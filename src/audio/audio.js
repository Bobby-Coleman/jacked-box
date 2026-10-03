// Shared Web Audio graph: master -> compressor -> destination, with music / sfx / voice buses.
// Phones only allow audio after a tap, so unlock() is called from the first button press.
import { load, save } from '../platform.js';

let ac = null;
let comp = null;
let master = null;
let musicBus = null;
let duckNode = null;
let sfxBus = null;
let voiceBus = null;
let unlocked = false;
let speechWarm = false;

const prefs = Object.assign({ muted: false, music: 0.5, sfx: 0.8, voice: 1 }, load('jb.audio') || {});

export function audioPrefs() {
  return prefs;
}

export function setAudioPref(k, v) {
  prefs[k] = v;
  save('jb.audio', prefs);
  apply();
}

function apply() {
  if (!ac) return;
  const t = ac.currentTime;
  master.gain.setTargetAtTime(prefs.muted ? 0 : 1, t, 0.03);
  musicBus.gain.setTargetAtTime(prefs.music * 0.55, t, 0.05);
  sfxBus.gain.setTargetAtTime(prefs.sfx, t, 0.03);
  voiceBus.gain.setTargetAtTime(prefs.voice * 1.3, t, 0.03);
}

export function ensure() {
  if (ac) return ac;
  const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
  if (!AC) return null;
  try {
    ac = new AC({ latencyHint: 'interactive' });
  } catch (e) {
    ac = new AC();
  }
  comp = ac.createDynamicsCompressor();
  comp.threshold.value = -12;
  comp.knee.value = 12;
  comp.ratio.value = 5;
  comp.attack.value = 0.004;
  comp.release.value = 0.2;
  master = ac.createGain();
  comp.connect(master);
  master.connect(ac.destination);
  musicBus = ac.createGain();
  duckNode = ac.createGain();
  musicBus.connect(duckNode);
  duckNode.connect(comp);
  sfxBus = ac.createGain();
  sfxBus.connect(comp);
  voiceBus = ac.createGain();
  voiceBus.connect(comp);
  apply();
  ac.onstatechange = () => {
    for (const fn of stateListeners) fn(ac.state);
  };
  return ac;
}

const stateListeners = new Set();
export function onAudioState(fn) {
  stateListeners.add(fn);
  return () => stateListeners.delete(fn);
}

export function unlock() {
  try {
    // Lets Web Audio play even with the iPhone ring/silent switch on (Safari 16.4+).
    if (navigator.audioSession && navigator.audioSession.type !== 'playback') navigator.audioSession.type = 'playback';
  } catch (e) {
    /* not supported */
  }
  const a = ensure();
  if (!a) return;
  if (a.state !== 'running') a.resume().catch(() => {});
  if (!unlocked) {
    const b = a.createBuffer(1, 1, 22050);
    const s = a.createBufferSource();
    s.buffer = b;
    s.connect(a.destination);
    s.start(0);
    unlocked = true;
  }
  try {
    if (!speechWarm && window.speechSynthesis) {
      const u = new SpeechSynthesisUtterance(' ');
      u.volume = 0;
      window.speechSynthesis.speak(u);
      speechWarm = true;
    }
  } catch (e) {
    /* ignore */
  }
}

export function isUnlocked() {
  return unlocked && ac && ac.state === 'running';
}

export function getCtx() {
  return ac && ac.state !== 'closed' ? ac : null;
}

export function buses() {
  return { ac, musicBus, sfxBus, voiceBus, duckNode };
}

export function duck(on) {
  if (!ac) return;
  duckNode.gain.setTargetAtTime(on ? 0.25 : 1, ac.currentTime, on ? 0.05 : 0.4);
}

// Resume the context when the page comes back (iOS suspends it in the background).
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && ac && ac.state !== 'running' && unlocked) ac.resume().catch(() => {});
  });
}
