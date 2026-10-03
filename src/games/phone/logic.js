// TELEPHONEY: drawing telephone (write -> draw -> describe -> draw ...).
// Each player starts a chain; chains rotate through the room; then we replay
// every chain step by step and laugh at how the message mutated.
import { PHONE_STARTERS } from '../../content/phone.js';
import { clean } from '../../engine/text.js';

export const PALETTE = ['#1d1611', '#ffffff', '#ff3b3b', '#ff8a1f', '#ffc928', '#19b66a', '#2f7bff', '#8b5cf6', '#ff7ac6', '#8a5a2b'];
const DUR = { write: 45000, draw: 75000, desc: 35000 };
export const ENTRY_MS = { text: 3400, draw: 4600 };

function kind(k) {
  return k === 0 ? 'write' : k % 2 === 1 ? 'draw' : 'desc';
}

function validDrawing(d) {
  return d && Array.isArray(d.s) && d.s.length > 0 && d.s.length < 2000 && d.s.every((st) => Array.isArray(st) && st.length >= 4 && st.length < 8000);
}

// Which chain does player j work on at step k?
export function chainFor(g, pid, k) {
  const j = g.order.indexOf(pid);
  if (j < 0) return -1;
  const n = g.order.length;
  return (((j - k) % n) + n) % n;
}

function startStep(ctx, g, k) {
  g.k = k;
  const kd = kind(k);
  ctx.phase(g, kd, DUR[kd]);
  ctx.say(kd === 'write' ? 'phone.write' : kd === 'draw' ? 'phone.draw' : 'phone.guess');
}

function stepDone(g, pid) {
  const c = chainFor(g, pid, g.k);
  return c >= 0 && g.chains[c].e[g.k] != null;
}

function closeStep(ctx, g) {
  const kd = kind(g.k);
  // Fill in anything missing so chains stay intact.
  g.order.forEach((pid) => {
    const c = chainFor(g, pid, g.k);
    if (g.chains[c].e[g.k] != null) return;
    if (kd === 'write') g.chains[c].e[g.k] = { p: pid, t: ctx.pick(PHONE_STARTERS), auto: 1 };
    else if (kd === 'desc') g.chains[c].e[g.k] = { p: pid, t: '(no idea)', auto: 1 };
    else g.chains[c].e[g.k] = { p: pid, b: null, auto: 1 };
  });
  if (g.k + 1 < g.steps) startStep(ctx, g, g.k + 1);
  else startReveal(ctx, g);
}

function startReveal(ctx, g) {
  g.ci = 0;
  g.ei = -1;
  g.likes = {};
  ctx.say('phone.reveal');
  nextEntry(ctx, g);
}

function nextEntry(ctx, g) {
  const chain = g.chains[g.ci];
  g.ei++;
  if (g.ei >= chain.e.length) {
    ctx.beat(g, 'chainEnd', 4500);
    return;
  }
  const e = chain.e[g.ei];
  if (e.t) ctx.read(e.t);
  ctx.beat(g, 'reveal', e.b !== undefined ? ENTRY_MS.draw : ENTRY_MS.text);
}

function finish(ctx, g) {
  // Likes become points: each like is worth 100 to the entry's author.
  const byAuthor = {};
  let bestDraw = null;
  let bestText = null;
  for (const [key, ids] of Object.entries(g.likes || {})) {
    const [c, e] = key.split('-').map(Number);
    const entry = g.chains[c] && g.chains[c].e[e];
    if (!entry) continue;
    byAuthor[entry.p] = (byAuthor[entry.p] || 0) + ids.length;
    ctx.award(g, entry.p, ids.length * 100);
    if (entry.b !== undefined) {
      if (!bestDraw || ids.length > bestDraw.n) bestDraw = { pid: entry.p, n: ids.length };
    } else if (!bestText || ids.length > bestText.n) bestText = { pid: entry.p, n: ids.length };
  }
  const awards = [];
  if (bestDraw) awards.push({ pid: bestDraw.pid, title: 'Most loved drawing', detail: `${bestDraw.n} like${bestDraw.n > 1 ? 's' : ''}` });
  if (bestText) awards.push({ pid: bestText.pid, title: 'Best caption', detail: `${bestText.n} like${bestText.n > 1 ? 's' : ''}` });
  ctx.end(g, { awards, note: 'Points come from likes. Tap the heart on your favorite moments next time!' });
}

