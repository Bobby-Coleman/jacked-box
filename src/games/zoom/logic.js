// ZOOM & ENHANCE: a friend's selfie starts as an extreme close-up (or pixelated, blurred,
// scrambled…) and slowly "enhances". Tap whose face it is; faster correct guesses score more.
export const ROUND_MS = 14000;
export const EFFECTS = ['zoom', 'pixel', 'blur', 'strip', 'flip', 'tiles'];

function facePlayers(ctx, g) {
  return g.pids.filter((p) => ctx.s.players[p] && ctx.s.players[p].face);
}

function nextRound(ctx, g) {
  g.round++;
  const faces = facePlayers(ctx, g);
  if (g.round > g.rounds || faces.length < 2) {
    const best = Object.keys(g.fastest).sort((a, b) => g.fastest[a] - g.fastest[b])[0];
    ctx.end(g, { awards: best ? [{ pid: best, title: 'Facial recognition', detail: `Fastest correct guess: ${(g.fastest[best] / 1000).toFixed(1)}s` }] : [] });
    return;
  }
  let pool = faces.filter((p) => !g.used.includes(p));
  if (!pool.length) {
    g.used = [];
    pool = faces;
  }
  const target = ctx.pick(pool);
  g.used.push(target);
  let effect = ctx.pick(EFFECTS);
  if (effect === g.lastEffect) effect = ctx.pick(EFFECTS);
  g.lastEffect = effect;
  const perm = ctx.shuffle(Array.from({ length: 16 }, (_, i) => i));
  g.r = {
    target,
    effect,
    fx: 0.32 + Math.random() * 0.36,
    fy: 0.34 + Math.random() * 0.3,
    perm,
    guesses: {},
    first: null,
  };
  ctx.beat(g, 'zoom', ROUND_MS);
  if (g.round === 1) ctx.say('zoom.start');
}

function reveal(ctx, g) {
  const r = g.r;
  const right = Object.entries(r.guesses)
    .filter(([, x]) => x.ok)
    .sort((a, b) => a[1].el - b[1].el);
  r.first = right.length ? right[0][0] : null;
  for (const [pid, x] of right) {
    let pts = Math.max(150, Math.round(1000 * (1 - x.el / ROUND_MS)));
    if (pid === r.first) pts += 200;
    x.pts = pts;
    ctx.award(g, pid, pts);
    if (!g.fastest[pid] || x.el < g.fastest[pid]) g.fastest[pid] = x.el;
  }
  // The face owner scores a little for every friend who couldn't place them.
  const fooled = Object.values(r.guesses).filter((x) => !x.ok).length;
  if (fooled) ctx.award(g, r.target, fooled * 100);
  ctx.beat(g, 'reveal', 5500);
  if (right.length) ctx.sayName('zoom.reveal', r.target);
  else ctx.say('zoom.nobody');
}

export default {
  id: 'zoom',
  name: 'Zoom & Enhance',
  tagline: "An extreme close-up of a friend's face slowly enhances. Whose is it? Tap fast.",
  min: 3,
  max: 12,
  minutes: 5,
  tags: ['Faces', 'Quick', 'Reflexes'],
  faces: true,
  faceMin: 3,
  rules: [
    "Everyone's selfie goes into the evidence locker.",
    "Each round shows one face as an extreme close-up, pixelated, blurred or scrambled. It slowly enhances.",
    'Tap whose face it is. The faster you get it right, the more points. One guess per round!',
  ],
  ROUND_MS,
  setup(ctx, g) {
    g.round = 0;
    const faces = facePlayers(ctx, g).length;
    g.rounds = Math.min(10, Math.max(5, faces * 2));
    g.used = [];
    g.fastest = {};
  },
  begin(ctx, g) {
    nextRound(ctx, g);
  },
  input(ctx, g, pid, d) {
    const r = g.r;
    if (d.t !== 'guess' || g.phase !== 'zoom' || !r || pid === r.target || r.guesses[pid]) return;
    if (!ctx.s.players[d.p]) return;
    const serverEl = ctx.now - g.t0;
    const el = Math.max(0, Math.min(serverEl, Number(d.el) || serverEl));
    r.guesses[pid] = { p: d.p, el, ok: d.p === r.target };
  },
  tick(ctx, g) {
    if (g.phase === 'zoom') {
      const guessers = g.pids.filter((p) => p !== g.r.target);
      if (ctx.due(g) || ctx.allDone(guessers, (p) => g.r.guesses[p])) reveal(ctx, g);
    } else if (g.phase === 'reveal') {
      if (ctx.due(g)) nextRound(ctx, g);
    }
  },
  skip(ctx, g) {
    if (g.phase === 'zoom') reveal(ctx, g);
    else g.until = ctx.now;
  },
  leave(ctx, g, pid) {
    g.pids = g.pids.filter((p) => p !== pid);
    if (g.r && g.r.target === pid && g.phase === 'zoom') reveal(ctx, g);
  },
  bot(g, pid, s) {
    const r = g.r;
    if (g.phase !== 'zoom' || !r || pid === r.target || r.guesses[pid]) return null;
    if (Math.random() < 0.6) return null;
    const faces = g.pids.filter((p) => p !== pid && s.players[p] && s.players[p].face);
    const p = Math.random() < 0.6 ? r.target : faces[Math.floor(Math.random() * faces.length)];
    return { t: 'guess', p, el: 2000 + Math.random() * 8000, step: g.step };
  },
};
