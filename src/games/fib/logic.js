// FIB FACTORY: bluffing trivia (Fibbage-style).
// Weird true facts with a blank: write a lie that fools friends, then find the truth.
// "About us" questions: one player answers truthfully about themselves; everyone else lies.
import { FIB_FACTS, FIB_ABOUT } from '../../content/fib.js';
import { clean, similar } from '../../engine/text.js';

const PLAN = [
  { round: 1, mult: 1 },
  { round: 1, mult: 1, about: true },
  { round: 2, mult: 2 },
  { round: 2, mult: 2, about: true },
  { round: 3, mult: 3 },
];
export const REVEAL_STEP = 2400;

function isTruth(q, text) {
  if (!q.truth) return false;
  return similar(text, q.truth) || (q.alt || []).some((a) => similar(text, a));
}

function nextQuestion(ctx, g) {
  g.qn++;
  if (g.qn >= PLAN.length) {
    ctx.end(g, { awards: awards(g) });
    return;
  }
  const plan = PLAN[g.qn];
  if (plan.round !== g.round) {
    g.round = plan.round;
    if (plan.round === 2) ctx.say('fib.round2');
    if (plan.round === 3) ctx.say('fib.final');
  }
  const live = ctx.live(g);
  let q;
  if (plan.about && ctx.aboutUs && live.length >= 3) {
    const pool = live.filter((p) => !g.abouted.includes(p));
    const target = ctx.pick(pool.length ? pool : live);
    g.abouted.push(target);
    const t = ctx.content(ctx.take('fib-about', FIB_ABOUT, 1, ctx.family)[0]);
    q = { about: target, text: t.replace(/\{name\}/g, ctx.name(target)), truth: null, alt: [], decoys: [] };
    ctx.say('fib.about');
  } else {
    const f = ctx.take('fib', FIB_FACTS, 1, ctx.family)[0];
    q = { about: null, text: f.q, truth: f.a, alt: f.alt, decoys: f.d };
  }
  g.q = { ...q, mult: plan.mult, lies: {}, rej: {}, opts: [], picks: {}, likes: {}, pts: {} };
  ctx.phase(g, 'lie', 45000);
  ctx.read(q.text.replace(/_+/g, 'blank'));
  ctx.say('fib.lie');
}

function choosers(g) {
  return g.pids.filter((p) => p !== g.q.about);
}

function startPick(ctx, g) {
  const q = g.q;
  if (q.about && !q.truth) {
    // The subject never answered: fall back to a regular fact.
    g.qn--;
    const f = ctx.take('fib', FIB_FACTS, 1, ctx.family)[0];
    g.q = { about: null, text: f.q, truth: f.a, alt: f.alt, decoys: f.d, mult: q.mult, lies: {}, rej: {}, opts: [], picks: {}, likes: {}, pts: {} };
    g.qn++;
    ctx.phase(g, 'lie', 45000);
    ctx.read(f.q.replace(/_+/g, 'blank'));
    return;
  }
  const opts = [{ id: 'T', text: q.truth, by: [] }];
  for (const [pid, text] of Object.entries(q.lies)) {
    const same = opts.find((o) => o.id !== 'T' && similar(o.text, text));
    if (same) same.by.push(pid);
    else opts.push({ id: 'L' + opts.length, text, by: [pid] });
  }
  // Pad with house lies so there's always a real choice.
  const want = Math.max(4, Math.min(6, choosers(g).length + 1));
  for (const d of ctx.shuffle(q.decoys || [])) {
    if (opts.length >= want) break;
    if (!opts.some((o) => similar(o.text, d))) opts.push({ id: 'H' + opts.length, text: d, by: [], house: 1 });
  }
  q.opts = ctx.shuffle(opts);
  ctx.phase(g, 'pick', 25000);
  ctx.say('fib.choose');
}

function reveal(ctx, g) {
  const q = g.q;
  const m = q.mult;
  const pts = {};
  const add = (pid, n) => {
    pts[pid] = (pts[pid] || 0) + n;
    ctx.award(g, pid, n);
  };
  const st = (pid) => (g.stats[pid] = g.stats[pid] || { fooled: 0, found: 0 });
  let found = 0;
  for (const [pid, oid] of Object.entries(q.picks)) {
    const o = q.opts.find((x) => x.id === oid);
    if (!o) continue;
    if (o.id === 'T') {
      add(pid, 1000 * m);
      st(pid).found++;
      found++;
      if (q.about) add(q.about, 250 * m);
    } else {
      for (const author of o.by) {
        if (author !== pid) {
          add(author, 500 * m);
          st(author).fooled++;
        }
      }
    }
  }
  q.pts = pts;
  g.liked = g.liked || {};
  for (const [oid, ids] of Object.entries(q.likes || {})) {
    const o = q.opts.find((x) => x.id === oid);
    if (o) for (const author of o.by) g.liked[author] = (g.liked[author] || 0) + ids.length;
  }
  const pickedCount = (o) => Object.values(q.picks).filter((v) => v === o.id).length;
  const lies = q.opts.filter((o) => o.id !== 'T' && pickedCount(o) > 0);
  lies.sort((a, b) => pickedCount(a) - pickedCount(b));
  q.revealOrder = lies.map((o) => o.id).concat(['T']);
  q.nobody = found === 0;
  ctx.beat(g, 'reveal', 1500 + q.revealOrder.length * REVEAL_STEP + 3000);
  ctx.say(found === 0 ? 'fib.nobody' : 'fib.truth');
}

