import { useEffect, useRef, useState } from 'preact/hooks';
import { Timer, AnswerBox, gsend, useFinalTicks, fmtScore, toast } from '../../ui/common.jsx';
import { PlayerAvatar } from '../../ui/Avatar.jsx';
import { DrawPad, Drawing, drawingToDataUrl } from '../../ui/DrawPad.jsx';
import { RoundHeader, Spectate, useStepSound, Voters } from '../shared.jsx';
import { sfx } from '../../audio/sfx.js';
import { vibrate, saveImage } from '../../platform.js';
import './fraud.css';

function nameOf(s, pid) {
  return (s.players[pid] && s.players[pid].name) || 'Someone';
}

// The shared canvas so far, assembled from per-stroke blobs.
function canvasData(r, link) {
  const s = [];
  for (const x of r.strokes) {
    const b = link ? link.blob(x.b) : null;
    if (b && Array.isArray(b.st)) s.push(b.st);
  }
  return { v: 1, p: r.palette, s };
}

export default function FraudView({ s, g, me, role, link }) {
  useStepSound(g, { peek: 'bell', vote: 'whoosh', guess: 'heartbeat', result: 'reveal' });
  useFinalTicks(g, g.phase === 'vote' || g.phase === 'guess');
  const r = g.r;
  if (!r) return null;
  const inRound = r.order.includes(me) && role === 'player';
  const head = <RoundHeader left={`Round ${g.round} of ${g.rounds}`} right={`Topic: ${r.topic}`} />;
  const props = { s, g, r, me, role, link, head, inRound };
  if (g.phase === 'peek') return <Peek {...props} />;
  if (g.phase === 'draw') return <DrawTurn {...props} />;
  if (g.phase === 'vote') return <Vote {...props} />;
  if (g.phase === 'guess') return <Guess {...props} />;
  return <Result {...props} />;
}

