// PULL A FACE: everyone gets the same prompt ("You just stepped on a Lego") and snaps
// a selfie acting it out. The room votes for the best face. The last round is COPYCAT:
// recreate a friend's face from an earlier round, shown side by side with the original.
import { FACE_PROMPTS } from '../../content/faces.js';

const IMG_RE = /^data:image\/(jpeg|png|webp);base64,/;
const MAX_IMG = 120000;
// A 1x1 PNG so bots (and the simulator) can take part.
export const BOT_SNAP = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

function startRound(ctx, g) {
  g.round++;
  const live = ctx.live(g);
  const copy = g.round === g.rounds && g.history.length >= 2 ? assignCopies(ctx, g, live) : null;
  const prompt = copy ? null : ctx.content(ctx.take('pull', FACE_PROMPTS, 1, ctx.family)[0]);
  g.r = { prompt, copy, snaps: {}, votes: {}, tally: {}, pts: {} };
  ctx.phase(g, 'snap', copy ? 40000 : 30000);
  if (copy) {
    ctx.say('pull.copy');
  } else {
    ctx.say('pull.snap');
    ctx.read(prompt);
  }
}

// Copycat: each player recreates someone else's face from an earlier round.
// Favor the faces that won votes.
function assignCopies(ctx, g, live) {
  const ranked = ctx.shuffle(g.history).sort((a, b) => b.votes - a.votes);
  const copy = {};
  const used = {};
  for (const pid of ctx.shuffle(live)) {
    const pick = ranked.find((h) => h.by !== pid && !used[h.blob]) || ranked.find((h) => h.by !== pid);
    if (!pick) continue;
    used[pick.blob] = 1;
    copy[pid] = { by: pick.by, blob: pick.blob, prompt: pick.prompt };
  }
  return copy;
}

function startVote(ctx, g) {
  const authors = Object.keys(g.r.snaps);
  if (authors.length < 2) {
    // Not enough faces to vote on: score what we have and move on.
    for (const a of authors) {
      g.r.pts[a] = 250;
      ctx.award(g, a, 250);
    }
    ctx.beat(g, 'reveal', 5000);
    return;
  }
  ctx.phase(g, 'vote', 30000);
  ctx.say('pull.vote');
}

function voters(g) {
  return g.pids.filter((p) => Object.keys(g.r.snaps).some((a) => a !== p)).concat(g.aud || []);
}

function reveal(ctx, g) {
  const r = g.r;
  const tally = {};
  for (const a of Object.values(r.votes)) tally[a] = (tally[a] || 0) + 1;
  r.tally = tally;
  const best = Math.max(0, ...Object.values(tally));
  for (const a of Object.keys(r.snaps)) {
    const v = tally[a] || 0;
    let pts = v * 500;
    if (best > 0 && v === best) pts += 250;
    r.pts[a] = pts;
    ctx.award(g, a, pts);
    g.totals[a] = (g.totals[a] || 0) + v;
    if (!r.copy) g.history.push({ by: a, blob: r.snaps[a], prompt: r.prompt, votes: v });
  }
  r.winners = Object.keys(tally).filter((a) => tally[a] === best && best > 0);
  ctx.beat(g, 'reveal', 8000);
  if (r.winners.length === 1) ctx.sayName('pull.winner', r.winners[0]);
  else ctx.say(r.winners.length ? 'pull.reveal' : 'pull.nobody');
}

function finish(ctx, g) {
  const awards = [];
  const best = Object.keys(g.totals).sort((a, b) => g.totals[b] - g.totals[a])[0];
  if (best && g.totals[best]) awards.push({ pid: best, title: 'Face of the century', detail: `${g.totals[best]} votes` });
  ctx.end(g, { awards });
}

export default {
  id: 'pull',
  name: 'Pull a Face',
  tagline: 'Act out the prompt with your face. Snap it. Best face wins.',
  min: 3,
  max: 10,
  minutes: 7,
  tags: ['Faces', 'Camera', 'Voting'],
  rules: [
    'Everyone gets the same prompt, like "You just stepped on a Lego". Act it out and snap a selfie.',
    'Then vote for the best face. 500 points per vote, plus a bonus for the round winner.',
    'Final round: COPYCAT. Recreate a friend\'s face from earlier, side by side with the original.',
  ],
  setup(ctx, g) {
    g.round = 0;
    g.rounds = g.pids.length <= 6 ? 4 : 3;
    g.totals = {};
    g.history = [];
  },
  begin(ctx, g) {
    startRound(ctx, g);
  },
  audience(g, d) {
    return d.t === 'vote';
  },
  input(ctx, g, pid, d) {
    const r = g.r;
    if (!r) return;
    if (d.t === 'snap' && g.phase === 'snap') {
      if (r.snaps[pid] || (r.copy && !r.copy[pid])) return;
      const p = ctx.s.players[pid];
      // Test bots reuse their selfie (it isn't a game blob, so it outlives the game).
      if (d.reuse && p && p.bot && p.face) {
        r.snaps[pid] = p.face;
        return;
      }
      if (typeof d.img !== 'string' || !IMG_RE.test(d.img) || d.img.length > MAX_IMG) return;
      r.snaps[pid] = ctx.blob({ img: d.img });
    } else if (d.t === 'vote' && g.phase === 'vote') {
      if (d.p !== pid && r.snaps[d.p]) r.votes[pid] = d.p;
    }
  },
  tick(ctx, g) {
    const r = g.r;
    if (g.phase === 'snap') {
      const need = r.copy ? Object.keys(r.copy) : g.pids;
      if (ctx.now >= g.until + 1500 || ctx.allDone(need, (p) => r.snaps[p])) startVote(ctx, g);
    } else if (g.phase === 'vote') {
      if (ctx.due(g) || ctx.allDone(voters(g), (p) => r.votes[p])) reveal(ctx, g);
    } else if (g.phase === 'reveal') {
      if (ctx.due(g)) {
        if (g.round >= g.rounds) finish(ctx, g);
        else startRound(ctx, g);
      }
    }
  },
  skip(ctx, g) {
    if (g.phase === 'snap') startVote(ctx, g);
    else if (g.phase === 'vote') reveal(ctx, g);
    else g.until = ctx.now;
  },
  leave(ctx, g, pid) {
    g.pids = g.pids.filter((p) => p !== pid);
  },
  bot(g, pid, s) {
    const r = g.r;
    const step = g.step;
    if (!r) return null;
    if (g.phase === 'snap' && !r.snaps[pid] && (!r.copy || r.copy[pid])) {
      const p = s && s.players[pid];
      return p && p.face ? { t: 'snap', reuse: 1, img: BOT_SNAP, step } : { t: 'snap', img: BOT_SNAP, step };
    }
    if (g.phase === 'vote' && !r.votes[pid]) {
      const others = Object.keys(r.snaps).filter((p) => p !== pid);
      if (others.length) return { t: 'vote', p: others[Math.floor(Math.random() * others.length)], step };
    }
    return null;
  },
};
