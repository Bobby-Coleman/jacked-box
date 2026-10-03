import { useEffect, useRef, useState } from 'preact/hooks';
import { Timer, WaitList, gsend, PlayerChip, useFinalTicks, fmtScore } from '../../ui/common.jsx';
import { PlayerAvatar } from '../../ui/Avatar.jsx';
import { sfx } from '../../audio/sfx.js';
import { vibrate } from '../../platform.js';
import './blend.css';

function Grid({ r, showSecret, onPick, picked }) {
  return (
    <div class="blend-grid" role="list">
      {r.words.map((w, i) => {
        const secret = showSecret && i === r.wi;
        const cls = 'bw' + (secret ? ' secret' : '') + (picked === i ? ' picked' : '') + (onPick ? ' pickable' : '');
        const Tag = onPick ? 'button' : 'div';
        return (
          <Tag class={cls} key={i} role="listitem" onClick={onPick ? () => onPick(i) : undefined}>
            {w}
          </Tag>
        );
      })}
    </div>
  );
}

function Header({ g, r, label }) {
  return (
    <div class="blend-head">
      <div class="row spread">
        <span class="eyebrow">
          Round {g.round} of {g.rounds}
        </span>
        <span class="eyebrow">{label}</span>
      </div>
      <h2 class="blend-topic game-font">{r.topic}</h2>
    </div>
  );
}

export default function BlendView({ s, g, me, role }) {
  const r = g.r;
  const amCham = r && r.cham === me && role === 'player';
  const knows = role === 'player' && !amCham;
  useFinalTicks(g, g.phase === 'vote' || g.phase === 'guess');

  // Buzz the Chameleon so they know without anyone seeing the screen.
  const buzzed = useRef(0);
  useEffect(() => {
    if (g.phase === 'card' && amCham && buzzed.current !== g.round) {
      buzzed.current = g.round;
      vibrate([80, 60, 80]);
    }
  }, [g.phase, g.round]);

  if (!r) return null;

  if (g.phase === 'card') return <CardPhase s={s} g={g} r={r} me={me} amCham={amCham} knows={knows} role={role} />;
  if (g.phase === 'clues') return <CluePhase s={s} g={g} r={r} me={me} knows={knows} />;
  if (g.phase === 'discuss') return <DiscussPhase s={s} g={g} r={r} me={me} knows={knows} role={role} />;
  if (g.phase === 'vote') return <VotePhase s={s} g={g} r={r} me={me} role={role} />;
  if (g.phase === 'guess') return <GuessPhase s={s} g={g} r={r} me={me} amCham={amCham} knows={knows} />;
  if (g.phase === 'result') return <ResultPhase s={s} g={g} r={r} me={me} />;
  return null;
}

function CardPhase({ s, g, r, me, amCham, knows, role }) {
  const [hidden, setHidden] = useState(false);
  const ready = !!r.ready[me];
  return (
    <div class="screen">
      <Header g={g} r={r} label="Secret card" />
      {role !== 'player' ? (
        <div class="blend-banner neutral">Players are checking their secret cards.</div>
      ) : amCham ? (
        <div class="blend-banner cham pop-in">
          <strong class="stencil">You are the Chameleon</strong>
          <span>You don't know the secret word. Blend in when it's your turn to speak.</span>
        </div>
      ) : (
        <div class="blend-banner pop-in">
          <span class="small">The secret word is</span>
          <strong class="stencil">{hidden ? '••••••' : r.words[r.wi]}</strong>
        </div>
      )}
      {!hidden && <Grid r={r} showSecret={knows} />}
      <div class="grow" />
      <Timer g={g} />
      {role === 'player' && (
        <div class="row">
          <button class="btn sm" onClick={() => setHidden(!hidden)}>
            {hidden ? 'Peek' : 'Hide'}
          </button>
          <button
            class="btn primary"
            disabled={ready}
            onClick={() => {
              sfx('tap');
              gsend({ t: 'ready' });
            }}
          >
            {ready ? 'Waiting for others' : 'Got it'}
          </button>
        </div>
      )}
      <WaitList s={s} pids={g.pids} done={(p) => r.ready[p]} size={36} />
    </div>
  );
}

function CluePhase({ s, g, r, me, knows }) {
  const cur = r.order[r.turn];
  const p = s.players[cur];
  const mine = cur === me;
  const lastTurn = useRef(-1);
  useEffect(() => {
    if (lastTurn.current !== r.turn) {
      lastTurn.current = r.turn;
      if (mine) {
        sfx('ding');
        vibrate(120);
      } else sfx('tap');
    }
  }, [r.turn]);
  return (
    <div class="screen">
      <Header g={g} r={r} label="Clues, out loud" />
      <div class={'turn-card pop-in' + (mine ? ' mine' : '')} key={r.turn}>
        <PlayerAvatar p={p} size={76} />
        <div class="col" style={{ gap: 2, minWidth: 0 }}>
          <span class="eyebrow" style={{ color: 'inherit', opacity: 0.8 }}>
            {mine ? "You're up" : 'Now speaking'}
          </span>
          <strong class="stencil turn-name">{p ? p.name : '…'}</strong>
          <span class="small">{mine ? 'Say ONE word out loud that hints at the secret word.' : 'Listen closely.'}</span>
        </div>
      </div>
      <Timer g={g} />
      <button
        class={'btn ' + (mine ? 'primary' : 'sm')}
        style={mine ? null : { alignSelf: 'center' }}
        onClick={() => {
          sfx('pop');
          gsend({ t: 'next' });
        }}
      >
        {mine ? 'I said my word' : 'Next speaker'}
      </button>
      <ol class="turn-order">
        {r.order.map((pid, i) => (
          <li key={pid} class={i < r.turn ? 'done' : i === r.turn ? 'now' : ''}>
            <PlayerChip p={s.players[pid]} size={24} />
          </li>
        ))}
      </ol>
      <Grid r={r} showSecret={knows} />
    </div>
  );
}

