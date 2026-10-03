// Host voice: plays BOXTER's pre-rendered lines (and pre-rendered player names), and falls
// back to the phone's own text-to-speech only for what can't be pre-rendered: things players
// typed, like answers and crimes.
import { getCtx, buses, duck } from './audio.js';
import { clipName, nameClips, nameFirst, lineSpoken } from './clipname.js';
import { LINES } from '../content/voice.js';

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

// Warm the players' name clips, so "BOBBY" + "phone on your forehead!" play back to back.
export async function preloadNames(names) {
  const m = await loadManifest();
  for (const n of names) {
    const c = nameClips(n).find((x) => m.has(x));
    if (c) getBuffer(c);
  }
}

// Robotic or novelty system voices we never want reading answers.
const ROBOTIC = /espeak|\bfred\b|albert|bad news|bahh|bells|boing|bubbles|cellos|deranged|good news|hysterical|jester|organ|superstar|trinoids|whisper|wobble|zarvox|junior|ralph|kathy|princess|grandma|grandpa|rocko|shelley|sandy|eddy|flo|reed/i;
const OLD_SAPI = /^microsoft (david|zira|mark|hazel|george|susan|james|catherine|ravi|heera)\b(?!.*(online|natural))/i;

// Score the device's voices and take the most natural-sounding English one:
// neural/online voices first (Edge "Natural", Google, Siri-era "Enhanced"/"Premium").
function voiceScore(v) {
  const n = v.name || '';
  if (ROBOTIC.test(n) || OLD_SAPI.test(n)) return -100;
  let s = 0;
  if (/natural|neural/i.test(n)) s += 60;
  if (/premium/i.test(n)) s += 50;
  if (/enhanced/i.test(n)) s += 40;
  if (/^google/i.test(n)) s += 30;
  if (/\b(aaron|evan|nathan|tom|alex|daniel|samantha|ava|zoe|allison|nicky|guy|andrew|brian|christopher|eric|ryan)\b/i.test(n)) s += 15;
  if (/en[-_]us/i.test(v.lang)) s += 8;
  else if (/en[-_](gb|au|ca|ie|nz)/i.test(v.lang)) s += 4;
  if (v.localService === false) s += 2; // network voices are usually the neural ones
  return s;
}

function pickVoice() {
  if (ttsVoice) return ttsVoice;
  const vs = (window.speechSynthesis && window.speechSynthesis.getVoices()) || [];
  const en = vs.filter((v) => /^en([-_]|$)/i.test(v.lang));
  let best = null;
  let bestScore = -Infinity;
  for (const v of en) {
    const sc = voiceScore(v);
    if (sc > bestScore) {
      best = v;
      bestScore = sc;
    }
  }
  return (ttsVoice = best);
}

// Which clips to play for a cue, in order. Null means "no clips: use the device voice".
function clipsFor(cue, m) {
  if (cue.k == null) {
    const name = clipName(cue.tts || cue.t);
    return m.has(name) ? [name] : null;
  }
  const tpl = (LINES[cue.k] || [])[cue.i] || '';
  // A line this phone's (older, cached) build doesn't know: just read the caption.
  if (!tpl) return null;
  const key = `${cue.k}-${cue.i}`;
  const hasLine = !!lineSpoken(tpl);
  if (hasLine && !m.has(key)) return null;
  const parts = hasLine ? [key] : [];
  if (tpl.includes('{name}') && cue.name) {
    const n = nameClips(cue.name).find((c) => m.has(c));
    // Names we haven't pre-rendered are left to the caption.
    if (n) {
      if (nameFirst(tpl)) parts.unshift(n);
      else parts.push(n);
    }
  }
  return parts;
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
      const m = await loadManifest();
      // Host lines are keyed; static prompts are looked up by their text.
      const parts = clipsFor(cue, m);
      let played = false;
      if (parts) {
        // Fetch all parts up front so a name and its line play back to back.
        const bufs = await Promise.all(parts.map(getBuffer));
        if (bufs.every(Boolean)) {
          for (const buf of bufs) await playBuffer(buf);
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
