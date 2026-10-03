import { useEffect, useRef, useState } from 'preact/hooks';
import { Timer, gsend, useFinalTicks, fmtScore, WaitList } from '../../ui/common.jsx';
import { PlayerAvatar } from '../../ui/Avatar.jsx';
import { faceSrc, loadImage } from '../../ui/faces.jsx';
import { RoundHeader, useStepSound } from '../shared.jsx';
import { sfx } from '../../audio/sfx.js';
import { store } from '../../app/session.js';
import { PART_NAMES } from './logic.js';
import './frank.css';

// Stitch the donor faces into horizontal bands, with surgical stitches along each seam.
function paintMonster(canvas, imgs, cuts) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const S = canvas.width;
  ctx.fillStyle = '#20302a';
  ctx.fillRect(0, 0, S, S);
  const bands = [0, ...cuts, 1];
  imgs.forEach((img, i) => {
    if (!img) return;
    const y0 = bands[i] * S;
    const y1 = bands[i + 1] * S;
    const iw = img.naturalWidth || img.width;
    const ih = img.naturalHeight || img.height;
    ctx.drawImage(img, 0, (y0 / S) * ih, iw, ((y1 - y0) / S) * ih, 0, y0, S, y1 - y0);
  });
  // A sickly monster tint keeps it spooky.
  ctx.fillStyle = 'rgba(80, 160, 90, 0.16)';
  ctx.fillRect(0, 0, S, S);
  ctx.strokeStyle = '#1d1611';
  ctx.lineCap = 'round';
  for (const c of cuts) {
    const y = c * S;
    ctx.lineWidth = Math.max(2, S * 0.012);
    ctx.beginPath();
    for (let x = 0; x <= S; x += S / 24) ctx.lineTo(x, y + (Math.floor(x / (S / 24)) % 2 ? -1 : 1) * S * 0.006);
    ctx.stroke();
    ctx.lineWidth = Math.max(1.5, S * 0.008);
    for (let x = S * 0.06; x < S; x += S / 9) {
      ctx.beginPath();
      ctx.moveTo(x - S * 0.012, y - S * 0.025);
      ctx.lineTo(x + S * 0.012, y + S * 0.025);
      ctx.stroke();
    }
  }
}

function Monster({ srcs, cuts }) {
  const ref = useRef(null);
  const [imgs, setImgs] = useState([]);
  useEffect(() => {
    let alive = true;
    Promise.all(srcs.map((s) => loadImage(s))).then((list) => alive && setImgs(list));
    return () => (alive = false);
  }, [srcs.join('|').length, srcs.length, cuts.join(',')]);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const px = Math.round((c.clientWidth || 300) * Math.min(window.devicePixelRatio || 1, 2));
    c.width = px;
    c.height = px;
    paintMonster(c, imgs, cuts);
  }, [imgs, cuts.join(',')]);
  return (
    <div class="fk-slab">
      <canvas ref={ref} aria-label="A stitched-together face" />
      {imgs.length === 0 && <div class="drawing-loading">Stitching…</div>}
    </div>
  );
}

export default function FrankView({ s, g, me, role }) {
  useStepSound(g, { look: 'heartbeat', reveal: 'reveal' });
  useFinalTicks(g, g.phase === 'look');
  const r = g.r;
  if (!r) return null;
  const srcs = r.donors.map((p) => faceSrc(s.players[p]));
  const head = <RoundHeader left={`Experiment ${g.round} of ${g.rounds}`} right={`${r.donors.length} donors`} />;
  return (
    <div class="screen">
      {head}
      <Monster srcs={srcs} cuts={r.cuts} />
      {g.phase === 'look' ? <Pick s={s} g={g} r={r} me={me} role={role} /> : <Reveal s={s} g={g} r={r} me={me} />}
    </div>
  );
}

function Pick({ s, g, r, me, role }) {
  const names = PART_NAMES[r.donors.length];
  const [sel, setSel] = useState(() => r.donors.map(() => null));
  const mine = r.guesses[me];
  const candidates = g.pids.filter((p) => s.players[p] && s.players[p].face);
  if (role !== 'player') return <WaitList s={s} pids={g.pids} done={(p) => r.guesses[p]} size={34} />;
  if (mine) {
    return (
      <>
        <Timer g={g} />
        <div class="label tight center-text">Locked in. Waiting for the other mad scientists…</div>
        <WaitList s={s} pids={g.pids} done={(p) => r.guesses[p]} size={34} />
      </>
    );
  }
  const ready = sel.every(Boolean);
  return (
    <>
      <Timer g={g} />
      {names.map((nm, i) => (
        <div class="fk-part" key={nm}>
          <span class="eyebrow">{nm}</span>
          <div class="fk-row">
            {candidates.map((p) => (
              <button
                key={p}
                class={'fk-chip' + (sel[i] === p ? ' on' : '')}
                onClick={() => {
                  sfx('tap');
                  setSel((cur) => cur.map((x, k) => (k === i ? p : x)));
                }}
              >
                <PlayerAvatar p={s.players[p]} size={26} noFace />
                <span>{p === me ? 'Me' : s.players[p].name}</span>
              </button>
            ))}
          </div>
        </div>
      ))}
      <button
        class="btn primary"
        disabled={!ready}
        onClick={() => {
          sfx('submit');
          gsend({ t: 'guess', parts: sel, el: (store.link ? store.link.now() : Date.now()) - g.t0 });
        }}
      >
        It's alive! Lock it in
      </button>
    </>
  );
}

function Reveal({ s, g, r, me }) {
  const names = PART_NAMES[r.donors.length];
  const mine = r.guesses[me];
  const once = useRef(false);
  useEffect(() => {
    if (once.current) return;
    once.current = true;
    if (mine) sfx(mine.ok === r.donors.length ? 'fanfare' : mine.ok ? 'correct' : 'wrong');
  }, []);
  const rows = Object.entries(r.guesses).sort((a, b) => (b[1].pts || 0) - (a[1].pts || 0));
  return (
    <>
      <div class="fk-donors pop-in">
        {r.donors.map((p, i) => (
          <div class="fk-donor" key={p}>
            <span class="eyebrow" style={{ color: 'inherit' }}>
              {names[i]}
            </span>
            <PlayerAvatar p={s.players[p]} size={56} />
            <strong>{s.players[p] ? s.players[p].name : '?'}</strong>
          </div>
        ))}
      </div>
      <div class="col" style={{ gap: 6 }}>
        {rows.map(([pid, x]) => (
          <div class="score-row" key={pid}>
            <PlayerAvatar p={s.players[pid]} size={28} />
            <span class="nm">{s.players[pid] ? s.players[pid].name : '?'}</span>
            <span class="small">
              {x.ok}/{r.donors.length} right
            </span>
            <span class="sc">+{fmtScore(x.pts || 0)}</span>
          </div>
        ))}
      </div>
    </>
  );
}
