// MOST WANTED: every player gets a WANTED poster with their face on it. Two friends
// each write the crime; the room votes which charge sticks. Bounty grows with every vote.
import { clean } from '../../engine/text.js';

export const BOUNTY_PER_VOTE = 10000;

function startWrite(ctx, g) {
  const order = ctx.shuffle(ctx.live(g));
  const n = order.length;
  g.posters = order.map((target, i) => ({ target, w: [order[(i + 1) % n], order[(i + 2) % n]], crimes: {}, votes: {}, pts: {} }));
  ctx.phase(g, 'write', 90000);
  ctx.say('wanted.write');
}

function myJobs(g, pid) {
  return g.posters.map((p, i) => ({ p, i })).filter(({ p }) => p.w.includes(pid));
}

function nextPoster(ctx, g) {
  for (;;) {
    g.pi++;
    if (g.pi >= g.posters.length) {
      finish(ctx, g);
      return;
    }
    if (Object.keys(g.posters[g.pi].crimes).length) break;
  }
  const P = g.posters[g.pi];
  const crimes = Object.keys(P.crimes);
  if (crimes.length < 2) {
    // One charge only: it sticks automatically.
    tally(ctx, g, P);
    return;
  }
  ctx.phase(g, 'vote', 20000);
  ctx.sayName('wanted.poster', P.target);
}

function voters(g, P) {
  return g.pids.filter((p) => !P.w.includes(p)).concat(g.aud || []);
}

function tally(ctx, g, P) {
  const counts = {};
  for (const w of Object.values(P.votes)) counts[w] = (counts[w] || 0) + 1;
  P.counts = counts;
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const authors = Object.keys(P.crimes);
  let winner = authors[0];
  for (const a of authors) if ((counts[a] || 0) > (counts[winner] || 0)) winner = a;
  P.winner = winner;
  P.bounty = Math.max(1, total) * BOUNTY_PER_VOTE;
  for (const a of authors) {
    const v = counts[a] || 0;
    let pts = v * 500;
    if (total >= 2 && v === total) pts += 250;
    if (authors.length === 1) pts = 500;
    P.pts[a] = pts;
    ctx.award(g, a, pts);
  }
  g.bounties[P.target] = (g.bounties[P.target] || 0) + P.bounty;
  ctx.read(P.crimes[winner]);
  ctx.beat(g, 'verdict', 7000);
  ctx.say('wanted.verdict');
}

function finish(ctx, g) {
  const awards = [];
  const enemy = Object.keys(g.bounties).sort((a, b) => g.bounties[b] - g.bounties[a])[0];
  if (enemy) awards.push({ pid: enemy, title: 'Public enemy #1', detail: `$${g.bounties[enemy].toLocaleString('en-US')} bounty` });
  const ids = Object.keys(g.scores).sort((a, b) => g.scores[b] - g.scores[a]);
  if (ids[0] && g.scores[ids[0]]) awards.push({ pid: ids[0], title: 'Most creative accuser', detail: 'Wrote the charges that stuck' });
  ctx.end(g, { awards });
}

export default {
  id: 'wanted',
  name: 'Most Wanted',
  tagline: "Everyone gets a WANTED poster with their face on it. You write their crimes.",
  min: 3,
  max: 10,
  minutes: 10,
  tags: ['Faces', 'Writing', 'About us'],
  faces: true,
  rules: [
    "Every player's face goes on a WANTED poster. You'll write the crime for two of your friends.",
    'Each poster gets two charges. The room votes which one sticks.',
    'Your charge scores 500 points per vote. The biggest bounty becomes Public Enemy #1.',
  ],
  BOUNTY_PER_VOTE,
  setup(ctx, g) {
    g.pi = -1;
    g.bounties = {};
  },
  begin(ctx, g) {
    startWrite(ctx, g);
  },
  audience(g, d) {
    return d.t === 'vote';
  },
  input(ctx, g, pid, d) {
    if (d.t === 'crime' && g.phase === 'write') {
      const P = g.posters[d.i];
      const text = clean(d.text, 80);
      if (P && text && P.w.includes(pid) && !P.crimes[pid]) P.crimes[pid] = text;
    } else if (d.t === 'vote' && g.phase === 'vote') {
      const P = g.posters[g.pi];
      if (P && !P.w.includes(pid) && P.crimes[d.w]) P.votes[pid] = d.w;
    }
  },
  tick(ctx, g) {
    if (g.phase === 'write') {
      const done = ctx.allDone(g.pids, (p) => myJobs(g, p).every(({ p: P }) => P.crimes[p]));
      if (ctx.now >= g.until + 1000 || done) nextPoster(ctx, g);
    } else if (g.phase === 'vote') {
      const P = g.posters[g.pi];
      if (ctx.due(g) || ctx.allDone(voters(g, P), (p) => P.votes[p])) tally(ctx, g, P);
    } else if (g.phase === 'verdict') {
      if (ctx.due(g)) nextPoster(ctx, g);
    }
  },
  skip(ctx, g) {
    if (g.phase === 'write') nextPoster(ctx, g);
    else if (g.phase === 'vote') tally(ctx, g, g.posters[g.pi]);
    else g.until = ctx.now;
  },
  leave(ctx, g, pid) {
    g.pids = g.pids.filter((p) => p !== pid);
  },
  bot(g, pid) {
    const step = g.step;
    if (g.phase === 'write') {
      const todo = myJobs(g, pid).find(({ p }) => !p.crimes[pid]);
      if (todo) return { t: 'crime', i: todo.i, text: 'Stealing ' + ['spoons', 'socks', 'the moon', 'wifi'][Math.floor(Math.random() * 4)], step };
    }
    if (g.phase === 'vote') {
      const P = g.posters[g.pi];
      if (P && !P.w.includes(pid) && !P.votes[pid]) {
        const ws = Object.keys(P.crimes);
        return { t: 'vote', w: ws[Math.floor(Math.random() * ws.length)], step };
      }
    }
    return null;
  },
};
