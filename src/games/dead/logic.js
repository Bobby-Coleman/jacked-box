// DEAD LIFT: trivia in a haunted gym (Trivia Murder Party-style).
// Wrong answers send you to the Killing Floor for a quick phone mini-game.
// Lose it and you're a ghost: you keep playing, but start the final escape behind.
import { DEAD_TRIVIA, DEAD_TF } from '../../content/dead.js';

const QUESTIONS = 7;
const FINAL_ROUNDS = 6;
export const EXIT = 6;
export const SYMBOLS = ['★', '●', '▲', '■', '♥', '◆'];
export const FLOOR_KINDS = ['lockers', 'math', 'memory', 'taps'];
export const TAP_TARGET = 35;
export const MEMORY_SHOW = 3800;

function nextQuestion(ctx, g) {
  g.qn++;
  if (g.qn >= QUESTIONS) {
    startFinal(ctx, g);
    return;
  }
  const t = ctx.take('dead', DEAD_TRIVIA, 1)[0];
  const order = ctx.shuffle([0, 1, 2, 3]);
  g.q = { q: t.q, opts: order.map((i) => t.o[i]), correct: order.indexOf(0), ans: {}, pts: {} };
  ctx.phase(g, 'question', 20000);
  ctx.read(t.q);
}

function revealQuestion(ctx, g) {
  const q = g.q;
  q.right = [];
  q.wrong = [];
  for (const pid of g.pids) {
    if (!ctx.exists(pid)) continue;
    if (q.ans[pid] === q.correct) {
      q.right.push(pid);
      const p = g.dead[pid] ? 500 : 1000;
      q.pts[pid] = p;
      ctx.award(g, pid, p);
    } else if (!g.dead[pid] && ctx.on(pid)) {
      q.wrong.push(pid);
    }
  }
  ctx.beat(g, 'qreveal', 4500);
}

function makeFloor(ctx, g, victims) {
  let kinds = FLOOR_KINDS.filter((k) => k !== g.lastFloor);
  const kind = ctx.pick(kinds);
  g.lastFloor = kind;
  const f = { kind, victims, died: [], data: {}, res: {} };
  if (kind === 'lockers') {
    f.n = 3;
    f.bad = Math.floor(Math.random() * 3);
  } else if (kind === 'math') {
    f.probs = [];
    for (let k = 0; k < 3; k++) {
      const op = ctx.pick(['+', '-', '×']);
      let a;
      let b;
      let ans;
      if (op === '×') {
        a = 3 + Math.floor(Math.random() * 7);
        b = 3 + Math.floor(Math.random() * 7);
        ans = a * b;
      } else if (op === '+') {
        a = 12 + Math.floor(Math.random() * 60);
        b = 12 + Math.floor(Math.random() * 60);
        ans = a + b;
      } else {
        a = 40 + Math.floor(Math.random() * 60);
        b = 5 + Math.floor(Math.random() * 35);
        ans = a - b;
      }
      const opts = new Set([ans]);
      while (opts.size < 4) {
        const off = (Math.floor(Math.random() * 6) + 1) * (Math.random() < 0.5 ? -1 : 1) * (op === '×' ? 1 : Math.random() < 0.5 ? 1 : 10);
        if (ans + off > 0) opts.add(ans + off);
      }
      f.probs.push({ a, b, op, ans, opts: ctx.shuffle([...opts]) });
    }
  } else if (kind === 'memory') {
    f.seq = Array.from({ length: 5 }, () => Math.floor(Math.random() * SYMBOLS.length));
  } else if (kind === 'taps') {
    f.goAt = ctx.now + 4200;
    f.window = 6000;
    f.target = TAP_TARGET;
  }
  return f;
}

function startFloor(ctx, g) {
  const victims = g.q.wrong.filter((p) => ctx.on(p));
  if (!victims.length) {
    nextQuestion(ctx, g);
    return;
  }
  g.f = makeFloor(ctx, g, victims);
  const dur = { lockers: 13000, math: 20000, memory: 18000, taps: 0 }[g.f.kind];
  if (g.f.kind === 'taps') ctx.beat(g, 'floor', g.f.goAt + g.f.window + 1500 - ctx.now);
  else ctx.phase(g, 'floor', dur);
  ctx.say('dead.floor');
  ctx.say('dead.' + g.f.kind);
}

