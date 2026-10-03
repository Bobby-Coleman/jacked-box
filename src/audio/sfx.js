// Synthesized sound effects (no audio files, no licensing).
import { getCtx, buses } from './audio.js';

let noiseBuf = null;
function noise(ac) {
  if (noiseBuf && noiseBuf.sampleRate === ac.sampleRate) return noiseBuf;
  const len = ac.sampleRate * 2;
  noiseBuf = ac.createBuffer(1, len, ac.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  return noiseBuf;
}

function out() {
  const ac = getCtx();
  if (!ac || ac.state !== 'running') return null;
  return { ac, bus: buses().sfxBus };
}

function env(g, t, a, peak, d, sustain = 0.0001) {
  g.gain.cancelScheduledValues(t);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + a);
  g.gain.exponentialRampToValueAtTime(Math.max(sustain, 0.0001), t + a + d);
}

function tone(o, { type = 'sine', f0, f1, t = 0, a = 0.005, d = 0.2, vol = 0.3, dest }) {
  const { ac, bus } = o;
  const start = ac.currentTime + t;
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(f0, start);
  if (f1) osc.frequency.exponentialRampToValueAtTime(f1, start + a + d);
  env(g, start, a, vol, d);
  osc.connect(g);
  g.connect(dest || bus);
  osc.start(start);
  osc.stop(start + a + d + 0.05);
  return osc;
}

function hiss(o, { t = 0, a = 0.005, d = 0.2, vol = 0.3, type = 'bandpass', f0 = 1000, f1, q = 1, dest }) {
  const { ac, bus } = o;
  const start = ac.currentTime + t;
  const src = ac.createBufferSource();
  src.buffer = noise(ac);
  const f = ac.createBiquadFilter();
  f.type = type;
  f.frequency.setValueAtTime(f0, start);
  if (f1) f.frequency.exponentialRampToValueAtTime(f1, start + a + d);
  f.Q.value = q;
  const g = ac.createGain();
  env(g, start, a, vol, d);
  src.connect(f);
  f.connect(g);
  g.connect(dest || bus);
  src.start(start, Math.random());
  src.stop(start + a + d + 0.05);
}

