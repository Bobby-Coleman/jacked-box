// ZINGER RING: head-to-head funny answers (Quiplash-style), presented as boxing bouts.
// Two rounds of 1-on-1 matchups (each player answers two prompts), then a final
// round where everyone answers the same prompt and everyone votes.
import { ZINGER_PROMPTS, ZINGER_NAMED, ZINGER_FINALS } from '../../content/zinger.js';

export const readMs = (t) => Math.min(7000, Math.max(1500, 700 + String(t || '').length * 58));
const norm = (t) => String(t || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const clean = (t, n = 80) => String(t || '').replace(/\s+/g, ' ').trim().slice(0, n);

function startRound(ctx, g, r) {
  g.round = r;
  const pids = ctx.shuffle(ctx.live(g).length >= 3 ? ctx.live(g) : g.pids);
  const n = pids.length;
  const nNamed = ctx.aboutUs && n >= 4 ? Math.min(2, Math.floor(n / 3)) : 0;
  const generic = ctx.take('zinger', ZINGER_PROMPTS, n - nNamed, ctx.family).map(ctx.content);
  const named = nNamed ? ctx.take('zinger-named', ZINGER_NAMED, nNamed, ctx.family).map((t) => ({ named: ctx.content(t) })) : [];
  const texts = ctx.shuffle([...generic, ...named]);
  g.matches = texts.map((t, i) => {
    const a = pids[i];
    const b = pids[(i + 1) % n];
    let text = t;
    if (t && t.named) {
      const others = g.pids.filter((p) => p !== a && p !== b);
      const target = others.length ? ctx.pick(others) : ctx.pick(g.pids);
      text = t.named.replace(/\{name\}/g, ctx.name(target));
    }
    return { text, a, b, ans: {}, votes: {}, pts: {}, ko: false, jinx: false };
  });
  g.mi = -1;
  ctx.phase(g, 'write', 90000);
  ctx.say(r === 1 ? 'zinger.write' : 'zinger.round2');
}

function myMatches(g, pid) {
  return g.matches.map((m, i) => ({ m, i })).filter(({ m }) => m.a === pid || m.b === pid);
}

function allAnswered(ctx, g) {
  return ctx.allDone(g.pids, (pid) => myMatches(g, pid).every(({ m }) => m.ans[pid]));
}

function nextMatch(ctx, g) {
  for (;;) {
    g.mi++;
    if (g.mi >= g.matches.length) {
      ctx.beat(g, 'scores', 7000);
      ctx.say('gen.scores');
      g.prev = { ...g.scores };
      return;
    }
    const m = g.matches[g.mi];
    if (m.ans[m.a] || m.ans[m.b]) break;
  }
  const m = g.matches[g.mi];
  ctx.beat(g, 'show', 1200 + readMs(m.text));
  ctx.read(m.text);
}

function voters(g, m) {
  return g.pids.filter((p) => p !== m.a && p !== m.b).concat(g.aud || []);
}

function startVote(ctx, g) {
  const m = g.matches[g.mi];
  const A = m.ans[m.a];
  const B = m.ans[m.b];
  if (A && B && norm(A) === norm(B)) {
    m.jinx = true;
    ctx.read(A);
    finishMatch(ctx, g);
    return;
  }
  if (!A || !B) {
    // Forfeit: the only answer wins by default.
    ctx.read(A || B);
    finishMatch(ctx, g);
    return;
  }
  ctx.phase(g, 'vote', 20000);
  g.voteMin = ctx.now + readMs(A) + readMs(B) + 400;
  ctx.read(A);
  ctx.read(B);
  ctx.say('zinger.vote');
}

function finishMatch(ctx, g) {
  const m = g.matches[g.mi];
  const mult = g.round;
  const va = Object.values(m.votes).filter((v) => v === 'a').length;
  const vb = Object.values(m.votes).filter((v) => v === 'b').length;
  const total = va + vb;
  m.pts = {};
  if (m.jinx) {
    ctx.say('zinger.jinx');
  } else if (!m.ans[m.a] || !m.ans[m.b]) {
    const w = m.ans[m.a] ? m.a : m.b;
    m.pts[w] = 500 * mult;
  } else if (total > 0) {
    m.pts[m.a] = Math.round((1000 * mult * va) / total);
    m.pts[m.b] = Math.round((1000 * mult * vb) / total);
    if (total >= 2 && (va === 0 || vb === 0)) {
      m.ko = va > 0 ? 'a' : 'b';
      const w = va > 0 ? m.a : m.b;
      m.pts[w] += 250 * mult;
      ctx.say('zinger.ko');
    }
  }
  for (const [pid, p] of Object.entries(m.pts)) ctx.award(g, pid, p);
  g.stats = g.stats || {};
  const st = (pid) => (g.stats[pid] = g.stats[pid] || { votes: 0, kos: 0 });
  st(m.a).votes += va;
  st(m.b).votes += vb;
  if (m.ko) st(m.ko === 'a' ? m.a : m.b).kos += 1;
  m.va = va;
  m.vb = vb;
  ctx.beat(g, 'result', 6500);
}

function startFinal(ctx, g) {
  g.round = 3;
  g.final = { text: ctx.content(ctx.take('zinger-final', ZINGER_FINALS, 1, ctx.family)[0]), ans: {}, votes: {}, order: [], pts: {} };
  ctx.phase(g, 'fwrite', 75000);
  ctx.say('zinger.final');
  ctx.read(g.final.text);
}

function startFinalVote(ctx, g) {
  const f = g.final;
  f.order = ctx.shuffle(Object.keys(f.ans));
  if (f.order.length < 2) {
    finishFinal(ctx, g);
    return;
  }
  ctx.phase(g, 'fvote', 40000);
  ctx.say('zinger.finalvote');
}

function finishFinal(ctx, g) {
  const f = g.final;
  const tally = {};
  for (const picks of Object.values(f.votes)) for (const p of picks) tally[p] = (tally[p] || 0) + 1;
  f.tally = tally;
  f.pts = {};
  for (const [pid, n] of Object.entries(tally)) {
    f.pts[pid] = n * 500;
    ctx.award(g, pid, n * 500);
    g.stats = g.stats || {};
    g.stats[pid] = g.stats[pid] || { votes: 0, kos: 0 };
    g.stats[pid].votes += n;
  }
  f.order = f.order.slice().sort((a, b) => (tally[b] || 0) - (tally[a] || 0));
  ctx.beat(g, 'fresult', 9000 + f.order.length * 600);
}

function awards(g) {
  const out = [];
  const stats = g.stats || {};
  const ids = Object.keys(stats);
  if (!ids.length) return out;
  const topKo = ids.slice().sort((a, b) => stats[b].kos - stats[a].kos)[0];
  if (stats[topKo].kos > 0) out.push({ pid: topKo, title: 'Knockout artist', detail: `${stats[topKo].kos} clean sweep${stats[topKo].kos > 1 ? 's' : ''}` });
  const topV = ids.slice().sort((a, b) => stats[b].votes - stats[a].votes)[0];
  if (stats[topV].votes > 0) out.push({ pid: topV, title: 'Crowd favorite', detail: `${stats[topV].votes} votes overall` });
  return out;
}

export default {
  id: 'zinger',
  name: 'Zinger Ring',
  tagline: 'Two answers enter the ring. Write the funniest one and win the crowd.',
  min: 3,
  max: 10,
  minutes: 15,
  tags: ['Writing', 'Voting'],
  rules: [
    'You get two prompts. Write the funniest answer you can think of for each.',
    'Every prompt goes head-to-head against someone else. Everyone else votes for the better answer.',
    'Sweep every vote for a ZINGER bonus. The final round puts everyone in the ring at once.',
  ],
  setup(ctx, g) {
    g.round = 0;
    g.stats = {};
  },
  begin(ctx, g) {
    startRound(ctx, g, 1);
  },
  audience(g, d) {
    return d.t === 'vote' || d.t === 'fvote';
  },
  input(ctx, g, pid, d) {
    if (d.t === 'ans' && g.phase === 'write') {
      const m = g.matches[d.m];
      const text = clean(d.text, 80);
      if (m && text && (m.a === pid || m.b === pid) && !m.ans[pid]) m.ans[pid] = text;
    } else if (d.t === 'vote' && g.phase === 'vote') {
      const m = g.matches[g.mi];
      if (m && pid !== m.a && pid !== m.b && (d.v === 'a' || d.v === 'b')) m.votes[pid] = d.v;
    } else if (d.t === 'fans' && g.phase === 'fwrite') {
      const text = clean(d.text, 80);
      if (text && !g.final.ans[pid]) g.final.ans[pid] = text;
    } else if (d.t === 'fvote' && g.phase === 'fvote') {
      const picks = Array.isArray(d.picks) ? [...new Set(d.picks)].filter((p) => p !== pid && g.final.ans[p]).slice(0, 2) : [];
      if (picks.length) g.final.votes[pid] = picks;
    }
  },
  tick(ctx, g) {
    const grace = 900;
    switch (g.phase) {
      case 'write':
        if ((g.until && ctx.now >= g.until + grace) || allAnswered(ctx, g)) nextMatch(ctx, g);
        break;
      case 'show':
        if (ctx.due(g)) startVote(ctx, g);
        break;
      case 'vote': {
        const m = g.matches[g.mi];
        const vs = voters(g, m).filter((p) => ctx.on(p));
        const done = vs.length === 0 || vs.every((p) => m.votes[p]);
        if (ctx.due(g) || (done && ctx.now >= g.voteMin)) finishMatch(ctx, g);
        break;
      }
      case 'result':
        if (ctx.due(g)) nextMatch(ctx, g);
        break;
      case 'scores':
        if (ctx.due(g)) {
          if (g.round < 2) startRound(ctx, g, 2);
          else startFinal(ctx, g);
        }
        break;
      case 'fwrite':
        if ((g.until && ctx.now >= g.until + grace) || ctx.allDone(g.pids, (p) => g.final.ans[p])) startFinalVote(ctx, g);
        break;
      case 'fvote': {
        const vs = g.pids.concat(g.aud || []).filter((p) => ctx.on(p));
        if (ctx.due(g) || vs.every((p) => g.final.votes[p])) finishFinal(ctx, g);
        break;
      }
      case 'fresult':
        if (ctx.due(g)) ctx.end(g, { awards: awards(g) });
        break;
      default:
        break;
    }
  },
  skip(ctx, g) {
    if (g.phase === 'vote') finishMatch(ctx, g);
    else if (g.phase === 'write') nextMatch(ctx, g);
    else if (g.phase === 'fwrite') startFinalVote(ctx, g);
    else if (g.phase === 'fvote') finishFinal(ctx, g);
    else g.until = ctx.now;
  },
  leave(ctx, g, pid) {
    g.pids = g.pids.filter((p) => p !== pid);
  },
  bot(g, pid) {
    const step = g.step;
    if (g.phase === 'write') {
      const todo = myMatches(g, pid).find(({ m }) => !m.ans[pid]);
      if (todo) return { t: 'ans', m: todo.i, text: 'bot answer ' + Math.floor(Math.random() * 5), step };
    }
    if (g.phase === 'vote') {
      const m = g.matches[g.mi];
      if (m && pid !== m.a && pid !== m.b && !m.votes[pid]) return { t: 'vote', v: Math.random() < 0.5 ? 'a' : 'b', step };
    }
    if (g.phase === 'fwrite' && !g.final.ans[pid]) return { t: 'fans', text: 'final ' + pid, step };
    if (g.phase === 'fvote' && !g.final.votes[pid]) {
      const others = Object.keys(g.final.ans).filter((p) => p !== pid);
      return { t: 'fvote', picks: others.sort(() => Math.random() - 0.5).slice(0, 2), step };
    }
    return null;
  },
};
