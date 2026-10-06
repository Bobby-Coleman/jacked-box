// Session store: who I am, which room I'm in, and the live RoomLink.
import { RoomLink } from '../net/link.js';
import { randomId } from '../net/mqtt.js';
import { engine } from '../engine/core.js';
import { load, save, sload, ssave, keepAwake } from '../platform.js';
import { randomAvatar } from '../ui/Avatar.jsx';
import { setBlobResolver } from '../ui/faceRegistry.js';
import { account, onAccount, useProfileHooks, pushProfile } from '../account/account.js';

// Consonants only: no accidental words, nothing that looks like 0/O or 1/I.
const CODE_CHARS = 'BCDFGHJKLMNPQRSTVWXZ';

export function newCode() {
  let s = '';
  const b = new Uint8Array(4);
  crypto.getRandomValues(b);
  for (let i = 0; i < 4; i++) s += CODE_CHARS[b[i] % CODE_CHARS.length];
  return s;
}

export function cleanCode(c) {
  return String(c || '')
    .toUpperCase()
    .replace(/[^A-Z]/g, '')
    .slice(0, 4);
}

export const store = {
  view: 'home', // 'home' | 'busy' | 'room'
  busyText: '',
  error: '',
  link: null,
  ver: 0,
  wasIn: false,
};

const subs = new Set();
export function subscribe(fn) {
  subs.add(fn);
  return () => subs.delete(fn);
}
function emit() {
  store.ver++;
  for (const fn of subs) fn();
}

// Per-tab player id (so several tabs on one computer are different players),
// remembered across reloads of the same tab.
function myId() {
  let id = sload('jb.pid');
  if (!id) {
    id = 'p_' + randomId(10);
    ssave('jb.pid', id);
  }
  return id;
}

export function profile() {
  // This tab's own identity wins over the device-wide default (lets several tabs be different players).
  const saved = sload('jb.me') || load('jb.me') || {};
  return {
    id: myId(),
    name: saved.name || '',
    av: saved.av || randomAvatar(),
    face: myFace(),
    premium: !!account.premium,
  };
}

// The player's selfie lives on this device only; it's sent (encrypted) to rooms they join.
export function myFace() {
  const f = sload('jb.face');
  if (f === 'none') return null;
  return f || load('jb.face') || null;
}

export function saveFace(img) {
  save('jb.face', img || null);
  ssave('jb.face', img || 'none');
  const link = store.link;
  if (link && link.state && link.state.players[link.me.id]) link.send('face', { img: img || null });
  emit();
}

setBlobResolver((id) => (store.link ? store.link.blob(id) : null));

// Dev only: the session owns the live room connection, so swapping it (or the engine below it)
// in place would strand the old connection. Reload the page instead.
if (import.meta.hot) import.meta.hot.accept(() => location.reload());

export function saveProfile(p) {
  save('jb.me', { name: p.name, av: p.av });
  ssave('jb.me', { name: p.name, av: p.av });
  if (store.link && store.link.state) store.link.send('profile', { name: p.name, av: p.av, premium: !!account.premium });
  pushProfile(p);
  emit();
}

// Signing in can bring a saved name and look from the account.
useProfileHooks(
  () => profile(),
  (p) => saveProfile(p),
);

// Premium can start or end mid-party (a purchase, a sign-in): tell the room.
let lastPremium = null;
onAccount((a) => {
  if (a.premium === lastPremium) return;
  lastPremium = a.premium;
  const link = store.link;
  if (link) link.me.premium = !!a.premium;
  if (link && link.state && link.state.players[link.me.id]) link.send('profile', { premium: !!a.premium });
  emit();
});

export function lastRoom() {
  const l = load('jb.last');
  if (!l || Date.now() - l.at > 3 * 3600e3) return null;
  return l;
}

function setUrlCode(code) {
  try {
    const u = new URL(window.location.href);
    if (code) u.searchParams.set('r', code);
    else u.searchParams.delete('r');
    window.history.replaceState(null, '', u.toString());
  } catch (e) {
    /* ignore */
  }
}

