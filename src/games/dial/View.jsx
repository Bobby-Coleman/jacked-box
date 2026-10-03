import { useEffect, useRef, useState } from 'preact/hooks';
import { Timer, AnswerBox, gsend, useFinalTicks, useNow, fmtScore, WaitList } from '../../ui/common.jsx';
import { PlayerAvatar } from '../../ui/Avatar.jsx';
import { RoundHeader, useStepSound } from '../shared.jsx';
import { sfx } from '../../audio/sfx.js';
import { vibrate } from '../../platform.js';
import { points } from './logic.js';
import './dial.css';

const CX = 110;
const CY = 112;
const R = 96;

function pt(v, r = R) {
  const a = Math.PI * (1 - v / 100);
  return [CX + r * Math.cos(a), CY - r * Math.sin(a)];
}

function wedge(v0, v1, r = R) {
  const a = Math.max(0, v0);
  const b = Math.min(100, v1);
  if (b <= a) return '';
  const [x0, y0] = pt(a, r);
  const [x1, y1] = pt(b, r);
  return `M${CX} ${CY} L${x0} ${y0} A${r} ${r} 0 0 1 ${x1} ${y1} Z`;
}

function DialFace({ target, showTarget, needles = [], mine, onSet, left, right }) {
  const ref = useRef(null);
  const dragging = useRef(false);
  const toVal = (e) => {
    const svg = ref.current;
    const r = svg.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * 220;
    const y = ((e.clientY - r.top) / r.height) * 130;
    let ang = Math.atan2(CY - y, x - CX);
    if (ang < 0) ang = x < CX ? Math.PI : 0;
    return Math.max(0, Math.min(100, Math.round((1 - ang / Math.PI) * 100)));
  };
  const down = (e) => {
    if (!onSet) return;
    dragging.current = true;
    ref.current.setPointerCapture(e.pointerId);
    onSet(toVal(e));
  };
  const move = (e) => {
    if (dragging.current && onSet) onSet(toVal(e));
  };
  const up = () => {
    dragging.current = false;
  };
  return (
    <div class="dl-face">
      <svg
        ref={ref}
        viewBox="0 0 220 130"
        class={onSet ? 'interactive' : ''}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        role={onSet ? 'slider' : 'img'}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={mine}
        aria-label={`Dial from ${left} to ${right}`}
      >
        <path d={wedge(0, 100, R + 6)} fill="#0d1a33" />
        <path d={wedge(0, 100)} fill="#ffe9c9" stroke="#1d1611" stroke-width="3" />
        {showTarget && (
          <g class="dl-target">
            <path d={wedge(target - 13, target + 13)} fill="#ffc46b" />
            <path d={wedge(target - 8, target + 8)} fill="#ff8a1f" />
            <path d={wedge(target - 3, target + 3)} fill="#ff4b2b" />
            <text x={pt(target, R - 12)[0]} y={pt(target, R - 12)[1]} class="dl-num">
              4
            </text>
          </g>
        )}
        {[0, 25, 50, 75, 100].map((v) => {
          const [x0, y0] = pt(v, R - 4);
          const [x1, y1] = pt(v, R + 4);
          return <line key={v} x1={x0} y1={y0} x2={x1} y2={y1} stroke="#1d1611" stroke-width="2" />;
        })}
        {needles.map((n) => {
          const [x, y] = pt(n.v, R - 6);
          return (
            <g key={n.id}>
              <line x1={CX} y1={CY} x2={x} y2={y} stroke={n.color} stroke-width={n.me ? 5 : 3.5} stroke-linecap="round" />
              <circle cx={x} cy={y} r={n.me ? 7 : 5.5} fill={n.color} stroke="#1d1611" stroke-width="2" />
            </g>
          );
        })}
        {typeof mine === 'number' && (
          <g>
            <line x1={CX} y1={CY} x2={pt(mine, R - 4)[0]} y2={pt(mine, R - 4)[1]} stroke="#1d1611" stroke-width="7" stroke-linecap="round" />
            <line x1={CX} y1={CY} x2={pt(mine, R - 4)[0]} y2={pt(mine, R - 4)[1]} stroke="#ff4b2b" stroke-width="3.5" stroke-linecap="round" />
          </g>
        )}
        <circle cx={CX} cy={CY} r="11" fill="#1d1611" />
        <circle cx={CX} cy={CY} r="5" fill="#ff8a1f" />
      </svg>
      <div class="dl-ends">
        <span class="dl-end l">{left}</span>
        <span class="dl-end r">{right}</span>
      </div>
    </div>
  );
}

