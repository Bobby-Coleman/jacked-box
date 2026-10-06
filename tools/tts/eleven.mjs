// BOXTER's voice with ElevenLabs. The API key stays on this computer: put it in tools/tts/.env as
// ELEVENLABS_API_KEY=... (git-ignored) or set it in the environment. Never commit it.
//
//   node tools/tts/eleven.mjs voices                 # deep British male voices in your account
//   node tools/tts/eleven.mjs audition [voiceIds]    # same lines in each voice -> tools/tts/audition-eleven/
//   node tools/tts/eleven.mjs budget                 # characters needed vs. left on your plan
//   node tools/tts/eleven.mjs render                 # every missing clip -> tools/tts/wav-eleven/
//
// Then: node tools/gen-voice.mjs encode wav-eleven   (MP3s + manifest in public/voice/)
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';

const HERE = new URL('./', import.meta.url);
const ENV = new URL('.env', HERE);
if (existsSync(ENV)) {
  for (const line of readFileSync(ENV, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
const KEY = process.env.ELEVENLABS_API_KEY;
const CONFIG = new URL('eleven.json', HERE); // { voiceId, model, settings } chosen after the audition
const cfg = existsSync(CONFIG) ? JSON.parse(readFileSync(CONFIG, 'utf8')) : {};
const VOICE = process.env.ELEVENLABS_VOICE_ID || cfg.voiceId || '';
const MODEL = process.env.ELEVENLABS_MODEL || cfg.model || 'eleven_v3';
const SETTINGS = cfg.settings || { stability: 0.5, similarity_boost: 0.8, style: 0.35, use_speaker_boost: true };
const RATE = 24000;

if (!KEY) {
  console.error('No ElevenLabs key. Put ELEVENLABS_API_KEY=... in tools/tts/.env (it is git-ignored).');
  process.exit(1);
}

async function api(path, opts = {}) {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch('https://api.elevenlabs.io' + path, { ...opts, headers: { 'xi-api-key': KEY, ...(opts.headers || {}) } });
    if (res.status === 429 && attempt < 6) {
      await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
      continue;
    }
    if (!res.ok) throw new Error(`${res.status} ${await res.text().catch(() => '')}`.slice(0, 400));
    return res;
  }
}

// Our cues are written for Chatterbox ([laugh]); v3 understands audio tags like [laughs].
function forModel(text) {
  if (MODEL === 'eleven_v3') {
    return text.replace(/\[laugh\]/g, '[laughs]').replace(/\[chuckle\]/g, '[chuckles]').replace(/\[sigh\]/g, '[sighs]').replace(/\[gasp\]/g, '[gasps]');
  }
  return text.replace(/\s*\[[a-z ]+\]\s*/g, ' ').trim();
}

async function speak(text, voiceId = VOICE, model = MODEL) {
  const res = await api(`/v1/text-to-speech/${voiceId}?output_format=pcm_${RATE}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, model_id: model, voice_settings: SETTINGS }),
  });
  return Buffer.from(await res.arrayBuffer()); // 16-bit mono PCM
}

function wav(pcm) {
  const b = Buffer.alloc(44);
  b.write('RIFF', 0);
  b.writeUInt32LE(36 + pcm.length, 4);
  b.write('WAVEfmt ', 8);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22);
  b.writeUInt32LE(RATE, 24);
  b.writeUInt32LE(RATE * 2, 28);
  b.writeUInt16LE(2, 32);
  b.writeUInt16LE(16, 34);
  b.write('data', 36);
  b.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([b, pcm]);
}

async function voices() {
  const res = await api('/v2/voices?page_size=100&include_total_count=true');
  const { voices: list } = await res.json();
  const rows = list.map((v) => ({ id: v.voice_id, name: v.name, cat: v.category, ...(v.labels || {}), desc: v.description || '' }));
  const brit = rows.filter((v) => /british|english|uk/i.test(`${v.accent} ${v.desc} ${v.name}`) && /male/i.test(v.gender || '') && !/female/i.test(v.gender || ''));
  console.log('British male voices in your account:');
  for (const v of brit) console.log(`  ${v.id}  ${v.name.padEnd(28)} ${[v.accent, v.age, v.description, v.use_case].filter(Boolean).join(', ')}  ${v.desc.slice(0, 60)}`);
  if (!brit.length) console.log('  (none tagged British; all voices below)');
  if (!brit.length) for (const v of rows) console.log(`  ${v.id}  ${v.name.padEnd(28)} ${[v.gender, v.accent, v.age].filter(Boolean).join(', ')}`);
  return brit;
}

const AUDITION = [
  "Welcome to RiffRaff! I'm Boxter, your host. Get your friends in here. The code is on your screen.",
  'Write the funniest thing you can think of, then vote for your favorite. Ready? [excited] It\'s go time!',
  'Knockout! That one got every vote! [laughs] Flawless victory!',
  '[sighs] Wow. Not one of you. Incredible.',
];

async function audition(ids) {
  const dir = new URL('audition-eleven/', HERE);
  mkdirSync(dir, { recursive: true });
  if (!ids.length) ids = (await voices()).slice(0, 4).map((v) => v.id);
  for (const id of ids) {
    for (const model of ['eleven_v3', 'eleven_multilingual_v2']) {
      const parts = [];
      for (const line of AUDITION) {
        const text = model === 'eleven_v3' ? line : line.replace(/\s*\[[a-z ]+\]\s*/g, ' ').trim();
        parts.push(await speak(text, id, model), Buffer.alloc(RATE * 2 * 0.6));
      }
      const file = new URL(`${id}-${model}.wav`, dir);
      writeFileSync(file, wav(Buffer.concat(parts)));
      console.log('wrote', file.pathname);
    }
  }
}

function jobs() {
  const f = new URL('jobs.json', HERE);
  if (!existsSync(f)) throw new Error('Run `node tools/gen-voice.mjs jobs` first.');
  return JSON.parse(readFileSync(f, 'utf8'));
}

async function budget() {
  const sub = await (await api('/v1/user/subscription')).json();
  const left = sub.character_limit - sub.character_count;
  const out = new URL('wav-eleven/', HERE);
  const todo = jobs().filter((j) => !existsSync(new URL(j.id + '.wav', out)));
  const need = todo.reduce((n, j) => n + forModel(j.text).length, 0);
  console.log(`plan: ${sub.tier}, ${sub.character_count.toLocaleString()} of ${sub.character_limit.toLocaleString()} characters used (${left.toLocaleString()} left)`);
  console.log(`to render: ${todo.length} clips, about ${need.toLocaleString()} characters`);
  return { left, need, todo };
}

async function render() {
  if (!VOICE) throw new Error('Pick a voice first: run `audition`, then set "voiceId" in tools/tts/eleven.json.');
  const { left, need, todo } = await budget();
  if (need > left) console.warn(`Not enough characters for everything: rendering in order (host lines first) until the plan runs out.`);
  const out = new URL('wav-eleven/', HERE);
  mkdirSync(out, { recursive: true });
  let i = 0;
  let spent = 0;
  let failed = 0;
  const worker = async () => {
    while (i < todo.length) {
      const j = todo[i++];
      const text = forModel(j.text);
      if (spent + text.length > left) return;
      try {
        const pcm = await speak(text);
        writeFileSync(new URL(j.id + '.wav', out), wav(pcm));
        spent += text.length;
      } catch (e) {
        failed++;
        console.warn('failed', j.id, e.message);
        if (/quota|limit/i.test(e.message)) return;
      }
      if (i % 25 === 0) console.log(`${i}/${todo.length}  ${spent.toLocaleString()} chars`);
    }
  };
  await Promise.all(Array.from({ length: Number(process.env.ELEVENLABS_CONCURRENCY || 3) }, worker));
  console.log(`done: ${spent.toLocaleString()} characters, ${failed} failed`);
}

const [cmd, ...rest] = process.argv.slice(2);
const run = { voices, audition: () => audition(rest), budget, render }[cmd];
if (!run) {
  console.log('usage: node tools/tts/eleven.mjs voices | audition [voiceId ...] | budget | render');
  process.exit(1);
}
await run();