export default {
  id: 'phone',
  name: 'Telephoney',
  tagline: 'Write it, draw it, guess it, pass it on. Watch your message fall apart.',
  min: 3,
  max: 10,
  minutes: 12,
  tags: ['Drawing', 'Chaos', 'No losers'],
  rules: [
    'Write a weird sentence. It gets passed to the next phone.',
    'Draw the sentence you receive. Then describe the drawing you receive. Repeat.',
    "At the end we replay every chain from start to finish. Tap the heart on your favorite moments.",
  ],
  ENTRY_MS,
  setup(ctx, g) {
    g.order = ctx.shuffle(ctx.live(g));
    const n = g.order.length;
    g.steps = n === 3 ? 4 : Math.min(n, 8);
    g.chains = g.order.map((p) => ({ by: p, e: [] }));
    g.k = 0;
  },
  begin(ctx, g) {
    startStep(ctx, g, 0);
  },
  anyStep(d) {
    return d.t === 'like';
  },
  input(ctx, g, pid, d) {
    const kd = g.phase;
    if (d.t === 'like' && (g.phase === 'reveal' || g.phase === 'chainEnd')) {
      const c = g.ci;
      const e = Math.min(d.e, g.ei);
      const entry = g.chains[c] && g.chains[c].e[e];
      if (!entry || entry.p === pid || d.c !== c) return;
      const key = `${c}-${e}`;
      const l = (g.likes[key] = g.likes[key] || []);
      if (!l.includes(pid)) l.push(pid);
      return;
    }
    if (!['write', 'draw', 'desc'].includes(kd) || d.t !== kd) return;
    const c = chainFor(g, pid, g.k);
    if (c < 0 || g.chains[c].e[g.k] != null) return;
    if (kd === 'draw') {
      if (!validDrawing(d.d)) return;
      g.chains[c].e[g.k] = { p: pid, b: ctx.blob({ v: 1, p: PALETTE, s: d.d.s }) };
    } else {
      const text = clean(d.text, 80);
      if (!text) return;
      g.chains[c].e[g.k] = { p: pid, t: text };
    }
  },
  tick(ctx, g) {
    const grace = 1200;
    if (['write', 'draw', 'desc'].includes(g.phase)) {
      if (ctx.now >= g.until + grace || ctx.allDone(g.order, (p) => stepDone(g, p))) closeStep(ctx, g);
    } else if (g.phase === 'reveal') {
      if (ctx.due(g)) nextEntry(ctx, g);
    } else if (g.phase === 'chainEnd') {
      if (ctx.due(g)) {
        if (g.ci + 1 < g.chains.length) {
          g.ci++;
          g.ei = -1;
          nextEntry(ctx, g);
        } else finish(ctx, g);
      }
    }
  },
  skip(ctx, g) {
    if (['write', 'draw', 'desc'].includes(g.phase)) closeStep(ctx, g);
    else g.until = ctx.now;
  },
  leave(ctx, g, pid) {
    g.pids = g.pids.filter((p) => p !== pid);
  },
  bot(g, pid) {
    const step = g.step;
    if (['write', 'draw', 'desc'].includes(g.phase) && !stepDone(g, pid)) {
      if (g.phase === 'draw') {
        const s = [[0, 1, 100, 100, 50, 50, 50, 50, 20, -40]];
        return { t: 'draw', d: { s }, step };
      }
      return { t: g.phase, text: g.phase + ' by ' + pid, step };
    }
    if (g.phase === 'reveal' && Math.random() < 0.3) return { t: 'like', c: g.ci, e: g.ei, step };
    return null;
  },
};
