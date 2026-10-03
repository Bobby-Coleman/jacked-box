import { useEffect, useRef, useState } from 'preact/hooks';
import { Timer, gsend, useFinalTicks, useNow, fmtScore } from '../../ui/common.jsx';
import { PlayerAvatar } from '../../ui/Avatar.jsx';
import { playerImageSrc } from '../../ui/faces.jsx';
import { RoundHeader, SentCard, Spectate, useStepSound, Voters } from '../shared.jsx';
import { TRUTH_EXAMPLES } from '../../content/faces.js';
import { sfx } from '../../audio/sfx.js';
import { vibrate } from '../../platform.js';
import './pants.css';

const LETTERS = ['A', 'B', 'C'];

function nameOf(s, pid) {
  return (s.players[pid] && s.players[pid].name) || 'Someone';
}

export default function PantsView({ s, g, me, role }) {
  useStepSound(g, { write: 'bell', grill: 'heartbeat', reveal: 'boom' });
  useFinalTicks(g, g.phase === 'write' || g.phase === 'grill');
  if (g.phase === 'write') return <Write s={s} g={g} me={me} role={role} />;
  const r = g.r;
  if (!r) return null;
  const head = <RoundHeader left={`Hot seat ${g.qi + 1} of ${g.queue.length}`} right="Pants on Fire" />;
  if (g.phase === 'grill') return <Grill s={s} g={g} r={r} me={me} role={role} head={head} />;
  return <Reveal s={s} g={g} r={r} me={me} head={head} />;
}

function Write({ s, g, me, role }) {
  const [lines, setLines] = useState(['', '', '']);
  const [lie, setLie] = useState(null);
  const sent = useRef(false);
  const t = useNow(250);
  const mine = g.sets[me];
  const ex = useRef(null);
  if (!ex.current) {
    const pool = TRUTH_EXAMPLES.slice().sort(() => Math.random() - 0.5);
    ex.current = pool.slice(0, 3);
  }
  const ready = lines.every((x) => x.trim()) && lie !== null;
  const submit = () => {
    if (sent.current || !ready) return;
    sent.current = true;
    sfx('submit');
    gsend({ t: 'stmts', a: lines[0].trim(), b: lines[1].trim(), c: lines[2].trim(), lie });
  };
  useEffect(() => {
    if (!sent.current && g.until && g.until - t < 900 && ready) submit();
  });
  const head = <RoundHeader left="Two truths and a lie" right="Pants on Fire" />;
  const doneFn = (p) => g.sets[p];
  if (role !== 'player' || !g.pids.includes(me)) {
    return (
      <div class="screen">
        {head}
        <Spectate text="Everyone's cooking up two truths and a lie…" />
        <Timer g={g} />
        <SentCard s={s} pids={g.pids} done={doneFn} title="Writing…" sub="" />
      </div>
    );
  }
  if (mine || sent.current) {
    return (
      <div class="screen">
        {head}
        <Timer g={g} />
        <SentCard s={s} pids={g.pids} done={doneFn} title="Locked in" sub="Practice your poker face…" />
      </div>
    );
  }
  return (
    <div class="screen">
      {head}
      <Timer g={g} />
      <span class="eyebrow center-text">Write 3 things about you. Two true, one a lie. Tap the flame on the lie.</span>
      {lines.map((v, i) => (
        <div class={'pn-line' + (lie === i ? ' lie' : '')} key={i}>
          <span class="pn-letter">{LETTERS[i]}</span>
          <input
            id={'pn-' + i}
            class="field"
            value={v}
            maxLength={90}
            placeholder={ex.current[i]}
            autocomplete="off"
            enterkeyhint="next"
            onInput={(e) => {
              const val = e.currentTarget.value.slice(0, 90);
              setLines((cur) => cur.map((x, k) => (k === i ? val : x)));
            }}
          />
          <button
            class={'pn-flame' + (lie === i ? ' on' : '')}
            aria-label={`Mark ${LETTERS[i]} as the lie`}
            aria-pressed={lie === i}
            onClick={() => {
              sfx('tap');
              setLie(i);
            }}
          >
            <Flame />
          </button>
        </div>
      ))}
      <button class="btn primary" disabled={!ready} onClick={submit}>
        {lie === null ? 'Mark your lie with a flame' : 'Lock it in'}
      </button>
    </div>
  );
}

