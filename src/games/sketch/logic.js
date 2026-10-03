// SKETCHY: draw a secret prompt; everyone else invents fake titles for it;
// then everyone tries to pick the real title out of the lies (Drawful-style).
import { SKETCH_PROMPTS } from '../../content/sketch.js';
import { clean, similar } from '../../engine/text.js';

export const INKS = ['#1d1611'];
export const COLORS = ['#ff3b3b', '#2f7bff', '#19b66a', '#ffb000', '#ff7ac6', '#8b5cf6', '#00b8c4', '#ff8a1f', '#7a4a1e'];
const REVEAL_STEP = 2300;

function validDrawing(d) {
  return d && Array.isArray(d.s) && Array.isArray(d.p) && d.s.length > 0 && d.s.length < 2000 && d.s.every((st) => Array.isArray(st) && st.length >= 4 && st.length < 8000);
}

function startDraw(ctx, g) {
  g.round++;
  const live = ctx.live(g);
  const prompts = ctx.take('sketch', SKETCH_PROMPTS, live.length, ctx.family).map(ctx.content);
  g.art = {};
  live.forEach((pid, i) => {
    const cols = ctx.shuffle(COLORS).slice(0, 2);
    g.art[pid] = { prompt: prompts[i], pal: [INKS[0], ...cols], blob: null };
  });
  ctx.phase(g, 'draw', 85000);
  ctx.say('sketch.draw');
}

function startQueue(ctx, g) {
  g.queue = ctx.shuffle(Object.keys(g.art).filter((pid) => g.art[pid].blob));
  g.qi = -1;
  nextArt(ctx, g);
}

function nextArt(ctx, g) {
  g.qi++;
  if (g.qi >= g.queue.length) {
    if (g.round < g.rounds) startDraw(ctx, g);
    else ctx.end(g, { awards: awards(g) });
    return;
  }
  const artist = g.queue[g.qi];
  const a = g.art[artist];
  g.cur = { artist, prompt: a.prompt, blob: a.blob, lies: {}, rej: {}, opts: [], picks: {}, likes: {}, pts: {} };
  ctx.phase(g, 'lie', 45000);
  ctx.say('sketch.title');
}

function guessers(g) {
  return g.pids.filter((p) => p !== g.cur.artist);
}

function startPick(ctx, g) {
  const c = g.cur;
  const opts = [{ id: 'T', text: c.prompt, by: [] }];
  for (const [pid, text] of Object.entries(c.lies)) {
    const same = opts.find((o) => o.id !== 'T' && similar(o.text, text));
    if (same) same.by.push(pid);
    else opts.push({ id: 'L' + opts.length, text, by: [pid] });
  }
  c.opts = ctx.shuffle(opts);
  ctx.phase(g, 'pick', 25000);
  ctx.say('sketch.choose');
}

function reveal(ctx, g) {
  const c = g.cur;
  const pts = {};
  const add = (pid, n) => {
    pts[pid] = (pts[pid] || 0) + n;
    ctx.award(g, pid, n);
  };
  g.stats = g.stats || {};
  const st = (pid) => (g.stats[pid] = g.stats[pid] || { fooled: 0, found: 0, art: 0 });
  for (const [pid, oid] of Object.entries(c.picks)) {
    const o = c.opts.find((x) => x.id === oid);
    if (!o) continue;
    if (o.id === 'T') {
      add(pid, 1000);
      add(c.artist, 500);
      st(pid).found++;
      st(c.artist).art++;
    } else {
      for (const author of o.by) {
        if (author !== pid) {
          add(author, 500);
          st(author).fooled++;
        }
      }
    }
  }
  c.pts = pts;
  // Reveal lies (picked ones first), truth last.
  const lies = c.opts.filter((o) => o.id !== 'T');
  const pickedCount = (o) => Object.values(c.picks).filter((v) => v === o.id).length;
  lies.sort((a, b) => pickedCount(a) - pickedCount(b));
  c.revealOrder = lies.filter((o) => pickedCount(o) > 0 || lies.length <= 4).map((o) => o.id).concat(['T']);
  ctx.beat(g, 'reveal', 1500 + c.revealOrder.length * REVEAL_STEP + 2500);
  ctx.say('sketch.reveal');
}

function awards(g) {
  const s = g.stats || {};
  const ids = Object.keys(s);
  const out = [];
  if (!ids.length) return out;
  const liar = ids.slice().sort((a, b) => s[b].fooled - s[a].fooled)[0];
  if (s[liar].fooled) out.push({ pid: liar, title: 'Master of lies', detail: `Fooled people ${s[liar].fooled} time${s[liar].fooled > 1 ? 's' : ''}` });
  const art = ids.slice().sort((a, b) => s[b].art - s[a].art)[0];
  if (s[art].art) out.push({ pid: art, title: 'Actually good artist', detail: `${s[art].art} correct guess${s[art].art > 1 ? 'es' : ''} on their art` });
  return out;
}

