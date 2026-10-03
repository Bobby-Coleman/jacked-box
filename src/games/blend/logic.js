// BLEND IN: a fast Chameleon-style hidden-role game for a table of phones.
// Everyone sees a grid of 16 words with the secret word marked, except the
// Chameleon. Clues are spoken out loud in the order shown on everyone's phone.
import { BLEND_CARDS } from '../../content/blend.js';

const ROUNDS = 3;

function nextRound(ctx, g) {
  g.round++;
  const card = ctx.take('blend', BLEND_CARDS, 1, ctx.family)[0];
  const live = ctx.live(g);
  let pool = live.filter((p) => !g.cham.includes(p));
  if (!pool.length) pool = live;
  const cham = ctx.pick(pool);
  g.cham.push(cham);
  const order = ctx.shuffle(live);
  if (order[0] === cham && order.length > 1) order.push(order.shift());
  g.r = {
    topic: card.topic,
    words: card.words,
    wi: Math.floor(Math.random() * card.words.length),
    cham,
    order,
    turn: 0,
    ready: {},
    votes: {},
    accused: null,
    guess: null,
    outcome: null,
    pts: {},
  };
  ctx.phase(g, 'card', 15000);
  ctx.say('blend.card');
}

function startClues(ctx, g) {
  g.r.turn = 0;
  g.r.ready = {};
  ctx.phase(g, 'clues', 11000);
  ctx.say('blend.clues');
  ctx.read(`${ctx.name(g.r.order[0])} goes first.`);
}

function advanceTurn(ctx, g) {
  const r = g.r;
  r.turn++;
  // skip players who dropped out
  while (r.turn < r.order.length && !ctx.on(r.order[r.turn])) r.turn++;
  if (r.turn >= r.order.length) {
    r.ready = {};
    ctx.phase(g, 'discuss', 45000);
    ctx.say('blend.discuss');
  } else {
    ctx.phase(g, 'clues', 11000);
    ctx.read(ctx.name(r.order[r.turn]));
  }
}

function startVote(ctx, g) {
  g.r.votes = {};
  ctx.phase(g, 'vote', 30000);
  ctx.say('blend.vote');
}

function resolveVote(ctx, g) {
  const r = g.r;
  const tally = {};
  for (const t of Object.values(r.votes)) tally[t] = (tally[t] || 0) + 1;
  let top = null;
  let best = 0;
  let tie = false;
  for (const [pid, n] of Object.entries(tally)) {
    if (n > best) {
      best = n;
      top = pid;
      tie = false;
    } else if (n === best) tie = true;
  }
  r.tally = tally;
  r.accused = tie ? null : top;
  if (r.accused && r.accused === r.cham) {
    ctx.phase(g, 'guess', 25000);
    ctx.say('blend.caught');
  } else {
    r.outcome = 'escaped';
    finishRound(ctx, g);
  }
}

function finishRound(ctx, g) {
  const r = g.r;
  const pts = {};
  const add = (pid, n) => {
    pts[pid] = (pts[pid] || 0) + n;
    ctx.award(g, pid, n);
  };
  if (r.outcome === 'escaped') {
    add(r.cham, 1000);
    ctx.say('blend.escaped');
  } else if (r.outcome === 'guessed') {
    add(r.cham, 500);
    ctx.say('blend.win');
  } else {
    for (const pid of g.pids) if (pid !== r.cham) add(pid, 500);
    ctx.say('blend.lose');
  }
  for (const [voter, target] of Object.entries(r.votes)) if (target === r.cham && voter !== r.cham) add(voter, 250);
  r.pts = pts;
  ctx.beat(g, 'result', 9000);
}

export default {
  id: 'blend',
  name: 'Blend In',
  tagline: 'Everyone knows the secret word except the Chameleon. Catch the faker.',
  min: 3,
  max: 12,
  minutes: 8,
  tags: ['Hidden role', 'Talk it out', 'Quick'],
  rules: [
    'Everyone sees the same 16 words. The secret word is marked. One player, the Chameleon, sees no mark.',
    'Go around the table in the order on your phone. Say ONE word out loud that hints at the secret word.',
    'Then argue, vote, and catch the Chameleon. If caught, the Chameleon can still win by guessing the word.',
  ],
  setup(ctx, g) {
    g.round = 0;
    g.rounds = ROUNDS;
    g.cham = [];
  },
  begin(ctx, g) {
    nextRound(ctx, g);
  },
  input(ctx, g, pid, d) {
    const r = g.r;
    if (!r) return;
    switch (d.t) {
      case 'ready':
        if (g.phase === 'card' || g.phase === 'discuss') r.ready[pid] = 1;
        break;
      case 'next':
        // The current speaker (or anyone, if they're stalling) moves the turn along.
        if (g.phase === 'clues') advanceTurn(ctx, g);
        break;
      case 'vote':
        if (g.phase === 'vote' && d.p !== pid && g.pids.includes(d.p)) r.votes[pid] = d.p;
        break;
      case 'guess':
        if (g.phase === 'guess' && pid === r.cham && Number.isInteger(d.w) && d.w >= 0 && d.w < r.words.length) {
          r.guess = d.w;
          r.outcome = d.w === r.wi ? 'guessed' : 'caught';
          finishRound(ctx, g);
        }
        break;
      default:
        break;
    }
  },
  tick(ctx, g) {
    const r = g.r;
    switch (g.phase) {
      case 'card':
        if (ctx.due(g) || ctx.allDone(g.pids, (p) => r.ready[p])) startClues(ctx, g);
        break;
      case 'clues':
        if (ctx.due(g) || !ctx.on(r.order[r.turn])) advanceTurn(ctx, g);
        break;
      case 'discuss': {
        const live = ctx.live(g);
        const ready = live.filter((p) => r.ready[p]).length;
        if (ctx.due(g) || ready >= Math.max(2, Math.ceil(live.length * 0.6))) startVote(ctx, g);
        break;
      }
      case 'vote':
        if (ctx.due(g) || ctx.allDone(g.pids, (p) => r.votes[p])) resolveVote(ctx, g);
        break;
      case 'guess':
        if (ctx.due(g) || !ctx.on(r.cham)) {
          r.outcome = 'caught';
          finishRound(ctx, g);
        }
        break;
      case 'result':
        if (ctx.due(g)) {
          if (g.round >= g.rounds) ctx.end(g);
          else nextRound(ctx, g);
        }
        break;
      default:
        break;
    }
  },
  skip(ctx, g) {
    if (g.phase === 'clues') advanceTurn(ctx, g);
    else g.until = ctx.now;
  },
  leave(ctx, g, pid) {
    g.pids = g.pids.filter((p) => p !== pid);
    if (g.r && g.r.cham === pid && g.phase !== 'result') {
      g.r.outcome = 'caught';
      finishRound(ctx, g);
    }
  },
  bot(g, pid) {
    const r = g.r;
    if (!r) return null;
    const step = g.step;
    if ((g.phase === 'card' || g.phase === 'discuss') && !r.ready[pid]) return { t: 'ready', step };
    if (g.phase === 'clues' && r.order[r.turn] === pid) return { t: 'next', step };
    if (g.phase === 'vote' && !r.votes[pid]) {
      const others = g.pids.filter((p) => p !== pid);
      return { t: 'vote', p: others[Math.floor(Math.random() * others.length)], step };
    }
    if (g.phase === 'guess' && pid === r.cham) return { t: 'guess', w: Math.floor(Math.random() * 16), step };
    return null;
  },
};
