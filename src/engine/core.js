// Room engine: pure state transitions run by whichever phone is the host.
// Game modules plug in through a small ctx API (phases, timers, scoring, voice cues).
import { GAMES } from '../games/logic.js';
import { LINES } from '../content/voice.js';

export const MAX_PLAYERS = 16;
export const PLAYER_COLORS = [
  '#ff4d3d', '#2f7bff', '#ffc21a', '#19b66a', '#ff7ac6', '#8b5cf6',
  '#00b8c4', '#ff8a1f', '#7a9a1e', '#e0457b', '#5b6bff', '#b07a3a',
  '#14a39a', '#d94bd9', '#9aa33b', '#ff5e5e',
];
const TIMER_SCALE = { fast: 0.7, normal: 1, chill: 1.6 };
const DEFAULT_SETTINGS = { spicy: false, timer: 'normal', voice: true, music: true, aboutUs: true };

export function cleanName(n) {
  return String(n || '')
    .replace(/[\u0000-\u001f<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 12);
}

function cleanAv(av) {
  const a = av && typeof av === 'object' ? av : {};
  const int = (x, max) => Math.max(0, Math.min(max, Math.floor(Number(x) || 0)));
  return { b: int(a.b, 7), e: int(a.e, 11), m: int(a.m, 11), h: int(a.h, 13) };
}

function pickColor(s) {
  const used = new Set(Object.values(s.players).map((p) => p.color));
  return PLAYER_COLORS.find((c) => !used.has(c)) || PLAYER_COLORS[Object.keys(s.players).length % PLAYER_COLORS.length];
}

function uniqueName(s, pid, name) {
  let base = name || 'PLAYER';
  const taken = (n) => Object.values(s.players).some((p) => p.id !== pid && p.name.toLowerCase() === n.toLowerCase());
  if (!taken(base)) return base;
  for (let i = 2; i < 30; i++) {
    const n = base.slice(0, 10) + i;
    if (!taken(n)) return n;
  }
  return base;
}

export function createRoom({ code, me, settings, now }) {
  const s = {
    code,
    term: 0,
    v: 0,
    host: me.id,
    created: now,
    updated: now,
    vip: null,
    speaker: null,
    players: {},
    order: [],
    acks: {},
    settings: { ...DEFAULT_SETTINGS, ...(settings || {}) },
    scene: 'lobby',
    pick: null,
    game: null,
    results: null,
    cues: [],
    cueN: 0,
    music: 'lobby',
    used: {},
    blobs: [],
    reacts: [],
    reactN: 0,
    closed: false,
    played: 0,
  };
  addPlayer(s, me.id, me, now);
  return s;
}

function addPlayer(s, pid, info, now) {
  let p = s.players[pid];
  if (!p) {
    if (Object.keys(s.players).length >= MAX_PLAYERS) return false;
    p = s.players[pid] = {
      id: pid,
      name: uniqueName(s, pid, cleanName(info.name) || 'PLAYER'),
      av: cleanAv(info.av),
      color: pickColor(s),
      joined: now,
      on: true,
      screen: !!info.screen,
    };
    if (info.bot) p.bot = true;
    s.order.push(pid);
    if (!p.screen && !p.bot && (!s.vip || !s.players[s.vip])) s.vip = pid;
    // A table screen is the best speaker: it lies in the middle and stays awake.
    if (!p.bot && (p.screen || !s.speaker || !s.players[s.speaker])) s.speaker = pid;
  } else {
    // A rejoin (page reload, phone woke up) keeps the identity the room already knows.
    if (!info.rejoin) {
      if (info.name) p.name = uniqueName(s, pid, cleanName(info.name) || p.name);
      if (info.av) p.av = cleanAv(info.av);
    }
    p.on = true;
  }
  return true;
}

function removePlayer(s, pid, now, io) {
  if (!s.players[pid]) return;
  const g = s.game;
  delete s.players[pid];
  s.order = s.order.filter((x) => x !== pid);
  if (s.vip === pid) s.vip = nextVip(s);
  if (s.speaker === pid) s.speaker = s.vip || s.host;
  if (g) {
    const mod = GAMES[g.id];
    const ctx = makeCtx(s, now, io);
    if (mod && mod.leave) mod.leave(ctx, g, pid);
  }
}

function nextVip(s) {
  const ids = s.order.filter((id) => s.players[id] && !s.players[id].screen && !s.players[id].bot);
  return ids.find((id) => s.players[id].on !== false) || ids[0] || null;
}

// ---------- ctx for game modules ----------

export function makeCtx(s, now, io) {
  const ctx = {
    s,
    now,
    io: io || { blob: () => null, dropBlob: () => {} },
    spicy: !!s.settings.spicy,
    aboutUs: s.settings.aboutUs !== false,
    rand: Math.random,
    dur(ms) {
      return Math.round(ms * (TIMER_SCALE[s.settings.timer] || 1));
    },
    // Timed phase (scaled by the room's timer setting). ms=0 -> no deadline.
    phase(g, name, ms) {
      g.phase = name;
      g.t0 = now;
      g.until = ms ? now + ctx.dur(ms) : 0;
      g.step = (g.step || 0) + 1;
    },
    // Presentation beat: fixed duration, not scaled.
    beat(g, name, ms) {
      g.phase = name;
      g.t0 = now;
      g.until = ms ? now + ms : 0;
      g.step = (g.step || 0) + 1;
    },
    due(g) {
      return g.until && now >= g.until;
    },
    on(pid) {
      const p = s.players[pid];
      return !!(p && p.on !== false);
    },
    exists(pid) {
      return !!s.players[pid];
    },
    name(pid) {
      return (s.players[pid] && s.players[pid].name) || 'Someone';
    },
    // Participants still connected.
    live(g) {
      return g.pids.filter((pid) => ctx.on(pid));
    },
    // True when every connected participant in `pids` satisfies `pred`.
    allDone(pids, pred) {
      const live = pids.filter((pid) => ctx.on(pid));
      return live.length > 0 && live.every(pred);
    },
    say(key, opts) {
      const list = LINES[key];
      if (!list || !list.length) return;
      if (s.settings.voice === false && !(opts && opts.caption)) return;
      const i = Math.floor(Math.random() * list.length);
      pushCue(s, { k: key, i, t: list[i], at: now });
    },
    read(text) {
      if (!text) return;
      pushCue(s, { tts: String(text).slice(0, 220), t: String(text).slice(0, 220), at: now });
    },
    award(g, pid, pts) {
      if (!pid || !pts) return;
      g.scores[pid] = (g.scores[pid] || 0) + Math.round(pts);
    },
    shuffle(arr) {
      const a = arr.slice();
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    },
    pick(arr) {
      return arr[Math.floor(Math.random() * arr.length)];
    },
    // Draw n content items from a pool without repeating within the session.
    take(pool, items, n, filter) {
      const ok = items.map((it, idx) => ({ it, idx })).filter(({ it }) => (filter ? filter(it) : true));
      const used = new Set(s.used[pool] || []);
      let fresh = ok.filter(({ idx }) => !used.has(idx));
      if (fresh.length < n) {
        s.used[pool] = [];
        fresh = ok;
      }
      const chosen = ctx.shuffle(fresh).slice(0, n);
      s.used[pool] = (s.used[pool] || []).concat(chosen.map((c) => c.idx)).slice(-300);
      return chosen.map((c) => c.it);
    },
    content(it) {
      // Content items may be strings or {t, s(picy)} objects.
      return typeof it === 'string' ? it : it.t;
    },
    family(it) {
      return ctx.spicy || typeof it === 'string' || !it.s;
    },
    blob(data) {
      const id = ctx.io.blob(data);
      if (id) s.blobs.push(id);
      return id;
    },
    end(g, extra = {}) {
      finishGame(s, g, now, extra);
    },
  };
  return ctx;
}

function pushCue(s, cue) {
  s.cueN = (s.cueN || 0) + 1;
  cue.n = s.cueN;
  s.cues.push(cue);
  if (s.cues.length > 6) s.cues.splice(0, s.cues.length - 6);
}

function finishGame(s, g, now, extra) {
  const ranking = Object.keys(g.scores)
    .filter((pid) => s.players[pid])
    .sort((a, b) => g.scores[b] - g.scores[a]);
  s.results = {
    id: g.id,
    scores: { ...g.scores },
    ranking,
    awards: extra.awards || [],
    note: extra.note || '',
    coop: extra.coop || null,
    at: now,
  };
  s.scene = 'results';
  s.game = null;
  s.music = 'results';
  s.played = (s.played || 0) + 1;
  const ctx = makeCtx(s, now);
  if (!extra.coop) ctx.say('results.winner');
}

function startGame(s, id, now, io) {
  const mod = GAMES[id];
  if (!mod) return;
  const pids = s.order.filter((x) => s.players[x] && !s.players[x].screen && s.players[x].on !== false);
  if (pids.length < mod.min) return;
  for (const b of s.blobs || []) io && io.dropBlob(b);
  s.blobs = [];
  const players = pids.slice(0, mod.max);
  const g = {
    id,
    pids: players,
    aud: pids.slice(mod.max),
    phase: 'intro',
    t0: now,
    until: now + 16000,
    step: 0,
    round: 0,
    scores: Object.fromEntries(players.map((x) => [x, 0])),
  };
  s.game = g;
  s.scene = 'game';
  s.results = null;
  s.pick = id;
  s.music = id;
  const ctx = makeCtx(s, now, io);
  ctx.say(`${id}.intro`);
  if (mod.setup) mod.setup(ctx, g);
}

// ---------- engine entry points (called by RoomLink on the host) ----------

export function reduce(s, pid, y, d, now, io) {
  d = d || {};
  if (y === 'join') {
    addPlayer(s, pid, d, now);
    return;
  }
  const p = s.players[pid];
  if (!p) return;
  const isVip = s.vip === pid;
  switch (y) {
    case 'profile':
      addPlayer(s, pid, { name: d.name, av: d.av }, now);
      break;
    case 'leave':
      removePlayer(s, pid, now, io);
      break;
    case 'settings':
      if (!isVip) break;
      for (const k of Object.keys(DEFAULT_SETTINGS)) {
        if (d[k] === undefined) continue;
        if (k === 'timer') {
          if (TIMER_SCALE[d[k]]) s.settings.timer = d[k];
        } else s.settings[k] = !!d[k];
      }
      break;
    case 'pick':
      if (isVip && s.scene === 'lobby' && (d.id === null || GAMES[d.id])) s.pick = d.id;
      break;
    case 'start':
      if (isVip && s.scene !== 'game') startGame(s, d.id, now, io);
      break;
    case 'again':
      if (isVip && s.scene === 'results' && s.results) startGame(s, s.results.id, now, io);
      break;
    case 'lobby':
      if (isVip && s.scene === 'results') {
        s.scene = 'lobby';
        s.music = 'lobby';
      }
      break;
    case 'end':
      if (isVip && s.scene === 'game') {
        s.scene = 'lobby';
        s.game = null;
        s.music = 'lobby';
      }
      break;
    case 'skip':
      if (isVip && s.scene === 'game' && s.game) {
        const g = s.game;
        const mod = GAMES[g.id];
        const ctx = makeCtx(s, now, io);
        if (g.phase === 'intro') {
          mod.begin(ctx, g);
        } else if (mod.skip) mod.skip(ctx, g);
        else g.until = now;
      }
      break;
    case 'kick':
      if (isVip && d.pid && d.pid !== pid) removePlayer(s, d.pid, now, io);
      break;
    case 'speaker':
      if ((isVip || d.pid === pid) && s.players[d.pid]) s.speaker = d.pid;
      break;
    case 'vip':
      if (isVip && s.players[d.pid] && !s.players[d.pid].screen) s.vip = d.pid;
      break;
    case 'react': {
      const e = String(d.e || '').slice(0, 8);
      if (!e) break;
      s.reactN = (s.reactN || 0) + 1;
      s.reacts.push({ n: s.reactN, p: pid, e, at: now });
      if (s.reacts.length > 10) s.reacts.splice(0, s.reacts.length - 10);
      break;
    }
    case 'close':
      if (isVip) s.closed = true;
      break;
    case 'addbot': {
      // Developer/test helper: the host phone plays for bot players.
      if (!isVip || s.scene !== 'lobby') break;
      const n = Object.values(s.players).filter((x) => x.bot).length;
      const name = BOT_NAMES[n % BOT_NAMES.length];
      const av = { b: Math.floor(Math.random() * 8), e: Math.floor(Math.random() * 12), m: Math.floor(Math.random() * 12), h: Math.floor(Math.random() * 14) };
      addPlayer(s, 'bot_' + Math.random().toString(36).slice(2, 8), { name, av, bot: true }, now);
      break;
    }
    case 'dropbots':
      if (!isVip || s.scene === 'game') break;
      for (const id of Object.keys(s.players)) if (s.players[id].bot) removePlayer(s, id, now, io);
      break;
    case 'g': {
      const g = s.game;
      if (!g || s.scene !== 'game') break;
      const mod = GAMES[g.id];
      const inGame = g.pids.includes(pid);
      if (!inGame && !(mod.audience && mod.audience(g, d))) break;
      if (d.step !== undefined && d.step !== g.step && !(mod.anyStep && mod.anyStep(d))) break;
      mod.input(makeCtx(s, now, io), g, pid, d);
      break;
    }
    default:
      break;
  }
}

export function tick(s, now, io) {
  // Keep a VIP and a speaker around.
  const vip = s.players[s.vip];
  if (!vip || (vip.on === false && now - (vip.offAt || now) > 15000)) {
    const nv = nextVip(s);
    if (nv && nv !== s.vip) s.vip = nv;
  }
  const sp = s.players[s.speaker];
  if (!sp || (sp.on === false && now - (sp.offAt || now) > 8000)) {
    const ns = s.players[s.vip] && s.players[s.vip].on !== false ? s.vip : s.host;
    if (ns && ns !== s.speaker) s.speaker = ns;
  }
  if (s.scene !== 'game' || !s.game) return;
  const g = s.game;
  const mod = GAMES[g.id];
  if (!mod) return;
  const ctx = makeCtx(s, now, io);
  if (g.phase === 'intro') {
    if (now >= g.until) mod.begin(ctx, g);
    return;
  }
  mod.tick(ctx, g);
}

const BOT_NAMES = ['BEEPBOOP', 'ROBO-RITA', 'CHAD-GPT', 'SIRI-OUSLY', 'TOASTER', 'R2-DEUCE', 'BYTE-ME', 'CLANKY'];

// Let bot players act (called by the host every tick).
export function botTick(s, now, io) {
  if (s.scene !== 'game' || !s.game) return;
  const g = s.game;
  const mod = GAMES[g.id];
  if (!mod || !mod.bot || g.phase === 'intro') return;
  for (const pid of g.pids) {
    const p = s.players[pid];
    if (!p || !p.bot || Math.random() > 0.12) continue;
    const d = mod.bot(g, pid, s);
    if (d) reduce(s, pid, 'g', JSON.parse(JSON.stringify(d)), now, io);
    if (s.game !== g) return;
  }
}

export function presence(s, pid, on, now, io) {
  const p = s.players[pid];
  if (!p) return;
  p.on = on;
  if (!on) p.offAt = now;
  const g = s.game;
  if (g && s.scene === 'game') {
    const mod = GAMES[g.id];
    if (mod && mod.presence) mod.presence(makeCtx(s, now, io), g, pid, on);
  }
}

export function hostChanged(s, oldHost, now) {
  const p = s.players[oldHost];
  if (p) {
    p.on = false;
    p.offAt = now;
  }
}

export const engine = { createRoom, reduce, tick, presence, hostChanged, botTick };
