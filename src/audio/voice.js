// Host voice: plays BOXTER's pre-rendered lines, falls back to the phone's own
// text-to-speech for anything dynamic (prompts, player answers, names).
import { getCtx, buses, duck } from './audio.js';
import { clipName } from './clipname.js';

let manifest = null; // Set of available clip names
let manifestVer = '1';
let manifestLoading = null;
const bufCache = new Map();
const queue = [];
let busy = false;
let current = null;
let ttsVoice = null;

function base() {
  return new URL('./voice/', document.baseURI).toString();
}

function loadManifest() {
  if (manifest) return Promise.resolve(manifest);
  if (!manifestLoading) {
    manifestLoading = fetch(base() + 'manifest.json', { cache: 'no-cache' })
      .then((r) => (r.ok ? r.json() : []))
      .catch(() => [])
      .then((m) => {
        const list = Array.isArray(m) ? m : (m && m.files) || [];
        if (m && m.v) manifestVer = String(m.v);
        manifest = new Set(list);
        return manifest;
      });
  }
  return manifestLoading;
}

async function getBuffer(name) {
  if (bufCache.has(name)) return bufCache.get(name);
  const ac = getCtx();
  if (!ac) return null;
  const p = fetch(base() + name + '.mp3?v=' + manifestVer)
    .then((r) => (r.ok ? r.arrayBuffer() : null))
    .then((ab) => (ab ? new Promise((res) => ac.decodeAudioData(ab, res, () => res(null))) : null))
    .catch(() => null);
  bufCache.set(name, p);
  return p;
}

// Warm the cache for a game's lines so playback starts instantly.
export async function preloadLines(keys) {
  const m = await loadManifest();
  for (const name of m) {
    if (keys.some((k) => name.startsWith(k))) getBuffer(name);
  }
}

function pickVoice() {
  if (ttsVoice) return ttsVoice;
  const vs = (window.speechSynthesis && window.speechSynthesis.getVoices()) || [];
  const en = vs.filter((v) => /^en[-_]/i.test(v.lang));
  const prefer = [/aaron/i, /evan/i, /nathan/i, /google us english/i, /daniel/i, /alex/i, /fred/i, /arthur/i, /samantha/i, /natural/i, /enhanced/i, /premium/i];
  for (const re of prefer) {
    const v = en.find((x) => re.test(x.name));
    if (v) return (ttsVoice = v);
  }
  return (ttsVoice = en.find((v) => /en-US/i.test(v.lang)) || en[0] || null);
}

if (typeof window !== 'undefined' && window.speechSynthesis) {
  window.speechSynthesis.onvoiceschanged = () => {
    ttsVoice = null;
  };
}

function speak(text) {
  return new Promise((resolve) => {
    const ss = window.speechSynthesis;
    if (!ss || !text) return resolve();
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      clearTimeout(guard);
      resolve();
    };
    const u = new SpeechSynthesisUtterance(text);
    const v = pickVoice();
    if (v) u.voice = v;
    u.lang = (v && v.lang) || 'en-US';
    u.rate = 1.04;
    u.pitch = 0.95;
    u.volume = 1;
    u.onend = finish;
    u.onerror = finish;
    const guard = setTimeout(finish, 1500 + text.length * 90);
    try {
      ss.cancel();
      ss.speak(u);
    } catch (e) {
      finish();
    }
  });
}

function playBuffer(buf) {
  return new Promise((resolve) => {
    const ac = getCtx();
    if (!ac || !buf) return resolve();
    const src = ac.createBufferSource();
    src.buffer = buf;
    src.connect(buses().voiceBus);
    src.onended = resolve;
    current = src;
    src.start();
  });
}

async function pump() {
  if (busy) return;
  busy = true;
  while (queue.length) {
    const cue = queue.shift();
    duck(true);
    try {
      let played = false;
      const m = await loadManifest();
      // Host lines are keyed; static prompts are looked up by their text.
      const name = cue.k != null ? `${cue.k}-${cue.i}` : clipName(cue.tts || cue.t);
      if (m.has(name)) {
        const buf = await getBuffer(name);
        if (buf) {
          await playBuffer(buf);
          played = true;
        }
      }
      if (!played) await speak(cue.tts || cue.t);
    } catch (e) {
      /* keep going */
    }
    current = null;
  }
  duck(false);
  busy = false;
}

export function playCue(cue) {
  // Don't let a backlog build up: keep at most 3 waiting lines.
  if (queue.length > 2) queue.splice(0, queue.length - 2);
  queue.push(cue);
  pump();
}

export function stopVoice() {
  queue.length = 0;
  try {
    if (current) current.stop();
  } catch (e) {
    /* ignore */
  }
  try {
    window.speechSynthesis && window.speechSynthesis.cancel();
  } catch (e) {
    /* ignore */
  }
}
