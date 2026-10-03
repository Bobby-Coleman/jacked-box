// MIND DIAL: one psychic sees a hidden target on a spectrum and gives a clue;
// everyone else turns their own dial to match (Wavelength-style, but individual).
import { DIAL_CARDS } from '../../content/dial.js';
import { clean } from '../../engine/text.js';

export function points(diff) {
  const d = Math.abs(diff);
  if (d <= 3) return 4;
  if (d <= 8) return 3;
  if (d <= 13) return 2;
  return 0;
}

function drawCard(ctx) {
  const c = ctx.take('dial', DIAL_CARDS, 1, (x) => ctx.spicy || !x[2])[0];
  return [c[0], c[1]];
}

function nextRound(ctx, g) {
  g.round++;
  if (g.round > g.rounds) {
    ctx.end(g, { awards: awards(g) });
    return;
  }
  // Rotate psychics through live players.
  let psychic = null;
  for (let i = 0; i < g.order.length; i++) {
    const cand = g.order[(g.round - 1 + i) % g.order.length];
    if (ctx.on(cand)) {
      psychic = cand;
      break;
    }
  }
  psychic = psychic || g.order[(g.round - 1) % g.order.length];
  g.r = {
    psychic,
    card: drawCard(ctx),
    target: 4 + Math.floor(Math.random() * 93),
    clue: '',
    redraws: 1,
    guesses: {},
    locked: {},
    pts: {},
  };
  ctx.phase(g, 'clue', 70000);
  ctx.say('dial.clue');
}

function startGuess(ctx, g) {
  if (!g.r.clue) {
    // Psychic stalled: skip their turn.
    g.r.clue = '(no clue)';
  }
  ctx.phase(g, 'guess', 40000);
  ctx.read(`The clue is: ${g.r.clue}`);
  ctx.say('dial.guess');
}

function reveal(ctx, g) {
  const r = g.r;
  let total = 0;
  let n = 0;
  let bull = false;
  for (const pid of g.pids) {
    if (pid === r.psychic) continue;
    const v = r.guesses[pid];
    if (typeof v !== 'number') continue;
    const p = points(v - r.target);
    if (p === 4) bull = true;
    r.pts[pid] = p * 100;
    ctx.award(g, pid, p * 100);
    total += p;
    n++;
    g.stats[pid] = g.stats[pid] || { bulls: 0, psy: 0 };
    if (p === 4) g.stats[pid].bulls++;
  }
  const psy = n ? Math.round((total / n) * 100) : 0;
  r.pts[r.psychic] = psy;
  ctx.award(g, r.psychic, psy);
  g.stats[r.psychic] = g.stats[r.psychic] || { bulls: 0, psy: 0 };
  g.stats[r.psychic].psy += psy;
  ctx.beat(g, 'reveal', 8000);
  ctx.say(bull ? 'dial.bullseye' : 'dial.reveal');
}

function awards(g) {
  const s = g.stats || {};
  const ids = Object.keys(s);
  const out = [];
  const bull = ids.slice().sort((a, b) => s[b].bulls - s[a].bulls)[0];
  if (bull && s[bull].bulls) out.push({ pid: bull, title: 'Mind reader', detail: `${s[bull].bulls} bullseye${s[bull].bulls > 1 ? 's' : ''}` });
  const psy = ids.slice().sort((a, b) => s[b].psy - s[a].psy)[0];
  if (psy && s[psy].psy) out.push({ pid: psy, title: 'Best psychic', detail: 'Gave the clearest clues' });
  return out;
}

export default {
  id: 'dial',
  name: 'Mind Dial',
  tagline: "One psychic, one secret target, one clue. Read your friend's mind.",
  min: 2,
  max: 12,
  minutes: 10,
  tags: ['Clever clues', 'Small groups'],
  rules: [
    'Each round, one player is the psychic. Only they can see where the target is on the dial.',
    "The psychic gives a clue that sits at that spot. For Cold to Hot, 'soup' might be pretty hot.",
    'Everyone else turns their dial. Closer means more points. The psychic scores when everyone gets close.',
  ],
  setup(ctx, g) {
    g.round = 0;
    g.order = ctx.shuffle(g.pids);
    g.rounds = Math.min(g.order.length <= 3 ? g.order.length * 2 : g.order.length, 8);
    g.stats = {};
  },
  begin(ctx, g) {
    nextRound(ctx, g);
  },
  input(ctx, g, pid, d) {
    const r = g.r;
    if (!r) return;
    if (d.t === 'clue' && g.phase === 'clue' && pid === r.psychic) {
      const c = clean(d.text, 40);
      if (c) {
        r.clue = c;
        startGuess(ctx, g);
      }
    } else if (d.t === 'redraw' && g.phase === 'clue' && pid === r.psychic && r.redraws > 0) {
      r.redraws--;
      r.card = drawCard(ctx);
      r.target = 4 + Math.floor(Math.random() * 93);
    } else if (d.t === 'guess' && g.phase === 'guess' && pid !== r.psychic && !r.locked[pid]) {
      const v = Math.round(Number(d.v));
      if (v >= 0 && v <= 100) {
        r.guesses[pid] = v;
        if (d.lock) r.locked[pid] = 1;
      }
    }
  },
  tick(ctx, g) {
    const r = g.r;
    if (g.phase === 'clue') {
      if (ctx.due(g) || !ctx.on(r.psychic)) startGuess(ctx, g);
    } else if (g.phase === 'guess') {
      const guessers = g.pids.filter((p) => p !== r.psychic);
      if (ctx.now >= g.until + 600 || ctx.allDone(guessers, (p) => r.locked[p])) reveal(ctx, g);
    } else if (g.phase === 'reveal') {
      if (ctx.due(g)) nextRound(ctx, g);
    }
  },
  skip(ctx, g) {
    if (g.phase === 'clue') startGuess(ctx, g);
    else if (g.phase === 'guess') reveal(ctx, g);
    else g.until = ctx.now;
  },
  leave(ctx, g, pid) {
    g.pids = g.pids.filter((p) => p !== pid);
    g.order = g.order.filter((p) => p !== pid);
  },
  bot(g, pid) {
    const r = g.r;
    const step = g.step;
    if (!r) return null;
    if (g.phase === 'clue' && pid === r.psychic) return { t: 'clue', text: 'soup', step };
    if (g.phase === 'guess' && pid !== r.psychic && !r.locked[pid]) return { t: 'guess', v: Math.floor(Math.random() * 101), lock: true, step };
    return null;
  },
};