function DiscussPhase({ s, g, r, me, knows, role }) {
  const ready = !!r.ready[me];
  return (
    <div class="screen">
      <Header g={g} r={r} label="Discuss" />
      <div class="blend-banner neutral">
        <strong class="stencil">Who's faking it?</strong>
        <span>Argue it out loud. Vote when you're ready.</span>
      </div>
      <Timer g={g} />
      {role === 'player' && (
        <button
          class="btn primary"
          disabled={ready}
          onClick={() => {
            sfx('tap');
            gsend({ t: 'ready' });
          }}
        >
          {ready ? 'Waiting for the others…' : 'Ready to vote'}
        </button>
      )}
      <WaitList s={s} pids={g.pids} done={(p) => r.ready[p]} size={36} />
      <Grid r={r} showSecret={knows} />
    </div>
  );
}

function VotePhase({ s, g, r, me, role }) {
  const mine = r.votes[me];
  return (
    <div class="screen">
      <Header g={g} r={r} label="Vote" />
      <h3 class="game-font center-text" style={{ fontSize: '1.6rem' }}>
        Who is the Chameleon?
      </h3>
      <Timer g={g} />
      {role === 'player' ? (
        <div class="vote-list">
          {g.pids
            .filter((pid) => pid !== me && s.players[pid])
            .map((pid) => (
              <button
                key={pid}
                class={'vote-btn' + (mine === pid ? ' on' : '')}
                onClick={() => {
                  sfx('pop');
                  vibrate(30);
                  gsend({ t: 'vote', p: pid });
                }}
              >
                <PlayerAvatar p={s.players[pid]} size={44} />
                <span class="nm">{s.players[pid].name}</span>
                {mine === pid && <span class="badge red">Your vote</span>}
              </button>
            ))}
        </div>
      ) : (
        <p class="center-text">Players are voting…</p>
      )}
      <WaitList s={s} pids={g.pids} done={(p) => r.votes[p]} size={34} />
    </div>
  );
}

function GuessPhase({ s, g, r, me, amCham, knows }) {
  const [picked, setPicked] = useState(null);
  const cp = s.players[r.cham];
  return (
    <div class="screen">
      <Header g={g} r={r} label="Last chance" />
      <div class="blend-banner cham pop-in">
        <strong class="stencil">{amCham ? 'You got caught!' : `${cp ? cp.name : 'They'} got caught!`}</strong>
        <span>{amCham ? 'Guess the secret word to steal the round.' : 'The Chameleon is guessing the secret word…'}</span>
      </div>
      <Timer g={g} />
      <Grid
        r={r}
        showSecret={knows}
        picked={picked}
        onPick={
          amCham
            ? (i) => {
                setPicked(i);
                sfx('drumroll');
                gsend({ t: 'guess', w: i });
              }
            : null
        }
      />
    </div>
  );
}

function ResultPhase({ s, g, r, me }) {
  const cp = s.players[r.cham];
  const accused = r.accused && s.players[r.accused];
  const outcomeText =
    r.outcome === 'escaped'
      ? r.accused
        ? `You accused ${accused ? accused.name : 'the wrong person'}. The Chameleon escapes!`
        : 'The vote was split. The Chameleon escapes!'
      : r.outcome === 'guessed'
        ? 'Caught, but they guessed the word!'
        : r.guess != null
          ? `Caught! They guessed "${r.words[r.guess]}".`
          : 'Caught red-handed!';
  const tableWins = r.outcome === 'caught';
  const played = useRef(false);
  useEffect(() => {
    if (played.current) return;
    played.current = true;
    sfx(tableWins ? 'fanfare' : 'slideDown');
  }, []);
  const myPts = r.pts[me] || 0;
  return (
    <div class="screen">
      <Header g={g} r={r} label="Reveal" />
      <div class={'reveal-card pop-in ' + (tableWins ? 'win' : 'lose')}>
        <span class="eyebrow" style={{ color: 'inherit' }}>
          The Chameleon was
        </span>
        <div class="row" style={{ justifyContent: 'center' }}>
          <PlayerAvatar p={cp} size={64} />
          <strong class="stencil" style={{ fontSize: '2.4rem' }}>
            {cp ? cp.name : '???'}
          </strong>
        </div>
        <span>
          Secret word: <strong>{r.words[r.wi]}</strong>
        </span>
        <span class="outcome">{outcomeText}</span>
      </div>
      {myPts > 0 && <div class="pts-pop pop-in">+{fmtScore(myPts)}</div>}
      <div class="label tight col" style={{ gap: 6 }}>
        <span class="eyebrow">Votes</span>
        {Object.entries(r.votes).map(([voter, target]) => (
          <div class="row" key={voter} style={{ gap: 6 }}>
            <PlayerChip p={s.players[voter]} size={22} />
            <span class="muted small">voted</span>
            <PlayerChip p={s.players[target]} size={22} />
            {target === r.cham && <span class="badge" style={{ background: '#b6e34a' }}>Right</span>}
          </div>
        ))}
        {Object.keys(r.votes).length === 0 && <span class="small muted">Nobody voted.</span>}
      </div>
      <Timer g={g} label={g.round >= g.rounds ? 'Final scores in' : 'Next round in'} />
    </div>
  );
}