function SecretCard({ r, me, inRound, small }) {
  if (!inRound) {
    return (
      <div class={'af-card' + (small ? ' small' : '')}>
        <span class="eyebrow">The word</span>
        <strong>{r.word}</strong>
      </div>
    );
  }
  if (me === r.fraud) {
    return (
      <div class={'af-card fraud' + (small ? ' small' : '')}>
        <span class="eyebrow">You are the</span>
        <strong>FRAUD</strong>
        {!small && <span class="small">Topic: {r.topic}. Blend in. Fake it. Figure out the word.</span>}
      </div>
    );
  }
  return (
    <div class={'af-card' + (small ? ' small' : '')}>
      <span class="eyebrow">The secret word</span>
      <strong>{r.word}</strong>
      {!small && <span class="small">One stroke per turn. Don't make it too obvious.</span>}
    </div>
  );
}

function Peek({ s, g, r, me, inRound, head }) {
  const ready = r.ready[me];
  return (
    <div class="screen">
      {head}
      <span class="eyebrow center-text">Hide your screen!</span>
      <SecretCard r={r} me={me} inRound={inRound} />
      <Timer g={g} />
      <div class="af-order">
        <span class="eyebrow">Drawing order</span>
        <OrderStrip s={s} r={r} />
      </div>
      {inRound && (
        <button
          class="btn primary"
          disabled={!!ready}
          onClick={() => {
            sfx('tap');
            gsend({ t: 'ready' });
          }}
        >
          {ready ? 'Waiting for the others…' : 'Got it'}
        </button>
      )}
    </div>
  );
}

function OrderStrip({ s, r, turn = -1 }) {
  const n = r.order.length;
  return (
    <div class="af-strip">
      {r.order.map((p, i) => (
        <span key={p} class={'af-pip' + (turn >= 0 && turn % n === i ? ' on' : '')} style={{ '--pc': r.palette[i] }}>
          <PlayerAvatar p={s.players[p]} size={26} />
          <span class="af-dot" />
        </span>
      ))}
    </div>
  );
}

function DrawTurn({ s, g, r, me, link, head, inRound }) {
  const who = r.order[r.turn % r.order.length];
  const mine = who === me;
  const lap = Math.floor(r.turn / r.order.length) + 1;
  const base = canvasData(r, link);
  const [sent, setSent] = useState(false);
  useEffect(() => {
    setSent(false);
    if (mine) {
      sfx('ding');
      vibrate([40, 60, 40]);
    }
  }, [g.step]);
  return (
    <div class="screen">
      {head}
      <SecretCard r={r} me={me} inRound={inRound} small />
      <div class="row spread af-turn">
        <span class={'af-who' + (mine ? ' me' : '')} style={{ '--pc': r.palette[r.order.indexOf(who)] }}>
          {mine ? 'Your stroke!' : `${nameOf(s, who)} is drawing…`}
        </span>
        <span class="eyebrow">
          Lap {lap} of {r.laps}
        </span>
      </div>
      <OrderStrip s={s} r={r} turn={r.turn} />
      {mine && !sent ? (
        <>
          <DrawPad
            key={g.step}
            palette={r.palette}
            base={base}
            single
            fixedColor={r.order.indexOf(me)}
            onStroke={(st) => {
              setSent(true);
              sfx('submit');
              gsend({ t: 'stroke', st });
            }}
          />
          <Timer g={g} />
        </>
      ) : (
        <>
          <Drawing data={base} label="The shared canvas" />
          <Timer g={g} />
        </>
      )}
    </div>
  );
}

function Vote({ s, g, r, me, role, link, head, inRound }) {
  const base = canvasData(r, link);
  const mine = r.votes[me];
  return (
    <div class="screen">
      {head}
      <Drawing data={base} label="The finished canvas" />
      <Timer g={g} />
      <span class="eyebrow center-text">{inRound ? 'Argue it out. Who is the Fraud?' : 'The artists are voting…'}</span>
      <div class="af-suspects">
        {r.order.map((p, i) => (
          <button
            key={p}
            class={'af-suspect' + (mine === p ? ' on' : '')}
            style={{ '--pc': r.palette[i] }}
            disabled={!inRound || p === me}
            onClick={() => {
              sfx('pop');
              vibrate(25);
              gsend({ t: 'vote', p });
            }}
          >
            <PlayerAvatar p={s.players[p]} size={40} />
            <span class="nm">{p === me ? 'You' : nameOf(s, p)}</span>
            <span class="af-dot" />
          </button>
        ))}
      </div>
    </div>
  );
}

function Guess({ s, g, r, me, link, head }) {
  const base = canvasData(r, link);
  return (
    <div class="screen">
      {head}
      <div class="af-busted pop-in">
        <PlayerAvatar p={s.players[r.fraud]} size={64} />
        <span class="stencil">{me === r.fraud ? 'Busted!' : `${nameOf(s, r.fraud)} is the Fraud!`}</span>
      </div>
      <Drawing data={base} label="The finished canvas" />
      <Timer g={g} />
      {me === r.fraud ? (
        <>
          <span class="eyebrow center-text">Last chance: what's the secret word? (Topic: {r.topic})</span>
          <AnswerBox g={g} id="af-guess" max={40} placeholder="Your best guess" cta="Steal the win" onSubmit={(text) => gsend({ t: 'guess', text })} />
        </>
      ) : (
        <Spectate text={`${nameOf(s, r.fraud)} gets one guess at the word. Hold your breath.`} />
      )}
    </div>
  );
}

function Result({ s, g, r, me, link, head }) {
  const base = canvasData(r, link);
  const once = useRef(false);
  useEffect(() => {
    if (once.current) return;
    once.current = true;
    const fraudWon = r.outcome === 'escaped' || r.outcome === 'guessed';
    const iWon = me === r.fraud ? fraudWon : !fraudWon;
    sfx(iWon ? 'fanfare' : 'wrong');
  }, []);
  const title = r.outcome === 'escaped' ? 'The Fraud got away!' : r.outcome === 'guessed' ? 'Caught, but they stole it!' : 'Fraud busted!';
  const save = async () => {
    const url = await drawingToDataUrl(base, {}, 900);
    const res = await saveImage(url, `art-fraud-${r.word.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.png`);
    if (res === 'downloaded') toast('Saved');
  };
  const ids = Object.keys(r.pts).sort((a, b) => r.pts[b] - r.pts[a]);
  return (
    <div class="screen">
      {head}
      <div class={'af-verdict pop-in ' + r.outcome}>
        <span class="stencil">{title}</span>
        <span>
          The word was <strong>{r.word}</strong>
          {r.guess ? (
            <>
              {' '}
              · Fraud guessed <strong>“{r.guess}”</strong>
            </>
          ) : null}
        </span>
      </div>
      <div class="row" style={{ justifyContent: 'center', gap: 10 }}>
        <PlayerAvatar p={s.players[r.fraud]} size={48} />
        <span class="stencil" style={{ fontSize: '1.4rem' }}>
          {nameOf(s, r.fraud)} was the Fraud
        </span>
      </div>
      <Drawing data={base} label="The finished canvas" />
      <div class="col" style={{ gap: 6 }}>
        {ids.map((pid) => {
          const vs = Object.entries(r.votes)
            .filter(([, t]) => t === pid)
            .map(([v]) => v);
          return (
            <div class="score-row" key={pid}>
              <PlayerAvatar p={s.players[pid]} size={28} />
              <span class="nm">{nameOf(s, pid)}</span>
              <Voters s={s} ids={vs} size={20} />
              <span class="sc">+{fmtScore(r.pts[pid])}</span>
            </div>
          );
        })}
      </div>
      <button class="btn sm" style={{ alignSelf: 'center' }} onClick={save}>
        Save the masterpiece
      </button>
    </div>
  );
}