function resolveFloor(ctx, g) {
  const f = g.f;
  for (const pid of f.victims) {
    const r = f.res[pid];
    let dies = false;
    if (f.kind === 'lockers') dies = r === undefined || r === f.bad;
    else if (f.kind === 'math') dies = !r || f.probs.some((p, k) => p.opts[r[k]] !== p.ans);
    else if (f.kind === 'memory') dies = !Array.isArray(r) || r.length !== f.seq.length || r.some((x, k) => x !== f.seq[k]);
    else if (f.kind === 'taps') dies = !(r >= f.target);
    if (dies) {
      f.died.push(pid);
      g.dead[pid] = true;
    }
  }
  ctx.beat(g, 'floorResult', 5500);
  ctx.say(f.died.length ? 'dead.died' : 'dead.survived');
}

function floorDone(ctx, g) {
  const f = g.f;
  return f.victims.every((p) => !ctx.on(p) || f.res[p] !== undefined);
}

function startFinal(ctx, g) {
  g.pos = {};
  for (const pid of g.pids) g.pos[pid] = g.dead[pid] ? 0 : 1;
  g.fr = 0;
  g.tfq = ctx.take('dead-tf', DEAD_TF, FINAL_ROUNDS);
  ctx.beat(g, 'finalIntro', 7000);
  ctx.say('dead.final');
}

function nextTF(ctx, g) {
  if (g.fr >= FINAL_ROUNDS || g.pids.some((p) => g.pos[p] >= EXIT)) {
    finish(ctx, g);
    return;
  }
  g.tf = { q: g.tfq[g.fr].q, a: g.tfq[g.fr].a, ans: {} };
  g.fr++;
  ctx.phase(g, 'tf', 10000);
  ctx.read(g.tf.q);
}

function revealTF(ctx, g) {
  const tf = g.tf;
  tf.right = [];
  for (const pid of g.pids) {
    if (tf.ans[pid] === tf.a) {
      tf.right.push(pid);
      g.pos[pid] = Math.min(EXIT, (g.pos[pid] || 0) + 1);
    }
  }
  ctx.beat(g, 'tfreveal', 3800);
}

function finish(ctx, g) {
  const ids = g.pids.filter((p) => ctx.exists(p));
  ids.sort((a, b) => (g.pos[b] || 0) - (g.pos[a] || 0) || (g.scores[b] || 0) - (g.scores[a] || 0));
  const winner = ids[0];
  const escaped = ids.filter((p) => g.pos[p] >= EXIT);
  for (const p of escaped) if (p !== winner) ctx.award(g, p, 1500);
  if (winner) ctx.award(g, winner, 3000);
  g.winner = winner;
  ctx.say('dead.escape');
  const awards = [];
  if (winner) awards.push({ pid: winner, title: g.pos[winner] >= EXIT ? 'Escaped the gym' : 'Got the furthest', detail: '+3,000 bonus' });
  const ghosts = Object.keys(g.dead).filter((p) => g.dead[p] && ctx.exists(p));
  if (ghosts.length) awards.push({ pid: ghosts[0], title: 'First ghost', detail: 'Haunting the squat rack forever' });
  ctx.end(g, { awards });
}

