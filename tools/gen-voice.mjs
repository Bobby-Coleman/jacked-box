// Renders BOXTER's voice with Kokoro-82M (Apache-2.0, https://huggingface.co/hexgrad/Kokoro-82M)
// into small MP3s under public/voice/, plus a manifest the game reads.
//
//   node tools/gen-voice.mjs            # host lines + every static prompt
//   node tools/gen-voice.mjs --lines    # host lines only
//   node tools/gen-voice.mjs --test     # one sample per candidate voice
//
// Clips already on disk are skipped, so re-running only renders what's new.
import { KokoroTTS } from 'kokoro-js';
import { Mp3Encoder } from '@breezystack/lamejs';
import { writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { LINES } from '../src/content/voice.js';
import { ZINGER_PROMPTS, ZINGER_FINALS } from '../src/content/zinger.js';
import { FIB_FACTS } from '../src/content/fib.js';
import { HERD_QUESTIONS } from '../src/content/herd.js';
import { SEAT_PROMPTS } from '../src/content/seat.js';
import { clipName } from '../src/audio/clipname.js';

const VOICE = process.env.JB_VOICE || 'am_michael';
const SPEED = 1.06;
const outDir = new URL('../public/voice/', import.meta.url);
const outPath = (name) => new URL(name + '.mp3', outDir);
if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

const args = new Set(process.argv.slice(2));

function toMp3(float32, rate) {
  const enc = new Mp3Encoder(1, rate, 48);
  const pcm = new Int16Array(float32.length);
  for (let i = 0; i < float32.length; i++) {
    const v = Math.max(-1, Math.min(1, float32[i]));
    pcm[i] = v < 0 ? v * 0x8000 : v * 0x7fff;
  }
  const chunks = [];
  const block = 1152;
  for (let i = 0; i < pcm.length; i += block) {
    const buf = enc.encodeBuffer(pcm.subarray(i, i + block));
    if (buf.length) chunks.push(Buffer.from(buf));
  }
  const end = enc.flush();
  if (end.length) chunks.push(Buffer.from(end));
  return Buffer.concat(chunks);
}

// Trim leading/trailing silence so cues feel snappy.
function trim(f32, rate) {
  const thr = 0.008;
  let a = 0;
  let b = f32.length - 1;
  while (a < b && Math.abs(f32[a]) < thr) a++;
  while (b > a && Math.abs(f32[b]) < thr) b--;
  const pad = Math.floor(rate * 0.04);
  return f32.subarray(Math.max(0, a - pad), Math.min(f32.length, b + pad));
}

const t0 = Date.now();
const tts = await KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-v1.0-ONNX', { dtype: 'q8', device: 'cpu' });
console.log(`model ready in ${((Date.now() - t0) / 1000).toFixed(1)}s`);

async function render(name, text, voice = VOICE) {
  if (existsSync(outPath(name))) return false;
  const audio = await tts.generate(text, { voice, speed: SPEED });
  const rate = audio.sampling_rate;
  const mp3 = toMp3(trim(audio.audio, rate), rate);
  writeFileSync(outPath(name), mp3);
  return true;
}

if (args.has('--test')) {
  const sample = "Welcome to Jacked Box! I'm Boxter. Get your friends in here. The code is on your screen.";
  for (const v of ['am_michael', 'am_fenrir', 'am_puck', 'am_echo', 'af_heart', 'bm_george']) {
    const t = Date.now();
    await render('test-' + v, sample, v);
    console.log(v, `${Date.now() - t}ms`);
  }
  process.exit(0);
}

const jobs = [];
for (const [key, variants] of Object.entries(LINES)) variants.forEach((text, i) => jobs.push([`${key}-${i}`, text]));
if (!args.has('--lines')) {
  const text = (it) => (typeof it === 'string' ? it : it.t);
  for (const p of ZINGER_PROMPTS) jobs.push([clipName(text(p)), text(p)]);
  for (const p of ZINGER_FINALS) jobs.push([clipName(text(p)), text(p)]);
  for (const f of FIB_FACTS) {
    const spoken = f.q.replace(/_+/g, 'blank');
    jobs.push([clipName(spoken), spoken]);
  }
  for (const q of HERD_QUESTIONS) jobs.push([clipName(text(q)), text(q)]);
  for (const q of SEAT_PROMPTS) {
    const spoken = `Who is most likely to ${text(q)}?`;
    jobs.push([clipName(spoken), spoken]);
  }
}

let made = 0;
for (let i = 0; i < jobs.length; i++) {
  const [name, text] = jobs[i];
  try {
    if (await render(name, text)) made++;
  } catch (e) {
    console.error('failed', name, e.message);
  }
  if (i % 25 === 0) console.log(`${i + 1}/${jobs.length}  (${made} new)  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
}

const names = readdirSync(outDir)
  .filter((f) => f.endsWith('.mp3') && !f.startsWith('test-'))
  .map((f) => f.slice(0, -4))
  .sort();
writeFileSync(new URL('manifest.json', outDir), JSON.stringify({ v: Date.now(), voice: VOICE, files: names }));
console.log(`done: ${made} new clips, ${names.length} total, ${((Date.now() - t0) / 1000).toFixed(0)}s`);