function Flame({ size = 26 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <path d="M12 2c1 4 6 6 6 12a6 6 0 01-12 0c0-3 2-5 3-6 0 2 1 3 2 3 0-3-1-6 1-9z" fill="#ff6a1f" stroke="#1d1611" stroke-width="1.6" stroke-linejoin="round" />
      <path d="M12 12c1 2 3 3 3 5a3 3 0 01-6 0c0-1.5 1-2.5 1.5-3 .2 1 .8 1.5 1.5 1.5 0-1.5-.5-2.5 0-3.5z" fill="#ffd400" />
    </svg>
  );
}

function HotSeat({ s, pid, burning }) {
  const p = s.players[pid];
  const src = playerImageSrc(p);
  return (
    <div class={'pn-seat pop-in' + (burning ? ' burning' : '')}>
      <div class="pn-face">{src ? <img src={src} alt={p ? p.name : ''} /> : <PlayerAvatar p={p} size={120} />}</div>
      <div class="pn-flames" aria-hidden="true">
        <Flame size={40} />
        <Flame size={52} />
        <Flame size={40} />
      </div>
      <strong class="stencil">{nameOf(s, pid)}</strong>
    </div>
  );
}

function Grill({ s, g, r, me, role, head }) {
  const mine = r.guesses[me];
  const isSubject = me === r.subject;
  const canGuess = !isSubject && (role === 'player' || role === 'audience');
  const set = isSubject ? g.sets[me] : null;
  return (
    <div class="screen">
      {head}
      <HotSeat s={s} pid={r.subject} />
      <Timer g={g} />
      <span class="eyebrow center-text">{isSubject ? 'Defend yourself! Everyone is grilling you.' : `Grill ${nameOf(s, r.subject)} out loud. Which one is the lie?`}</span>
      <div class="col">
        {r.lines.map((line, i) => (
          <button
            key={i}
            class={'pn-stmt' + (mine === i ? ' on' : '') + (isSubject && i === r.lie ? ' mylie' : '')}
            disabled={!canGuess}
            onClick={() => {
              sfx('pop');
              vibrate(20);
              gsend({ t: 'guess', i });
            }}
          >
            <span class="pn-letter">{LETTERS[i]}</span>
            <span>{line}</span>
            {isSubject && i === r.lie && (
              <span class="pn-mark">
                <Flame size={20} /> your lie
              </span>
            )}
          </button>
        ))}
      </div>
      {!isSubject && <span class="small center-text" style={{ opacity: 0.8 }}>{mine !== undefined ? 'You can change your vote until time runs out.' : 'Ask questions first. Vote when you are sure.'}</span>}
      {isSubject && set && <span class="small center-text" style={{ opacity: 0.8 }}>Keep a straight face.</span>}
    </div>
  );
}

function Reveal({ s, g, r, me, head }) {
  const once = useRef(false);
  useEffect(() => {
    if (once.current) return;
    once.current = true;
    const mine = r.guesses[me];
    if (me === r.subject) sfx(r.fooled ? 'fanfare' : 'wrong');
    else if (mine !== undefined) sfx(mine === r.lie ? 'correct' : 'wrong');
  }, []);
  const byChoice = [0, 1, 2].map((i) =>
    Object.entries(r.guesses)
      .filter(([, x]) => x === i)
      .map(([p]) => p),
  );
  const ids = Object.keys(r.pts).sort((a, b) => r.pts[b] - r.pts[a]);
  return (
    <div class="screen">
      {head}
      <HotSeat s={s} pid={r.subject} burning />
      <div class="col">
        {r.lines.map((line, i) => (
          <div key={i} class={'pn-stmt revealed' + (i === r.lie ? ' lie' : ' truth')}>
            <span class="pn-letter">{i === r.lie ? <Flame size={22} /> : '✓'}</span>
            <span class="pn-text">{line}</span>
            <Voters s={s} ids={byChoice[i]} size={20} />
          </div>
        ))}
      </div>
      <div class="col" style={{ gap: 6 }}>
        {ids.map((pid) => (
          <div class="score-row" key={pid}>
            <PlayerAvatar p={s.players[pid]} size={28} />
            <span class="nm">{nameOf(s, pid)}</span>
            <span class="small">{pid === r.subject ? `fooled ${r.fooled}` : 'spotted it'}</span>
            <span class="sc">+{fmtScore(r.pts[pid])}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
