"""Render BOXTER's lines with Chatterbox-Turbo (MIT, Resemble AI) on the local GPU.

    python render.py --jobs jobs.json --out wav/            # render everything missing
    python render.py --audition                             # compare candidate voices

Each clip is checked with Whisper (speech recognition): if the words don't match the
script, or the timing is off, it's re-rolled with a new seed (up to --tries times) and
the best take is kept. Takes that never pass are listed in qa-report.json.
"""
import argparse
import json
import math
import os
import re
import sys
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
os.environ.setdefault("HF_HOME", str(HERE / ".hf"))

import numpy as np  # noqa: E402
import soundfile as sf  # noqa: E402
import torch  # noqa: E402
import librosa  # noqa: E402

VOICE_FILE = HERE / "voice" / "boxter.wav"  # reference clip that defines BOXTER's voice

NUMBER_WORDS = set(
    "zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen "
    "sixteen seventeen eighteen nineteen twenty thirty forty fifty sixty seventy eighty ninety "
    "hundred thousand million billion first second third".split()
)


def words(t):
    t = re.sub(r"\[[a-z ]+\]", " ", t.lower())  # paralinguistic tags aren't words
    t = t.replace("&", " and ")
    t = re.sub(r"[^a-z0-9' ]+", " ", t)
    out = []
    for w in t.split():
        w = w.strip("'")
        if not w or w.isdigit() or w in NUMBER_WORDS:
            continue
        out.append(w)
    return out


def wer(ref, hyp):
    r, h = words(ref), words(hyp)
    if not r:
        return 0.0
    d = list(range(len(h) + 1))
    for i in range(1, len(r) + 1):
        prev, d[0] = d[0], i
        for j in range(1, len(h) + 1):
            cur = d[j]
            d[j] = min(d[j] + 1, d[j - 1] + 1, prev + (r[i - 1] != h[j - 1]))
            prev = cur
    return d[len(h)] / len(r)


def trim(y, sr, thr=0.02):
    win = int(sr * 0.01)
    idx = [i for i in range(0, len(y), win) if np.max(np.abs(y[i : i + win])) > thr]
    if not idx:
        return y
    pad = int(sr * 0.05)
    return y[max(0, idx[0] - pad) : min(len(y), idx[-1] + win + pad)]


def expected_seconds(text):
    # ~14 characters per second of speech for an energetic host, plus pauses at punctuation
    t = re.sub(r"\[[a-z ]+\]", "", text)
    return len(t) / 14.0 + 0.25 * len(re.findall(r"[.!?]", t)) + 0.3


def pitch_stats(y, sr):
    f0 = librosa.yin(y, fmin=60, fmax=400, sr=sr, frame_length=2048)
    rms = librosa.feature.rms(y=y, frame_length=2048, hop_length=512)[0]
    n = min(len(f0), len(rms))
    f0, rms = f0[:n], rms[:n]
    voiced = f0[(rms > 0.25 * np.max(rms)) & (f0 > 60) & (f0 < 400)]
    if len(voiced) < 5:
        return 0.0, 0.0
    semis = 12 * np.log2(voiced / np.median(voiced))
    return float(np.median(voiced)), float(np.std(semis))


class Checker:
    """Whisper speech recognition, used to catch mumbles, skipped words and run-on babble."""

    def __init__(self, device):
        from transformers import pipeline

        self.asr = pipeline(
            "automatic-speech-recognition",
            model="openai/whisper-base.en",
            device=0 if device == "cuda" else -1,
            torch_dtype=torch.float16 if device == "cuda" else torch.float32,
        )

    def text(self, y, sr):
        y16 = librosa.resample(y, orig_sr=sr, target_sr=16000)
        return self.asr({"raw": y16.astype(np.float32), "sampling_rate": 16000})["text"].strip()

    def judge(self, y, sr, job):
        hyp = self.text(y, sr)
        dur = len(y) / sr
        exp = expected_seconds(job["text"])
        if job["kind"] == "name":
            # Whisper often re-spells names (Jaxon -> Jackson), so check shape, not spelling.
            ok = 0.2 <= dur <= 1.8 and 1 <= len(words(hyp)) <= 3
            return ok, (0.0 if ok else 1.0), hyp, dur
        w = wer(job["text"], hyp)
        too_long = dur > max(2.2 * exp, exp + 2.5)
        too_short = dur < 0.35 * exp
        limit = 0.15 if len(words(job["text"])) >= 6 else 0.34
        ok = w <= limit and not too_long and not too_short
        score = w + (0.5 if too_long or too_short else 0.0)
        return ok, score, hyp, dur


def load_model(device):
    from chatterbox.tts_turbo import ChatterboxTurboTTS

    return ChatterboxTurboTTS.from_pretrained(device=device)


def use_voice(model, voice):
    if voice and voice != "builtin":
        model.prepare_conditionals(str(voice))


def say(model, text, seed, temperature):
    torch.manual_seed(seed)
    wav = model.generate(text, temperature=temperature)
    return wav.squeeze(0).detach().cpu().numpy().astype(np.float32)


