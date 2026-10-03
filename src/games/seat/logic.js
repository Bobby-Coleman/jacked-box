// HOT SEAT: "Who's most likely to...?" Everyone votes for someone in the room.
// You score for agreeing with the room; whoever gets the most votes takes the
// superlative home. Loud, quick, and entirely about the people playing.
import { SEAT_PROMPTS } from '../../content/seat.js';

const ROUNDS = 8;

function nextRound(ctx, g) {
  g.round++;
  if (g.round > g.rounds) {
    finish(ctx, g);
    return;
  }
  const p = ctx.content(ctx.take('seat', SEAT_PROMPTS, 1, ctx.family)[0]);
  g.r = { prompt: p, votes: {}, top: [], pts: {} };
  ctx.phase(g, 'vote', 20000);
  ctx.read(`Who is most likely to ${p}?`);
}

function reveal(ctx, g) {
  const r = g.r;
  const tally = {};
  for (const t of Object.values(r.votes)) tally[t] = (tally[t] || 0) + 1;
  const max = Math.max(0, ...Object.values(tally));
  r.tally = tally;
  r.top = max > 0 ? Object.keys(tally).filter((p) => tally[p] === max) : [];
  // Agreeing with the room: 100 points for every other person who voted like you.
  for (const [voter, target] of Object.entries(r.votes)) {
    const same = (tally[target] || 0) - 1;
    if (same > 0) {
      r.pts[voter] = same * 100;
      ctx.award(g, voter, same * 100);
    }
  }
  for (const pid of r.top) {
    g.titles[pid] = g.titles[pid] || [];
    g.titles[pid].push({ prompt: r.prompt, votes: max });
  }
  ctx.beat(g, 'reveal', 7500);
}

function finish(ctx, g) {
  const awards = [];
  for (const [pid, list] of Object.entries(g.titles)) {
    const best = list.slice().sort((a, b) => b.votes - a.votes)[0];
    awards.push({ pid, title: 'Most likely to', detail: best.prompt });
  }
  ctx.end(g, { awards, note: 'Points come from agreeing with the room.' });
}

export default {
  id: 'seat',
  name: 'Hot Seat',
  tagline: "Who's most likely to...? Vote on your friends, defend yourself, collect superlatives.",
  min: 3,
  max: 16,
  minutes: 6,
  tags: ['About us', 'Quick', 'Big groups'],
  rules: [
    "Each round asks who in this room is most likely to do something. Vote for anyone, even yourself.",
    'You score 100 points for every other person who voted the same way you did.',
    'Whoever gets the most votes takes that title home. Argue about it out loud!',
  ],
  setup(ctx, g) {
    g.round = 0;
    g.rounds = ROUNDS;
    g.titles = {};
  },
  begin(ctx, g) {
    nextRound(ctx, g);
  },
  input(ctx, g, pid, d) {
    if (d.t === 'vote' && g.phase === 'vote' && g.pids.includes(d.p)) g.r.votes[pid] = d.p;
  },
  tick(ctx, g) {
    if (g.phase === 'vote') {
      if (ctx.now >= g.until + 500 || ctx.allDone(g.pids, (p) => g.r.votes[p])) reveal(ctx, g);
    } else if (g.phase === 'reveal') {
      if (ctx.due(g)) nextRound(ctx, g);
    }
  },
  skip(ctx, g) {
    if (g.phase === 'vote') reveal(ctx, g);
    else g.until = ctx.now;
  },
  leave(ctx, g, pid) {
    g.pids = g.pids.filter((p) => p !== pid);
  },
  bot(g, pid) {
    if (g.phase === 'vote' && !g.r.votes[pid]) {
      const pick = g.pids[Math.floor(Math.random() * Math.min(3, g.pids.length))];
      return { t: 'vote', p: pick, step: g.step };
    }
    return null;
  },
};
