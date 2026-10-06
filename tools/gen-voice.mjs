// BOXTER's voice pipeline. Renders every host line, every static prompt and a few hundred
// player names with Chatterbox-Turbo (MIT, Resemble AI: https://github.com/resemble-ai/chatterbox)
// on the local GPU, then encodes small MP3s into public/voice/ plus the manifest the game reads.
//
//   node tools/gen-voice.mjs jobs      # write tools/tts/jobs.json (what needs rendering)
//   node tools/gen-voice.mjs render    # jobs + run the Python renderer (tools/tts/render.py)
//   node tools/gen-voice.mjs encode    # WAVs in tools/tts/wav -> public/voice/*.mp3 + manifest
//   node tools/gen-voice.mjs all       # jobs + render + encode
//
// Rendering skips clips that already have a WAV, so re-runs only render what's new.
// Set up the renderer once: see tools/tts/README.md.
import { Mp3Encoder } from '@breezystack/lamejs';
import { writeFileSync, readFileSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { LINES } from '../src/content/voice.js';
import { ZINGER_PROMPTS, ZINGER_FINALS } from '../src/content/zinger.js';
import { FIB_FACTS } from '../src/content/fib.js';
import { HERD_QUESTIONS } from '../src/content/herd.js';
import { SEAT_PROMPTS } from '../src/content/seat.js';
import { DEAD_TRIVIA, DEAD_TF } from '../src/content/dead.js';
import { FACE_PROMPTS } from '../src/content/faces.js';
import { clipName, nameClip, nameFirst, lineSpoken } from '../src/audio/clipname.js';
import { nameJobs } from './names.mjs';

const ROOT = new URL('../', import.meta.url);
const TTS = new URL('tts/', import.meta.url);
const WAV = new URL('tts/wav/', import.meta.url);
const OUT = new URL('../public/voice/', import.meta.url);
const VOICE = process.argv[3] === 'wav-eleven' ? 'elevenlabs' : 'chatterbox-turbo';
const step = process.argv[2] || 'all';

// ---------- what to say ----------

function spokenLine(tpl) {
  if (!tpl.includes('{name}')) return tpl;
  const rest = lineSpoken(tpl);
  if (!rest) return '';
  // "A masterpiece by..." leads into the name; "You go first!" follows it.
  if (!nameFirst(tpl)) return rest.replace(/[\s:,;]+$/, '') + '...';
  return rest.charAt(0).toUpperCase() + rest.slice(1);
}

function buildJobs() {
  const jobs = [];
  const seen = new Set();
  const add = (id, text, kind) => {
    if (!id || !text || seen.has(id)) return;
    seen.add(id);
    jobs.push({ id, text, kind });
  };
  for (const [key, variants] of Object.entries(LINES)) variants.forEach((tpl, i) => add(`${key}-${i}`, spokenLine(tpl), 'line'));
  const text = (it) => (typeof it === 'string' ? it : it.t);
  const prompt = (t) => add(clipName(t), t, 'prompt');
  for (const p of ZINGER_PROMPTS) prompt(text(p));
  for (const p of ZINGER_FINALS) prompt(text(p));
  for (const f of FIB_FACTS) prompt(f.q.replace(/_+/g, 'blank'));
  for (const q of HERD_QUESTIONS) prompt(text(q));
  for (const q of DEAD_TRIVIA) prompt(q.q);
  for (const q of DEAD_TF) prompt(q.q);
  for (const q of SEAT_PROMPTS) prompt(`Who is most likely to ${text(q)}?`);
  for (const q of FACE_PROMPTS) prompt(text(q));
  for (const j of nameJobs(nameClip)) add(j.id, j.text, 'name');
  return jobs;
}

// ---------- WAV -> MP3 ----------

function readWav(buf) {
  if (buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WAVE') throw new Error('not a wav');
  let pos = 12;
  let fmt = null;
  let data = null;
  while (pos + 8 <= buf.length) {
    const id = buf.toString('ascii', pos, pos + 4);
    const size = buf.readUInt32LE(pos + 4);
    if (id === 'fmt ') fmt = { format: buf.readUInt16LE(pos + 8), channels: buf.readUInt16LE(pos + 10), rate: buf.readUInt32LE(pos + 12), bits: buf.readUInt16LE(pos + 22) };
    if (id === 'data') data = buf.subarray(pos + 8, pos + 8 + size);
    pos += 8 + size + (size % 2);
  }
  if (!fmt || !data) throw new Error('bad wav');
  const n = Math.floor(data.length / (fmt.bits / 8) / fmt.channels);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const o = i * fmt.channels * (fmt.bits / 8);
    out[i] = fmt.bits === 16 ? data.readInt16LE(o) / 32768 : fmt.format === 3 ? data.readFloatLE(o) : data.readInt32LE(o) / 2147483648;
  }
  return { rate: fmt.rate, audio: out };
}

// Trim leading/trailing silence so cues feel snappy; keep a hair of room tone.
function trim(f32, rate) {
  const win = Math.floor(rate * 0.01);
  const loud = (i) => {
    let m = 0;
    for (let k = i; k < Math.min(f32.length, i + win); k++) m = Math.max(m, Math.abs(f32[k]));
    return m > 0.02;
  };
  let a = 0;
  while (a < f32.length && !loud(a)) a += win;
  let b = f32.length - win;
  while (b > a && !loud(b)) b -= win;
  const pad = Math.floor(rate * 0.05);
  return f32.slice(Math.max(0, a - pad), Math.min(f32.length, b + win + pad));
}

// Even out loudness across clips (RMS of the voiced part), with a peak ceiling.
function normalize(f32) {
  let sum = 0;
  let cnt = 0;
  let peak = 0;
  for (const v of f32) {
    const a = Math.abs(v);
    peak = Math.max(peak, a);
    if (a > 0.02) {
      sum += v * v;
      cnt++;
    }
  }
  if (!cnt) return f32;
  const rms = Math.sqrt(sum / cnt);
  const target = 0.16; // about -16 dBFS while speaking
  const gain = Math.min(target / rms, 0.95 / peak);
  const out = new Float32Array(f32.length);
  for (let i = 0; i < f32.length; i++) out[i] = f32[i] * gain;
  // 15 ms fades so clips never click
  const fade = Math.min(Math.floor(out.length / 4), 360);
  for (let i = 0; i < fade; i++) {
    out[i] *= i / fade;
    out[out.length - 1 - i] *= i / fade;
  }
  return out;
}

function toMp3(f32, rate) {
  const enc = new Mp3Encoder(1, rate, 48);
  const pcm = new Int16Array(f32.length);
  for (let i = 0; i < f32.length; i++) {
    const v = Math.max(-1, Math.min(1, f32[i]));
    pcm[i] = v < 0 ? v * 0x8000 : v * 0x7fff;
  }
  const chunks = [];
  for (let i = 0; i < pcm.length; i += 1152) {
    const b = enc.encodeBuffer(pcm.subarray(i, i + 1152));
    if (b.length) chunks.push(Buffer.from(b));
  }
  const end = enc.flush();
  if (end.length) chunks.push(Buffer.from(end));
  return Buffer.concat(chunks);
}

// ---------- steps ----------

function writeJobs() {
  const jobs = buildJobs();
  writeFileSync(new URL('jobs.json', TTS), JSON.stringify(jobs, null, 1));
  const kinds = jobs.reduce((m, j) => ((m[j.kind] = (m[j.kind] || 0) + 1), m), {});
  console.log(`${jobs.length} clips (${Object.entries(kinds).map(([k, n]) => `${n} ${k}s`).join(', ')}) -> tools/tts/jobs.json`);
  return jobs;
}

function render() {
  const py = fileURLToPath(new URL('.venv/Scripts/python.exe', TTS));
  const exe = existsSync(py) ? py : 'python';
  const r = spawnSync(exe, [fileURLToPath(new URL('render.py', TTS)), '--jobs', fileURLToPath(new URL('jobs.json', TTS)), '--out', fileURLToPath(WAV), ...process.argv.slice(3)], { stdio: 'inherit', cwd: fileURLToPath(ROOT) });
  if (r.status !== 0) {
    console.error('renderer failed');
    process.exit(r.status || 1);
  }
}

function encode() {
  // `encode wav-eleven` encodes the ElevenLabs renders instead of the Chatterbox ones.
  const WAV = new URL((process.argv[3] || 'wav') + '/', TTS);
  const jobs = buildJobs();
  const missing = jobs.filter((j) => !existsSync(new URL(j.id + '.wav', WAV)));
  if (missing.length) console.warn(`${missing.length} clips have no WAV yet (they'll use the device voice): ${missing.slice(0, 8).map((j) => j.id).join(', ')}${missing.length > 8 ? '…' : ''}`);
  // Replace the whole set so voices never mix.
  if (existsSync(OUT)) for (const f of readdirSync(OUT)) if (f.endsWith('.mp3')) rmSync(new URL(f, OUT));
  mkdirSync(OUT, { recursive: true });
  let bytes = 0;
  const files = [];
  for (const j of jobs) {
    const src = new URL(j.id + '.wav', WAV);
    if (!existsSync(src)) continue;
    const { rate, audio } = readWav(readFileSync(src));
    const mp3 = toMp3(normalize(trim(audio, rate)), rate);
    writeFileSync(new URL(j.id + '.mp3', OUT), mp3);
    bytes += mp3.length;
    files.push(j.id);
  }
  files.sort();
  writeFileSync(new URL('manifest.json', OUT), JSON.stringify({ v: Date.now(), voice: VOICE, files }));
  console.log(`encoded ${files.length} clips, ${(bytes / 1e6).toFixed(1)} MB -> public/voice/`);
}

mkdirSync(WAV, { recursive: true });
if (step === 'jobs') writeJobs();
else if (step === 'render') {
  writeJobs();
  render();
} else if (step === 'encode') encode();
else if (step === 'all') {
  writeJobs();
  render();
  encode();
} else {
  console.error('usage: node tools/gen-voice.mjs [jobs|render|encode|all]');
  process.exit(1);
}