def render_jobs(args):
    device = "cuda" if torch.cuda.is_available() else "cpu"
    jobs = json.loads(Path(args.jobs).read_text(encoding="utf-8"))
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    todo = [j for j in jobs if args.force or not (out / f"{j['id']}.wav").exists()]
    if args.only:
        todo = [j for j in todo if re.search(args.only, j["id"])]
    if args.limit:
        todo = todo[: args.limit]
    print(f"{len(jobs)} clips, {len(todo)} to render on {device}", flush=True)
    if not todo:
        return
    t0 = time.time()
    model = load_model(device)
    voice = args.voice or (str(VOICE_FILE) if VOICE_FILE.exists() else "builtin")
    use_voice(model, voice)
    checker = None if args.no_qa else Checker(device)
    print(f"model ready in {time.time() - t0:.0f}s, voice: {voice}", flush=True)
    report_path = out.parent / "qa-report.json"
    report = json.loads(report_path.read_text(encoding="utf-8")) if report_path.exists() else {}
    t1 = time.time()
    for n, job in enumerate(todo, 1):
        best = None
        for attempt in range(args.tries):
            y = trim(say(model, job["text"], args.seed + attempt * 7919, args.temperature), model.sr)
            if checker is None:
                best = (True, 0.0, "", len(y) / model.sr, y)
                break
            ok, score, hyp, dur = checker.judge(y, model.sr, job)
            if best is None or score < best[1]:
                best = (ok, score, hyp, dur, y)
            if ok:
                break
        ok, score, hyp, dur, y = best
        sf.write(out / f"{job['id']}.wav", y, model.sr, subtype="PCM_16")
        if ok:
            report.pop(job["id"], None)
        else:
            report[job["id"]] = {"text": job["text"], "heard": hyp, "score": round(score, 3), "seconds": round(dur, 2)}
        if n % 20 == 0 or n == len(todo) or not ok:
            rate = (time.time() - t1) / n
            flag = "" if ok else f"  CHECK {job['id']}: heard {hyp!r}"
            print(f"{n}/{len(todo)}  {rate:.2f}s/clip  eta {rate * (len(todo) - n) / 60:.1f} min{flag}", flush=True)
            report_path.write_text(json.dumps(report, indent=1), encoding="utf-8")
    report_path.write_text(json.dumps(report, indent=1), encoding="utf-8")
    print(f"done in {(time.time() - t0) / 60:.1f} min; {len(report)} clips flagged in {report_path.name}", flush=True)


AUDITION_LINES = [
    "Welcome to Jacked Box! I'm Boxter. Get your friends in here. The code is on your screen.",
    "Knockout! That one got every vote! [laugh] Flawless victory!",
    "Ten seconds left! Hurry it up!",
    "Unbelievable. The Chameleon knew all along.",
]


def audition(args):
    """Render the same lines in each candidate voice and print objective measurements."""
    device = "cuda" if torch.cuda.is_available() else "cpu"
    model = load_model(device)
    checker = Checker(device)
    out = HERE / "audition"
    out.mkdir(exist_ok=True)
    cands = ["builtin"] + sorted(str(p) for p in (HERE / "refs").glob("*.wav"))
    rows = []
    for c in cands:
        use_voice(model, c)
        name = "builtin" if c == "builtin" else Path(c).stem
        ws, f0s, vars_, speeds = [], [], [], []
        clips = []
        for i, line in enumerate(AUDITION_LINES):
            y = trim(say(model, line, args.seed, args.temperature), model.sr)
            clips.append(y)
            hyp = checker.text(y, model.sr)
            ws.append(wer(line, hyp))
            f0, var = pitch_stats(y, model.sr)
            f0s.append(f0)
            vars_.append(var)
            speeds.append(len(words(line)) / (len(y) / model.sr))
        gap = np.zeros(int(model.sr * 0.6), dtype=np.float32)
        sf.write(out / f"{name}.wav", np.concatenate([x for c_ in clips for x in (c_, gap)]), model.sr, subtype="PCM_16")
        rows.append((name, np.mean(ws), np.median(f0s), np.mean(vars_), np.mean(speeds)))
    print(f"{'voice':24} {'WER':>6} {'pitch Hz':>9} {'expressive':>11} {'words/s':>8}")
    for r in rows:
        print(f"{r[0]:24} {r[1]:6.2f} {r[2]:9.0f} {r[3]:11.2f} {r[4]:8.2f}")
    (out / "audition.json").write_text(json.dumps([dict(zip(["voice", "wer", "pitch", "expressive", "wps"], map(lambda v: v if isinstance(v, str) else round(float(v), 3), r))) for r in rows], indent=1))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--jobs", default=str(HERE / "jobs.json"))
    ap.add_argument("--out", default=str(HERE / "wav"))
    ap.add_argument("--voice", help="reference .wav (5-15 s) or 'builtin'; default tools/tts/voice/boxter.wav")
    ap.add_argument("--tries", type=int, default=4)
    ap.add_argument("--seed", type=int, default=1234)
    ap.add_argument("--temperature", type=float, default=0.8)
    ap.add_argument("--force", action="store_true")
    ap.add_argument("--only", help="regex on clip ids")
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--no-qa", action="store_true")
    ap.add_argument("--audition", action="store_true")
    args = ap.parse_args()
    if args.audition:
        audition(args)
    else:
        render_jobs(args)


if __name__ == "__main__":
    main()
