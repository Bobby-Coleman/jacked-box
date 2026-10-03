import { useEffect, useRef, useState } from 'preact/hooks';
import { gsend, useNow, fmtScore, PlayerChip } from '../../ui/common.jsx';
import { PlayerAvatar } from '../../ui/Avatar.jsx';
import { faceSrc, loadImage } from '../../ui/faces.jsx';
import { RoundHeader, useStepSound } from '../shared.jsx';
import { sfx } from '../../audio/sfx.js';
import { vibrate } from '../../platform.js';
import { store } from '../../app/session.js';
import { ROUND_MS } from './logic.js';
import './zoom.css';

const ease = (t) => 1 - Math.pow(1 - t, 2.2);
const lerp = (a, b, t) => a + (b - a) * t;

// Paint the face with the round's "enhance" effect at progress p (0 → 1).
function paintEffect(canvas, img, r, p) {
  if (!canvas || !img) return;
  const ctx = canvas.getContext('2d');
  const S = canvas.width;
  ctx.save();
  ctx.fillStyle = '#05080a';
  ctx.fillRect(0, 0, S, S);
  ctx.imageSmoothingEnabled = true;
  const e = ease(Math.min(1, Math.max(0, p)));
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  if (r.effect === 'zoom' || r.effect === 'flip') {
    const z = lerp(r.effect === 'flip' ? 5 : 9, 1, e);
    const cx = lerp(r.fx, 0.5, e);
    const cy = lerp(r.fy, 0.5, e);
    if (r.effect === 'flip') {
      ctx.translate(S / 2, S / 2);
      ctx.rotate(Math.PI * (1 - e));
      ctx.translate(-S / 2, -S / 2);
    }
    const dw = S * z;
    ctx.drawImage(img, S / 2 - cx * dw, S / 2 - cy * dw, dw, dw);
  } else if (r.effect === 'pixel') {
    const n = Math.max(3, Math.round(lerp(3, 96, e * e)));
    const tmp = paintEffect.tmp || (paintEffect.tmp = document.createElement('canvas'));
    tmp.width = n;
    tmp.height = n;
    tmp.getContext('2d').drawImage(img, 0, 0, iw, ih, 0, 0, n, n);
    ctx.imageSmoothingEnabled = e > 0.97;
    ctx.drawImage(tmp, 0, 0, n, n, 0, 0, S, S);
  } else if (r.effect === 'blur') {
    if (typeof ctx.filter === 'string') {
      ctx.filter = `blur(${lerp(S * 0.09, 0, e)}px)`;
      ctx.drawImage(img, 0, 0, S, S);
      ctx.filter = 'none';
    } else {
      paintEffect(canvas, img, { ...r, effect: 'pixel' }, p);
    }
  } else if (r.effect === 'strip') {
    const h = lerp(0.07, 1, e);
    const top = Math.max(0, Math.min(1 - h, r.fy - h / 2));
    ctx.drawImage(img, 0, top * ih, iw, h * ih, 0, top * S, S, h * S);
  } else if (r.effect === 'tiles') {
    const fixed = Math.floor(e * 17);
    const ts = S / 4;
    const sw = iw / 4;
    const sh = ih / 4;
    for (let i = 0; i < 16; i++) {
      // Tile i shows the right piece once it's "fixed", otherwise a scrambled one.
      const src = r.perm.indexOf(i) < fixed ? i : r.perm[i];
      ctx.drawImage(img, (src % 4) * sw, Math.floor(src / 4) * sh, sw, sh, (i % 4) * ts, Math.floor(i / 4) * ts, ts, ts);
    }
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = Math.max(1, S * 0.006);
    for (let k = 1; k < 4; k++) {
      ctx.beginPath();
      ctx.moveTo(k * ts, 0);
      ctx.lineTo(k * ts, S);
      ctx.moveTo(0, k * ts);
      ctx.lineTo(S, k * ts);
      ctx.stroke();
    }
  }
  ctx.restore();
  // Scanlines for the CSI-monitor look.
  ctx.fillStyle = 'rgba(0, 255, 170, 0.05)';
  for (let y = 0; y < S; y += Math.max(3, Math.round(S / 120))) ctx.fillRect(0, y, S, 1);
}

