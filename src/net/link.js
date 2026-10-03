// RoomLink: keeps every phone in a room on the same game state.
//
// Model: one phone is the authoritative host (runs the game engine). Everyone
// else sends inputs and renders the host's snapshots. Snapshots are retained on
// the brokers, so a phone that reloads or wakes up gets the latest state at once.
//
// Reliability:
//  - inputs carry a per-player sequence number and are resent until the host's
//    snapshot acknowledges them (acks), and the host applies them strictly in order
//  - the host heartbeats; if it goes quiet (phone locked, app switched, battery)
//    the next connected player takes over from the last snapshot (host migration)
//  - higher term wins; equal-term conflicts resolve deterministically
//  - large payloads (drawings) ride inside inputs, then the host republishes them
//    as retained blobs that late joiners receive automatically
import { PubSub } from './pubsub.js';
import { roomKeys, makeCodec } from './seal.js';

export const NS = 'jackedbox/r2';
const HOST_TIMEOUT = 6500;
const HB_MS = 2000;
const PING_MS = 2500;
const RESEND_MS = 1500;
const OFFLINE_MS = 9000;
const PUBLISH_GAP = 60;
const REPUBLISH_MS = 15000;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export class RoomLink {
  constructor({ code, me, engine, transport }) {
    this.code = code;
    this.me = me;
    this.engine = engine;
    this.base = null; // set once the room keys are derived (topic never contains the code)
    this.state = null;
    this.isHost = false;
    this.listeners = new Set();
    this.seq = 0;
    this.outbox = [];
    this.hostSeenAt = 0;
    this.samples = [];
    this.offset = 0;
    this.blobs = new Map();
    this.pending = {};
    this.gapSince = {};
    this.lastSeen = {};
    this.lastPing = 0;
    this.lastTick = Date.now();
    this.lastPublishedBody = '';
    this.lastPublishAt = 0;
    this.publishTimer = null;
    this.resyncAt = 0;
    this.version = 0; // local render counter
    this.netUp = 0;
    this.closed = false;
    const handlers = {
      onMessage: (t, m, r) => this._msg(t, m, r),
      onStatus: (n) => {
        const was = this.netUp;
        this.netUp = n;
        if (n > was && this.isHost && this.state) this._publishNow(true);
        this._emit();
      },
    };
    this.ps = transport ? transport(handlers) : new PubSub(handlers);
  }

  // ---------- public API ----------

  on(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  now() {
    return this.isHost ? Date.now() : Date.now() + this.offset;
  }

  get connected() {
    return this.netUp > 0;
  }

  get hostAlive() {
    return this.isHost || Date.now() - this.hostSeenAt < HOST_TIMEOUT;
  }

  async create(settings) {
    await this._open();
    // Give brokers a moment to deliver any retained snapshot for this code.
    await sleep(1200);
    const prev = this.state;
    if (prev && !prev.closed && Date.now() - (prev.updated || 0) < 3 * 3600e3) {
      throw new Error('code-taken');
    }
    const now = Date.now();
    const s = this.engine.createRoom({ code: this.code, me: this.me, settings, now });
    // Terms are seeded from the clock so a fresh room always beats stale retained ones.
    s.term = Math.max(Math.floor(now / 1000), (prev && prev.term + 1) || 0);
    s.host = this.me.id;
    s.v = 0;
    this.state = s;
    this._becomeHost();
    this._publishNow(true);
    this._emit();
  }

  async join() {
    await this._open();
    const t0 = Date.now();
    while (!this.state && Date.now() - t0 < 6000) await sleep(80);
    if (!this.state) throw new Error('not-found');
    if (this.state.closed) throw new Error('closed');
    if (Date.now() - (this.state.updated || 0) > 8 * 3600e3) throw new Error('expired');
    this.hostSeenAt = Date.now(); // grace period before any election
    const mine = this.state.players && this.state.players[this.me.id];
    this.send('join', { name: this.me.name, av: this.me.av, screen: !!this.me.screen, rejoin: !!mine });
    this._emit();
  }

  send(y, d = {}) {
    if (this.closed) return 0;
    if (this.state) this.seq = Math.max(this.seq, (this.state.acks && this.state.acks[this.me.id]) || 0);
    const q = ++this.seq;
    if (this.isHost) {
      this._queueInput(this.me.id, q, y, d);
      return q;
    }
    const item = { env: { p: this.me.id, q, y, d }, at: 0 };
    this.outbox.push(item);
    this._flushOutbox(Date.now());
    return q;
  }

  pendingInputs() {
    return this.outbox.map((o) => o.env);
  }

  blob(id) {
    return this.blobs.get(id);
  }

  async leave() {
    const s = this.state;
    if (s && s.players && s.players[this.me.id]) {
      this.send('leave', {});
      if (this.isHost) {
        // Hand the room to the next connected player right away instead of waiting for a timeout.
        const next = this._successors()[0];
        if (next) {
          s.term += 1;
          s.host = next;
          this._publishNow(true);
        }
      }
      await sleep(400);
    }
    this.close();
  }

  close() {
    this.closed = true;
    this._stopHost();
    clearInterval(this.clientTimer);
    clearTimeout(this.publishTimer);
    this.ps.close();
    this.listeners.clear();
  }

  // Call when the page becomes visible again (phones suspend tabs aggressively).
  wake() {
    if (!this.base) return;
    this.hostSeenAt = Date.now();
    this.ps.kick();
    if (!this.isHost) this.ps.resubscribe(`${this.base}/s`);
    this._flushOutbox(Date.now(), true);
  }

  // ---------- internals ----------

  async _open() {
    if (!this.base) {
      const keys = await roomKeys(this.code);
      this.base = `${NS}/${keys.topic}`;
      if (this.ps.setCodec && !globalThis.JB_NOSEAL) this.ps.setCodec(makeCodec(keys.key));
    }
    this.ps.start();
    this.ps.subscribe(`${this.base}/s`);
    this.ps.subscribe(`${this.base}/h`);
    this.ps.subscribe(`${this.base}/b/+`);
    await this.ps.ready();
    this.netUp = this.ps.upCount();
    if (!this.clientTimer) this.clientTimer = setInterval(() => this._clientTick(), 400);
  }

  _emit() {
    this.version++;
    for (const fn of this.listeners) {
      try {
        fn(this);
      } catch (e) {
        console.error(e);
      }
    }
  }

  _msg(topic, m) {
    if (this.closed || !this.base || !topic.startsWith(this.base)) return;
    const kind = topic.slice(this.base.length + 1);
    if (kind === 's') this._onState(m.s, m.t);
    else if (kind === 'h') this._onHeartbeat(m);
    else if (kind === 'i') {
      if (this.isHost) this._onInput(m);
    } else if (kind.startsWith('b/')) this._onBlob(m);
  }

  _newer(s, cur) {
    if (s.term !== cur.term) return s.term > cur.term;
    if (s.host !== cur.host) return s.host < cur.host;
    return s.v > cur.v;
  }

  _onState(s, t) {
    if (!s || s.code !== this.code) return;
    const cur = this.state;
    if (cur && !this._newer(s, cur)) return;
    if (this.isHost && s.host !== this.me.id) this._stopHost();
    if (cur && cur.host !== s.host) this.samples = [];
    this.state = s;
    if (s.host !== this.me.id) {
      this.hostSeenAt = Date.now();
      this._clock(t);
    } else if (!this.isHost && !s.closed) {
      // The snapshot says this device is the host (it reloaded while hosting): resume.
      s.term += 1;
      this._becomeHost();
      this._publishNow(true);
    }
    this._ackOutbox();
    this._emit();
  }

  _onHeartbeat(m) {
    if (!this.state || m.host === this.me.id) return;
    const s = this.state;
    if (m.term === s.term && m.host === s.host) {
      this.hostSeenAt = Date.now();
      this._clock(m.t);
      if (m.v > s.v) this._resync();
    } else if (m.term > s.term || (m.term === s.term && m.host < s.host)) {
      this._resync();
    }
  }

  _resync() {
    const now = Date.now();
    if (now - this.resyncAt < 2500) return;
    this.resyncAt = now;
    this.ps.resubscribe(`${this.base}/s`);
  }

  _clock(t) {
    if (typeof t !== 'number') return;
    this.samples.push(t - Date.now());
    if (this.samples.length > 15) this.samples.shift();
    this.offset = Math.max(...this.samples);
  }

  _ackOutbox() {
    const a = (this.state.acks && this.state.acks[this.me.id]) || 0;
    if (this.outbox.length) this.outbox = this.outbox.filter((o) => o.env.q > a);
  }

  _flushOutbox(now, force = false) {
    if (this.isHost || !this.base) return;
    for (const o of this.outbox) {
      if (!force && o.at && now - o.at < RESEND_MS) continue;
      this.ps.publish(`${this.base}/i`, o.env);
      o.at = now;
    }
  }

  _onBlob(m) {
    if (!m || !m.id || this.blobs.has(m.id)) return;
    this.blobs.set(m.id, m.d);
    this._emit();
  }

  _clientTick() {
    if (this.closed) return;
    const now = Date.now();
    const gap = now - this.lastTick;
    this.lastTick = now;
    if (gap > 3000) {
      // JS was suspended (screen locked / tab hidden): don't mistake our own nap for a dead host.
      this.wake();
      return;
    }
    if (!this.isHost) {
      this._flushOutbox(now);
      if (now - this.lastPing > PING_MS && this.netUp > 0) {
        this.lastPing = now;
        this.ps.publish(`${this.base}/i`, { k: 'p', p: this.me.id, t: now });
      }
      this._maybeElect(now);
    }
  }

  _maybeElect(now) {
    const s = this.state;
    if (!s || s.closed || !s.players || !s.players[this.me.id] || this.netUp === 0) return;
    const silent = now - this.hostSeenAt;
    if (silent < HOST_TIMEOUT) return;
    const cands = this._successors();
    const idx = cands.indexOf(this.me.id);
    if ((idx >= 0 && silent > HOST_TIMEOUT + idx * 3000) || silent > HOST_TIMEOUT + 20000) {
      this._takeOver();
    }
  }

  _successors() {
    const s = this.state;
    const ids = (s.order || []).filter((id) => id !== s.host && s.players[id] && !s.players[id].bot && s.players[id].on !== false);
    // Prefer table screens: they stay awake.
    return ids.filter((id) => s.players[id].screen).concat(ids.filter((id) => !s.players[id].screen));
  }

  _takeOver() {
    const s = this.state;
    const old = s.host;
    s.term += 1;
    s.host = this.me.id;
    this._becomeHost();
    try {
      this.engine.hostChanged(s, old, Date.now());
    } catch (e) {
      console.error(e);
    }
    this._publishNow(true);
    this._emit();
  }

  _becomeHost() {
    if (this.isHost) return;
    this.isHost = true;
    this.offset = 0;
    this.samples = [];
    const now = Date.now();
    for (const pid of Object.keys(this.state.players || {})) this.lastSeen[pid] = now;
    this.state.acks = this.state.acks || {};
    this.seq = Math.max(this.seq, this.state.acks[this.me.id] || 0);
    this.ps.subscribe(`${this.base}/i`);
    this.hostTimer = setInterval(() => this._hostTick(), 200);
    this.hbTimer = setInterval(() => this._heartbeat(), HB_MS);
    // Apply anything this device had queued as a client.
    const queued = this.outbox;
    this.outbox = [];
    for (const o of queued) this._queueInput(this.me.id, o.env.q, o.env.y, o.env.d);
  }

  _stopHost() {
    if (!this.isHost) return;
    this.isHost = false;
    clearInterval(this.hostTimer);
    clearInterval(this.hbTimer);
    this.ps.unsubscribe(`${this.base}/i`);
    this.hostSeenAt = Date.now();
  }

  _io() {
    return {
      blob: (data) => {
        const id = Math.random().toString(36).slice(2, 12);
        this.blobs.set(id, data);
        this.ps.publish(`${this.base}/b/${id}`, { id, d: data }, true);
        return id;
      },
      dropBlob: (id) => {
        this.blobs.delete(id);
        this.ps.publish(`${this.base}/b/${id}`, null, true);
      },
    };
  }

  _onInput(m) {
    const pid = m.p;
    if (!pid || typeof pid !== 'string') return;
    const now = Date.now();
    this.lastSeen[pid] = now;
    const pl = this.state.players[pid];
    if (pl && pl.on === false) {
      try {
        this.engine.presence(this.state, pid, true, now, this._io());
      } catch (e) {
        console.error(e);
      }
      this._dirty();
    }
    if (m.k === 'p') return;
    if (typeof m.q !== 'number' || typeof m.y !== 'string') return;
    this._queueInput(pid, m.q, m.y, m.d || {});
  }

  _queueInput(pid, q, y, d) {
    const last = this.state.acks[pid] || 0;
    if (q <= last) return;
    const pend = this.pending[pid] || (this.pending[pid] = new Map());
    pend.set(q, { y, d });
    this._drain(pid);
  }

  _drain(pid) {
    const acks = this.state.acks;
    const pend = this.pending[pid];
    if (!pend) return;
    let changed = false;
    let next = (acks[pid] || 0) + 1;
    for (const k of pend.keys()) if (k < next) pend.delete(k);
    for (;;) {
      if (!pend.has(next)) {
        if (pend.size === 0) break;
        // A gap: tolerate briefly (resends fill it), then skip ahead.
        const now = Date.now();
        if (!this.gapSince[pid]) this.gapSince[pid] = now;
        if (now - this.gapSince[pid] < 4000) break;
        next = Math.min(...pend.keys());
      }
      this.gapSince[pid] = 0;
      const inp = pend.get(next);
      pend.delete(next);
      acks[pid] = next;
      try {
        this.engine.reduce(this.state, pid, inp.y, inp.d, Date.now(), this._io());
      } catch (e) {
        console.error('input failed', inp.y, e);
      }
      changed = true;
      next++;
    }
    if (changed) this._dirty();
  }

  _hostTick() {
    const now = Date.now();
    const s = this.state;
    for (const pid of Object.keys(s.players)) {
      if (pid === this.me.id || s.players[pid].bot) {
        if (s.players[pid].on === false) this.engine.presence(s, pid, true, now, this._io());
        continue;
      }
      const on = now - (this.lastSeen[pid] || 0) < OFFLINE_MS;
      if (s.players[pid] && s.players[pid].on !== on) {
        try {
          this.engine.presence(s, pid, on, now, this._io());
        } catch (e) {
          console.error(e);
        }
      }
    }
    // retry gapped inputs
    for (const pid of Object.keys(this.pending)) {
      if (this.pending[pid].size) this._drain(pid);
    }
    try {
      this.engine.tick(s, now, this._io());
      if (this.engine.botTick) this.engine.botTick(s, now, this._io());
    } catch (e) {
      console.error('tick failed', e);
    }
    this._dirty();
    if (now - this.lastPublishAt > REPUBLISH_MS) this._publishNow(true);
  }

  _heartbeat() {
    const s = this.state;
    this.ps.publish(`${this.base}/h`, { term: s.term, v: s.v, host: s.host, t: Date.now() });
  }

  _dirty() {
    if (!this.isHost) return;
    if (this.publishTimer) return;
    const wait = Math.max(0, PUBLISH_GAP - (Date.now() - this.lastPublishAt));
    this.publishTimer = setTimeout(() => {
      this.publishTimer = null;
      this._publishNow(false);
    }, wait);
  }

  _publishNow(force) {
    if (!this.isHost || !this.state) return;
    const s = this.state;
    const keepV = s.v;
    const keepU = s.updated;
    s.v = 0;
    s.updated = 0;
    const body = JSON.stringify(s);
    s.v = keepV;
    s.updated = keepU;
    const changed = body !== this.lastPublishedBody;
    if (!changed && !force) return;
    if (changed) {
      s.v = (s.v || 0) + 1;
      s.updated = Date.now();
      this.lastPublishedBody = body;
      this._emit();
    }
    this.lastPublishAt = Date.now();
    this.ps.publish(`${this.base}/s`, { s, t: Date.now() }, true);
  }
}
