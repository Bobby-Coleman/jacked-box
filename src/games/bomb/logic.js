// TICK TOCK BOOM: everyone's phone lies face-up on the table. The bomb lives on one
// phone at a time; its holder shouts something in the category and taps to throw it
// to a random phone. A hidden fuse decides who blows up. Three strikes and you're out.
import { BOMB_CATEGORIES } from '../../content/table.js';

const LIVES = 3;
const MIN_HOLD = 700;

function alive(ctx, g) {
  return g.pids.filter((p) => ctx.on(p) && (g.lives[p] || 0) > 0);
}

function nextRound(ctx, g) {
  g.round++;
  const live = alive(ctx, g);
  const cat = ctx.content(ctx.take('bomb', BOMB_CATEGORIES, 1, ctx.family)[0]);
  const holder = ctx.pick(live.length ? live : g.pids);
  g.r = { cat, holder, passes: 0, heldSince: 0, fuseAt: 0, fuseMs: 0, boom: null, prev: null };
  ctx.beat(g, 'ready', 4500);
  ctx.say(g.round === 1 ? 'bomb.start' : 'bomb.next');
}

function light(ctx, g) {
  const r = g.r;
  r.fuseMs = 16000 + Math.floor(Math.random() * 26000);
  r.fuseAt = ctx.now + r.fuseMs;
  r.lit = ctx.now;
  r.heldSince = ctx.now;
  // No visible timer: the fuse is a secret. The tick speeds up as it burns.
  ctx.beat(g, 'live', 0);
}

function pass(ctx, g) {
  const r = g.r;
  const live = alive(ctx, g).filter((p) => p !== r.holder);
  if (!live.length) return;
  let pool = live;
  if (live.length > 1 && r.prev) pool = live.filter((p) => p !== r.prev) || live;
  r.prev = r.holder;
  r.holder = ctx.pick(pool.length ? pool : live);
  r.passes++;
  r.heldSince = ctx.now;
  g.passes[r.prev] = (g.passes[r.prev] || 0) + 1;
}

function explode(ctx, g) {
  const r = g.r;
  r.boom = r.holder;
  g.lives[r.holder] = Math.max(0, (g.lives[r.holder] || 0) - 1);
  for (const p of g.pids) g.scores[p] = (g.lives[p] || 0) * 1000 + (g.passes[p] || 0) * 10;
  ctx.beat(g, 'boom', 6000);
  ctx.sayName('bomb.boom', r.holder);
}

export default {
  id: 'bomb',
  name: 'Tick Tock Boom',
  tagline: 'Phones on the table. Shout an answer, throw the bomb, pray it doesn’t blow up on you.',
  min: 3,
  max: 12,
  minutes: 8,
  tags: ['Table game', 'Loud', 'Fast'],
  rules: [
    'Everyone puts their phone face up on the table in front of them. Turn your volume up!',
    "When the bomb lands on your phone, shout something that fits the category, then tap your phone to throw it. No repeats!",
    `The fuse is secret. Whoever holds the bomb when it explodes loses a life. Lose all ${LIVES} and the game ends.`,
  ],
  setup(ctx, g) {
    g.round = 0;
    g.lives = Object.fromEntries(g.pids.map((p) => [p, LIVES]));
    g.passes = {};
    for (const p of g.pids) g.scores[p] = LIVES * 1000;
  },
  begin(ctx, g) {
    nextRound(ctx, g);
  },
  input(ctx, g, pid, d) {
    const r = g.r;
    if (!r) return;
    if (d.t === 'pass' && g.phase === 'live' && pid === r.holder && ctx.now - r.heldSince >= MIN_HOLD) pass(ctx, g);
    else if (d.t === 'go' && g.phase === 'ready') light(ctx, g);
  },
  tick(ctx, g) {
    const r = g.r;
    if (g.phase === 'ready') {
      if (ctx.due(g)) light(ctx, g);
    } else if (g.phase === 'live') {
      // If the holder drops off, hand the bomb to someone present.
      if (!ctx.on(r.holder)) pass(ctx, g);
      if (ctx.now >= r.fuseAt) explode(ctx, g);
    } else if (g.phase === 'boom') {
      if (ctx.due(g)) {
        const out = g.pids.some((p) => (g.lives[p] || 0) <= 0);
        if (out || g.round >= 10) {
          const survivor = g.pids.filter((p) => g.lives[p] > 0).sort((a, b) => g.lives[b] - g.lives[a])[0];
          const awards = [];
          if (survivor) awards.push({ pid: survivor, title: 'Bomb-proof', detail: `${g.lives[survivor]} ${g.lives[survivor] === 1 ? 'life' : 'lives'} left` });
          const thrower = Object.keys(g.passes).sort((a, b) => g.passes[b] - g.passes[a])[0];
          if (thrower) awards.push({ pid: thrower, title: 'Hot potato', detail: `Threw the bomb ${g.passes[thrower]} times` });
          ctx.end(g, { awards });
        } else nextRound(ctx, g);
      }
    }
  },
  skip(ctx, g) {
    if (g.phase === 'ready') light(ctx, g);
    else if (g.phase === 'live') explode(ctx, g);
    else g.until = ctx.now;
  },
  leave(ctx, g, pid) {
    g.pids = g.pids.filter((p) => p !== pid);
    if (g.r && g.r.holder === pid && g.phase === 'live') pass(ctx, g);
  },
  bot(g, pid) {
    const r = g.r;
    if (r && g.phase === 'live' && r.holder === pid) return { t: 'pass', step: g.step };
    return null;
  },
};