function EvidenceScreen({ src, r, t0, full = false }) {
  const ref = useRef(null);
  const [img, setImg] = useState(null);
  useEffect(() => {
    let alive = true;
    loadImage(src).then((im) => alive && setImg(im));
    return () => (alive = false);
  }, [src]);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const css = c.clientWidth || 300;
    const px = Math.round(css * Math.min(window.devicePixelRatio || 1, 2));
    c.width = px;
    c.height = px;
    let raf;
    const loop = () => {
      const now = store.link ? store.link.now() : Date.now();
      paintEffect(c, img, r, full ? 1 : (now - t0) / ROUND_MS);
      if (!full) raf = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(raf);
  }, [img, r, t0, full]);
  return (
    <div class="ze-monitor">
      <canvas ref={ref} aria-label="Enhancing image" />
      <span class="ze-rec">● ENHANCE</span>
      {!img && <div class="drawing-loading">Loading evidence…</div>}
    </div>
  );
}

export default function ZoomView({ s, g, me, role }) {
  useStepSound(g, { zoom: 'whoosh', reveal: 'reveal' });
  const r = g.r;
  if (!r) return null;
  const target = s.players[r.target];
  const src = faceSrc(target);
  const head = <RoundHeader left={`Exhibit ${g.round} of ${g.rounds}`} right="Zoom & Enhance" />;
  if (g.phase === 'zoom') return <Guess s={s} g={g} r={r} me={me} role={role} src={src} head={head} />;
  return <Reveal s={s} g={g} r={r} me={me} src={src} head={head} />;
}

function Guess({ s, g, r, me, role, src, head }) {
  const t = useNow(200);
  const mine = r.guesses[me];
  const isTarget = me === r.target;
  const candidates = g.pids.filter((p) => p !== me && s.players[p] && s.players[p].face);
  const left = Math.max(0, Math.ceil((g.until - t) / 1000));
  const guess = (p) => {
    if (mine || isTarget || role !== 'player') return;
    sfx('pop');
    vibrate(25);
    gsend({ t: 'guess', p, el: (store.link ? store.link.now() : Date.now()) - g.t0 });
  };
  return (
    <div class="screen">
      {head}
      <EvidenceScreen src={src} r={r} t0={g.t0} />
      <div class="row spread">
        <span class="eyebrow">{isTarget ? "That's your face. Act natural." : mine ? 'Locked in' : 'Whose face is this?'}</span>
        <span class="ze-clock tabular">{left}s</span>
      </div>
      {isTarget || role !== 'player' ? (
        <div class="label tight center-text">{isTarget ? 'Watch your friends try to recognize you.' : 'Players are guessing…'}</div>
      ) : (
        <div class="ze-picks">
          {candidates.map((p) => (
            <button key={p} class={'ze-pick' + (mine && mine.p === p ? ' on' : '')} disabled={!!mine} onClick={() => guess(p)}>
              <PlayerAvatar p={s.players[p]} size={34} noFace />
              <span class="nm">{s.players[p].name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Reveal({ s, g, r, me, src, head }) {
  const mine = r.guesses[me];
  const once = useRef(false);
  useEffect(() => {
    if (once.current) return;
    once.current = true;
    if (mine) sfx(mine.ok ? 'correct' : 'wrong');
  }, []);
  const rows = Object.entries(r.guesses).sort((a, b) => (b[1].ok - a[1].ok) || a[1].el - b[1].el);
  return (
    <div class="screen">
      {head}
      <EvidenceScreen src={src} r={r} t0={g.t0} full />
      <div class="ze-id pop-in">
        <span class="eyebrow" style={{ color: 'inherit' }}>
          Identified
        </span>
        <PlayerChip p={s.players[r.target]} size={30} />
      </div>
      <div class="col" style={{ gap: 6 }}>
        {rows.map(([pid, x]) => (
          <div class={'score-row' + (x.ok ? '' : ' ze-miss')} key={pid}>
            <PlayerAvatar p={s.players[pid]} size={28} />
            <span class="nm">{s.players[pid] ? s.players[pid].name : '?'}</span>
            <span class="small">{x.ok ? `${(x.el / 1000).toFixed(1)}s` : `said ${s.players[x.p] ? s.players[x.p].name : '?'}`}</span>
            <span class="sc">{x.ok ? `+${fmtScore(x.pts || 0)}` : '0'}</span>
          </div>
        ))}
        {rows.length === 0 && <div class="label tight center-text">Nobody guessed!</div>}
      </div>
    </div>
  );
}
