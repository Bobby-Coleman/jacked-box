import { useEffect, useRef, useState } from 'preact/hooks';
import { Timer, AnswerBox, gsend, useFinalTicks, PlayerChip } from '../../ui/common.jsx';
import { PlayerAvatar } from '../../ui/Avatar.jsx';
import { RoundHeader, SentCard, Spectate, useStepSound } from '../shared.jsx';
import { sfx } from '../../audio/sfx.js';
import { WIN_COWS } from './logic.js';
import './herd.css';

export function Cow({ size = 22, odd = false }) {
  const body = odd ? '#ff7ac6' : '#fff';
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden="true" style={{ flex: 'none' }}>
      <g stroke="#1d1611" stroke-width="3" stroke-linejoin="round">
        <path d="M8 15l7 4M40 15l-7 4" stroke-linecap="round" />
        <path d="M13 16h22c2 6 2 14-2 20H15c-4-6-4-14-2-20z" fill={body} />
        {!odd && <path d="M15 16h9v8c-4 2-8 0-10-3z" fill="#1d1611" stroke="none" />}
        {odd && <path d="M27 18c3 1 5 3 5 6" fill="none" stroke-linecap="round" />}
        <ellipse cx="24" cy="34" rx="9" ry="6" fill={odd ? '#ffc3e4' : '#ffb3c7'} />
        <circle cx="21" cy="34" r="1.3" fill="#1d1611" stroke="none" />
        <circle cx="27" cy="34" r="1.3" fill="#1d1611" stroke="none" />
      </g>
    </svg>
  );
}

export default function HerdView({ s, g, me, role }) {
  useStepSound(g, { answer: 'pop', judge: 'whoosh' });
  useFinalTicks(g, g.phase === 'answer');
  const head = <RoundHeader left={`Round ${g.round}`} right={`First to ${WIN_COWS} cows`} />;
  return (
    <div class="screen">
      {head}
      <div class="hd-q pop-in" key={g.round}>
        {g.q.t}
      </div>
      {g.phase === 'answer' && <AnswerPhase s={s} g={g} me={me} role={role} />}
      {g.phase === 'judge' && <JudgePhase s={s} g={g} me={me} />}
      {g.phase === 'score' && <ScorePhase s={s} g={g} me={me} />}
      <Standings s={s} g={g} me={me} />
    </div>
  );
}

function AnswerPhase({ s, g, me, role }) {
  const done = g.ans[me] !== undefined;
  const [picked, setPicked] = useState(null);
  if (role !== 'player') return <Spectate text="The herd is thinking…" />;
  if (done) return <SentCard s={s} pids={g.pids} done={(p) => g.ans[p] !== undefined} title="Moo." sub="Waiting for the rest of the herd…" />;
  return (
    <>
      <Timer g={g} />
      {g.q.o ? (
        <div class="hd-opts">
          {g.q.o.map((o, i) => (
            <button
              key={i}
              class={'hd-opt' + (picked === i ? ' on' : '')}
              onClick={() => {
                setPicked(i);
                sfx('pop');
                gsend({ t: 'ans', i });
              }}
            >
              {o}
            </button>
          ))}
        </div>
      ) : (
        <AnswerBox g={g} id={'hd' + g.round} max={40} placeholder="What would most people say?" onSubmit={(text) => gsend({ t: 'ans', text })} cta="Moo it in" />
      )}
    </>
  );
}

function GroupCard({ s, gr, sel, onTap, herd, mine }) {
  const Tag = onTap ? 'button' : 'div';
  return (
    <Tag class={'hd-group' + (sel ? ' sel' : '') + (herd ? ' herd' : '') + (mine ? ' mine' : '')} onClick={onTap}>
      <div class="row spread" style={{ gap: 8 }}>
        <span class="hd-gtext">{gr.text}</span>
        <span class="hd-count">{gr.pids.length}</span>
      </div>
      {gr.alts && gr.alts.length > 0 && <span class="small muted">also: {gr.alts.join(', ')}</span>}
      <div class="row wrap" style={{ gap: 4 }}>
        {gr.pids.map((p) => (s.players[p] ? <PlayerAvatar key={p} p={s.players[p]} size={28} /> : null))}
      </div>
      {herd && <span class="hd-herd-tag">THE HERD</span>}
    </Tag>
  );
}

function JudgePhase({ s, g, me }) {
  const isVip = s.vip === me;
  const [sel, setSel] = useState(null);
  const tap = (key) => {
    if (!isVip) return;
    if (!sel) {
      setSel(key);
      sfx('tap');
    } else if (sel === key) setSel(null);
    else {
      sfx('pop');
      gsend({ t: 'merge', a: sel, b: key });
      setSel(null);
    }
  };
  const vip = s.players[s.vip];
  return (
    <>
      <Timer g={g} />
      <div class="label tight small">
        {isVip ? (
          <span>
            <strong>You're the judge.</strong> Tap two answers that mean the same thing to merge them. Everyone can shout at you.
          </span>
        ) : (
          <span>
            <strong>{vip ? vip.name : 'The VIP'}</strong> is merging answers that mean the same thing. Make your case out loud!
          </span>
        )}
      </div>
      <div class="col">
        {g.groups.map((gr) => (
          <GroupCard key={gr.key} s={s} gr={gr} sel={sel === gr.key} onTap={isVip ? () => tap(gr.key) : null} mine={gr.pids.includes(me)} />
        ))}
      </div>
      {isVip && (
        <button
          class="btn primary"
          onClick={() => {
            sfx('submit');
            gsend({ t: 'judged' });
          }}
        >
          Looks right, score it
        </button>
      )}
    </>
  );
}

function ScorePhase({ s, g, me }) {
  const r = g.res;
  const played = useRef(false);
  useEffect(() => {
    if (played.current || !r) return;
    played.current = true;
    if (r.herd) sfx('moo');
    else sfx('slideDown');
  }, []);
  if (!r) return null;
  const herd = g.groups.find((gr) => gr.key === r.herd);
  const inHerd = herd && herd.pids.includes(me);
  return (
    <>
      <div class={'hd-verdict pop-in ' + (r.herd ? 'yes' : 'no')}>
        {r.herd ? (inHerd ? 'You moved with the herd! +1 cow' : 'The herd went another way.') : r.tie ? 'A tie! No cows this round.' : 'No herd this time.'}
      </div>
      {r.odd && (
        <div class="hd-odd pop-in">
          <Cow size={40} odd />
          <span>
            <strong>{s.players[r.odd] ? s.players[r.odd].name : 'Someone'}</strong> {r.odd === r.prevOdd ? 'keeps' : 'gets'} the Odd Cow!
          </span>
        </div>
      )}
      <div class="col">
        {g.groups.map((gr) => (
          <GroupCard key={gr.key} s={s} gr={gr} herd={gr.key === r.herd} mine={gr.pids.includes(me)} />
        ))}
      </div>
    </>
  );
}

function Standings({ s, g, me }) {
  const ids = g.pids.filter((p) => s.players[p]).sort((a, b) => (g.cows[b] || 0) - (g.cows[a] || 0));
  return (
    <div class="hd-standings">
      {ids.map((pid) => (
        <div class={'hd-stand' + (pid === me ? ' me' : '')} key={pid}>
          <PlayerChip p={s.players[pid]} size={24} />
          <span class="hd-cows">
            {Array.from({ length: g.cows[pid] || 0 }).map((_, i) => (
              <Cow key={i} size={18} />
            ))}
            {g.odd === pid && <Cow size={22} odd />}
          </span>
        </div>
      ))}
    </div>
  );
}
