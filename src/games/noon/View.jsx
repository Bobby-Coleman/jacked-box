import { useEffect, useRef, useState } from 'preact/hooks';
import { Timer, gsend, fmtScore } from '../../ui/common.jsx';
import { PlayerAvatar } from '../../ui/Avatar.jsx';
import { RoundHeader } from '../shared.jsx';
import { sfx } from '../../audio/sfx.js';
import { vibrate } from '../../platform.js';
import './noon.css';

export default function NoonView({ s, g, me, role, link }) {
  const r = g.r;
  if (!r) return null;
  if (g.phase === 'standoff') return <Standoff key={g.step} g={g} r={r} me={me} role={role} link={link} />;
  return <Result s={s} g={g} r={r} me={me} />;
}

function Standoff({ g, r, me, role, link }) {
  const [shown, setShown] = useState(null); // null | {kind, word}
  const [mine, setMine] = useState(null); // {rt, early, fake}
  const drawShownAt = useRef(0);
  const shownRef = useRef(null);
  const done = useRef(false);

  useEffect(() => {
    const timers = [];
    for (const ev of r.events) {
      // Convert the host's timestamp into this phone's clock.
      const delay = ev.at - link.now();
      timers.push(
        setTimeout(() => {
          shownRef.current = ev;
          setShown(ev);
          if (ev.kind === 'draw') {
            requestAnimationFrame(() => {
              drawShownAt.current = performance.now();
            });
          }
        }, Math.max(0, delay)),
      );
    }
    sfx('heartbeat');
    return () => timers.forEach(clearTimeout);
  }, []);

  const tap = (e) => {
    e.preventDefault();
    if (done.current || role !== 'player') return;
    done.current = true;
    const ev = shownRef.current;
    let res;
    if (!ev || ev.kind !== 'draw' || !drawShownAt.current) {
      res = { rt: 0, early: !ev || ev.kind !== 'fake', fake: !!ev && ev.kind === 'fake' };
      sfx('buzz');
      vibrate(200);
    } else {
      res = { rt: Math.round(performance.now() - drawShownAt.current), early: false, fake: false };
      sfx('bang');
      vibrate(40);
    }
    setMine(res);
    gsend({ t: 'tap', ...res });
  };

  const isDraw = shown && shown.kind === 'draw';
  const isFake = shown && shown.kind === 'fake';
  return (
    <button class={'nn-stage' + (isDraw ? ' draw' : isFake ? ' fake' : '')} onPointerDown={tap} aria-label="Tap when it says DRAW">
      <span class="nn-round eyebrow">
        Round {g.round} of 5
      </span>
      {mine ? (
        mine.early || mine.fake ? (
          <span class="nn-big stencil shake">{mine.fake ? 'Fooled!' : 'Too early!'}</span>
        ) : (
          <span class="nn-time">
            <span class="stencil nn-big">{(mine.rt / 1000).toFixed(3)}s</span>
            <span>Nice shot. Waiting for the others…</span>
          </span>
        )
      ) : isDraw ? (
        <span class="nn-draw stencil">DRAW!</span>
      ) : isFake ? (
        <span class="nn-draw stencil fake">{shown.word}</span>
      ) : (
        <span class="nn-wait">
          <span class="stencil nn-big">Hands off</span>
          <span>Phone flat on the table. Tap only when it says DRAW.</span>
        </span>
      )}
    </button>
  );
}

function Result({ s, g, r, me }) {
  const played = useRef(false);
  useEffect(() => {
    if (!played.current) {
      played.current = true;
      sfx('ding');
    }
  }, []);
  const losers = Object.entries(r.taps).filter(([, t]) => t.early || t.fake || t.rt < 90);
  const missed = g.pids.filter((p) => !r.taps[p] && s.players[p]);
  return (
    <div class="screen">
      <RoundHeader left={`Round ${g.round} of 5`} right="Results" />
      <div class="col" style={{ gap: 8 }}>
        {r.ranking.map((x, i) => (
          <div class={'nn-row slide-in' + (i === 0 ? ' first' : '')} key={x.pid} style={{ animationDelay: `${i * 0.12}s` }}>
            <span class="nn-place stencil">{i + 1}</span>
            <PlayerAvatar p={s.players[x.pid]} size={36} />
            <span class="nm">{s.players[x.pid] ? s.players[x.pid].name : '?'}</span>
            <span class="nn-rt tabular">{(x.rt / 1000).toFixed(3)}s</span>
            <span class="nn-pts">+{fmtScore(r.pts[x.pid] || 0)}</span>
          </div>
        ))}
        {losers.map(([pid, t]) => (
          <div class="nn-row bad" key={pid}>
            <span class="nn-place stencil">✗</span>
            <PlayerAvatar p={s.players[pid]} size={36} />
            <span class="nm">{s.players[pid] ? s.players[pid].name : '?'}</span>
            <span class="nn-rt">{t.fake ? 'Fell for the fake' : 'Jumped the gun'}</span>
            <span class="nn-pts">−250</span>
          </div>
        ))}
        {missed.map((pid) => (
          <div class="nn-row" key={pid}>
            <span class="nn-place stencil">–</span>
            <PlayerAvatar p={s.players[pid]} size={36} />
            <span class="nm">{s.players[pid].name}</span>
            <span class="nn-rt">Asleep at the saloon</span>
          </div>
        ))}
      </div>
      <div class="grow" />
      <Timer g={g} label={g.round >= 5 ? 'Final scores in' : 'Next standoff in'} />
    </div>
  );
}
