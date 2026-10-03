// Tiny procedural music engine: one looping track per game, synthesized live.
// Only the "speaker" phone plays music, so the room hears one clean source.
import { getCtx, buses } from './audio.js';

const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

// Patterns are 16 steps per bar. Chords are MIDI note arrays, one per bar.
const TRACKS = {
  lobby: {
    bpm: 98, swing: 0.16,
    chords: [[50, 53, 57, 60, 64], [43, 59, 64, 65], [48, 52, 55, 59, 62], [45, 49, 55, 58]],
    bass: '1..1..5.1..8.5..', bassType: 'triangle', bassVol: 0.55,
    drums: { k: 'x.....x.x.......', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.' },
    keys: '..x...x...x..x..', keysType: 'triangle', keysVol: 0.07,
    arp: null,
  },
  zinger: {
    bpm: 126, swing: 0,
    chords: [[57, 60, 64], [53, 57, 60], [55, 59, 62], [52, 56, 59]],
    bass: '1.1.1.1.1.1.1.18', bassType: 'sawtooth', bassVol: 0.42,
    drums: { k: 'x...x...x...x...', s: '....x.......x...', h: '..x...x...x...x.', c: '............x...' },
    keys: 'x.......x.....x.', keysType: 'square', keysVol: 0.045,
    arp: { pat: [0, 2, 1, 2], every: 2, oct: 12, type: 'square', vol: 0.03, gate: '..x.x.x...x.x.x.' },
  },
  fib: {
    bpm: 92, swing: 0.22,
    chords: [[52, 55, 59], [52, 55, 59], [48, 52, 55], [47, 51, 54]],
    bass: '1.5.8.5.1.5.8.7.', bassType: 'triangle', bassVol: 0.5,
    drums: { k: 'x.......x.......', s: '....x.......x..x', h: 'x.x.x.x.x.x.x.x.' },
    keys: null,
    arp: { pat: [0, 1, 2, 1], every: 4, oct: 12, type: 'pluck', vol: 0.09, gate: 'x...x...x...x.x.' },
  },
  sketch: {
    bpm: 112, swing: 0.1,
    chords: [[60, 64, 67], [57, 60, 64], [53, 57, 60], [55, 59, 62]],
    bass: '1...5...1...5.8.', bassType: 'triangle', bassVol: 0.5,
    drums: { k: 'x.....x...x.....', s: '....x.......x...', h: '..x...x...x...x.' },
    keys: null,
    arp: { pat: [0, 1, 2, 3, 2, 1], every: 2, oct: 12, type: 'marimba', vol: 0.1, gate: 'x.x.x.x.x.x.x.x.' },
  },
  phone: {
    bpm: 118, swing: 0.08,
    chords: [[55, 59, 62], [52, 55, 59], [48, 52, 55], [50, 54, 57]],
    bass: '1..1..1.5..5..5.', bassType: 'triangle', bassVol: 0.5,
    drums: { k: 'x.......x.......', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.', c: '....x.......x...' },
    keys: null,
    arp: { pat: [0, 2, 1, 2], every: 2, oct: 12, type: 'pluck', vol: 0.08, gate: 'x.xx.xx.x.xx.xx.' },
  },
  blend: {
    bpm: 100, swing: 0.12,
    chords: [[57, 60, 64], [55, 59, 62], [53, 57, 60], [55, 59, 62]],
    bass: '1.....1...5.....', bassType: 'sine', bassVol: 0.6,
    drums: { k: 'x.....x...x.....', t: '..x.....x..x..x.', sh: 'x.xxx.xxx.xxx.xx' },
    keys: null,
    arp: { pat: [0, 2, 1, 2, 0, 1], every: 2, oct: 12, type: 'marimba', vol: 0.09, gate: 'x..x..x.x..x..x.' },
  },
  dial: {
    bpm: 86, swing: 0,
    chords: [[53, 57, 60, 64], [52, 55, 59, 62], [50, 53, 57, 60], [48, 52, 55, 59]],
    bass: '1.......1.....5.', bassType: 'sine', bassVol: 0.55,
    drums: { k: 'x.........x.....', h: '....x.......x...' },
    keys: 'x...............', keysType: 'sine', keysVol: 0.06, keysLen: 14,
    arp: { pat: [0, 1, 2, 3], every: 2, oct: 12, type: 'sine', vol: 0.05, gate: 'x.x.x.x.x.x.x.x.', delay: true },
  },
  herd: {
    bpm: 116, swing: 0.05,
    chords: [[55, 59, 62], [60, 64, 67], [62, 66, 69], [55, 59, 62]],
    bass: '1...5...1...5...', bassType: 'triangle', bassVol: 0.55,
    drums: { k: 'x...x...x...x...', s: '....x.......x...', h: '..x...x...x...x.' },
    keys: '....x.......x...', keysType: 'square', keysVol: 0.04,
    arp: { pat: [0, 1, 2, 1], every: 1, oct: 12, type: 'pluck', vol: 0.06, gate: 'x.x.xx.xx.x.xx.x' },
  },
  bomb: {
    bpm: 140, swing: 0,
    chords: [[48, 51, 55], [44, 48, 51], [48, 51, 55], [43, 47, 50]],
    bass: '1...1...1...1.1.', bassType: 'sawtooth', bassVol: 0.35,
    drums: { k: 'x.......x.......', h: 'x.x.x.x.x.x.x.x.' },
    keys: null,
    arp: { pat: [2, 1], every: 4, oct: 24, type: 'square', vol: 0.02, gate: 'x...x...x...x...' },
  },
  noon: {
    bpm: 76, swing: 0.1,
    chords: [[57, 60, 64], [50, 53, 57], [52, 56, 59], [57, 60, 64]],
    bass: '1.......5.......', bassType: 'triangle', bassVol: 0.55,
    drums: { k: 'x.......x.......', sh: '..x...x...x...x.' },
    keys: null,
    arp: { pat: [2, 1, 0, 1], every: 4, oct: 12, type: 'whistle', vol: 0.06, gate: 'x.......x...x...', delay: true },
  },
  head: {
    bpm: 124, swing: 0,
    chords: [[60, 64, 67], [55, 59, 62], [57, 60, 64], [53, 57, 60]],
    bass: '1.1.1.1.1.1.1.1.', bassType: 'square', bassVol: 0.3,
    drums: { k: 'x...x...x...x...', s: '....x.......x...', h: '..x...x...x...x.', c: '....x.......x...' },
    keys: '..x...x...x...x.', keysType: 'triangle', keysVol: 0.05,
    arp: null,
  },
  dead: {
    bpm: 84, swing: 0,
    chords: [[45, 48, 52], [46, 49, 53], [45, 48, 52], [44, 47, 51]],
    bass: '1.......1...1...', bassType: 'sawtooth', bassVol: 0.32,
    drums: { k: 'x.......x.......', h: '....x.......x...', t: '..............x.' },
    keys: 'x...............', keysType: 'triangle', keysVol: 0.05, keysLen: 15,
    arp: { pat: [2, 1, 0, 1], every: 2, oct: 12, type: 'sine', vol: 0.05, gate: 'x...x...x...x.x.', delay: true },
  },
  seat: {
    bpm: 102, swing: 0.12,
    chords: [[50, 53, 57], [50, 53, 57], [46, 50, 53], [45, 49, 52]],
    bass: '1..1..1.1..1..5.', bassType: 'triangle', bassVol: 0.5,
    drums: { k: 'x.....x.x.......', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.' },
    keys: '..x...x...x...x.', keysType: 'square', keysVol: 0.035,
    arp: null,
  },
  photo: {
    bpm: 96, swing: 0.2,
    chords: [[53, 57, 60, 64], [50, 53, 57, 60], [55, 59, 62, 65], [48, 52, 55, 59]],
    bass: '1.3.5.6.8.6.5.3.', bassType: 'triangle', bassVol: 0.5,
    drums: { k: 'x.......x.......', h: 'x..x..x.x..x..x.' },
    keys: 'x.....x.....x...', keysType: 'triangle', keysVol: 0.06,
    arp: { pat: [0, 2, 3, 2], every: 4, oct: 12, type: 'pluck', vol: 0.07, gate: 'x...x.x.....x...' },
  },
  zoom: {
    bpm: 110, swing: 0,
    chords: [[45, 48, 52], [41, 45, 48], [43, 47, 50], [40, 44, 47]],
    bass: '1.1.1.1.1.1.1.1.', bassType: 'sawtooth', bassVol: 0.3,
    drums: { k: 'x...x...x...x...', h: '..x...x...x...x.' },
    keys: null,
    arp: { pat: [0, 1, 2, 1], every: 1, oct: 12, type: 'square', vol: 0.025, gate: 'x.x.x.x.x.x.x.x.', delay: true },
  },
  frank: {
    bpm: 90, swing: 0,
    chords: [[45, 48, 51], [44, 47, 50], [45, 48, 52], [46, 49, 53]],
    bass: '1.....1.1.....5.', bassType: 'sawtooth', bassVol: 0.3,
    drums: { k: 'x.......x..x....', t: '......x.......x.' },
    keys: 'x...............', keysType: 'triangle', keysVol: 0.05, keysLen: 14,
    arp: { pat: [2, 1, 0, 1], every: 2, oct: 12, type: 'sine', vol: 0.05, gate: 'x..x..x.x..x..x.', delay: true },
  },
  wanted: {
    bpm: 96, swing: 0.18,
    chords: [[52, 55, 59], [57, 60, 64], [52, 55, 59], [47, 51, 54]],
    bass: '1...5...1...5.5.', bassType: 'triangle', bassVol: 0.55,
    drums: { k: 'x.....x.x.......', sh: 'x.xxx.xxx.xxx.xx' },
    keys: null,
    arp: { pat: [0, 1, 2, 1], every: 4, oct: 12, type: 'whistle', vol: 0.05, gate: 'x.......x...x...', delay: true },
  },
  pull: {
    bpm: 120, swing: 0,
    chords: [[57, 60, 64], [50, 53, 57], [55, 59, 62], [52, 55, 59]],
    bass: '1.8.1.8.1.8.1.8.', bassType: 'triangle', bassVol: 0.5,
    drums: { k: 'x...x...x...x...', s: '....x.......x...', h: '..x...x...x...x.' },
    keys: 'x.x...x.x...x...', keysType: 'square', keysVol: 0.035,
    arp: null,
  },
  fraud: {
    bpm: 104, swing: 0.1,
    chords: [[50, 53, 57], [52, 55, 58], [53, 57, 60], [52, 55, 59]],
    bass: '1...5...1...5...', bassType: 'triangle', bassVol: 0.5,
    drums: { k: 'x.......x.......', h: '..x...x...x...x.' },
    keys: null,
    arp: { pat: [0, 1, 2, 1], every: 2, oct: 12, type: 'pluck', vol: 0.09, gate: 'x.x...x.x...x.x.' },
  },
  pants: {
    bpm: 100, swing: 0,
    chords: [[50, 53, 57], [50, 53, 58], [50, 53, 57], [49, 52, 56]],
    bass: '1.1.....1.1.....', bassType: 'triangle', bassVol: 0.5,
    drums: { k: 'x.......x.......', t: '....x.......x...', h: 'x.x.x.x.x.x.x.x.' },
    keys: null,
    arp: { pat: [0, 2, 1, 2], every: 2, oct: 12, type: 'marimba', vol: 0.08, gate: 'x..x..x...x..x..' },
  },
  split: {
    bpm: 128, swing: 0,
    chords: [[60, 64, 67], [57, 60, 64], [62, 65, 69], [55, 59, 62]],
    bass: '1.1.5.5.1.1.5.5.', bassType: 'square', bassVol: 0.28,
    drums: { k: 'x...x...x...x...', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.', c: '............x...' },
    keys: null,
    arp: { pat: [0, 1, 2, 1], every: 2, oct: 12, type: 'square', vol: 0.03, gate: 'x.x.x.x.x.x.x.x.' },
  },
  results: {
    bpm: 108, swing: 0.05,
    chords: [[60, 64, 67], [53, 57, 60], [55, 59, 62], [60, 64, 67]],
    bass: '1...1.5.1...1.5.', bassType: 'triangle', bassVol: 0.5,
    drums: { k: 'x...x...x...x...', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.' },
    keys: 'x.....x.....x...', keysType: 'triangle', keysVol: 0.06,
    arp: { pat: [0, 1, 2, 3], every: 2, oct: 12, type: 'square', vol: 0.03, gate: 'x.x.x.x.x.x.x.x.' },
  },
};

let current = null;
let timer = null;
let step = 0;
let nextTime = 0;
let trackGain = null;
let delayIn = null;
let noiseBuf = null;

function nb(ac) {
  if (noiseBuf) return noiseBuf;
  noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return noiseBuf;
}

function voice(ac, dest, { type, freq, t, a = 0.005, d, vol, lp, vib }) {
  const o = ac.createOscillator();
  const g = ac.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  let node = o;
  if (lp) {
    const f = ac.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = lp;
    f.Q.value = 0.7;
    o.connect(f);
    node = f;
  }
  if (vib) {
    const l = ac.createOscillator();
    const lg = ac.createGain();
    l.frequency.value = 5.5;
    lg.gain.value = freq * 0.012;
    l.connect(lg);
    lg.connect(o.frequency);
    l.start(t);
    l.stop(t + a + d + 0.1);
  }
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  node.connect(g);
  g.connect(dest);
  o.start(t);
  o.stop(t + a + d + 0.05);
}

function drum(ac, dest, kind, t) {
  if (kind === 'k') {
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.22);
    g.gain.setValueAtTime(0.7, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    o.connect(g);
    g.connect(dest);
    o.start(t);
    o.stop(t + 0.32);
    return;
  }
  if (kind === 't') {
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.frequency.setValueAtTime(220, t);
    o.frequency.exponentialRampToValueAtTime(110, t + 0.2);
    g.gain.setValueAtTime(0.25, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
    o.connect(g);
    g.connect(dest);
    o.start(t);
    o.stop(t + 0.27);
    return;
  }
  const src = ac.createBufferSource();
  src.buffer = nb(ac);
  const f = ac.createBiquadFilter();
  const g = ac.createGain();
  let dur = 0.05;
  let vol = 0.12;
  if (kind === 's' || kind === 'c') {
    f.type = 'bandpass';
    f.frequency.value = kind === 's' ? 1800 : 1200;
    f.Q.value = 0.8;
    dur = kind === 's' ? 0.16 : 0.1;
    vol = kind === 's' ? 0.28 : 0.22;
  } else if (kind === 'sh') {
    f.type = 'highpass';
    f.frequency.value = 6000;
    dur = 0.06;
    vol = 0.07;
  } else {
    f.type = 'highpass';
    f.frequency.value = 7500;
    dur = 0.04;
    vol = 0.08;
  }
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f);
  f.connect(g);
  g.connect(dest);
  src.start(t, Math.random() * 0.5);
  src.stop(t + dur + 0.02);
}

function inst(ac, dest, type, midi, t, dur, vol) {
  const freq = mtof(midi);
  if (type === 'pluck') voice(ac, dest, { type: 'square', freq, t, a: 0.003, d: Math.min(dur, 0.22), vol, lp: 1800 });
  else if (type === 'marimba') {
    voice(ac, dest, { type: 'sine', freq, t, a: 0.002, d: 0.35, vol });
    voice(ac, dest, { type: 'sine', freq: freq * 4, t, a: 0.001, d: 0.05, vol: vol * 0.4 });
  } else if (type === 'whistle') voice(ac, dest, { type: 'sine', freq, t, a: 0.06, d: dur, vol, vib: true });
  else voice(ac, dest, { type, freq, t, a: 0.01, d: dur, vol, lp: type === 'square' || type === 'sawtooth' ? 2400 : 0 });
}

function schedule() {
  const ac = getCtx();
  if (!ac || !current) return;
  const tr = current;
  const sixteenth = 60 / tr.bpm / 4;
  while (nextTime < ac.currentTime + 0.15) {
    const s = step % 16;
    const bar = Math.floor(step / 16) % tr.chords.length;
    const chord = tr.chords[bar];
    const swing = s % 2 === 1 ? sixteenth * tr.swing : 0;
    const t = nextTime + swing;
    const dest = trackGain;
    for (const [k, pat] of Object.entries(tr.drums || {})) if (pat[s] === 'x') drum(ac, dest, k, t);
    const bc = tr.bass && tr.bass[s];
    if (bc && bc !== '.') {
      const root = chord[0] - 12;
      const n = bc === '5' ? root + 7 : bc === '8' ? root + 12 : bc === '7' ? root + 10 : bc === '3' ? chord[1] - 12 : bc === '6' ? root + 9 : root;
      voice(ac, dest, { type: tr.bassType, freq: mtof(n), t, a: 0.006, d: sixteenth * 1.8, vol: tr.bassVol * 0.5, lp: 700 });
    }
    if (tr.keys && tr.keys[s] === 'x') {
      for (const n of chord) inst(ac, dest, tr.keysType, n, t, sixteenth * (tr.keysLen || 2.5), tr.keysVol);
    }
    if (tr.arp && tr.arp.gate[s] === 'x') {
      const idx = tr.arp.pat[Math.floor(step / tr.arp.every) % tr.arp.pat.length] % chord.length;
      const n = chord[idx] + tr.arp.oct;
      inst(ac, tr.arp.delay && delayIn ? delayIn : dest, tr.arp.type, n, t, sixteenth * 1.5, tr.arp.vol);
    }
    nextTime += sixteenth;
    step++;
  }
}

export function playMusic(name) {
  const ac = getCtx();
  const id = !name ? null : TRACKS[name] ? name : 'lobby';
  if (current && current.id === id) return;
  stopMusic();
  if (!ac || !id) return;
  const { musicBus } = buses();
  current = { id, ...TRACKS[id] };
  trackGain = ac.createGain();
  trackGain.gain.setValueAtTime(0.0001, ac.currentTime);
  trackGain.gain.exponentialRampToValueAtTime(1, ac.currentTime + 1.2);
  trackGain.connect(musicBus);
  // simple echo send for spacey tracks
  const dl = ac.createDelay(1.0);
  dl.delayTime.value = (60 / current.bpm) * 0.75;
  const fb = ac.createGain();
  fb.gain.value = 0.35;
  delayIn = ac.createGain();
  delayIn.connect(trackGain);
  delayIn.connect(dl);
  dl.connect(fb);
  fb.connect(dl);
  dl.connect(trackGain);
  step = 0;
  nextTime = ac.currentTime + 0.08;
  timer = setInterval(schedule, 30);
  schedule();
}

export function stopMusic() {
  const ac = getCtx();
  if (timer) clearInterval(timer);
  timer = null;
  if (trackGain && ac) {
    const g = trackGain;
    g.gain.setTargetAtTime(0.0001, ac.currentTime, 0.25);
    setTimeout(() => {
      try {
        g.disconnect();
      } catch (e) {
        /* ignore */
      }
    }, 1500);
  }
  trackGain = null;
  delayIn = null;
  current = null;
}

export function currentMusic() {
  return current ? current.id : null;
}
