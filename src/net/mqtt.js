// Minimal MQTT 3.1.1 client over WebSocket.
// QoS 0 only, clean sessions, auto-reconnect, keepalive watchdog.
// Runs in browsers, in iOS/Android WebViews, and in Node 22+ (global WebSocket),
// so the exact same netcode is exercised by the simulation scripts.

const te = new TextEncoder();
const td = new TextDecoder();

function u16(n) {
  return Uint8Array.of((n >> 8) & 255, n & 255);
}

function mstr(s) {
  const b = te.encode(s);
  const out = new Uint8Array(2 + b.length);
  out[0] = (b.length >> 8) & 255;
  out[1] = b.length & 255;
  out.set(b, 2);
  return out;
}

function lenBytes(n) {
  const out = [];
  do {
    let b = n % 128;
    n = Math.floor(n / 128);
    if (n > 0) b |= 0x80;
    out.push(b);
  } while (n > 0);
  return out;
}

function packet(type, flags, parts) {
  let body = 0;
  for (const p of parts) body += p.length;
  const lb = lenBytes(body);
  const out = new Uint8Array(1 + lb.length + body);
  out[0] = (type << 4) | flags;
  out.set(lb, 1);
  let o = 1 + lb.length;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

function concat(a, b) {
  const out = new Uint8Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}

export function randomId(len = 12) {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const bytes = new Uint8Array(len);
  globalThis.crypto.getRandomValues(bytes);
  let s = '';
  for (let i = 0; i < len; i++) s += chars[bytes[i] % chars.length];
  return s;
}

export class MqttClient {
  constructor(url, opts = {}) {
    this.url = url;
    this.clientId = opts.clientId || 'jbx_' + randomId(14);
    this.keepalive = opts.keepalive || 25; // seconds
    this.onMessage = opts.onMessage || (() => {});
    this.onStatus = opts.onStatus || (() => {});
    this.subs = new Set();
    this.ws = null;
    this.buf = new Uint8Array(0);
    this.connected = false;
    this.closed = false;
    this.pid = 1;
    this.retry = 0;
    this.lastIn = 0;
    this.lastOut = 0;
    this.timer = null;
    this.reconnectTimer = null;
    this.connectStartedAt = 0;
  }

  get status() {
    if (this.connected) return 'up';
    if (this.closed) return 'closed';
    return 'down';
  }

  connect() {
    this.closed = false;
    this._open();
    if (!this.timer) this.timer = setInterval(() => this._watchdog(), 1000);
  }

  _open() {
    clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    this._teardownSocket();
    this.buf = new Uint8Array(0);
    this.connectStartedAt = Date.now();
    let ws;
    try {
      ws = new WebSocket(this.url, ['mqtt']);
    } catch (e) {
      this._scheduleReconnect();
      return;
    }
    ws.binaryType = 'arraybuffer';
    this.ws = ws;
    ws.onopen = () => {
      if (ws !== this.ws) return;
      const flags = 0x02; // clean session
      const vh = new Uint8Array([0, 4, 77, 81, 84, 84, 4, flags, ...u16(this.keepalive)]);
      this._raw(packet(1, 0, [vh, mstr(this.clientId)]));
    };
    ws.onmessage = (ev) => {
      if (ws !== this.ws) return;
      const data = ev.data instanceof ArrayBuffer ? new Uint8Array(ev.data) : new Uint8Array(ev.data.buffer || ev.data);
      this.lastIn = Date.now();
      this._onData(data);
    };
    ws.onclose = () => {
      if (ws !== this.ws) return;
      this._lost();
    };
    ws.onerror = () => {
      if (ws !== this.ws) return;
      this._lost();
    };
  }

  _teardownSocket() {
    const ws = this.ws;
    this.ws = null;
    if (ws) {
      ws.onopen = ws.onmessage = ws.onclose = ws.onerror = null;
      try {
        ws.close();
      } catch (e) {
        /* ignore */
      }
    }
  }

  _lost() {
    const was = this.connected;
    this.connected = false;
    this._teardownSocket();
    if (was) this.onStatus('down');
    if (!this.closed) this._scheduleReconnect();
  }

  _scheduleReconnect() {
    if (this.closed || this.reconnectTimer) return;
    const base = Math.min(8000, 400 * Math.pow(2, this.retry));
    const delay = base * (0.7 + Math.random() * 0.6);
    this.retry++;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (!this.closed) this._open();
    }, delay);
  }

  // Force a fresh connection (e.g. when a phone wakes up and the socket may be a zombie).
  kick() {
    if (this.closed) return;
    if (!this.connected) {
      this.retry = 0;
      this._open();
      return;
    }
    // Probe with a ping; watchdog will reconnect if nothing comes back quickly.
    this._probeAt = Date.now();
    this._raw(Uint8Array.of(0xc0, 0));
  }

  _watchdog() {
    if (this.closed) return;
    const now = Date.now();
    if (!this.connected) {
      // Stuck while connecting?
      if (this.ws && now - this.connectStartedAt > 9000) this._lost();
      return;
    }
    if (this._probeAt && now - this._probeAt > 3500 && this.lastIn < this._probeAt) {
      this._probeAt = 0;
      this._lost();
      return;
    }
    if (now - this.lastIn > this.keepalive * 1000 * 1.6) {
      this._lost();
      return;
    }
    if (now - this.lastOut > this.keepalive * 1000 * 0.5 || now - this.lastIn > this.keepalive * 1000 * 0.6) {
      this._raw(Uint8Array.of(0xc0, 0));
    }
  }

  _raw(bytes) {
    const ws = this.ws;
    if (!ws || ws.readyState !== 1) return false;
    try {
      ws.send(bytes);
      this.lastOut = Date.now();
      return true;
    } catch (e) {
      return false;
    }
  }

  _onData(chunk) {
    this.buf = this.buf.length ? concat(this.buf, chunk) : chunk;
    for (;;) {
      const buf = this.buf;
      if (buf.length < 2) return;
      let mult = 1;
      let len = 0;
      let i = 1;
      let b;
      do {
        if (i >= buf.length) return;
        b = buf[i++];
        len += (b & 127) * mult;
        mult *= 128;
        if (i > 5) {
          this._lost();
          return;
        }
      } while (b & 128);
      if (buf.length < i + len) return;
      const h = buf[0];
      const body = buf.subarray(i, i + len);
      this.buf = buf.subarray(i + len);
      this._packet(h, body);
      if (!this.ws) return;
    }
  }

  _packet(h, body) {
    const type = h >> 4;
    if (type === 2) {
      // CONNACK
      const rc = body[1];
      if (rc !== 0) {
        this._lost();
        return;
      }
      this.connected = true;
      this.retry = 0;
      for (const f of this.subs) this._sendSub(f);
      this.onStatus('up');
    } else if (type === 3) {
      const qos = (h >> 1) & 3;
      const retain = (h & 1) === 1;
      const tlen = (body[0] << 8) | body[1];
      const topic = td.decode(body.subarray(2, 2 + tlen));
      let o = 2 + tlen;
      if (qos > 0) {
        const pid = (body[o] << 8) | body[o + 1];
        o += 2;
        if (qos === 1) this._raw(packet(4, 0, [u16(pid)]));
        else if (qos === 2) this._raw(packet(5, 0, [u16(pid)]));
      }
      const payload = body.subarray(o);
      try {
        this.onMessage(topic, payload, retain);
      } catch (e) {
        console.error('mqtt onMessage handler failed', e);
      }
    } else if (type === 6) {
      // PUBREL for QoS2 -> PUBCOMP
      const pid = (body[0] << 8) | body[1];
      this._raw(packet(7, 0, [u16(pid)]));
    }
    // SUBACK(9), UNSUBACK(11), PINGRESP(13), PUBACK(4) need no action.
  }

  _nextPid() {
    this.pid = (this.pid % 65535) + 1;
    return this.pid;
  }

  _sendSub(filter) {
    this._raw(packet(8, 2, [u16(this._nextPid()), mstr(filter), Uint8Array.of(0)]));
  }

  subscribe(filter) {
    if (this.subs.has(filter)) return;
    this.subs.add(filter);
    if (this.connected) this._sendSub(filter);
  }

  unsubscribe(filter) {
    if (!this.subs.delete(filter)) return;
    if (this.connected) this._raw(packet(10, 2, [u16(this._nextPid()), mstr(filter)]));
  }

  publish(topic, payload, retain = false) {
    if (!this.connected) return false;
    const bytes = typeof payload === 'string' ? te.encode(payload) : payload || new Uint8Array(0);
    return this._raw(packet(3, retain ? 1 : 0, [mstr(topic), bytes]));
  }

  close() {
    this.closed = true;
    clearInterval(this.timer);
    this.timer = null;
    clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    if (this.connected) this._raw(Uint8Array.of(0xe0, 0));
    this.connected = false;
    this._teardownSocket();
    this.onStatus('closed');
  }
}

export function decodeText(bytes) {
  return td.decode(bytes);
}
