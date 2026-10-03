// SPLIT DECISION: finish a dilemma ("You get a million dollars, but ____") so the room
// splits exactly down the middle. Too good a deal and everyone says yes; too awful and
// everyone says no. A perfect 50/50 split is worth the most.
import { SPLIT_TEMPLATES } from '../../content/faces.js';
import { clean } from '../../engine/text.js';

function startWrite(ctx, g) {
  g.round++;
  const live = ctx.live(g);
  const tpls = ctx.take('split', SPLIT_TEMPLATES, live.length, ctx.family).map(ctx.content);
  g.jobs = {};
  live.forEach((pid, i) => {
    g.jobs[pid] = { tpl: tpls[i % tpls.length], text: null };
  });
  ctx.phase(g, 'write', 75000);
  ctx.say('split.write');
}

function startVotes(ctx, g) {
  g.queue = ctx.shuffle(Object.keys(g.jobs).filter((p) => g.jobs[p].text));
  g.qi = -1;
  nextDilemma(ctx, g);
}

export function fill(tpl, text) {
  return String(tpl).replace('____', text);
}

function nextDilemma(ctx, g) {
  g.qi++;
  if (g.qi >= g.queue.length) {
    endRound(ctx, g);
    return;
  }
  const author = g.queue[g.qi];
  g.r = { author, votes: {}, pts: 0 };
  ctx.phase(g, 'vote', 15000);
  const j = g.jobs[author];
  ctx.read(`${fill(j.tpl, j.text)} Would you?`);
}

function voters(g) {
  return g.pids.filter((p) => p !== g.r.author).concat(g.aud || []);
}

function result(ctx, g) {
  const r = g.r;
  const vals = Object.values(r.votes);
  const yes = vals.filter((v) => v === 'y').length;
  const no = vals.length - yes;
  const total = yes + no;
  r.yes = yes;
  r.no = no;
  let pts = 0;
  if (total >= 2) {
    pts = Math.round(1000 * (1 - Math.abs(yes - no) / total));
    if (Math.abs(yes - no) <= (total % 2)) pts += 500;
    r.perfect = Math.abs(yes - no) <= total % 2;
  }
  r.pts = pts;
  ctx.award(g, r.author, pts);
  g.split[r.author] = (g.split[r.author] || 0) + pts;
  ctx.beat(g, 'result', 5500);
  ctx.say(r.perfect ? 'split.perfect' : total && (yes === 0 || no === 0) ? 'split.lopsided' : 'split.result');
}

function endRound(ctx, g) {
  if (g.round < g.rounds) {
    startWrite(ctx, g);
    return;
  }
  const awards = [];
  const best = Object.keys(g.split).sort((a, b) => g.split[b] - g.split[a])[0];
  if (best && g.split[best]) awards.push({ pid: best, title: 'Master divider', detail: 'Split the room best' });
  ctx.end(g, { awards });
}

export default {
  id: 'split',
  name: 'Split Decision',
  tagline: 'Write the catch that splits the room 50/50. Would you?',
  min: 3,
  max: 12,
  minutes: 8,
  tags: ['Writing', 'Voting', 'Debate'],
  rules: [
    'You get a sweet deal with a blank catch, like "You can fly, but ____". Write the catch.',
    'The room votes YES or NO on each finished deal.',
    'You score when the room is divided. A perfect 50/50 split is worth the most. Everyone saying the same thing scores zero.',
  ],
  setup(ctx, g) {
    g.round = 0;
    g.rounds = 2;
    g.split = {};
  },
  begin(ctx, g) {
    startWrite(ctx, g);
  },
  audience(g, d) {
    return d.t === 'vote';
  },
  input(ctx, g, pid, d) {
    if (d.t === 'catch' && g.phase === 'write') {
      const j = g.jobs[pid];
      const text = clean(d.text, 90);
      if (j && !j.text && text) j.text = text;
    } else if (d.t === 'vote' && g.phase === 'vote') {
      if (pid !== g.r.author && (d.v === 'y' || d.v === 'n')) g.r.votes[pid] = d.v;
    }
  },
  tick(ctx, g) {
    if (g.phase === 'write') {
      if (ctx.now >= g.until + 1500 || ctx.allDone(Object.keys(g.jobs), (p) => g.jobs[p].text)) startVotes(ctx, g);
    } else if (g.phase === 'vote') {
      if (ctx.due(g) || ctx.allDone(voters(g), (p) => g.r.votes[p])) result(ctx, g);
    } else if (g.phase === 'result') {
      if (ctx.due(g)) nextDilemma(ctx, g);
    }
  },
  skip(ctx, g) {
    if (g.phase === 'write') startVotes(ctx, g);
    else if (g.phase === 'vote') result(ctx, g);
    else g.until = ctx.now;
  },
  leave(ctx, g, pid) {
    g.pids = g.pids.filter((p) => p !== pid);
  },
  bot(g, pid) {
    const step = g.step;
    if (g.phase === 'write' && g.jobs[pid] && !g.jobs[pid].text) {
      return { t: 'catch', text: ['you have to sing everything', 'you smell like soup forever', 'your mom reads your texts'][Math.floor(Math.random() * 3)], step };
    }
    if (g.phase === 'vote' && g.r && pid !== g.r.author && !g.r.votes[pid]) return { t: 'vote', v: Math.random() < 0.5 ? 'y' : 'n', step };
    return null;
  },
};
