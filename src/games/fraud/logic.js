// ART FRAUD: one shared canvas. Everyone knows the secret word except the Fraud, who
// only knows the topic. Take turns adding ONE stroke each, in your own color. Then
// vote out the Fraud. If caught, the Fraud can still steal it by guessing the word.
import { BLEND_CARDS } from '../../content/blend.js';
import { similar } from '../../engine/text.js';

const TURN_MS = 25000;
const MAX_STROKE = 1200;

function nextRound(ctx, g) {
  g.round++;
  const card = ctx.take('fraud', BLEND_CARDS, 1, ctx.family)[0];
  const live = ctx.live(g);
  let pool = live.filter((p) => !g.frauds.includes(p));
  if (!pool.length) pool = live;
  const fraud = ctx.pick(pool);
  g.frauds.push(fraud);
  const order = ctx.shuffle(live);
  // The Fraud never goes first: they get to see a stroke or two before committing.
  if (order[0] === fraud && order.length > 1) order.push(order.shift());
  g.r = {
    topic: card.topic,
    word: ctx.pick(card.words),
    fraud,
    order,
    palette: order.map((p) => (ctx.s.players[p] && ctx.s.players[p].color) || '#1d1611'),
    laps: order.length <= 6 ? 2 : 1,
    turn: -1,
    strokes: [],
    ready: {},
    votes: {},
    accused: null,
    guess: null,
    outcome: null,
    pts: {},
  };
  ctx.phase(g, 'peek', 12000);
  ctx.say('fraud.peek');
}

function totalTurns(r) {
  return r.order.length * r.laps;
}

function drawer(r) {
  return r.order[r.turn % r.order.length];
}

function nextTurn(ctx, g) {
  const r = g.r;
  r.turn++;
  while (r.turn < totalTurns(r) && !ctx.on(drawer(r))) r.turn++;
  if (r.turn >= totalTurns(r)) {
    r.votes = {};
    ctx.phase(g, 'vote', 40000);
    ctx.say('fraud.vote');
    return;
  }
  ctx.phase(g, 'draw', TURN_MS);
  if (r.turn === 0) ctx.say('fraud.draw');
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
  if (r.accused && r.accused === r.fraud && ctx.on(r.fraud)) {
    ctx.phase(g, 'guess', 25000);
    ctx.say('fraud.caught');
  } else {
    r.outcome = r.accused === r.fraud ? 'caught' : 'escaped';
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
    add(r.fraud, 1000);
    ctx.say('fraud.escaped');
  } else if (r.outcome === 'guessed') {
    add(r.fraud, 500);
    ctx.say('fraud.stole');
  } else {
    for (const pid of g.pids) if (pid !== r.fraud) add(pid, 500);
    ctx.say('fraud.busted');
  }
  for (const [voter, target] of Object.entries(r.votes)) if (target === r.fraud && voter !== r.fraud) add(voter, 250);
  r.pts = pts;
  ctx.beat(g, 'result', 9000);
}

function validStroke(st) {
  if (!Array.isArray(st) || st.length < 4 || st.length > MAX_STROKE) return false;
  return st.every((n) => Number.isFinite(n) && Math.abs(n) <= 1000);
}

