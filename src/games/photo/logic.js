// PHOTOBOMB: everyone gets a scene starring two friends. Their selfies become face
// stickers on your canvas; draw the rest of the scene around (and on top of) them.
// Then the room tours the gallery and votes for favorites.
import { PHOTO_SCENES } from '../../content/faces.js';

export const PALETTE = ['#1d1611', '#ffffff', '#ff3b3b', '#ff8a1f', '#ffc928', '#19b66a', '#2f7bff', '#8b5cf6', '#ff7ac6', '#8a5a2b'];
export const GALLERY_MS = 7500;

export function sceneText(tpl, nameA, nameB) {
  return String(tpl || '').replace(/\{A\}/g, nameA).replace(/\{B\}/g, nameB);
}

function validDrawing(d) {
  if (!d || !Array.isArray(d.s) || d.s.length > 2000) return false;
  if (!d.s.every((st) => Array.isArray(st) && st.length >= 4 && st.length < 8000)) return false;
  if (d.k && (!Array.isArray(d.k) || d.k.length > 2)) return false;
  return true;
}

function cleanStickers(k) {
  return (k || [])
    .filter((x) => x && (x.who === 'a' || x.who === 'b'))
    .map((x) => ({
      who: x.who,
      x: Math.max(0, Math.min(1000, Math.round(Number(x.x) || 500))),
      y: Math.max(0, Math.min(1000, Math.round(Number(x.y) || 500))),
      z: Math.max(100, Math.min(800, Math.round(Number(x.z) || 320))),
      r: Math.round(Number(x.r) || 0) % 360,
    }));
}

function startDraw(ctx, g) {
  g.round++;
  const order = ctx.shuffle(ctx.live(g));
  const n = order.length;
  const scenes = ctx.take('photo', PHOTO_SCENES, n, ctx.family).map(ctx.content);
  g.art = {};
  order.forEach((pid, i) => {
    g.art[pid] = { tpl: scenes[i], a: order[(i + 1) % n], b: order[(i + 2) % n], blob: null };
  });
  ctx.phase(g, 'draw', 100000);
  ctx.say('photo.draw');
}

function startGallery(ctx, g) {
  g.queue = ctx.shuffle(Object.keys(g.art).filter((p) => g.art[p].blob));
  g.gi = -1;
  if (!g.queue.length) {
    finishRound(ctx, g);
    return;
  }
  ctx.say('photo.gallery');
  nextPiece(ctx, g);
}

function nextPiece(ctx, g) {
  g.gi++;
  if (g.gi >= g.queue.length) {
    g.votes = {};
    ctx.phase(g, 'vote', 40000);
    ctx.say('photo.vote');
    return;
  }
  const artist = g.queue[g.gi];
  const a = g.art[artist];
  ctx.sayName('photo.by', artist);
  ctx.beat(g, 'gallery', GALLERY_MS);
}

function reveal(ctx, g) {
  const tally = {};
  for (const picks of Object.values(g.votes || {})) for (const p of picks) tally[p] = (tally[p] || 0) + 1;
  g.tally = tally;
  for (const [artist, n] of Object.entries(tally)) {
    ctx.award(g, artist, n * 500);
    g.fame = g.fame || {};
    const art = g.art[artist];
    if (art) {
      g.fame[art.a] = (g.fame[art.a] || 0) + n;
      g.fame[art.b] = (g.fame[art.b] || 0) + n;
    }
    g.totals[artist] = (g.totals[artist] || 0) + n;
  }
  ctx.beat(g, 'reveal', 9000);
  ctx.say('photo.reveal');
}

