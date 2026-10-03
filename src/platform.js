// Thin platform layer. Everything device-specific goes through here so a native
// shell (Capacitor) can swap in plugins later: haptics, keep-awake, share, storage.

export function load(key) {
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : null;
  } catch (e) {
    return null;
  }
}

export function save(key, val) {
  try {
    if (val == null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(val));
  } catch (e) {
    /* storage blocked */
  }
}

export function sload(key) {
  try {
    const v = sessionStorage.getItem(key);
    return v ? JSON.parse(v) : null;
  } catch (e) {
    return null;
  }
}

export function ssave(key, val) {
  try {
    if (val == null) sessionStorage.removeItem(key);
    else sessionStorage.setItem(key, JSON.stringify(val));
  } catch (e) {
    /* storage blocked */
  }
}

export function vibrate(pattern) {
  try {
    if (navigator.vibrate) navigator.vibrate(pattern);
  } catch (e) {
    /* iOS Safari has no vibration API */
  }
}

// Keep the screen on while a party is running.
let wakeLock = null;
let wantAwake = false;

async function requestWake() {
  if (!wantAwake || document.visibilityState !== 'visible') return;
  try {
    if ('wakeLock' in navigator && !wakeLock) {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => {
        wakeLock = null;
      });
    }
  } catch (e) {
    wakeLock = null;
  }
}

export function keepAwake(on) {
  wantAwake = on;
  if (on) requestWake();
  else if (wakeLock) {
    wakeLock.release().catch(() => {});
    wakeLock = null;
  }
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') requestWake();
  });
}

export async function shareLink(url, text) {
  try {
    if (navigator.share) {
      await navigator.share({ title: 'Jacked Box', text, url });
      return 'shared';
    }
  } catch (e) {
    if (e && e.name === 'AbortError') return 'cancelled';
  }
  return copyText(url);
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return 'copied';
  } catch (e) {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
      return 'copied';
    } catch (e2) {
      return 'failed';
    }
  }
}

// Public web address of the game. Invites must always point here, because inside a
// native shell (Capacitor) the page's own origin is something like capacitor://localhost.
export const PUBLIC_URL = 'https://bobby-coleman.github.io/jacked-box/';

export function isNativeShell() {
  const cap = typeof window !== 'undefined' && window.Capacitor;
  if (cap && typeof cap.isNativePlatform === 'function') return cap.isNativePlatform();
  return typeof location !== 'undefined' && !/^https?:$/.test(location.protocol);
}

export function appUrl() {
  if (isNativeShell()) return PUBLIC_URL;
  const u = new URL(window.location.href);
  u.search = '';
  u.hash = '';
  return u.toString();
}

export function joinUrl(code) {
  const u = new URL(appUrl());
  u.searchParams.set('r', code);
  return u.toString();
}

// ---------- install as an app (PWA) ----------
let installEvent = null;
const installSubs = new Set();
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    installEvent = e;
    installSubs.forEach((fn) => fn());
  });
}

export function isStandalone() {
  try {
    return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  } catch (e) {
    return false;
  }
}

export function isIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

export function canInstall() {
  return !!installEvent;
}

export function onInstallable(fn) {
  installSubs.add(fn);
  return () => installSubs.delete(fn);
}

export async function promptInstall() {
  if (!installEvent) return false;
  installEvent.prompt();
  const choice = await installEvent.userChoice.catch(() => null);
  installEvent = null;
  installSubs.forEach((fn) => fn());
  return !!(choice && choice.outcome === 'accepted');
}