export default function DialView({ s, g, me, role }) {
  useStepSound(g, { clue: 'pop', guess: 'whoosh', reveal: 'drumroll' });
  useFinalTicks(g, g.phase === 'guess');
  const r = g.r;
  if (!r) return null;
  const psychic = s.players[r.psychic];
  const amPsychic = me === r.psychic;
  const head = <RoundHeader left={`Round ${g.round} of ${g.rounds}`} right="Mind Dial" />;
  return (
    <div class="screen">
      {head}
      <div class="dl-psychic">
        <PlayerAvatar p={psychic} size={40} />
        <span>
          <span class="eyebrow" style={{ display: 'block' }}>
            Psychic
          </span>
          <strong class="game-font">{amPsychic ? 'You' : psychic ? psychic.name : '…'}</strong>
        </span>
        {r.clue && g.phase !== 'clue' && <span class="dl-clue pop-in">“{r.clue}”</span>}
      </div>
      {g.phase === 'clue' && <CluePhase s={s} g={g} r={r} me={me} amPsychic={amPsychic} role={role} />}
      {g.phase === 'guess' && <GuessPhase s={s} g={g} r={r} me={me} amPsychic={amPsychic} role={role} />}
      {g.phase === 'reveal' && <RevealPhase s={s} g={g} r={r} me={me} />}
    </div>
  );
}

function CluePhase({ s, g, r, me, amPsychic }) {
  if (!amPsychic) {
    return (
      <>
        <DialFace left={r.card[0]} right={r.card[1]} showTarget={false} />
        <div class="label tight center-text">The psychic is looking at the target and thinking of a clue…</div>
        <Timer g={g} />
      </>
    );
  }
  return (
    <>
      <DialFace left={r.card[0]} right={r.card[1]} target={r.target} showTarget />
      <Timer g={g} />
      <span class="eyebrow">Give a clue that lands on the red zone</span>
      <AnswerBox g={g} id={'dl' + g.round + r.card.join()} max={40} placeholder="Something that fits that spot…" onSubmit={(text) => gsend({ t: 'clue', text })} cta="Send clue" />
      {r.redraws > 0 && (
        <button
          class="btn ghost sm"
          style={{ alignSelf: 'center' }}
          onClick={() => {
            sfx('swoop');
            gsend({ t: 'redraw' });
          }}
        >
          Too hard? Draw a new card (once)
        </button>
      )}
    </>
  );
}

function GuessPhase({ s, g, r, me, amPsychic, role }) {
  const [v, setV] = useState(50);
  const locked = !!r.locked[me];
  const sent = useRef(false);
  const t = useNow(250);
  const lock = () => {
    if (sent.current) return;
    sent.current = true;
    sfx('submit');
    vibrate(30);
    gsend({ t: 'guess', v, lock: true });
  };
  useEffect(() => {
    sent.current = locked;
  }, [g.step]);
  useEffect(() => {
    if (!amPsychic && role === 'player' && !sent.current && g.until && g.until - t < 900) lock();
  });
  const guessers = g.pids.filter((p) => p !== r.psychic);
  if (amPsychic || role !== 'player') {
    return (
      <>
        <DialFace left={r.card[0]} right={r.card[1]} target={r.target} showTarget={amPsychic} />
        <Timer g={g} />
        <div class="label tight center-text">{amPsychic ? 'Keep a straight face while they guess!' : 'Players are turning their dials…'}</div>
        <WaitList s={s} pids={guessers} done={(p) => r.locked[p]} size={36} />
      </>
    );
  }
  return (
    <>
      <DialFace
        left={r.card[0]}
        right={r.card[1]}
        mine={locked ? r.guesses[me] : v}
        onSet={
          locked
            ? null
            : (x) => {
                if (x !== v) sfx('tick');
                setV(x);
              }
        }
      />
      <Timer g={g} />
      {locked ? (
        <WaitList s={s} pids={guessers} done={(p) => r.locked[p]} size={36} />
      ) : (
        <>
          <input id="dial-range" class="dl-range" type="range" min="0" max="100" value={v} onInput={(e) => setV(Number(e.currentTarget.value))} aria-label="Fine tune your guess" />
          <button class="btn primary" onClick={lock}>
            Lock it in
          </button>
        </>
      )}
    </>
  );
}

function RevealPhase({ s, g, r, me }) {
  const needles = Object.entries(r.guesses).map(([pid, v]) => ({ id: pid, v, color: s.players[pid] ? s.players[pid].color : '#888', me: pid === me }));
  const ranked = Object.entries(r.guesses)
    .map(([pid, v]) => ({ pid, v, p: points(v - r.target) }))
    .sort((a, b) => b.p - a.p || Math.abs(a.v - r.target) - Math.abs(b.v - r.target));
  return (
    <>
      <DialFace left={r.card[0]} right={r.card[1]} target={r.target} showTarget needles={needles} />
      <div class="col" style={{ gap: 6 }}>
        {ranked.map((x, i) => (
          <div class="score-row slide-in" key={x.pid} style={{ animationDelay: `${0.3 + i * 0.1}s` }}>
            <PlayerAvatar p={s.players[x.pid]} size={30} />
            <span class="nm">{s.players[x.pid] ? s.players[x.pid].name : '?'}</span>
            {x.p === 4 && <span class="badge red">Bullseye</span>}
            <span class="sc">+{fmtScore(x.p * 100)}</span>
          </div>
        ))}
        <div class="score-row">
          <PlayerAvatar p={s.players[r.psychic]} size={30} />
          <span class="nm">{s.players[r.psychic] ? s.players[r.psychic].name : '?'} (psychic)</span>
          <span class="sc">+{fmtScore(r.pts[r.psychic] || 0)}</span>
        </div>
      </div>
      <Timer g={g} label={g.round >= g.rounds ? 'Final scores in' : 'Next psychic in'} />
    </>
  );
}
