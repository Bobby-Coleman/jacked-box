import { useEffect, useRef } from 'preact/hooks';
import { Timer, AnswerBox, gsend, useFinalTicks, fmtScore } from '../../ui/common.jsx';
import { PlayerAvatar } from '../../ui/Avatar.jsx';
import { RoundHeader, SentCard, Spectate, useStepSound, Voters, CountUp } from '../shared.jsx';
import { sfx } from '../../audio/sfx.js';
import { vibrate } from '../../platform.js';
import { fill } from './logic.js';
import './split.css';

function nameOf(s, pid) {
  return (s.players[pid] && s.players[pid].name) || 'Someone';
}

function Deal({ tpl, text }) {
  const [a, b] = String(tpl).split('____');
  return (
    <div class="sd-deal pop-in">
      {a}
      {text ? <mark>{text}</mark> : <span class="sd-blank">______</span>}
      {b}
    </div>
  );
}

export default function SplitView({ s, g, me, role }) {
  useStepSound(g, { write: 'bell', vote: 'whoosh', result: 'reveal' });
  useFinalTicks(g, g.phase === 'write' || g.phase === 'vote');
  if (g.phase === 'write') return <Write s={s} g={g} me={me} role={role} />;
  const r = g.r;
  if (!r) return null;
  const j = g.jobs[r.author];
  const head = <RoundHeader left={`Round ${g.round} of ${g.rounds}`} right={`Deal ${g.qi + 1} of ${g.queue.length}`} />;
  if (g.phase === 'vote') return <Vote s={s} g={g} r={r} j={j} me={me} role={role} head={head} />;
  return <Result s={s} g={g} r={r} j={j} me={me} head={head} />;
}

function Write({ s, g, me, role }) {
  const job = g.jobs[me];
  const pids = Object.keys(g.jobs);
  const doneFn = (p) => g.jobs[p] && g.jobs[p].text;
  const head = <RoundHeader left={`Round ${g.round} of ${g.rounds}`} right="Split Decision" />;
  if (role !== 'player' || !job) {
    return (
      <div class="screen">
        {head}
        <Spectate text="Everyone's writing the catch…" />
        <Timer g={g} />
        <SentCard s={s} pids={pids} done={doneFn} title="Writing…" sub="" />
      </div>
    );
  }
  if (job.text) {
    return (
      <div class="screen">
        {head}
        <Deal tpl={job.tpl} text={job.text} />
        <Timer g={g} />
        <SentCard s={s} pids={pids} done={doneFn} title="Deal drafted" sub="Waiting for the others…" />
      </div>
    );
  }
  return (
    <div class="screen">
      {head}
      <Timer g={g} />
      <span class="eyebrow center-text">Write the catch. Aim for a 50/50 split.</span>
      <Deal tpl={job.tpl} />
      <AnswerBox g={g} id="sd-catch" max={90} placeholder="…you can only whisper" cta="Make the deal" onSubmit={(text) => gsend({ t: 'catch', text })} />
      <span class="small center-text" style={{ opacity: 0.8 }}>
        Too sweet and everyone says yes. Too cruel and everyone says no.
      </span>
    </div>
  );
}

function Vote({ s, g, r, j, me, role, head }) {
  const mine = r.votes[me];
  const isAuthor = me === r.author;
  const can = !isAuthor && (role === 'player' || role === 'audience');
  const pick = (v) => {
    sfx(v === 'y' ? 'correct' : 'pop');
    vibrate(25);
    gsend({ t: 'vote', v });
  };
  return (
    <div class="screen">
      {head}
      <Deal tpl={j.tpl} text={j.text} />
      <Timer g={g} />
      {isAuthor ? (
        <Spectate text="Your deal. Watch them squirm." />
      ) : (
        <div class="sd-buttons">
          <button class={'sd-yes' + (mine === 'y' ? ' on' : '')} disabled={!can} onClick={() => pick('y')}>
            DEAL
          </button>
          <button class={'sd-no' + (mine === 'n' ? ' on' : '')} disabled={!can} onClick={() => pick('n')}>
            NO DEAL
          </button>
        </div>
      )}
      <span class="small center-text" style={{ opacity: 0.8 }}>
        {Object.keys(r.votes).length} voted
      </span>
    </div>
  );
}

function Result({ s, g, r, j, me, head }) {
  const once = useRef(false);
  useEffect(() => {
    if (once.current) return;
    once.current = true;
    if (r.perfect) sfx('fanfare');
    else if (r.pts) sfx('cash');
    else sfx('wrong');
  }, []);
  const total = (r.yes || 0) + (r.no || 0);
  const yp = total ? Math.round((r.yes / total) * 100) : 50;
  const ids = (v) =>
    Object.entries(r.votes)
      .filter(([, x]) => x === v)
      .map(([p]) => p);
  return (
    <div class="screen">
      {head}
      <Deal tpl={j.tpl} text={j.text} />
      <div class="sd-bar" role="img" aria-label={`${r.yes} deal, ${r.no} no deal`}>
        <div class="sd-y" style={{ width: yp + '%' }}>
          {r.yes ? `${r.yes} DEAL` : ''}
        </div>
        <div class="sd-n" style={{ width: 100 - yp + '%' }}>
          {r.no ? `${r.no} NO` : ''}
        </div>
      </div>
      <div class="row spread">
        <Voters s={s} ids={ids('y')} size={22} />
        <Voters s={s} ids={ids('n')} size={22} />
      </div>
      <div class={'sd-score pop-in' + (r.perfect ? ' perfect' : '')}>
        <PlayerAvatar p={s.players[r.author]} size={40} />
        <span class="nm">{nameOf(s, r.author)}</span>
        <span class="stencil">{r.perfect ? 'PERFECT SPLIT' : total && (r.yes === 0 || r.no === 0) ? 'NO CONTEST' : 'SPLIT'}</span>
        <span class="sc">
          +<CountUp to={r.pts} />
        </span>
      </div>
    </div>
  );
}
