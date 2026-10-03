import { useEffect, useRef, useState } from 'preact/hooks';
import { Timer, gsend, PlayerChip, useFinalTicks } from '../../ui/common.jsx';
import { PlayerAvatar } from '../../ui/Avatar.jsx';
import { RoundHeader } from '../shared.jsx';
import { sfx } from '../../audio/sfx.js';
import { vibrate, load, save } from '../../platform.js';
import './head.css';

export default function HeadView({ s, g, me, role }) {
  const t = g.t;
  useFinalTicks(g, g.phase === 'play');
  // Every phone reacts when a word is scored.
  const lastI = useRef(t ? t.i : 0);
  const [flash, setFlash] = useState(null);
  useEffect(() => {
    if (!t) return;
    if (t.i > lastI.current) {
      const ok = t.got.includes(t.i - 1);
      sfx(ok ? 'correct' : 'swoop');
      setFlash(ok ? 'ok' : 'skip');
      setTimeout(() => setFlash(null), 450);
      if (t.guesser === me) vibrate(ok ? 60 : [20, 40, 20]);
    }
    lastI.current = t.i;
  }, [t && t.i]);
  if (!t) return null;
  const amGuesser = t.guesser === me;
  if (g.phase === 'ready') return <Ready s={s} g={g} t={t} amGuesser={amGuesser} />;
  if (g.phase === 'play') return amGuesser ? <Forehead g={g} t={t} flash={flash} /> : <ClueGiver s={s} g={g} t={t} flash={flash} role={role} />;
  return <TurnEnd s={s} g={g} t={t} />;
}

function Ready({ s, g, t, amGuesser }) {
  const [rot, setRot] = useState(load('jb.headRotate') !== false);
  const p = s.players[t.guesser];
  if (amGuesser) {
    return (
      <div class="screen hd-ready">
        <RoundHeader left={`Turn ${g.turn + 1} of ${g.turns}`} right={t.cat} />
        <div class="fh-big pop-in">
          <span class="stencil">You're up!</span>
          <span>Hold your phone on your forehead, screen facing OUT. Don't peek!</span>
        </div>
        <label class="row" style={{ justifyContent: 'center', gap: 8, fontWeight: 700 }}>
          <input
            id="fh-rotate"
            type="checkbox"
            checked={rot}
            onChange={(e) => {
              setRot(e.currentTarget.checked);
              save('jb.headRotate', e.currentTarget.checked);
            }}
          />
          I'm holding it sideways (rotate the word)
        </label>
        <div class="grow" />
        <Timer g={g} label="Auto-start in" />
        <button
          class="btn primary big-cta"
          onClick={() => {
            sfx('bell');
            gsend({ t: 'start' });
          }}
        >
          Ready, start the clock!
        </button>
      </div>
    );
  }
  return (
    <div class="screen">
      <RoundHeader left={`Turn ${g.turn + 1} of ${g.turns}`} right="Get ready" />
      <div class="fh-big pop-in">
        <PlayerAvatar p={p} size={80} />
        <span class="stencil">{p ? p.name : 'Someone'} is guessing</span>
        <span>
          Category: <strong>{t.cat}</strong>
        </span>
        <span class="small">You'll see the word on your phone. Shout clues, act it out, never say the word!</span>
      </div>
      <Timer g={g} label="Starting in" />
    </div>
  );
}

function Forehead({ g, t, flash }) {
  const rot = load('jb.headRotate') !== false;
  const word = t.words[t.i] || '';
  const tap = (e) => {
    // Blind taps for the guesser: right half = got it, left half = pass.
    const r = e.currentTarget.getBoundingClientRect();
    const right = rot ? e.clientY > r.top + r.height / 2 : e.clientX > r.left + r.width / 2;
    gsend({ t: right ? 'got' : 'pass', i: t.i });
  };
  return (
    <button class={'fh-stage' + (flash ? ' ' + flash : '')} onPointerDown={tap} aria-label={`Current word: ${word}`}>
      <span class={'fh-word-wrap' + (rot ? ' rot' : '')}>
        <span class="fh-cat">{t.cat}</span>
        <span class="fh-word stencil" key={t.i}>
          {word}
        </span>
        <span class="fh-score">{t.got.length} correct</span>
      </span>
      <span class="fh-timer">
        <Timer g={g} />
      </span>
    </button>
  );
}

function ClueGiver({ s, g, t, flash, role }) {
  const word = t.words[t.i] || '';
  const p = s.players[t.guesser];
  const act = (y) => {
    vibrate(15);
    gsend({ t: y, i: t.i });
  };
  return (
    <div class={'screen fh-giver' + (flash ? ' ' + flash : '')}>
      <div class="row spread">
        <PlayerChip p={p} size={26} />
        <span class="eyebrow">{t.cat}</span>
      </div>
      <Timer g={g} />
      <div class="fh-card pop-in" key={t.i}>
        <span class="small">Get them to say</span>
        <strong class="stencil">{word}</strong>
      </div>
      <div class="fh-btns">
        <button class="btn" onClick={() => act('pass')} disabled={role === 'screen'}>
          Pass
        </button>
        <button class="btn primary fh-got" onClick={() => act('got')} disabled={role === 'screen'}>
          Got it!
        </button>
      </div>
      <p class="center-text small" style={{ margin: 0 }}>
        {t.got.length} correct so far
      </p>
    </div>
  );
}

function TurnEnd({ s, g, t }) {
  const p = s.players[t.guesser];
  const seen = t.words.slice(0, t.i + 1);
  return (
    <div class="screen">
      <RoundHeader left={`Turn ${g.turn + 1} of ${g.turns}`} right="Time!" />
      <div class="fh-big pop-in">
        <PlayerAvatar p={p} size={64} />
        <span class="stencil">
          {p ? p.name : 'They'} got {t.got.length}!
        </span>
      </div>
      <div class="fh-list">
        {seen.map((w, i) => (
          <span key={i} class={'fh-chip' + (t.got.includes(i) ? ' ok' : t.passed.includes(i) ? ' skip' : ' cur')}>
            {w}
          </span>
        ))}
      </div>
      <div class="grow" />
      <Timer g={g} label={g.turn + 1 >= g.turns ? 'Final scores in' : 'Next guesser in'} />
    </div>
  );
}
