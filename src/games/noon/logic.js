// HIGH NOON: phones on the table, hands off. When YOUR screen says DRAW, tap it.
// Reaction time is measured on each phone from the moment DRAW appears on that
// phone, so network lag can't cheat anyone. Fake-outs (DRAGON! DRAMA!) punish twitchy fingers.
import { NOON_FAKES } from '../../content/table.js';

const ROUNDS = 5;
const WINDOW = 3500;

function nextRound(ctx, g) {
  g.round++;
  const base = ctx.now + 3200;
  const delay = 1800 + Math.floor(Math.random() * 4200);
  const events = [];
  if (Math.random() < 0.4) {
    const fakeAt = base + Math.floor(delay * (0.35 + Math.random() * 0.4));
    events.push({ at: fakeAt, kind: 'fake', word: ctx.pick(NOON_FAKES) });
    events.push({ at: Math.max(base + delay, fakeAt + 1300), kind: 'draw' });
  } else {
    events.push({ at: base + delay, kind: 'draw' });
  }
  const drawAt = events[events.length - 1].at;
  g.r = { events, drawAt, taps: {}, ranking: [], pts: {} };
  // The phase deadline is the end of the tap window; clients never show it.
  ctx.beat(g, 'standoff', drawAt + WINDOW - ctx.now);
  ctx.say('noon.ready');
}

function results(ctx, g) {
  const r = g.r;
  const valid = Object.entries(r.taps)
    .filter(([, t]) => !t.early && !t.fake && t.rt >= 90 && t.rt <= WINDOW)
    .sort((a, b) => a[1].rt - b[1].rt);
  const prizes = [1000, 600, 300];
  r.ranking = valid.map(([pid, t]) => ({ pid, rt: t.rt }));
  valid.forEach(([pid], i) => {
    const p = prizes[i] || 100;
    r.pts[pid] = p;
    ctx.award(g, pid, p);
    if (!g.best[pid] || r.taps[pid].rt < g.best[pid]) g.best[pid] = r.taps[pid].rt;
  });
  for (const [pid, t] of Object.entries(r.taps)) {
    if (t.early || t.fake || t.rt < 90) {
      r.pts[pid] = -250;
      ctx.award(g, pid, -250);
    }
  }
  if (Object.values(r.taps).some((t) => t.early || t.fake)) ctx.say('noon.early');
  else if (valid.length) ctx.say('noon.winner');
  ctx.beat(g, 'result', 6000);
}

export default {
  id: 'noon',
  name: 'High Noon',
  tagline: 'Phones down, hands off. When your screen says DRAW, slap it. Fastest hand wins.',
  min: 2,
  max: 16,
  minutes: 4,
  tags: ['Table game', 'Reflexes', 'Any size'],
  rules: [
    'Put your phone flat on the table and take your hands off it.',
    'When YOUR screen flashes DRAW, tap it as fast as you can. Reaction time is measured on your own phone, so lag never matters.',
    "Watch out for fake-outs like DRAGON or DRAMA. Tap on anything but DRAW and you lose points.",
  ],
  WINDOW,
  setup(ctx, g) {
    g.round = 0;
    g.best = {};
  },
  begin(ctx, g) {
    nextRound(ctx, g);
  },
  input(ctx, g, pid, d) {
    if (d.t !== 'tap' || g.phase !== 'standoff' || g.r.taps[pid]) return;
    const rt = Math.round(Number(d.rt) || 0);
    g.r.taps[pid] = { rt, early: !!d.early, fake: !!d.fake };
  },
  tick(ctx, g) {
    if (g.phase === 'standoff') {
      const r = g.r;
      const all = ctx.allDone(g.pids, (p) => r.taps[p]);
      if (ctx.due(g) || (all && ctx.now >= r.drawAt)) results(ctx, g);
    } else if (g.phase === 'result') {
      if (ctx.due(g)) {
        if (g.round >= ROUNDS) {
          const fastest = Object.keys(g.best).sort((a, b) => g.best[a] - g.best[b])[0];
          ctx.end(g, { awards: fastest ? [{ pid: fastest, title: 'Fastest hand in the west', detail: `${(g.best[fastest] / 1000).toFixed(3)} s` }] : [] });
        } else nextRound(ctx, g);
      }
    }
  },
  skip(ctx, g) {
    if (g.phase === 'standoff') results(ctx, g);
    else g.until = ctx.now;
  },
  leave(ctx, g, pid) {
    g.pids = g.pids.filter((p) => p !== pid);
  },
  bot(g, pid, s) {
    if (g.phase === 'standoff' && !g.r.taps[pid]) {
      if (Math.random() < 0.08) return { t: 'tap', rt: 0, early: true, step: g.step };
      return { t: 'tap', rt: 180 + Math.floor(Math.random() * 300), step: g.step };
    }
    return null;
  },
};
