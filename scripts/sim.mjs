// Offline engine simulator: plays every game start-to-finish with bots, at
// several player counts, with random disconnects, on a fake clock.
// Usage: node scripts/sim.mjs [gameId] [runsPerCount]
import { engine } from '../src/engine/core.js';
import { GAMES, GAME_LIST } from '../src/games/logic.js';

const only = process.argv[2];
const runs = Number(process.argv[3] || 6);

function simulate(gameId, n, opts = {}) {
  const mod = GAMES[gameId];
  let now = 1_700_000_000_000;
  const start = now;
  const blobs = new Map();
  const io = {
    blob: (d) => {
      const id = 'b' + Math.random().toString(36).slice(2, 8);
      blobs.set(id, d);
      return id;
    },
    dropBlob: (id) => blobs.delete(id),
  };
  const ids = Array.from({ length: n }, (_, i) => 'p' + i);
  const s = engine.createRoom({ code: 'TEST', me: { id: ids[0], name: 'Pat', av: {} }, settings: opts.settings || {}, now });
  for (const id of ids.slice(1)) engine.reduce(s, id, 'join', { name: 'Bot' + id }, now, io);
  engine.reduce(s, ids[0], 'start', { id: gameId }, now, io);
  if (s.scene !== 'game') throw new Error(`${gameId} did not start with ${n} players`);
  let ticks = 0;
  const phases = new Set();
  let dropped = null;
  while (s.scene === 'game' && ticks < 40000) {
    ticks++;
    now += 200;
    const g = s.game;
    phases.add(g.phase);
    // random disconnect / reconnect
    if (opts.flaky && !dropped && Math.random() < 0.002) {
      dropped = g.pids[Math.floor(Math.random() * g.pids.length)];
      engine.presence(s, dropped, false, now, io);
    } else if (dropped && Math.random() < 0.004) {
      engine.presence(s, dropped, true, now, io);
      dropped = null;
    }
    if (mod.bot) {
      for (const pid of [...g.pids, ...(g.aud || [])]) {
        if (pid === dropped) continue;
        if (Math.random() < (opts.eager ? 0.6 : 0.15)) {
          const d = mod.bot(g, pid, s);
          if (d) engine.reduce(s, pid, 'g', JSON.parse(JSON.stringify(d)), now, io);
          if (!s.game) break;
        }
      }
    }
    if (s.game) engine.tick(s, now, io);
    // state must stay JSON-serializable and reasonably small
    if (ticks % 50 === 0) {
      const size = JSON.stringify(s).length;
      if (size > 60000) throw new Error(`${gameId}: state too large (${size} bytes)`);
    }
  }
  if (s.scene !== 'results') throw new Error(`${gameId} with ${n} players stuck in phase ${s.game && s.game.phase} after ${ticks} ticks`);
  return { minutes: ((now - start) / 60000).toFixed(1), phases: [...phases].join(','), scores: s.results.scores, size: JSON.stringify(s).length };
}

let failures = 0;
for (const mod of GAME_LIST) {
  if (only && mod.id !== only) continue;
  const counts = [];
  for (let n = mod.min; n <= Math.min(mod.max, 12); n++) counts.push(n);
  for (const n of counts) {
    for (let i = 0; i < runs; i++) {
      try {
        const r = simulate(mod.id, n, { flaky: i % 2 === 1, eager: i % 3 === 0, settings: { spicy: i % 2 === 0 } });
        if (i === 0) console.log(`${mod.id} n=${n}: ${r.minutes} min, phases=${r.phases}, stateBytes=${r.size}`);
      } catch (e) {
        failures++;
        console.error(`FAIL ${mod.id} n=${n} run=${i}:`, e.stack || e.message);
        break;
      }
    }
  }
}
if (failures) {
  console.error(`${failures} failure(s)`);
  process.exit(1);
}
console.log('all simulations passed');
