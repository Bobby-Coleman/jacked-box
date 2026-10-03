import { useEffect, useRef, useState } from 'preact/hooks';
import { Timer, AnswerBox, gsend, useFinalTicks, useNow, fmtScore, PlayerChip, Icon } from '../../ui/common.jsx';
import { PlayerAvatar } from '../../ui/Avatar.jsx';
import { RoundHeader, SentCard, Spectate, useStepSound, Voters } from '../shared.jsx';
import { sfx } from '../../audio/sfx.js';
import { REVEAL_STEP } from './logic.js';
import './fib.css';

const ROUND = { 1: 'Round 1', 2: 'Round 2 · double points', 3: 'Final fib · triple points' };

function Question({ q, s, filled }) {
  const parts = q.text.split(/_{2,}/);
  return (
    <div class="fb-q pop-in">
      {q.about && (
        <span class="fb-about">
          <PlayerAvatar p={s.players[q.about]} size={28} /> About {s.players[q.about] ? s.players[q.about].name : 'someone'}
        </span>
      )}
      <p>
        {parts.length > 1 ? (
          <>
            {parts[0]}
            <span class={'fb-blank' + (filled ? ' filled' : '')}>{filled || ' '}</span>
            {parts.slice(1).join('')}
          </>
        ) : (
          q.text
        )}
      </p>
    </div>
  );
}

export default function FibView({ s, g, me, role }) {
  const t = useNow(300);
  useStepSound(g, { lie: 'whoosh', pick: 'pop', reveal: 'drumroll' });
  useFinalTicks(g, g.phase === 'lie' || g.phase === 'pick');
  const q = g.q;
  if (!q) return null;
  const head = <RoundHeader left={ROUND[g.round] || ''} right={`Question ${g.qn + 1} of 5`} />;
  return (
    <div class="screen">
      {head}
      <Question q={q} s={s} filled={g.phase === 'reveal' && revealedTruth(g, t) ? q.truth : null} />
      {g.phase === 'lie' && <LiePhase s={s} g={g} q={q} me={me} role={role} />}
      {g.phase === 'pick' && <PickPhase s={s} g={g} q={q} me={me} role={role} />}
      {g.phase === 'reveal' && <RevealPhase s={s} g={g} q={q} me={me} />}
    </div>
  );
}

function revealedTruth(g, t) {
  const elapsed = t - g.t0;
  return elapsed > 1200 + (g.q.revealOrder.length - 1) * REVEAL_STEP;
}

function LiePhase({ s, g, q, me, role }) {
  const isSubject = q.about === me;
  const rejCount = q.rej[me] || 0;
  const [shake, setShake] = useState(false);
  const lastRej = useRef(rejCount);
  useEffect(() => {
    if (rejCount > lastRej.current) {
      sfx('ding');
      setShake(true);
      setTimeout(() => setShake(false), 500);
    }
    lastRej.current = rejCount;
  }, [rejCount]);
  const doneFn = (p) => (p === q.about ? !!q.truth : !!q.lies[p]);
  if (role !== 'player') return <SentCard s={s} pids={g.pids} done={doneFn} title="Lying in progress…" sub="" />;
  const submitted = isSubject ? !!q.truth : !!q.lies[me];
  if (submitted) return <SentCard s={s} pids={g.pids} done={doneFn} title={isSubject ? 'Truth locked in' : 'Lie locked in'} sub="Waiting for everyone else…" />;
  return (
    <>
      <Timer g={g} />
      {isSubject ? (
        <div class="label tight fb-subject">
          <strong>This one is about you.</strong> Tell the TRUTH. Everyone else is about to lie about you.
        </div>
      ) : (
        <span class="eyebrow">Write a believable lie</span>
      )}
      {rejCount > 0 && <div class={'label tight fb-warn' + (shake ? ' shake' : '')}>Whoa, that's actually the truth (or really close)! Write a lie instead.</div>}
      <AnswerBox g={g} id={'fb' + g.qn + '-' + rejCount} max={50} placeholder={isSubject ? 'The honest answer…' : 'Your lie…'} onSubmit={(text) => gsend({ t: 'lie', text })} cta={isSubject ? 'Submit the truth' : 'Submit lie'} />
    </>
  );
}

function PickPhase({ s, g, q, me, role }) {
  const myPick = q.picks[me];
  const canPick = role === 'player' && me !== q.about;
  return (
    <>
      <Timer g={g} />
      <span class="eyebrow center-text">{q.about === me ? 'Watch them try to guess the truth about you.' : 'Find the truth'}</span>
      <div class="fb-opts">
        {q.opts.map((o) => {
          const own = o.by.includes(me);
          const liked = (q.likes[o.id] || []).includes(me);
          return (
            <div class="sk-opt-row" key={o.id}>
              <button
                class={'fb-opt' + (myPick === o.id ? ' on' : '') + (own ? ' own' : '')}
                disabled={!canPick || own}
                onClick={() => {
                  sfx('pop');
                  gsend({ t: 'pick', o: o.id });
                }}
              >
                <span>{o.text}</span>
                {own && <span class="badge paper">Your lie</span>}
              </button>
              {!own && (
                <button
                  class={'like-btn' + (liked ? ' on' : '')}
                  aria-label="Like this lie"
                  onClick={() => {
                    sfx('tap');
                    gsend({ t: 'like', o: o.id });
                  }}
                >
                  <Icon name="heart" size={20} />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}

function RevealPhase({ s, g, q, me }) {
  const t = useNow(200);
  const elapsed = t - g.t0;
  const shown = Math.min(q.revealOrder.length, Math.max(0, Math.floor((elapsed - 1200) / REVEAL_STEP) + 1));
  const last = useRef(0);
  useEffect(() => {
    if (shown > last.current) {
      const id = q.revealOrder[shown - 1];
      sfx(id === 'T' ? 'ding' : 'buzz');
      last.current = shown;
    }
  }, [shown]);
  const pickersOf = (oid) => Object.entries(q.picks).filter(([, v]) => v === oid).map(([p]) => p);
  return (
    <div class="col">
      {q.revealOrder.slice(0, shown).map((oid) => {
        const o = q.opts.find((x) => x.id === oid);
        if (!o) return null;
        const truth = o.id === 'T';
        const pickers = pickersOf(o.id);
        return (
          <div class={'fb-rev pop-in' + (truth ? ' truth' : '')} key={oid}>
            <div class="fb-rev-text">{o.text}</div>
            <div class="row spread" style={{ gap: 6, flexWrap: 'wrap' }}>
              {truth ? (
                <span class="fb-stamp truth">The truth</span>
              ) : o.house ? (
                <span class="fb-stamp house">House lie</span>
              ) : (
                <span class="small">
                  Lie by{' '}
                  {o.by.map((p) => (
                    <PlayerChip key={p} p={s.players[p]} size={20} />
                  ))}
                </span>
              )}
              <div class="row" style={{ gap: 4 }}>
                {pickers.length > 0 && <span class="small">{truth ? 'Found by' : 'Fooled'}</span>}
                <Voters s={s} ids={pickers} size={22} />
              </div>
            </div>
          </div>
        );
      })}
      {shown >= q.revealOrder.length && (
        <>
          {q.nobody && <div class="label tight center-text pop-in">Nobody found the truth!</div>}
          {q.pts[me] > 0 && <div class="pts-banner pop-in">You scored +{fmtScore(q.pts[me])}</div>}
        </>
      )}
    </div>
  );
}
