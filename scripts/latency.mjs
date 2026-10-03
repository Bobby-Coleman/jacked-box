// Measures input round-trip (client send -> host applies -> client sees ack) over the real relays.
// Usage: node scripts/latency.mjs [noseal]
import { RoomLink } from '../src/net/link.js';
import { engine } from '../src/engine/core.js';
if (process.argv[2] === 'noseal') globalThis.JB_NOSEAL = true;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const code = Array.from({ length: 4 }, () => 'BCDFGHJKLMNPQRSTVWXZ'[Math.floor(Math.random() * 20)]).join('');
const host = new RoomLink({ code, me: { id: 'p_h' + Math.random().toString(36).slice(2, 6), name: 'Host', av: {} }, engine });
await host.create({});
const c = new RoomLink({ code, me: { id: 'p_c' + Math.random().toString(36).slice(2, 6), name: 'Client', av: {} }, engine });
await c.join();
for (let k = 0; k < 60 && !(host.state.players[c.me.id]); k++) await sleep(100);
await sleep(2500); // let all brokers settle
const rtts = [];
for (let i = 0; i < 12; i++) {
  const q = c.send('profile', { name: 'Client' + i });
  const t = Date.now();
  while ((c.state.acks[c.me.id] || 0) < q && Date.now() - t < 5000) await sleep(5);
  rtts.push(Date.now() - t);
  await sleep(300);
}
rtts.sort((a, b) => a - b);
console.log(process.argv[2] === 'noseal' ? 'plain ' : 'sealed', 'median', rtts[6], 'ms  min', rtts[0], 'max', rtts[11], 'brokers', host.netUp, c.netUp);
host.close();
c.close();
process.exit(0);
