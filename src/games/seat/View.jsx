import { useEffect, useRef } from 'preact/hooks';
import { Timer, gsend, useFinalTicks, fmtScore } from '../../ui/common.jsx';
import { PlayerAvatar } from '../../ui/Avatar.jsx';
import { RoundHeader, Voters, useStepSound } from '../shared.jsx';
import { sfx } from '../../audio/sfx.js';
import { vibrate } from '../../platform.js';
import './seat.css';

export default function SeatView({ s, g, me, role }) {
  useStepSound(g, { vote: 'pop', reveal: 'drumroll' });
  useFinalTicks(g, g.phase === 'vote');
  const r = g.r;
  if (!r) return null;
  return (
    <div class="screen">
      <RoundHeader left={`Round ${g.round} of ${g.rounds}`} right="Hot Seat" />
      <div class="hs-q pop-in" key={g.round}>
        <span class="hs-lead">Who's most likely to</span>
        <strong class="game-font">{r.prompt}?</strong>
      </div>
      {g.phase === 'vote' ? <Vote s={s} g={g} r={r} me={me} role={role} /> : <Reveal s={s} g={g} r={r} me={me} />}
    </div>
  );
}

function Vote({ s, g, r, me, role }) {
  const mine = r.votes[me];
  const canVote = role === 'player';
  return (
    <>
      <Timer g={g} />
      <div class="hs-grid">
        {g.pids
          .filter((p) => s.players[p])
          .map((pid) => (
            <button
              key={pid}
              class={'hs-pick' + (mine === pid ? ' on' : '')}
              disabled={!canVote}
              onClick={() => {
                sfx('pop');
                vibrate(20);
                gsend({ t: 'vote', p: pid });
              }}
            >
              <PlayerAvatar p={s.players[pid]} size={52} />
              <span class="nm">{pid === me ? 'Me!' : s.players[pid].name}</span>
            </button>
          ))}
      </div>
      <p class="center-text small" style={{ margin: 0, fontWeight: 700 }}>
        {Object.keys(r.votes).length} of {g.pids.length} voted{mine ? '. Tap someone else to change.' : ''}
      </p>
    </>
  );
}

function Reveal({ s, g, r, me }) {
  const tally = r.tally || {};
  const ranked = Object.keys(tally).sort((a, b) => tally[b] - tally[a]);
  const iWon = r.top.includes(me);
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    done.current = true;
    if (iWon) {
      sfx('fanfare');
      vibrate([100, 60, 100, 60, 200]);
    } else sfx('applause');
  }, []);
  const top = r.top.map((p) => s.players[p]).filter(Boolean);
  return (
    <>
      <div class={'hs-verdict pop-in' + (iWon ? ' me' : '')}>
        <span class="eyebrow" style={{ color: 'inherit' }}>
          The room has spoken
        </span>
        <div class="row wrap" style={{ justifyContent: 'center', gap: 10 }}>
          {top.map((p) => (
            <span class="col" style={{ alignItems: 'center', gap: 4 }} key={p.id}>
              <PlayerAvatar p={p} size={72} />
              <strong class="stencil hs-name">{p.id === me ? 'You!' : p.name}</strong>
            </span>
          ))}
          {top.length === 0 && <strong>Nobody voted!</strong>}
        </div>
      </div>
      <div class="col" style={{ gap: 6 }}>
        {ranked.map((pid) => {
          const voters = Object.entries(r.votes)
            .filter(([, t]) => t === pid)
            .map(([v]) => v);
          return (
            <div class="score-row" key={pid}>
              <PlayerAvatar p={s.players[pid]} size={30} />
              <span class="nm">{s.players[pid] ? s.players[pid].name : '?'}</span>
              <Voters s={s} ids={voters} size={22} />
              <span class="sc">{tally[pid]}</span>
            </div>
          );
        })}
      </div>
      {r.pts[me] > 0 && <div class="pts-banner pop-in">You agreed with the room: +{fmtScore(r.pts[me])}</div>}
      <Timer g={g} label={g.round >= g.rounds ? 'Final scores in' : 'Next question in'} />
    </>
  );
}
