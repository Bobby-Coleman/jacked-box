// MOOJORITY: think like the herd (Herd Mentality-style).
// Everyone answers the same question; matching the biggest group earns a cow.
// The one-and-only lone answer gets stuck with the Odd Cow (you can't win holding it).
import { HERD_QUESTIONS } from '../../content/herd.js';
import { clean, groupAnswers } from '../../engine/text.js';

export const WIN_COWS = 6;
const MAX_ROUNDS = 12;

function nextRound(ctx, g) {
  g.round++;
  const q = ctx.take('herd', HERD_QUESTIONS, 1, ctx.family)[0];
  g.q = typeof q === 'string' ? { t: q, o: null } : { t: q.t, o: q.o || null };
  g.ans = {};
  g.groups = [];
  g.res = null;
  ctx.phase(g, 'answer', g.q.o ? 15000 : 25000);
  ctx.read(g.q.t);
  if (g.round === 1) ctx.say('herd.answer');
}

function buildGroups(ctx, g) {
  const entries = Object.entries(g.ans);
  if (g.q.o) {
    const by = {};
    for (const [pid, i] of entries) (by[i] = by[i] || []).push(pid);
    g.groups = Object.entries(by).map(([i, pids]) => ({ key: 'o' + i, text: g.q.o[i], pids }));
  } else {
    g.groups = groupAnswers(entries);
  }
  g.groups.sort((a, b) => b.pids.length - a.pids.length);
  g.pickA = null;
  if (g.q.o || g.groups.length <= 1) score(ctx, g);
  else {
    ctx.phase(g, 'judge', 20000);
    ctx.say('herd.reveal');
  }
}

function score(ctx, g) {
  const groups = g.groups.slice().sort((a, b) => b.pids.length - a.pids.length);
  g.groups = groups;
  const top = groups[0];
  const tie = groups.length > 1 && groups[1].pids.length === top.pids.length;
  const res = { herd: null, tie: false, odd: null, prevOdd: g.odd };
  if (top && top.pids.length >= 2 && !tie) {
    res.herd = top.key;
    for (const pid of top.pids) {
      g.cows[pid] = (g.cows[pid] || 0) + 1;
      ctx.award(g, pid, 1000);
    }
  } else if (tie) {
    res.tie = true;
    ctx.say('herd.tie');
  }
  const singles = groups.filter((gr) => gr.pids.length === 1);
  if (singles.length === 1 && groups.length > 1) {
    res.odd = singles[0].pids[0];
    if (g.odd !== res.odd) {
      g.odd = res.odd;
      ctx.sayName('herd.odd', res.odd);
    }
  }
  g.res = res;
  ctx.beat(g, 'score', 7000);
}

function winner(g) {
  const ids = Object.keys(g.cows).filter((p) => g.cows[p] >= WIN_COWS && p !== g.odd);
  ids.sort((a, b) => g.cows[b] - g.cows[a]);
  return ids[0] || null;
}

function finish(ctx, g) {
  // Holding the Odd Cow at the end costs two cows.
  if (g.odd) ctx.award(g, g.odd, -2000);
  const w = winner(g);
  const awards = [];
  if (w) awards.push({ pid: w, title: 'Head of the herd', detail: `First to ${WIN_COWS} cows` });
  if (g.odd) awards.push({ pid: g.odd, title: 'Stuck with the Odd Cow', detail: 'Minus 2 cows. Moo.' });
  ctx.end(g, { awards });
}

export default {
  id: 'herd',
  name: 'Moojority',
  tagline: "Don't be clever. Be popular. Match the herd and collect cows.",
  min: 3,
  max: 16,
  minutes: 10,
  tags: ['Quick', 'Big groups', 'Easy'],
  rules: [
    'Everyone answers the same question. Try to give the SAME answer as most people.',
    "If you're in the biggest group, you earn a cow. Ties earn nothing.",
    `The only person with a unique answer gets the Odd Cow, and you can't win while holding it. First to ${WIN_COWS} cows wins.`,
  ],
  WIN_COWS,
  setup(ctx, g) {
    g.round = 0;
    g.cows = Object.fromEntries(g.pids.map((p) => [p, 0]));
    g.odd = null;
  },
  begin(ctx, g) {
    nextRound(ctx, g);
  },
  input(ctx, g, pid, d) {
    if (d.t === 'ans' && g.phase === 'answer' && g.ans[pid] === undefined) {
      if (g.q.o) {
        if (Number.isInteger(d.i) && d.i >= 0 && d.i < g.q.o.length) g.ans[pid] = d.i;
      } else {
        const text = clean(d.text, 40);
        if (text) g.ans[pid] = text;
      }
    } else if (d.t === 'merge' && g.phase === 'judge' && pid === ctx.s.vip) {
      const a = g.groups.find((x) => x.key === d.a);
      const b = g.groups.find((x) => x.key === d.b);
      if (a && b && a !== b) {
        a.pids = a.pids.concat(b.pids);
        a.text = a.text.length <= b.text.length ? a.text : b.text;
        a.alts = (a.alts || []).concat([b.text], b.alts || []);
        g.groups = g.groups.filter((x) => x !== b).sort((x, y) => y.pids.length - x.pids.length);
      }
    } else if (d.t === 'judged' && g.phase === 'judge' && pid === ctx.s.vip) {
      score(ctx, g);
    }
  },
  tick(ctx, g) {
    if (g.phase === 'answer') {
      if (ctx.now >= g.until + 800 || ctx.allDone(g.pids, (p) => g.ans[p] !== undefined)) buildGroups(ctx, g);
    } else if (g.phase === 'judge') {
      if (ctx.due(g)) score(ctx, g);
    } else if (g.phase === 'score') {
      if (ctx.due(g)) {
        if (winner(g) || g.round >= MAX_ROUNDS) finish(ctx, g);
        else nextRound(ctx, g);
      }
    }
  },
  skip(ctx, g) {
    if (g.phase === 'answer') buildGroups(ctx, g);
    else if (g.phase === 'judge') score(ctx, g);
    else g.until = ctx.now;
  },
  leave(ctx, g, pid) {
    g.pids = g.pids.filter((p) => p !== pid);
    if (g.odd === pid) g.odd = null;
  },
  bot(g, pid) {
    const step = g.step;
    if (g.phase === 'answer' && g.ans[pid] === undefined) {
      if (g.q.o) return { t: 'ans', i: Math.floor(Math.random() * Math.min(2, g.q.o.length)), step };
      return { t: 'ans', text: ['pizza', 'Pizza!', 'tacos', 'sushi'][Math.floor(Math.random() * 4)], step };
    }
    return null;
  },
};
