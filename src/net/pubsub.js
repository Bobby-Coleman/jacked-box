// Redundant pub/sub over several public MQTT brokers at once.
// Every message is published to every connected broker and de-duplicated on
// receipt by a random message id, so a broker outage is invisible to the game.
import { MqttClient, randomId, decodeText } from './mqtt.js';

export const PRIMARY_BROKERS = ['wss://broker.emqx.io:8084/mqtt', 'wss://broker.hivemq.com:8884/mqtt', 'wss://public:public@public.cloud.shiftr.io'];
export const FALLBACK_BROKERS = ['wss://test.mosquitto.org:8081/mqtt'];

export class PubSub {
  constructor({ urls = PRIMARY_BROKERS, fallback = FALLBACK_BROKERS, onMessage, onStatus } = {}) {
    this.urls = urls;
    this.fallback = fallback;
    this.onMessage = onMessage || (() => {});
    this.onStatus = onStatus || (() => {});
    this.clients = [];
    this.filters = new Set();
    this.seen = new Map();
    this.fallbackAdded = false;
    this.started = false;
    this.lowSince = 0;
    this.codec = null;
    this.outChain = Promise.resolve();
    this.inChain = Promise.resolve();
  }

  // Optional {seal(obj) -> Promise<bytes>, open(bytes) -> Promise<obj>} for end-to-end sealing.
  // Sealing is async, so sends and receives run through promise chains to keep their order.
  setCodec(codec) {
    this.codec = codec;
  }

  start() {
    if (this.started) return;
    this.started = true;
    for (const url of this.urls) this._add(url);
    // Bring in the fallback broker when we are running on fewer than two brokers for a while.
    this.healthTimer = setInterval(() => {
      const up = this.upCount();
      if (up >= 2 || this.fallbackAdded) {
        this.lowSince = 0;
        return;
      }
      if (!this.lowSince) this.lowSince = Date.now();
      const limit = up === 0 ? 4000 : 15000;
      if (Date.now() - this.lowSince > limit) {
        this.fallbackAdded = true;
        for (const u of this.fallback) this._add(u);
      }
    }, 1000);
  }

  _add(url) {
    const c = new MqttClient(url, {
      onMessage: (topic, payload, retain) => this._in(topic, payload, retain),
      onStatus: () => this.onStatus(this.upCount()),
    });
    for (const f of this.filters) c.subscribe(f);
    this.clients.push(c);
    c.connect();
  }

  upCount() {
    let n = 0;
    for (const c of this.clients) if (c.connected) n++;
    return n;
  }

  // Resolves once at least one broker is connected (or rejects after timeout).
  ready(timeoutMs = 12000) {
    if (this.upCount() > 0) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const t0 = Date.now();
      const iv = setInterval(() => {
        if (this.upCount() > 0) {
          clearInterval(iv);
          resolve();
        } else if (Date.now() - t0 > timeoutMs) {
          clearInterval(iv);
          reject(new Error('offline'));
        }
      }, 50);
    });
  }

  subscribe(filter) {
    this.filters.add(filter);
    for (const c of this.clients) c.subscribe(filter);
  }

  unsubscribe(filter) {
    this.filters.delete(filter);
    for (const c of this.clients) c.unsubscribe(filter);
  }

  // Re-subscribing makes brokers re-deliver retained messages (used to resync).
  resubscribe(filter) {
    for (const c of this.clients) {
      c.unsubscribe(filter);
      c.subscribe(filter);
    }
  }

  publish(topic, obj, retain = false) {
    if (obj == null) {
      // Empty retained payload clears a retained message on the brokers.
      for (const c of this.clients) c.publish(topic, '', retain);
      return;
    }
    if (!obj._i) obj._i = randomId(10);
    this._mark(obj._i);
    if (!this.codec) {
      const payload = JSON.stringify(obj);
      for (const c of this.clients) c.publish(topic, payload, retain);
      return;
    }
    const codec = this.codec;
    this.outChain = this.outChain
      .then(() => codec.seal(obj))
      .then((bytes) => {
        for (const c of this.clients) c.publish(topic, bytes, retain);
      })
      .catch(() => {});
  }

  _mark(id) {
    this.seen.set(id, 1);
    if (this.seen.size > 5000) {
      let n = 0;
      for (const k of this.seen.keys()) {
        this.seen.delete(k);
        if (++n >= 1500) break;
      }
    }
  }

  _in(topic, payload, retain) {
    if (!payload || !payload.length) return;
    if (this.codec) {
      const codec = this.codec;
      const bytes = payload.slice();
      this.inChain = this.inChain
        .then(() => codec.open(bytes))
        .then(
          (obj) => this._deliver(topic, obj, retain),
          () => {},
        );
      return;
    }
    let obj;
    try {
      obj = JSON.parse(decodeText(payload));
    } catch (e) {
      return;
    }
    this._deliver(topic, obj, retain);
  }

  _deliver(topic, obj, retain) {
    if (!obj || typeof obj !== 'object') return;
    if (obj._i) {
      if (this.seen.has(obj._i)) return;
      this._mark(obj._i);
    }
    try {
      this.onMessage(topic, obj, retain);
    } catch (e) {
      console.error(e);
    }
  }

  kick() {
    for (const c of this.clients) c.kick();
  }

  close() {
    clearInterval(this.healthTimer);
    for (const c of this.clients) c.close();
    this.clients = [];
    this.started = false;
  }
}
