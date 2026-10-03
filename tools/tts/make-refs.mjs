// Candidate reference voices for BOXTER. Chatterbox clones the timbre of a short reference
// clip; these come from Kokoro-82M's synthetic voices (Apache-2.0), so BOXTER doesn't sound
// like any real person. Writes tools/tts/refs/<voice>.wav (~12 s each).
import { KokoroTTS } from 'kokoro-js';
import { writeFileSync, mkdirSync } from 'node:fs';

const TEXT =
  "Alright, alright, alright! Welcome back to Jacked Box, the only party game that does push-ups between rounds. " +
  "Grab your phones, warm up those thumbs, and let's get this party lifted! Who's ready? I'm ready. I was born ready. I'm a box.";
const VOICES = (process.argv[2] || 'am_michael,am_puck,am_fenrir,am_eric,am_liam,bm_george').split(',');

function wav(f32, rate) {
  const b = Buffer.alloc(44 + f32.length * 2);
  b.write('RIFF', 0);
  b.writeUInt32LE(36 + f32.length * 2, 4);
  b.write('WAVEfmt ', 8);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22);
  b.writeUInt32LE(rate, 24);
  b.writeUInt32LE(rate * 2, 28);
  b.writeUInt16LE(2, 32);
  b.writeUInt16LE(16, 34);
  b.write('data', 36);
  b.writeUInt32LE(f32.length * 2, 40);
  for (let i = 0; i < f32.length; i++) b.writeInt16LE(Math.round(Math.max(-1, Math.min(1, f32[i])) * 32767), 44 + i * 2);
  return b;
}

const dir = new URL('refs/', import.meta.url);
mkdirSync(dir, { recursive: true });
const tts = await KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-v1.0-ONNX', { dtype: 'q8', device: 'cpu' });
for (const v of VOICES) {
  const a = await tts.generate(TEXT, { voice: v, speed: 1.08 });
  writeFileSync(new URL(`kokoro-${v}.wav`, dir), wav(a.audio, a.sampling_rate));
  console.log(v, (a.audio.length / a.sampling_rate).toFixed(1) + 's');
}