function finishRound(ctx, g) {
  if (g.round < g.rounds) startDraw(ctx, g);
  else {
    const awards = [];
    const best = Object.keys(g.totals).sort((a, b) => g.totals[b] - g.totals[a])[0];
    if (best && g.totals[best]) awards.push({ pid: best, title: 'Gallery favorite', detail: `${g.totals[best]} votes for their art` });
    const fame = g.fame || {};
    const face = Object.keys(fame).sort((a, b) => fame[b] - fame[a])[0];
    if (face && fame[face]) awards.push({ pid: face, title: 'Face of the night', detail: 'Starred in the most-loved drawings' });
    ctx.end(g, { awards });
  }
}

export default {
  id: 'photo',
  name: 'Photobomb',
  tagline: "Your friends' faces become stickers. Draw them into ridiculous scenes.",
  min: 3,
  max: 10,
  minutes: 10,
  tags: ['Faces', 'Drawing', 'Voting'],
  faces: true,
  rules: [
    "You'll get a scene starring two friends, like \"Sam and Riley robbing a bank\". Their selfies are stickers on your canvas.",
    'Drag, resize and rotate the faces, then draw the rest of the scene around them. Draw on top of them too: hats, mustaches, wings.',
    'Then everyone tours the gallery and votes for their two favorites. No selfie? Your box avatar stands in.',
  ],
  setup(ctx, g) {
    g.round = 0;
    g.rounds = g.pids.length <= 4 ? 2 : 1;
    g.totals = {};
  },
  begin(ctx, g) {
    startDraw(ctx, g);
  },
  input(ctx, g, pid, d) {
    if (d.t === 'draw' && g.phase === 'draw') {
      const a = g.art[pid];
      if (!a || a.blob || !validDrawing(d.d)) return;
      a.blob = ctx.blob({ v: 1, p: PALETTE, s: d.d.s, k: cleanStickers(d.d.k) });
    } else if (d.t === 'vote' && g.phase === 'vote') {
      const picks = Array.isArray(d.picks) ? [...new Set(d.picks)].filter((p) => p !== pid && g.art[p] && g.art[p].blob).slice(0, 2) : [];
      if (picks.length) g.votes[pid] = picks;
    }
  },
  tick(ctx, g) {
    const grace = 1500;
    if (g.phase === 'draw') {
      if (ctx.now >= g.until + grace || ctx.allDone(Object.keys(g.art), (p) => g.art[p].blob)) startGallery(ctx, g);
    } else if (g.phase === 'gallery') {
      if (ctx.due(g)) nextPiece(ctx, g);
    } else if (g.phase === 'vote') {
      if (ctx.due(g) || ctx.allDone(g.pids, (p) => g.votes[p] || !g.queue.some((q) => q !== p))) reveal(ctx, g);
    } else if (g.phase === 'reveal') {
      if (ctx.due(g)) finishRound(ctx, g);
    }
  },
  skip(ctx, g) {
    if (g.phase === 'draw') startGallery(ctx, g);
    else if (g.phase === 'vote') reveal(ctx, g);
    else g.until = ctx.now;
  },
  leave(ctx, g, pid) {
    g.pids = g.pids.filter((p) => p !== pid);
  },
  bot(g, pid) {
    const step = g.step;
    if (g.phase === 'draw' && g.art[pid] && !g.art[pid].blob) {
      const s = [];
      for (let k = 0; k < 5; k++) {
        const st = [Math.floor(Math.random() * 8), 1, 100 + Math.floor(Math.random() * 800), 550 + Math.floor(Math.random() * 300)];
        for (let i = 0; i < 18; i++) st.push(Math.floor(Math.random() * 30) - 15, Math.floor(Math.random() * 30) - 15);
        s.push(st);
      }
      return { t: 'draw', d: { s, k: [{ who: 'a', x: 320, y: 360, z: 330, r: -6 }, { who: 'b', x: 690, y: 360, z: 330, r: 8 }] }, step };
    }
    if (g.phase === 'vote' && !g.votes[pid]) {
      const others = g.queue.filter((p) => p !== pid);
      if (others.length) return { t: 'vote', picks: others.sort(() => Math.random() - 0.5).slice(0, 2), step };
    }
    return null;
  },
};