export default {
  id: 'sketch',
  name: 'Sketchy',
  tagline: 'Draw something weird. Write fake titles for everyone else’s art. Spot the real one.',
  min: 3,
  max: 8,
  minutes: 12,
  tags: ['Drawing', 'Bluffing'],
  rules: [
    'Everyone gets a secret, weird prompt. Draw it on your phone.',
    "For each drawing, make up a fake title good enough to fool everyone else.",
    "Then find the real title. Points for finding the truth, and for every friend your lie fooled.",
  ],
  REVEAL_STEP,
  setup(ctx, g) {
    g.round = 0;
    g.rounds = g.pids.length <= 4 ? 2 : 1;
    g.stats = {};
  },
  begin(ctx, g) {
    startDraw(ctx, g);
  },
  input(ctx, g, pid, d) {
    if (d.t === 'draw' && g.phase === 'draw') {
      const a = g.art[pid];
      if (a && !a.blob && validDrawing(d.d)) a.blob = ctx.blob({ v: 1, p: a.pal, s: d.d.s });
    } else if (d.t === 'lie' && g.phase === 'lie' && pid !== g.cur.artist) {
      const text = clean(d.text, 60);
      if (!text || g.cur.lies[pid]) return;
      if (similar(text, g.cur.prompt)) {
        g.cur.rej[pid] = (g.cur.rej[pid] || 0) + 1;
        return;
      }
      g.cur.lies[pid] = text;
    } else if (d.t === 'pick' && g.phase === 'pick' && pid !== g.cur.artist) {
      const o = g.cur.opts.find((x) => x.id === d.o);
      if (o && !o.by.includes(pid)) g.cur.picks[pid] = o.id;
    } else if (d.t === 'like' && (g.phase === 'pick' || g.phase === 'reveal')) {
      const o = g.cur.opts.find((x) => x.id === d.o);
      if (o && !o.by.includes(pid)) {
        const l = (g.cur.likes[o.id] = g.cur.likes[o.id] || []);
        if (!l.includes(pid)) l.push(pid);
      }
    }
  },
  anyStep(d) {
    return d.t === 'like';
  },
  tick(ctx, g) {
    const grace = 1200;
    switch (g.phase) {
      case 'draw':
        if (ctx.now >= g.until + grace || ctx.allDone(Object.keys(g.art), (p) => g.art[p].blob)) startQueue(ctx, g);
        break;
      case 'lie':
        if (ctx.now >= g.until + grace || ctx.allDone(guessers(g), (p) => g.cur.lies[p])) startPick(ctx, g);
        break;
      case 'pick':
        if (ctx.due(g) || ctx.allDone(guessers(g), (p) => g.cur.picks[p])) reveal(ctx, g);
        break;
      case 'reveal':
        if (ctx.due(g)) nextArt(ctx, g);
        break;
      default:
        break;
    }
  },
  skip(ctx, g) {
    if (g.phase === 'draw') startQueue(ctx, g);
    else if (g.phase === 'lie') startPick(ctx, g);
    else if (g.phase === 'pick') reveal(ctx, g);
    else g.until = ctx.now;
  },
  leave(ctx, g, pid) {
    g.pids = g.pids.filter((p) => p !== pid);
  },
  bot(g, pid) {
    const step = g.step;
    if (g.phase === 'draw' && g.art[pid] && !g.art[pid].blob) {
      const s = [];
      for (let k = 0; k < 6; k++) {
        const st = [Math.floor(Math.random() * 3), 1, Math.floor(Math.random() * 900), Math.floor(Math.random() * 900)];
        for (let i = 0; i < 20; i++) st.push(Math.floor(Math.random() * 20) - 10, Math.floor(Math.random() * 20) - 10);
        s.push(st);
      }
      return { t: 'draw', d: { v: 1, p: ['#000'], s }, step };
    }
    if (g.phase === 'lie' && pid !== g.cur.artist && !g.cur.lies[pid]) return { t: 'lie', text: 'fake title ' + Math.floor(Math.random() * 1000), step };
    if (g.phase === 'pick' && pid !== g.cur.artist && !g.cur.picks[pid]) {
      const opts = g.cur.opts.filter((o) => !o.by.includes(pid));
      if (opts.length) return { t: 'pick', o: opts[Math.floor(Math.random() * opts.length)].id, step };
    }
    return null;
  },
};