function awards(g) {
  const s = g.stats || {};
  const ids = Object.keys(s);
  const out = [];
  const liar = ids.slice().sort((a, b) => s[b].fooled - s[a].fooled)[0];
  if (liar && s[liar].fooled) out.push({ pid: liar, title: 'Most convincing liar', detail: `Fooled people ${s[liar].fooled} times` });
  const det = ids.slice().sort((a, b) => s[b].found - s[a].found)[0];
  if (det && s[det].found) out.push({ pid: det, title: 'Lie detector', detail: `Found the truth ${s[det].found} times` });
  const liked = g.liked || {};
  const fun = Object.keys(liked).sort((a, b) => liked[b] - liked[a])[0];
  if (fun && liked[fun]) out.push({ pid: fun, title: 'Funniest lies', detail: `${liked[fun]} heart${liked[fun] > 1 ? 's' : ''} from the room` });
  return out;
}

export default {
  id: 'fib',
  name: 'Fib Factory',
  tagline: 'Weird true facts with a blank. Lie convincingly, then sniff out the truth.',
  min: 2,
  max: 10,
  minutes: 12,
  tags: ['Bluffing', 'Trivia', 'About us'],
  rules: [
    "You'll see a strange but true fact with a blank in it.",
    'Fill in the blank with a lie good enough to fool your friends.',
    'Then find the real answer among the lies. Some questions are about the people in this room!',
  ],
  setup(ctx, g) {
    g.qn = -1;
    g.round = 0;
    g.abouted = [];
    g.stats = {};
  },
  begin(ctx, g) {
    nextQuestion(ctx, g);
  },
  anyStep(d) {
    return d.t === 'like';
  },
  input(ctx, g, pid, d) {
    const q = g.q;
    if (!q) return;
    if (d.t === 'lie' && g.phase === 'lie') {
      const text = clean(d.text, 50);
      if (!text) return;
      if (q.about === pid) {
        if (!q.truth) q.truth = text;
        return;
      }
      if (q.lies[pid]) return;
      if (isTruth(q, text)) {
        q.rej[pid] = (q.rej[pid] || 0) + 1;
        return;
      }
      q.lies[pid] = text;
    } else if (d.t === 'pick' && g.phase === 'pick' && pid !== q.about) {
      const o = q.opts.find((x) => x.id === d.o);
      if (o && !o.by.includes(pid)) q.picks[pid] = o.id;
    } else if (d.t === 'like' && (g.phase === 'pick' || g.phase === 'reveal')) {
      const o = q.opts.find((x) => x.id === d.o);
      if (o && !o.by.includes(pid) && o.id !== 'T') {
        const l = (q.likes[o.id] = q.likes[o.id] || []);
        if (!l.includes(pid)) l.push(pid);
      }
    }
  },
  tick(ctx, g) {
    const q = g.q;
    const grace = 1000;
    switch (g.phase) {
      case 'lie': {
        const done = ctx.allDone(g.pids, (p) => (p === q.about ? !!q.truth : !!q.lies[p]));
        if (ctx.now >= g.until + grace || done) startPick(ctx, g);
        break;
      }
      case 'pick':
        if (ctx.due(g) || ctx.allDone(choosers(g), (p) => q.picks[p])) reveal(ctx, g);
        break;
      case 'reveal':
        if (ctx.due(g)) nextQuestion(ctx, g);
        break;
      default:
        break;
    }
  },
  skip(ctx, g) {
    if (g.phase === 'lie') startPick(ctx, g);
    else if (g.phase === 'pick') reveal(ctx, g);
    else g.until = ctx.now;
  },
  leave(ctx, g, pid) {
    g.pids = g.pids.filter((p) => p !== pid);
  },
  bot(g, pid) {
    const q = g.q;
    const step = g.step;
    if (!q) return null;
    if (g.phase === 'lie') {
      if (q.about === pid && !q.truth) return { t: 'lie', text: 'my true answer', step };
      if (q.about !== pid && !q.lies[pid]) return { t: 'lie', text: 'lie ' + Math.floor(Math.random() * 1000), step };
    }
    if (g.phase === 'pick' && pid !== q.about && !q.picks[pid]) {
      const opts = q.opts.filter((o) => !o.by.includes(pid));
      if (opts.length) return { t: 'pick', o: opts[Math.floor(Math.random() * opts.length)].id, step };
    }
    return null;
  },
};
