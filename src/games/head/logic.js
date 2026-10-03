// FOREHEAD: one guesser holds their phone on their forehead, screen out.
// Everyone else sees the word on their own phone, shouts clues, and taps GOT IT or PASS.
import { HEAD_DECKS, HEAD_SPICY } from '../../content/table.js';

const TURN_MS = 60000;
const GAP = 450;

function decks(ctx) {
  return ctx.spicy ? { ...HEAD_DECKS, ...HEAD_SPICY } : HEAD_DECKS;
}

function nextTurn(ctx, g) {
  g.turn++;
  if (g.turn >= g.turns) {
    const best = Object.keys(g.got).sort((a, b) => g.got[b] - g.got[a])[0];
    ctx.end(g, { awards: best && g.got[best] ? [{ pid: best, title: 'Big brain energy', detail: `Guessed ${g.got[best]} in one minute` }] : [] });
    return;
  }
  let guesser = g.order[g.turn % g.order.length];
  for (let i = 0; i < g.order.length && !ctx.on(guesser); i++) guesser = g.order[(g.turn + i) % g.order.length];
  const all = decks(ctx);
  const names = Object.keys(all);
  const cat = names[(g.catSeed + g.turn) % names.length];
  const words = ctx.shuffle(all[cat]).slice(0, 30);
  g.t = { guesser, cat, words, i: 0, got: [], passed: [], last: 0 };
  ctx.phase(g, 'ready', 15000);
  ctx.sayName('head.next', guesser);
}

function advance(ctx, g, ok) {
  const t = g.t;
  if (ctx.now - t.last < GAP) return;
  t.last = ctx.now;
  (ok ? t.got : t.passed).push(t.i);
  if (ok) {
    ctx.award(g, t.guesser, 100);
    g.got[t.guesser] = (g.got[t.guesser] || 0) + 1;
  }
  t.i++;
  if (t.i >= t.words.length) endTurn(ctx, g);
}

function endTurn(ctx, g) {
  ctx.beat(g, 'turnEnd', 7000);
  ctx.say('head.time');
}

export default {
  id: 'head',
  name: 'Forehead',
  tagline: 'Phone on your forehead, friends yelling clues. Guess as many as you can in a minute.',
  min: 2,
  max: 12,
  minutes: 8,
  tags: ['Table game', 'Shouting', 'Act it out'],
  rules: [
    "When it's your turn, hold your phone on your forehead with the screen facing out.",
    'Everyone else sees the word on their own phone. Shout clues, act it out, but never say the word!',
    'Clue-givers tap GOT IT when you guess right, or PASS to skip. One minute per turn.',
  ],
  TURN_MS,
  setup(ctx, g) {
    g.order = ctx.shuffle(g.pids);
    g.turns = g.order.length === 2 ? 4 : Math.min(g.order.length, 8);
    g.turn = -1;
    g.got = {};
    g.catSeed = Math.floor(Math.random() * 50);
  },
  begin(ctx, g) {
    nextTurn(ctx, g);
  },
  input(ctx, g, pid, d) {
    const t = g.t;
    if (!t) return;
    if (d.t === 'start' && g.phase === 'ready' && pid === t.guesser) {
      ctx.beat(g, 'play', TURN_MS);
      t.last = ctx.now;
      ctx.say('head.go');
    } else if ((d.t === 'got' || d.t === 'pass') && g.phase === 'play' && d.i === t.i) {
      advance(ctx, g, d.t === 'got');
    }
  },
  tick(ctx, g) {
    if (g.phase === 'ready') {
      if (ctx.due(g)) {
        ctx.beat(g, 'play', TURN_MS);
        g.t.last = ctx.now;
        ctx.say('head.go');
      }
    } else if (g.phase === 'play') {
      if (ctx.due(g)) endTurn(ctx, g);
    } else if (g.phase === 'turnEnd') {
      if (ctx.due(g)) nextTurn(ctx, g);
    }
  },
  skip(ctx, g) {
    if (g.phase === 'play') endTurn(ctx, g);
    else if (g.phase === 'ready') {
      ctx.beat(g, 'play', TURN_MS);
      g.t.last = ctx.now;
    } else g.until = ctx.now;
  },
  leave(ctx, g, pid) {
    g.pids = g.pids.filter((p) => p !== pid);
    g.order = g.order.filter((p) => p !== pid);
    if (g.t && g.t.guesser === pid && g.phase !== 'turnEnd') endTurn(ctx, g);
  },
  bot(g, pid) {
    const t = g.t;
    if (!t) return null;
    if (g.phase === 'ready' && pid === t.guesser) return { t: 'start', step: g.step };
    if (g.phase === 'play' && pid !== t.guesser) return { t: Math.random() < 0.7 ? 'got' : 'pass', i: t.i, step: g.step };
    return null;
  },
};
