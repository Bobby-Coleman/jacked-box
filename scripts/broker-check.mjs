// Probes candidate public MQTT-over-WSS brokers: connect time, echo latency,
// retained-message delivery to a fresh connection, and a ~40KB payload.
import { MqttClient, randomId, decodeText } from '../src/net/mqtt.js';

const CANDIDATES = [
  'wss://broker.emqx.io:8084/mqtt',
  'wss://broker.hivemq.com:8884/mqtt',
  'wss://test.mosquitto.org:8081/mqtt',
  'wss://mqtt.eclipseprojects.io:443/mqtt',
  'wss://public.mqtthq.com:8084/mqtt',
];

function probe(url) {
  return new Promise((resolve) => {
    const res = { url, connectMs: null, echoMs: [], retained: false, bigOk: false, error: null };
    const topic = `jbx-probe/${randomId(8)}`;
    const t0 = Date.now();
    let sentAt = 0;
    let n = 0;
    const big = 'x'.repeat(40000);
    const done = () => {
      clearTimeout(timeout);
      try { a.close(); } catch (e) {}
      try { b && b.close(); } catch (e) {}
      resolve(res);
    };
    const timeout = setTimeout(() => { res.error = res.error || 'timeout'; done(); }, 15000);
    let b = null;
    const a = new MqttClient(url, {
      onStatus: (s) => {
        if (s === 'up' && res.connectMs == null) {
          res.connectMs = Date.now() - t0;
          a.subscribe(topic + '/#');
          setTimeout(() => { sentAt = Date.now(); a.publish(topic + '/echo', 'ping' + n); }, 300);
        }
      },
      onMessage: (t, payload) => {
        if (t === topic + '/echo') {
          res.echoMs.push(Date.now() - sentAt);
          n++;
          if (n < 5) { sentAt = Date.now(); a.publish(topic + '/echo', 'ping' + n); }
          else {
            a.publish(topic + '/big', big);
          }
        } else if (t === topic + '/big') {
          res.bigOk = decodeText(payload).length === big.length;
          // retained check with a second connection
          a.publish(topic + '/ret', 'retained-hello', true);
          setTimeout(() => {
            b = new MqttClient(url, {
              onStatus: (s) => { if (s === 'up') b.subscribe(topic + '/ret'); },
              onMessage: (t2, p2, retain) => {
                if (t2 === topic + '/ret' && decodeText(p2) === 'retained-hello') {
                  res.retained = retain;
                  a.publish(topic + '/ret', '', true); // clear
                  setTimeout(done, 200);
                }
              },
            });
            b.connect();
          }, 500);
        }
      },
    });
    a.connect();
  });
}

const results = await Promise.all(CANDIDATES.map(probe));
for (const r of results) {
  const avg = r.echoMs.length ? Math.round(r.echoMs.reduce((x, y) => x + y, 0) / r.echoMs.length) : null;
  console.log(`${r.url}\n  connect=${r.connectMs}ms echoAvg=${avg}ms echo=${JSON.stringify(r.echoMs)} big40k=${r.bigOk} retained=${r.retained} err=${r.error}`);
}
process.exit(0);
