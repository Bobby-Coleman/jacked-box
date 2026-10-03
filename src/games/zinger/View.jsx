import { useState } from 'preact/hooks';
import { Timer, AnswerBox, gsend, useFinalTicks, fmtScore, PlayerChip } from '../../ui/common.jsx';
import { PlayerAvatar } from '../../ui/Avatar.jsx';
import { RoundHeader, Scoreboard, SentCard, Spectate, useStepSound, Voters, CountUp } from '../shared.jsx';
import { SAFETY } from '../../content/zinger.js';
import { sfx } from '../../audio/sfx.js';
import { vibrate } from '../../platform.js';
import './zinger.css';

const ROUND_NAME = { 1: 'Round 1', 2: 'Round 2 · double points', 3: 'Final round' };

export default function ZingerView({ s, g, me, role }) {
  useStepSound(g, { show: 'bell', result: 'drumroll', scores: 'whoosh', fwrite: 'bell', fresult: 'drumroll' });
  useFinalTicks(g, ['write', 'vote', 'fwrite', 'fvote'].includes(g.phase));
  const head = <RoundHeader left={ROUND_NAME[g.round] || ''} right={g.phase === 'show' || g.phase === 'vote' || g.phase === 'result' ? `Bout ${g.mi + 1} of ${g.matches.length}` : null} />;
  switch (g.phase) {
    case 'write':
      return <Write s={s} g={g} me={me} role={role} head={head} />;
    case 'show':
    case 'vote':
    case 'result':
      return <Bout s={s} g={g} me={me} role={role} head={head} />;
    case 'scores':
      return (
        <div class="screen">
          {head}
          <Scoreboard s={s} g={g} prev={g.prev} title={g.round < 2 ? 'After round 1' : 'Before the final'} />
          <div class="grow" />
          <Timer g={g} label={g.round < 2 ? 'Round 2 in' : 'Final round in'} />
        </div>
      );
    case 'fwrite':
      return <FinalWrite s={s} g={g} me={me} role={role} head={head} />;
    case 'fvote':
      return <FinalVote s={s} g={g} me={me} role={role} head={head} />;
    case 'fresult':
      return <FinalResult s={s} g={g} me={me} head={head} />;
    default:
      return null;
  }
}

function Write({ s, g, me, role, head }) {
  const mine = g.matches.map((m, i) => ({ m, i })).filter(({ m }) => m.a === me || m.b === me);
  const todo = mine.find(({ m }) => !m.ans[me]);
  const doneFn = (pid) => g.matches.filter((m) => m.a === pid || m.b === pid).every((m) => m.ans[pid]);
  if (role !== 'player' || !mine.length) {
    return (
      <div class="screen">
        {head}
        <Spectate text="Players are writing their answers. Get ready to vote!" />
        <Timer g={g} />
        <SentCard s={s} pids={g.pids} done={doneFn} title="Writing…" sub="Answers so far" />
      </div>
    );
  }
  if (!todo) {
    return (
      <div class="screen">
        {head}
        <Timer g={g} />
        <SentCard s={s} pids={g.pids} done={doneFn} title="Gloves off!" sub="Both answers are in. Waiting for the others…" />
      </div>
    );
  }
  const idx = mine.indexOf(todo);
  const submit = (text) => gsend({ t: 'ans', m: todo.i, text });
  return (
    <div class="screen">
      {head}
      <Timer g={g} />
      <div class="row spread">
        <span class="eyebrow">
          Prompt {idx + 1} of {mine.length}
        </span>
      </div>
      <div class="prompt-card zr-prompt pop-in" key={todo.i}>
        {todo.m.text}
      </div>
      <AnswerBox g={g} id={'zr' + todo.i} max={80} placeholder="Your zinger…" onSubmit={submit} cta="Throw it" />
      <button
        class="btn ghost sm"
        style={{ alignSelf: 'center' }}
        onClick={() => {
          sfx('pop');
          submit(SAFETY[Math.floor(Math.random() * SAFETY.length)]);
        }}
      >
        Out of ideas? Throw a safety jab
      </button>
    </div>
  );
}

function AnswerCard({ side, text, author, s, votes, phase, mine, picked, onPick, pts, ko, jinx }) {
  const reveal = phase === 'result';
  const Tag = onPick ? 'button' : 'div';
  return (
    <Tag class={`zr-ans ${side}` + (picked ? ' picked' : '') + (reveal && ko ? ' ko' : '') + (onPick ? ' pickable' : '')} onClick={onPick}>
      <span class="zr-corner">{side === 'a' ? 'Red corner' : 'Blue corner'}</span>
      <span class="zr-text">{text || <em class="muted">No answer. Forfeit!</em>}</span>
      {mine && !reveal && <span class="badge paper zr-mine">Yours</span>}
      {picked && !reveal && <span class="badge zr-mine">Your vote</span>}
      {reveal && (
        <div class="zr-reveal">
          <span class="player-chip">
            <PlayerAvatar p={s.players[author]} size={30} />
            <span class="nm">{s.players[author] ? s.players[author].name : '?'}</span>
          </span>
          <Voters s={s} ids={votes} size={24} />
          {!jinx && <strong class="zr-pts">+<CountUp to={pts || 0} /></strong>}
        </div>
      )}
      {reveal && ko && <span class="zr-stamp">ZINGER!</span>}
    </Tag>
  );
}