export default {
  id: 'fraud',
  name: 'Art Fraud',
  tagline: 'One canvas, one stroke each. One of you has no idea what you are all drawing.',
  min: 4,
  max: 10,
  minutes: 9,
  tags: ['Hidden role', 'Drawing', 'Talk it out'],
  rules: [
    'Everyone sees the secret word except the Fraud, who only knows the topic.',
    'Take turns adding ONE stroke to the shared canvas, in your color. Be clear enough to prove you know the word, vague enough to keep the Fraud guessing.',
    'Then vote out the Fraud. If caught, the Fraud can still win by guessing the word.',
  ],
  setup(ctx, g) {
    g.round = 0;
    g.rounds = g.pids.length <= 5 ? 3 : 2;
    g.frauds = [];
  },
  begin(ctx, g) {
    nextRound(ctx, g);
  },
  input(ctx, g, pid, d) {
    const r = g.r;
    if (!r) return;
    switch (d.t) {
      case 'ready':
        if (g.phase === 'peek') r.ready[pid] = 1;
        break;
      case 'stroke': {
        if (g.phase !== 'draw' || drawer(r) !== pid || !validStroke(d.st)) return;
        const st = d.st.map((n) => Math.round(n));
        st[0] = r.order.indexOf(pid);
        st[1] = Math.max(0, Math.min(2, st[1] | 0));
        st[2] = Math.max(0, Math.min(1000, st[2]));
        st[3] = Math.max(0, Math.min(1000, st[3]));
        r.strokes.push({ by: pid, b: ctx.blob({ st }) });
        nextTurn(ctx, g);
        break;
      }
      case 'pass':
        if (g.phase === 'draw' && drawer(r) === pid) nextTurn(ctx, g);
        break;
      case 'vote':
        if (g.phase === 'vote' && d.p !== pid && r.order.includes(d.p)) r.votes[pid] = d.p;
        break;
      case 'guess':
        if (g.phase === 'guess' && pid === r.fraud && typeof d.text === 'string' && r.guess == null) {
          r.guess = d.text.slice(0, 40);
          r.outcome = similar(r.guess, r.word) ? 'guessed' : 'caught';
          finishRound(ctx, g);
        }
        break;
      default:
        break;
    }
  },
  tick(ctx, g) {
    const r = g.r;
    if (g.phase === 'peek') {
      if (ctx.due(g) || ctx.allDone(r.order, (p) => r.ready[p])) nextTurn(ctx, g);
    } else if (g.phase === 'draw') {
      if (ctx.now >= g.until + 1000 || !ctx.on(drawer(r))) nextTurn(ctx, g);
    } else if (g.phase === 'vote') {
      if (ctx.due(g) || ctx.allDone(r.order, (p) => r.votes[p])) resolveVote(ctx, g);
    } else if (g.phase === 'guess') {
      if (ctx.now >= g.until + 1500 || !ctx.on(r.fraud)) {
        r.outcome = 'caught';
        finishRound(ctx, g);
      }
    } else if (g.phase === 'result') {
      if (ctx.due(g)) {
        if (g.round >= g.rounds) {
          const awards = [];
          const ids = Object.keys(g.scores).sort((a, b) => g.scores[b] - g.scores[a]);
          if (ids[0] && g.scores[ids[0]]) awards.push({ pid: ids[0], title: 'Master forger', detail: 'Top of the gallery' });
          ctx.end(g, { awards });
        } else nextRound(ctx, g);
      }
    }
  },
  skip(ctx, g) {
    if (g.phase === 'peek' || g.phase === 'draw') nextTurn(ctx, g);
    else if (g.phase === 'vote') resolveVote(ctx, g);
    else if (g.phase === 'guess') {
      g.r.outcome = 'caught';
      finishRound(ctx, g);
    } else g.until = ctx.now;
  },
  leave(ctx, g, pid) {
    g.pids = g.pids.filter((p) => p !== pid);
  },
  bot(g, pid) {
    const r = g.r;
    const step = g.step;
    if (!r) return null;
    if (g.phase === 'peek' && !r.ready[pid]) return { t: 'ready', step };
    if (g.phase === 'draw' && drawer(r) === pid) {
      const st = [0, 1, 200 + Math.floor(Math.random() * 600), 200 + Math.floor(Math.random() * 600)];
      for (let i = 0; i < 14; i++) st.push(Math.floor(Math.random() * 60) - 30, Math.floor(Math.random() * 60) - 30);
      return { t: 'stroke', st, step };
    }
    if (g.phase === 'vote' && !r.votes[pid]) {
      const others = r.order.filter((p) => p !== pid);
      return { t: 'vote', p: others[Math.floor(Math.random() * others.length)], step };
    }
    if (g.phase === 'guess' && pid === r.fraud) return { t: 'guess', text: Math.random() < 0.5 ? r.word : 'banana', step };
    return null;
  },
};
