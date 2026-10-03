# BOXTER's voice

BOXTER (the host) is voiced by **Chatterbox-Turbo** from Resemble AI ([MIT license](https://github.com/resemble-ai/chatterbox)), rendered offline on a local GPU into small MP3s under `public/voice/`. Nothing runs at play time: the game just plays the clips. Chatterbox adds an imperceptible [PerTh watermark](https://github.com/resemble-ai/perth) to everything it generates.

What gets rendered (`node tools/gen-voice.mjs jobs` lists it all in `tools/tts/jobs.json`):

- every host line in `src/content/voice.js`
- every built-in prompt the host reads out (trivia, Zinger prompts, Hot Seat questions, Pull a Face prompts…)
- ~600 common first names, nicknames and family names (`tools/names.mjs`), so lines like "BOBBY, phone on your forehead!" are spoken in BOXTER's voice. The name and the line are separate clips played back to back.

Anything players type themselves (answers, crimes) can't be pre-rendered, so the room speaker's own text-to-speech reads it. `src/audio/voice.js` picks the most natural voice the phone has.

## Setup (once)

Needs an NVIDIA GPU (8 GB is plenty) and Python 3.11 or newer.

```bash
cd tools/tts
python -m venv .venv
.venv/Scripts/python -m pip install torch torchaudio --index-url https://download.pytorch.org/whl/cu128
.venv/Scripts/python -m pip install chatterbox-tts soundfile
```

Model weights (~4 GB) and the Whisper checker download on first run into `tools/tts/.hf/`.

## Render

```bash
node tools/gen-voice.mjs all      # write jobs, render missing WAVs, encode MP3s + manifest
```

- Rendering skips clips that already have a WAV in `tools/tts/wav/`, so after adding lines only the new ones render. Delete a WAV (or pass `--force --only <regex>` via `node tools/gen-voice.mjs render --force --only zinger`) to redo it.
- Every take is checked with Whisper speech recognition. If the words don't match the script, or the clip is far too long or short, it's re-rolled with a new seed (up to 4 tries) and the best take is kept. Clips that never pass are listed in `tools/tts/qa-report.json`.
- `encode` trims silence, evens out loudness and replaces the whole `public/voice/` set, so voices never mix.

## The voice itself

`tools/tts/voice/boxter.wav` is the reference clip Chatterbox clones. It's synthetic, so BOXTER doesn't sound like any real person. To try other voices:

```bash
node tools/tts/make-refs.mjs                                  # candidate reference clips in tools/tts/refs/
tools/tts/.venv/Scripts/python tools/tts/render.py --audition # same test lines in each voice + measurements
```

Listen to `tools/tts/audition/*.wav`, copy the winner to `tools/tts/voice/boxter.wav`, delete `tools/tts/wav/` and render again.
