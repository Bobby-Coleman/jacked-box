// Small building blocks shared by several game screens.
import { useEffect, useRef, useState } from 'preact/hooks';
import { PlayerAvatar } from '../ui/Avatar.jsx';
import { WaitList, fmtScore } from '../ui/common.jsx';
import { sfx } from '../audio/sfx.js';

export function RoundHeader({ left, right }) {
  return (
    <div class="row spread round-head">
      <span class="eyebrow">{left}</span>
      {right && <span class="eyebrow">{right}</span>}
    </div>
  );
}

export function Scoreboard({ s, g, prev, title = 'Scores' }) {
  const ids = Object.keys(g.scores).filter((p) => s.players[p]);
  ids.sort((a, b) => g.scores[b] - g.scores[a]);
  return (
    <div class="col">
      <span class="eyebrow">{title}</span>
      <div class="scoreboard">
        {ids.map((pid, i) => {
          const d = prev ? g.scores[pid] - (prev[pid] || 0) : 0;
          return (
            <div class="score-row slide-in" key={pid} style={{ animationDelay: `${i * 0.06}s` }}>
              <span class="tabular" style={{ width: 22, fontWeight: 800 }}>
                {i + 1}
              </span>
              <PlayerAvatar p={s.players[pid]} size={34} />
              <span class="nm">{s.players[pid].name}</span>
              {d > 0 && <span class="delta">+{fmtScore(d)}</span>}
              <span class="sc">{fmtScore(g.scores[pid])}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function SentCard({ s, pids, done, title = 'Sent!', sub = 'Waiting for everyone else…' }) {
  return (
    <div class="label done-card pop-in" style={{ color: 'var(--ink)' }}>
      <span class="stencil">{title}</span>
      <span class="small">{sub}</span>
      <WaitList s={s} pids={pids} done={done} size={40} />
    </div>
  );
}

export function Spectate({ text = 'Watching this round. You can play in the next game.' }) {
  return (
    <div class="label tight center-text small" style={{ color: 'var(--ink)' }}>
      {text}
    </div>
  );
}

// Count-up number for point reveals.
export function CountUp({ to, ms = 900 }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    let raf;
    const t0 = performance.now();
    const step = (t) => {
      const k = Math.min(1, (t - t0) / ms);
      setV(Math.round(to * (1 - Math.pow(1 - k, 3))));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [to]);
  return <span class="tabular">{fmtScore(v)}</span>;
}

// Play a sound once when a phase/step starts on this phone.
export function useStepSound(g, map) {
  const last = useRef(null);
  useEffect(() => {
    const key = g.step;
    if (last.current === key) return;
    last.current = key;
    const name = map[g.phase];
    if (name) sfx(name);
  }, [g.step]);
}

export function Voters({ s, ids, size = 26 }) {
  return (
    <div class="voters">
      {ids.map((pid) => (s.players[pid] ? <PlayerAvatar key={pid} p={s.players[pid]} size={size} /> : null))}
    </div>
  );
}
