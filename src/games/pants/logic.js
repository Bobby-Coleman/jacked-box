// PANTS ON FIRE: two truths and a lie, with a face in the hot seat. Everyone writes three
// statements about themselves and marks the lie. Then each player takes a turn: the
// room grills them out loud, then votes which statement is the lie.
import { clean } from '../../engine/text.js';

function startWrite(ctx, g) {
  g.sets = {};
  ctx.phase(g, 'write', 120000);
  ctx.say('pants.write');
}

function startTurns(ctx, g) {
  g.queue = ctx.shuffle(Object.keys(g.sets).filter((p) => ctx.exists(p)));
  g.qi = -1;
  if (!g.queue.length) {
    finish(ctx, g);
    return;
  }
  nextSubject(ctx, g);
}

function nextSubject(ctx, g) {
  g.qi++;
  while (g.qi < g.queue.length && !ctx.exists(g.queue[g.qi])) g.qi++;
  if (g.qi >= g.queue.length) {
    finish(ctx, g);
    return;
  }
  const subject = g.queue[g.qi];
  const set = g.sets[subject];
  const perm = ctx.shuffle([0, 1, 2]);
  g.r = {
    subject,
    lines: perm.map((i) => set.s[i]),
    lie: perm.indexOf(set.lie),
    guesses: {},
    pts: {},
  };
  ctx.phase(g, 'grill', 40000);
  ctx.sayName('pants.grill', subject);
}

function reveal(ctx, g) {
  const r = g.r;
  let fooled = 0;
  for (const [pid, i] of Object.entries(r.guesses)) {
    if (i === r.lie) {
      r.pts[pid] = 500;
      ctx.award(g, pid, 500);
      g.detect[pid] = (g.detect[pid] || 0) + 1;
    } else fooled++;
  }
  // Players who never guessed aren't counted as fooled.
  if (fooled) {
    r.pts[r.subject] = fooled * 250;
    ctx.award(g, r.subject, fooled * 250);
  }
  g.fooled[r.subject] = (g.fooled[r.subject] || 0) + fooled;
  r.fooled = fooled;
  ctx.beat(g, 'reveal', 7000);
  ctx.say(fooled ? 'pants.fooled' : 'pants.caught');
}

function guessers(g) {
  return g.pids.filter((p) => p !== g.r.subject).concat(g.aud || []);
}

function finish(ctx, g) {
  const awards = [];
  const liar = Object.keys(g.fooled).sort((a, b) => g.fooled[b] - g.fooled[a])[0];
  if (liar && g.fooled[liar]) awards.push({ pid: liar, title: 'Best liar', detail: `Fooled ${g.fooled[liar]} ${g.fooled[liar] === 1 ? 'person' : 'people'}` });
  const det = Object.keys(g.detect).sort((a, b) => g.detect[b] - g.detect[a])[0];
  if (det && g.detect[det]) awards.push({ pid: det, title: 'Human lie detector', detail: `Spotted ${g.detect[det]} ${g.detect[det] === 1 ? 'lie' : 'lies'}` });
  ctx.end(g, { awards });
}

export default {
  id: 'pants',
  name: 'Pants on Fire',
  tagline: 'Two truths and a lie, with your face in the hot seat. Grill each other.',
  min: 3,
  max: 10,
  minutes: 10,
  tags: ['About us', 'Talk it out', 'Bluffing'],
  faces: true,
  rules: [
    'Write three things about yourself: two true, one a lie. Mark the lie.',
    'One at a time, each player takes the hot seat. Grill them out loud, then vote which one is the lie.',
    'Spot the lie: 500 points. Fool someone: 250 points each.',
  ],
  setup(ctx, g) {
    g.fooled = {};
    g.detect = {};
  },
  begin(ctx, g) {
    startWrite(ctx, g);
  },
  audience(g, d) {
    return d.t === 'guess';
  },
  input(ctx, g, pid, d) {
    if (d.t === 'stmts' && g.phase === 'write') {
      if (g.sets[pid] || !g.pids.includes(pid)) return;
      const s = [clean(d.a, 90), clean(d.b, 90), clean(d.c, 90)];
      const lie = Number(d.lie);
      if (s.some((x) => !x) || ![0, 1, 2].includes(lie)) return;
      g.sets[pid] = { s, lie };
    } else if (d.t === 'guess' && g.phase === 'grill') {
      const i = Number(d.i);
      if (pid !== g.r.subject && [0, 1, 2].includes(i)) g.r.guesses[pid] = i;
    }
  },
  tick(ctx, g) {
    if (g.phase === 'write') {
      if (ctx.now >= g.until + 1500 || ctx.allDone(g.pids, (p) => g.sets[p])) startTurns(ctx, g);
    } else if (g.phase === 'grill') {
      if (ctx.due(g) || ctx.allDone(guessers(g), (p) => g.r.guesses[p] !== undefined)) reveal(ctx, g);
    } else if (g.phase === 'reveal') {
      if (ctx.due(g)) nextSubject(ctx, g);
    }
  },
  skip(ctx, g) {
    if (g.phase === 'write') startTurns(ctx, g);
    else if (g.phase === 'grill') reveal(ctx, g);
    else g.until = ctx.now;
  },
  leave(ctx, g, pid) {
    g.pids = g.pids.filter((p) => p !== pid);
  },
  bot(g, pid) {
    const step = g.step;
    if (g.phase === 'write' && !g.sets[pid]) {
      return { t: 'stmts', a: 'I have a pet rock', b: 'I once met a famous robot', c: 'I can juggle five toasters', lie: Math.floor(Math.random() * 3), step };
    }
    if (g.phase === 'grill' && g.r && pid !== g.r.subject && g.r.guesses[pid] === undefined) {
      return { t: 'guess', i: Math.floor(Math.random() * 3), step };
    }
    return null;
  },
};