const S = {
  tap(o) {
    tone(o, { type: 'sine', f0: 880, f1: 1320, d: 0.05, vol: 0.18 });
  },
  pop(o) {
    tone(o, { type: 'sine', f0: 320, f1: 980, d: 0.08, vol: 0.32 });
  },
  submit(o) {
    hiss(o, { f0: 500, f1: 3200, d: 0.28, vol: 0.22, q: 1.4 });
    tone(o, { type: 'triangle', f0: 523, t: 0.0, d: 0.1, vol: 0.2 });
    tone(o, { type: 'triangle', f0: 784, t: 0.08, d: 0.18, vol: 0.22 });
  },
  tick(o) {
    tone(o, { type: 'square', f0: 1500, d: 0.025, vol: 0.08 });
  },
  tock(o) {
    tone(o, { type: 'square', f0: 950, d: 0.03, vol: 0.08 });
  },
  ding(o) {
    tone(o, { type: 'sine', f0: 1318, d: 0.9, vol: 0.28 });
    tone(o, { type: 'sine', f0: 1976, d: 0.6, vol: 0.12 });
    tone(o, { type: 'sine', f0: 2637, d: 0.3, vol: 0.06 });
  },
  buzz(o) {
    const osc = tone(o, { type: 'sawtooth', f0: 130, f1: 98, d: 0.45, vol: 0.2 });
    if (osc) osc.detune.setValueAtTime(-30, o.ac.currentTime);
    tone(o, { type: 'square', f0: 65, d: 0.45, vol: 0.12 });
  },
  whoosh(o) {
    hiss(o, { f0: 300, f1: 2400, a: 0.08, d: 0.3, vol: 0.25, q: 0.8 });
  },
  swoop(o) {
    hiss(o, { f0: 2600, f1: 300, a: 0.05, d: 0.32, vol: 0.22, q: 0.8 });
  },
  reveal(o) {
    hiss(o, { f0: 400, f1: 5000, a: 0.25, d: 0.15, vol: 0.18, type: 'highpass' });
    [784, 988, 1175, 1568].forEach((f, i) => tone(o, { type: 'triangle', f0: f, t: 0.28 + i * 0.05, d: 0.35, vol: 0.12 }));
  },
  fanfare(o) {
    const notes = [523, 659, 784, 1047];
    notes.forEach((f, i) => tone(o, { type: 'square', f0: f, t: i * 0.11, d: 0.16, vol: 0.12 }));
    [523, 659, 784, 1047].forEach((f) => tone(o, { type: 'triangle', f0: f, t: 0.46, a: 0.01, d: 1.1, vol: 0.12 }));
    tone(o, { type: 'sawtooth', f0: 131, t: 0.46, d: 1.0, vol: 0.08 });
  },
  drumroll(o) {
    for (let i = 0; i < 26; i++) {
      hiss(o, { t: i * 0.045, d: 0.05, vol: 0.05 + (i / 26) * 0.18, f0: 1800, q: 0.7 });
    }
    hiss(o, { t: 1.2, d: 1.1, vol: 0.3, type: 'highpass', f0: 4000 });
    tone(o, { type: 'sine', f0: 120, f1: 50, t: 1.2, d: 0.4, vol: 0.4 });
  },
  boom(o) {
    hiss(o, { a: 0.005, d: 1.6, vol: 0.9, type: 'lowpass', f0: 3000, f1: 60, q: 0.5 });
    tone(o, { type: 'sine', f0: 90, f1: 28, d: 1.2, vol: 0.9 });
    tone(o, { type: 'square', f0: 45, f1: 25, d: 0.6, vol: 0.25 });
  },
  bang(o) {
    hiss(o, { a: 0.001, d: 0.25, vol: 0.8, type: 'highpass', f0: 900 });
    tone(o, { type: 'sine', f0: 160, f1: 40, d: 0.25, vol: 0.7 });
  },
  bell(o) {
    for (let k = 0; k < 3; k++) {
      const t = k * 0.16;
      tone(o, { type: 'sine', f0: 1240, t, d: 0.9, vol: 0.22 });
      tone(o, { type: 'sine', f0: 1240 * 2.76, t, d: 0.35, vol: 0.07 });
      tone(o, { type: 'sine', f0: 1240 * 5.4, t, d: 0.15, vol: 0.04 });
    }
  },
  moo(o) {
    const { ac, bus } = o;
    const t = ac.currentTime;
    const osc = ac.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(150, t);
    osc.frequency.linearRampToValueAtTime(175, t + 0.25);
    osc.frequency.linearRampToValueAtTime(118, t + 1.0);
    const lfo = ac.createOscillator();
    const lg = ac.createGain();
    lfo.frequency.value = 6;
    lg.gain.value = 3;
    lfo.connect(lg);
    lg.connect(osc.frequency);
    const f = ac.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = 3;
    f.frequency.setValueAtTime(380, t);
    f.frequency.linearRampToValueAtTime(820, t + 0.35);
    f.frequency.linearRampToValueAtTime(420, t + 1.0);
    const g = ac.createGain();
    env(g, t, 0.12, 0.6, 0.95);
    osc.connect(f);
    f.connect(g);
    g.connect(bus);
    osc.start(t);
    lfo.start(t);
    osc.stop(t + 1.15);
    lfo.stop(t + 1.15);
  },
  cash(o) {
    hiss(o, { d: 0.05, vol: 0.3, type: 'highpass', f0: 3000 });
    tone(o, { type: 'sine', f0: 2093, t: 0.06, d: 0.5, vol: 0.18 });
    tone(o, { type: 'sine', f0: 2637, t: 0.1, d: 0.6, vol: 0.14 });
  },
  slideUp(o) {
    tone(o, { type: 'sine', f0: 300, f1: 1400, a: 0.02, d: 0.45, vol: 0.25 });
  },
  slideDown(o) {
    tone(o, { type: 'sine', f0: 1200, f1: 220, a: 0.02, d: 0.55, vol: 0.25 });
  },
  scratch(o) {
    hiss(o, { f0: 2400, f1: 500, d: 0.12, vol: 0.4, q: 3 });
    hiss(o, { t: 0.13, f0: 600, f1: 2200, d: 0.1, vol: 0.35, q: 3 });
  },
  heartbeat(o) {
    tone(o, { type: 'sine', f0: 70, f1: 45, d: 0.14, vol: 0.6 });
    tone(o, { type: 'sine', f0: 65, f1: 42, t: 0.2, d: 0.16, vol: 0.45 });
  },
  applause(o) {
    for (let i = 0; i < 60; i++) {
      hiss(o, { t: Math.random() * 1.8, a: 0.002, d: 0.03 + Math.random() * 0.03, vol: 0.05 + Math.random() * 0.08, f0: 1200 + Math.random() * 2200, q: 1.2 });
    }
  },
  correct(o) {
    tone(o, { type: 'triangle', f0: 784, d: 0.1, vol: 0.22 });
    tone(o, { type: 'triangle', f0: 1175, t: 0.09, d: 0.25, vol: 0.22 });
  },
  wrong(o) {
    tone(o, { type: 'square', f0: 220, d: 0.12, vol: 0.12 });
    tone(o, { type: 'square', f0: 165, t: 0.13, d: 0.3, vol: 0.12 });
  },
  count(o) {
    tone(o, { type: 'square', f0: 660, d: 0.08, vol: 0.12 });
  },
  go(o) {
    tone(o, { type: 'square', f0: 1320, d: 0.25, vol: 0.14 });
  },
  sparkle(o) {
    [1568, 2093, 2637, 3136].forEach((f, i) => tone(o, { type: 'sine', f0: f, t: i * 0.04, d: 0.25, vol: 0.08 }));
  },
};

export function sfx(name) {
  const o = out();
  if (!o || !S[name]) return;
  try {
    S[name](o);
  } catch (e) {
    /* ignore audio errors */
  }
}

export const SFX_NAMES = Object.keys(S);