function Bout({ s, g, me, role, head }) {
  const m = g.matches[g.mi];
  if (!m) return null;
  const canVote = g.phase === 'vote' && me !== m.a && me !== m.b && (role === 'player' || role === 'audience');
  const myVote = m.votes[me];
  const votersFor = (side) => Object.entries(m.votes).filter(([, v]) => v === side).map(([p]) => p);
  const vote = (v) => {
    if (!canVote) return;
    sfx('pop');
    vibrate(25);
    gsend({ t: 'vote', v });
  };
  const amAuthor = me === m.a || me === m.b;
  return (
    <div class="screen zr-bout">
      {head}
      <div class="zr-ropes" aria-hidden="true" />
      <div class="prompt-card zr-prompt pop-in" key={'p' + g.mi}>
        {m.text}
      </div>
      {g.phase === 'show' ? (
        <div class="zr-vs pop-in">
          <span>VS</span>
        </div>
      ) : (
        <>
          {g.phase === 'vote' && <Timer g={g} />}
          {m.jinx && g.phase === 'result' && <div class="zr-jinx pop-in">JINX!</div>}
          <div class="zr-pair">
            <AnswerCard side="a" text={m.ans[m.a]} author={m.a} s={s} votes={votersFor('a')} phase={g.phase} mine={me === m.a} picked={myVote === 'a'} onPick={canVote ? () => vote('a') : null} pts={m.pts[m.a]} ko={m.ko === 'a'} jinx={m.jinx} />
            <AnswerCard side="b" text={m.ans[m.b]} author={m.b} s={s} votes={votersFor('b')} phase={g.phase} mine={me === m.b} picked={myVote === 'b'} onPick={canVote ? () => vote('b') : null} pts={m.pts[m.b]} ko={m.ko === 'b'} jinx={m.jinx} />
          </div>
          {g.phase === 'vote' && (
            <p class="center-text small" style={{ margin: 0, fontWeight: 700 }}>
              {amAuthor ? "Your answer is in the ring. You can't vote on this one." : canVote ? (myVote ? 'Vote locked in. Tap the other one to switch.' : 'Tap the funnier answer.') : 'Voting…'}
            </p>
          )}
        </>
      )}
    </div>
  );
}

function FinalWrite({ s, g, me, role, head }) {
  const f = g.final;
  const done = !!f.ans[me];
  return (
    <div class="screen">
      {head}
      <Timer g={g} />
      <div class="prompt-card zr-prompt zr-final pop-in">{f.text}</div>
      {role !== 'player' ? (
        <Spectate text="Everyone's answering the final prompt." />
      ) : done ? (
        <SentCard s={s} pids={g.pids} done={(p) => f.ans[p]} />
      ) : (
        <AnswerBox g={g} id="zrfinal" max={80} placeholder="Everyone answers this one…" onSubmit={(text) => gsend({ t: 'fans', text })} cta="Lock it in" />
      )}
    </div>
  );
}

function FinalVote({ s, g, me, role, head }) {
  const f = g.final;
  const [picks, setPicks] = useState([]);
  const locked = !!f.votes[me];
  const toggle = (pid) => {
    if (locked) return;
    sfx('tap');
    setPicks((p) => (p.includes(pid) ? p.filter((x) => x !== pid) : p.length >= 2 ? [p[1], pid] : [...p, pid]));
  };
  const canVote = role === 'player' || role === 'audience';
  return (
    <div class="screen">
      {head}
      <div class="prompt-card zr-prompt zr-final">{f.text}</div>
      <Timer g={g} />
      <span class="eyebrow center-text">{locked ? 'Votes locked in' : 'Pick your two favorites'}</span>
      <div class="col">
        {f.order.map((pid) => {
          const own = pid === me;
          const on = picks.includes(pid) || (locked && f.votes[me].includes(pid));
          return (
            <button key={pid} class={'zr-final-opt' + (on ? ' on' : '') + (own ? ' own' : '')} disabled={own || !canVote || locked} onClick={() => toggle(pid)}>
              <span>{f.ans[pid]}</span>
              {own && <span class="badge paper">Yours</span>}
              {on && <span class="badge red">{picks.indexOf(pid) === 0 || (locked && f.votes[me][0] === pid) ? '1st' : '2nd'}</span>}
            </button>
          );
        })}
      </div>
      {canVote && !locked && (
        <button
          class="btn primary"
          disabled={picks.length === 0}
          onClick={() => {
            sfx('submit');
            gsend({ t: 'fvote', picks });
          }}
        >
          Vote ({picks.length}/2)
        </button>
      )}
    </div>
  );
}

function FinalResult({ s, g, me, head }) {
  const f = g.final;
  const tally = f.tally || {};
  return (
    <div class="screen">
      {head}
      <div class="prompt-card zr-prompt zr-final">{f.text}</div>
      <div class="col">
        {f.order.map((pid, i) => {
          const voters = Object.entries(f.votes)
            .filter(([, ps]) => ps.includes(pid))
            .map(([v]) => v);
          return (
            <div class={'zr-fres slide-in' + (i === 0 && tally[pid] ? ' top' : '')} key={pid} style={{ animationDelay: `${(f.order.length - i) * 0.35}s` }}>
              <div class="zr-fres-text">{f.ans[pid]}</div>
              <div class="row spread" style={{ gap: 6 }}>
                <PlayerChip p={s.players[pid]} size={26} />
                <Voters s={s} ids={voters} size={22} />
                <strong class="tabular">+{fmtScore(f.pts[pid] || 0)}</strong>
              </div>
            </div>
          );
        })}
      </div>
      <Timer g={g} label="Final scores in" />
    </div>
  );
}