function attach(link) {
  store.link = link;
  store.wasIn = false;
  let faceSent = false;
  link.on(() => {
    const s = link.state;
    if (s && s.players && s.players[link.me.id]) {
      store.wasIn = true;
      const face = myFace();
      if (!faceSent && face && !s.players[link.me.id].face && !link.me.screen) {
        faceSent = true;
        link.send('face', { img: face });
      }
    }
    if (s && s.closed) {
      endWith('The VIP ended the party. Thanks for playing!');
      return;
    }
    if (s && store.wasIn && s.players && !s.players[link.me.id]) {
      endWith('You were removed from the room.');
      return;
    }
    emit();
  });
}

function endWith(msg) {
  const link = store.link;
  store.link = null;
  if (link) link.close();
  ssave('jb.active', null);
  save('jb.last', null);
  setUrlCode(null);
  keepAwake(false);
  store.view = 'home';
  store.error = msg;
  emit();
}

const ERRORS = {
  offline: "Can't reach the game servers. Check your internet and try again.",
  'not-found': 'No party with that code. Check the letters and try again.',
  closed: 'That party has ended.',
  expired: 'That party expired. Ask for a new code.',
  'code-taken': 'Could not open a room. Try again.',
};

function busy(text) {
  store.view = 'busy';
  store.busyText = text;
  store.error = '';
  emit();
}

function fail(e) {
  store.view = 'home';
  store.error = ERRORS[e && e.message] || 'Something went wrong. Try again.';
  if (store.link) store.link.close();
  store.link = null;
  emit();
}

function entered(code, me) {
  ssave('jb.active', { code });
  save('jb.last', { code, pid: me.id, name: me.name, at: Date.now() });
  setUrlCode(code);
  keepAwake(true);
  store.view = 'room';
  emit();
}

export async function createParty(opts = {}) {
  const me = { ...profile(), screen: !!opts.screen };
  if (opts.screen) me.name = 'TABLE';
  busy('Opening a room…');
  for (let attempt = 0; attempt < 4; attempt++) {
    const code = newCode();
    const link = new RoomLink({ code, me, engine });
    attach(link);
    try {
      await link.create(opts.settings);
      entered(code, me);
      return;
    } catch (e) {
      link.close();
      store.link = null;
      if (e.message !== 'code-taken') return fail(e);
    }
  }
  fail(new Error('code-taken'));
}

export async function joinParty(code, opts = {}) {
  code = cleanCode(code);
  if (code.length !== 4) {
    store.error = 'Room codes are 4 letters.';
    emit();
    return;
  }
  const me = { ...profile(), screen: !!opts.screen };
  if (opts.pid) {
    me.id = opts.pid;
    ssave('jb.pid', opts.pid);
  }
  if (opts.screen) me.name = 'TABLE';
  busy(`Finding room ${code}…`);
  const link = new RoomLink({ code, me, engine });
  attach(link);
  try {
    await link.join();
    entered(code, me);
  } catch (e) {
    if (opts.silent) {
      link.close();
      store.link = null;
      ssave('jb.active', null);
      store.view = 'home';
      emit();
      return;
    }
    fail(e);
  }
}

export async function leaveParty() {
  const link = store.link;
  store.link = null;
  ssave('jb.active', null);
  save('jb.last', null);
  setUrlCode(null);
  keepAwake(false);
  store.view = 'home';
  emit();
  if (link) await link.leave();
}

export function clearError() {
  store.error = '';
  emit();
}

// Auto-rejoin after a reload of the same tab.
export function resume() {
  const a = sload('jb.active');
  if (a && a.code) {
    joinParty(a.code, { silent: true });
    return true;
  }
  return false;
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && store.link) store.link.wake();
  });
  window.addEventListener('online', () => store.link && store.link.wake());
  window.addEventListener('pageshow', (e) => {
    if (e.persisted && store.link) store.link.wake();
  });
}
