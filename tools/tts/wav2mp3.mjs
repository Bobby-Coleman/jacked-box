// Convert WAV files to small MP3s for sharing auditions: node tools/tts/wav2mp3.mjs in.wav [more.wav ...]
import { Mp3Encoder } from '@breezystack/lamejs';
import { readFileSync, writeFileSync } from 'node:fs';

function readWav(buf) {
  let pos = 12;
  let fmt = null;
  let data = null;
  while (pos + 8 <= buf.length) {
    const id = buf.toString('ascii', pos, pos + 4);
    const size = buf.readUInt32LE(pos + 4);
    if (id === 'fmt ') fmt = { rate: buf.readUInt32LE(pos + 12), bits: buf.readUInt16LE(pos + 22), ch: buf.readUInt16LE(pos + 10) };
    if (id === 'data') data = buf.subarray(pos + 8, pos + 8 + size);
    pos += 8 + size + (size % 2);
  }
  const n = Math.floor(data.length / 2 / fmt.ch);
  const pcm = new Int16Array(n);
  for (let i = 0; i < n; i++) pcm[i] = data.readInt16LE(i * 2 * fmt.ch);
  return { rate: fmt.rate, pcm };
}

for (const f of process.argv.slice(2)) {
  const { rate, pcm } = readWav(readFileSync(f));
  const enc = new Mp3Encoder(1, rate, 64);
  const out = [];
  for (let i = 0; i < pcm.length; i += 1152) {
    const b = enc.encodeBuffer(pcm.subarray(i, i + 1152));
    if (b.length) out.push(Buffer.from(b));
  }
  out.push(Buffer.from(enc.flush()));
  const dest = f.replace(/\.wav$/i, '.mp3');
  writeFileSync(dest, Buffer.concat(out));
  console.log(dest);
}
