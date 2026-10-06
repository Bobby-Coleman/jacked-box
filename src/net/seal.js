// Room privacy on public relays.
// The room code never appears on the wire: it's stretched with PBKDF2 into
//  - an opaque topic id (so rooms can't be found by browsing topics), and
//  - an AES-GCM key that seals every message (state, inputs, drawings, faces).
// Anyone who knows the room code can still join, exactly like the 4-letter code
// implies; what this stops is passive snooping on the shared public brokers.
const te = new TextEncoder();
const td = new TextDecoder();
const SALT = 'riffraff-room-salt-v1';
const ITERATIONS = 60000;

function subtle() {
  const s = globalThis.crypto && globalThis.crypto.subtle;
  if (!s) throw new Error('webcrypto-unavailable');
  return s;
}

export async function roomKeys(code) {
  const sub = subtle();
  const base = await sub.importKey('raw', te.encode('JB2|' + String(code).toUpperCase()), 'PBKDF2', false, ['deriveBits']);
  const bits = new Uint8Array(await sub.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: te.encode(SALT), iterations: ITERATIONS }, base, 384));
  const key = await sub.importKey('raw', bits.slice(0, 32), 'AES-GCM', false, ['encrypt', 'decrypt']);
  const topic = Array.from(bits.slice(32, 42), (b) => b.toString(16).padStart(2, '0')).join('');
  return { key, topic };
}

export function makeCodec(key) {
  const sub = subtle();
  return {
    async seal(obj) {
      const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
      const ct = new Uint8Array(await sub.encrypt({ name: 'AES-GCM', iv }, key, te.encode(JSON.stringify(obj))));
      const out = new Uint8Array(12 + ct.length);
      out.set(iv, 0);
      out.set(ct, 12);
      return out;
    },
    async open(bytes) {
      if (!bytes || bytes.length < 29) throw new Error('short');
      const pt = await sub.decrypt({ name: 'AES-GCM', iv: bytes.slice(0, 12) }, key, bytes.slice(12));
      return JSON.parse(td.decode(pt));
    },
  };
}
