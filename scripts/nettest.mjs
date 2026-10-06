// Real-network test over the public MQTT brokers.
// 1. A host creates a room; N bot clients join.
// 2. They play a game (bots act through each game's bot()).
// 3. Mid-game the host's process "dies" (connection dropped, no goodbye).
// 4. We check that another phone takes over and the game still finishes.
// Usage: node scripts/nettest.mjs [gameId] [clients]
import { RoomLink } from '../src/net/link.js';
import { engine } from '../src/engine/core.js';
import { GAMES } from '../src/games/logic.js';

const gameId = process.argv[2] || 'herd';
const nClients = Number(process.argv[3] || 4);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const CODE_CHARS = 'BCDFGHJKLMNPQRSTVWXZ';
const code = Array.from({ length: 4 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');
const t0 = Date.now();
const log = (...a) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s]`, ...a);

const mk = (i) => ({ id: 'p_test' + i + Math.random().toString(36).slice(2, 6), name: 'Tester' + i, av: { b: i % 8, e: i % 12, m: i % 12, h: i % 14 } });

const host = new RoomLink({ code, me: { ...mk(0), premium: true }, engine });
await host.create({});
log(`room ${code} created; brokers up: ${host.netUp}`);

const clients = [];
for (let i = 1; i <= nClients; i++) {
  const c = new RoomLink({ code, me: mk(i), engine });
  await c.join();
  clients.push(c);
}
// wait until everyone is in
for (let k = 0; k < 100; k++) {
  if (Object.keys(host.state.players).length === nClients + 1) break;
  await sleep(100);
}
log(`joined: ${Object.keys(host.state.players).length} players`);

// Input latency: time from send to ack in the host's snapshot, seen by the client.
const lat = [];
for (const c of clients.slice(0, 3)) {
  const q = c.send('profile', { name: c.me.name, av: c.me.av });
  const s0 = Date.now();
  for (let k = 0; k < 100; k++) {
    if (c.state && (c.state.acks[c.me.id] || 0) >= q) break;
    await sleep(10);
  }
  lat.push(Date.now() - s0);
}
log(`input round-trip (send -> ack seen): ${lat.join(', ')} ms`);

const all = [host, ...clients];
let alive = new Set(all);
// Bots play: every 300ms each live link may act.
const botLoop = setInterval(() => {
  for (const L of alive) {
    const s = L.state;
    if (!s || s.scene !== 'game' || !s.game || s.game.phase === 'intro') continue;
    const mod = GAMES[s.game.id];
    if (Math.random() < 0.35) {
      const d = mod.bot && mod.bot(s.game, L.me.id, s);
      if (d) L.send('g', d);
    }
  }
}, 300);

host.send('start', { id: gameId });
await sleep(1500);
host.send('skip', {});
log(`started ${gameId}`);

// Let it run, then kill the host abruptly.
await sleep(12000);
const before = clients[0].state;
log(`killing host mid-game (phase=${before.game && before.game.phase}, term=${before.term})`);
alive.delete(host);
host.close();
const killedAt = Date.now();

let newHost = null;
for (let k = 0; k < 400; k++) {
  const s = clients[0].state;
  if (s.host !== host.me.id && clients.some((c) => c.isHost)) {
    newHost = clients.find((c) => c.isHost);
    break;
  }
  await sleep(100);
}
if (!newHost) {
  console.error('FAIL: nobody took over hosting');
  process.exit(1);
}
log(`host migrated to ${newHost.me.name} after ${((Date.now() - killedAt) / 1000).toFixed(1)}s (term ${newHost.state.term})`);
// The VIP left with the host; make sure someone can still skip if needed.
let finished = false;
for (let k = 0; k < 2400; k++) {
  const s = clients[0].state;
  if (s.scene === 'results') {
    finished = true;
    break;
  }
  await sleep(100);
}
clearInterval(botLoop);
const s = clients[0].state;
log(finished ? `game finished: ${JSON.stringify(s.results.scores)}` : `FAIL: still in phase ${s.game && s.game.phase}`);
// Consistency: every client should agree on the final state version.
const versions = clients.map((c) => `${c.state.term}/${c.state.v}`);
log(`client views: ${versions.join(' ')}`);
for (const c of clients) c.close();
process.exit(finished ? 0 : 1);