export default {
  id: 'dead',
  name: 'Dead Lift',
  tagline: 'Trivia in a haunted gym. Wrong answers send you to the Killing Floor.',
  min: 2,
  max: 10,
  minutes: 14,
  tags: ['Trivia', 'Mini-games', 'Spooky'],
  rules: [
    'Answer trivia questions on your phone. Get one wrong and you go to the Killing Floor.',
    'The Killing Floor is a quick mini-game: pick a locker, do fast math, repeat a pattern, or tap like crazy. Fail it and you become a ghost.',
    'Ghosts keep playing. In the final round everyone races to escape the gym, but ghosts start a step behind.',
  ],
  setup(ctx, g) {
    g.qn = -1;
    g.dead = {};
    g.lastFloor = null;
  },
  begin(ctx, g) {
    nextQuestion(ctx, g);
  },
  input(ctx, g, pid, d) {
    if (d.t === 'ans' && g.phase === 'question' && g.q.ans[pid] === undefined && Number.isInteger(d.i) && d.i >= 0 && d.i < 4) {
      g.q.ans[pid] = d.i;
    } else if (g.phase === 'floor' && g.f && g.f.victims.includes(pid) && g.f.res[pid] === undefined) {
      const f = g.f;
      if (d.t === 'locker' && f.kind === 'lockers' && Number.isInteger(d.i) && d.i >= 0 && d.i < f.n) f.res[pid] = d.i;
      else if (d.t === 'math' && f.kind === 'math' && Array.isArray(d.a) && d.a.length === 3) f.res[pid] = d.a.map((x) => Number(x));
      else if (d.t === 'memory' && f.kind === 'memory' && Array.isArray(d.seq)) f.res[pid] = d.seq.slice(0, 8).map((x) => Number(x));
      else if (d.t === 'taps' && f.kind === 'taps') f.res[pid] = Math.max(0, Math.min(200, Math.floor(Number(d.n) || 0)));
    } else if (d.t === 'tf' && g.phase === 'tf' && g.tf.ans[pid] === undefined && typeof d.v === 'boolean') {
      g.tf.ans[pid] = d.v;
    }
  },
  tick(ctx, g) {
    switch (g.phase) {
      case 'question':
        if (ctx.now >= g.until + 500 || ctx.allDone(g.pids, (p) => g.q.ans[p] !== undefined)) revealQuestion(ctx, g);
        break;
      case 'qreveal':
        if (ctx.due(g)) startFloor(ctx, g);
        break;
      case 'floor':
        if (ctx.due(g) || (g.f.kind !== 'taps' && floorDone(ctx, g))) resolveFloor(ctx, g);
        else if (g.f.kind === 'taps' && floorDone(ctx, g) && ctx.now > g.f.goAt + g.f.window) resolveFloor(ctx, g);
        break;
      case 'floorResult':
        if (ctx.due(g)) nextQuestion(ctx, g);
        break;
      case 'finalIntro':
        if (ctx.due(g)) nextTF(ctx, g);
        break;
      case 'tf':
        if (ctx.now >= g.until + 400 || ctx.allDone(g.pids, (p) => g.tf.ans[p] !== undefined)) revealTF(ctx, g);
        break;
      case 'tfreveal':
        if (ctx.due(g)) nextTF(ctx, g);
        break;
      default:
        break;
    }
  },
  skip(ctx, g) {
    if (g.phase === 'question') revealQuestion(ctx, g);
    else if (g.phase === 'floor') resolveFloor(ctx, g);
    else if (g.phase === 'tf') revealTF(ctx, g);
    else g.until = ctx.now;
  },
  leave(ctx, g, pid) {
    g.pids = g.pids.filter((p) => p !== pid);
  },
  bot(g, pid) {
    const step = g.step;
    if (g.phase === 'question' && g.q.ans[pid] === undefined) return { t: 'ans', i: Math.random() < 0.5 ? g.q.correct : Math.floor(Math.random() * 4), step };
    if (g.phase === 'floor' && g.f.victims.includes(pid) && g.f.res[pid] === undefined) {
      const f = g.f;
      if (f.kind === 'lockers') return { t: 'locker', i: Math.floor(Math.random() * 3), step };
      if (f.kind === 'math') return { t: 'math', a: f.probs.map((p) => (Math.random() < 0.8 ? p.opts.indexOf(p.ans) : 0)), step };
      if (f.kind === 'memory') return { t: 'memory', seq: Math.random() < 0.6 ? f.seq.slice() : [0, 0, 0, 0, 0], step };
      if (f.kind === 'taps') return { t: 'taps', n: 25 + Math.floor(Math.random() * 20), step };
    }
    if (g.phase === 'tf' && g.tf.ans[pid] === undefined) return { t: 'tf', v: Math.random() < 0.6 ? g.tf.a : !g.tf.a, step };
    return null;
  },
};
