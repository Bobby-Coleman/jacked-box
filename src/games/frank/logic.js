// FRANKENFACE: two or three friends' selfies get stitched into one monster face
// (eyes from one, nose from another, mouth from a third). Name every donor.
export const PART_NAMES = { 2: ['Top half', 'Bottom half'], 3: ['Eyes', 'Nose', 'Mouth'] };

function facePlayers(ctx, g) {
  return g.pids.filter((p) => ctx.s.players[p] && ctx.s.players[p].face);
}

function nextRound(ctx, g) {
  g.round++;
  const faces = facePlayers(ctx, g);
  if (g.round > g.rounds || faces.length < 2) {
    const best = Object.keys(g.parts).sort((a, b) => g.parts[b] - g.parts[a])[0];
    ctx.end(g, { awards: best && g.parts[best] ? [{ pid: best, title: 'Mad scientist', detail: `Identified ${g.parts[best]} body parts` }] : [] });
    return;
  }
  const n = g.round > Math.ceil(g.rounds / 2) && faces.length >= 3 ? 3 : 2;
  const donors = ctx.shuffle(faces).slice(0, n);
  const j = () => (Math.random() - 0.5) * 0.04;
  const cuts = n === 2 ? [0.56 + j()] : [0.47 + j(), 0.66 + j()];
  g.r = { donors, cuts, guesses: {} };
  ctx.phase(g, 'look', 30000);
  if (g.round === 1) ctx.say('frank.start');
}

function reveal(ctx, g) {
  const r = g.r;
  for (const [pid, x] of Object.entries(r.guesses)) {
    let ok = 0;
    x.parts.forEach((p, i) => {
      if (p === r.donors[i]) ok++;
    });
    let pts = ok * 400;
    if (ok === r.donors.length) pts += Math.max(0, Math.round(300 * (1 - x.el / 30000)));
    x.ok = ok;
    x.pts = pts;
    ctx.award(g, pid, pts);
    g.parts[pid] = (g.parts[pid] || 0) + ok;
  }
  ctx.beat(g, 'reveal', 7000);
  ctx.say('frank.reveal');
}

export default {
  id: 'frank',
  name: 'Frankenface',
  tagline: "Friends' faces stitched into one monster. Name every donor.",
  min: 3,
  max: 12,
  minutes: 6,
  tags: ['Faces', 'Guessing', 'Quick'],
  faces: true,
  faceMin: 3,
  rules: [
    'Each round, two or three selfies get stitched together into one face.',
    'Pick whose eyes, nose and mouth (or top and bottom) you think you see.',
    'Points for every part you get right, plus a speed bonus for naming them all.',
  ],
  PART_NAMES,
  setup(ctx, g) {
    g.round = 0;
    g.rounds = 6;
    g.parts = {};
  },
  begin(ctx, g) {
    nextRound(ctx, g);
  },
  input(ctx, g, pid, d) {
    const r = g.r;
    if (d.t !== 'guess' || g.phase !== 'look' || !r || r.guesses[pid]) return;
    if (!Array.isArray(d.parts) || d.parts.length !== r.donors.length) return;
    if (!d.parts.every((p) => ctx.s.players[p])) return;
    const el = Math.max(0, Math.min(ctx.now - g.t0, Number(d.el) || 0));
    r.guesses[pid] = { parts: d.parts.slice(), el };
  },
  tick(ctx, g) {
    if (g.phase === 'look') {
      if (ctx.now >= g.until + 500 || ctx.allDone(g.pids, (p) => g.r.guesses[p])) reveal(ctx, g);
    } else if (g.phase === 'reveal') {
      if (ctx.due(g)) nextRound(ctx, g);
    }
  },
  skip(ctx, g) {
    if (g.phase === 'look') reveal(ctx, g);
    else g.until = ctx.now;
  },
  leave(ctx, g, pid) {
    g.pids = g.pids.filter((p) => p !== pid);
  },
  bot(g, pid, s) {
    const r = g.r;
    if (g.phase !== 'look' || !r || r.guesses[pid] || Math.random() < 0.5) return null;
    const faces = g.pids.filter((p) => s.players[p] && s.players[p].face);
    const parts = r.donors.map((d) => (Math.random() < 0.6 ? d : faces[Math.floor(Math.random() * faces.length)]));
    return { t: 'guess', parts, el: 4000 + Math.random() * 15000, step: g.step };
  },
};
