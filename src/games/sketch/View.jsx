import { useEffect, useRef, useState } from 'preact/hooks';
import { Timer, AnswerBox, gsend, useFinalTicks, useNow, fmtScore, PlayerChip, Icon } from '../../ui/common.jsx';
import { PlayerAvatar } from '../../ui/Avatar.jsx';
import { DrawPad, Drawing, isBlank } from '../../ui/DrawPad.jsx';
import { RoundHeader, SentCard, Spectate, useStepSound, Voters } from '../shared.jsx';
import { sfx } from '../../audio/sfx.js';
import mod from './logic.js';
import './sketch.css';

export default function SketchView({ s, g, me, role, link }) {
  useStepSound(g, { draw: 'bell', lie: 'whoosh', pick: 'pop', reveal: 'drumroll' });
  useFinalTicks(g, ['draw', 'lie', 'pick'].includes(g.phase));
  const head = <RoundHeader left={g.rounds > 1 ? `Round ${g.round} of ${g.rounds}` : 'Sketchy'} right={g.queue && g.phase !== 'draw' ? `Drawing ${g.qi + 1} of ${g.queue.length}` : null} />;
  if (g.phase === 'draw') return <DrawPhase s={s} g={g} me={me} role={role} head={head} />;
  const c = g.cur;
  if (!c) return null;
  const data = link.blob(c.blob);
  const artist = s.players[c.artist];
  return (
    <div class="screen">
      {head}
      <div class={'sk-art pop-in' + (g.phase === 'lie' ? '' : ' small')} key={c.blob}>
        <Drawing data={data} label={`Drawing by ${artist ? artist.name : 'someone'}`} />
        <span class="sk-artist">
          <PlayerChip p={artist} size={24} />
        </span>
      </div>
      {g.phase === 'lie' && <LiePhase s={s} g={g} me={me} role={role} />}
      {g.phase === 'pick' && <PickPhase s={s} g={g} me={me} role={role} />}
      {g.phase === 'reveal' && <RevealPhase s={s} g={g} me={me} />}
    </div>
  );
}

function DrawPhase({ s, g, me, role, head }) {
  const mine = g.art[me];
  const [data, setData] = useState(null);
  const sent = useRef(false);
  const t = useNow(250);
  const submit = () => {
    if (sent.current || isBlank(data)) return;
    sent.current = true;
    sfx('submit');
    gsend({ t: 'draw', d: data });
  };
  useEffect(() => {
    sent.current = !!(mine && mine.blob);
  }, [g.step]);
  useEffect(() => {
    if (!sent.current && g.until && g.until - t < 900 && !isBlank(data)) submit();
  });
  const doneFn = (p) => g.art[p] && g.art[p].blob;
  if (role !== 'player' || !mine) {
    return (
      <div class="screen">
        {head}
        <Spectate text="Artists at work. No peeking." />
        <Timer g={g} />
        <SentCard s={s} pids={Object.keys(g.art)} done={doneFn} title="Drawing…" sub="Finished so far" />
      </div>
    );
  }
  if (mine.blob || sent.current) {
    return (
      <div class="screen">
        {head}
        <Timer g={g} />
        <SentCard s={s} pids={Object.keys(g.art)} done={doneFn} title="Masterpiece sent!" sub="Waiting for the other artists…" />
      </div>
    );
  }
  return (
    <div class="screen sk-draw">
      {head}
      <div class="sk-prompt">
        <span class="eyebrow">Draw this (keep it secret)</span>
        <strong class="game-font">{mine.prompt}</strong>
      </div>
      <DrawPad palette={mine.pal} onChange={setData} />
      <Timer g={g} />
      <button class="btn primary" disabled={isBlank(data)} onClick={submit}>
        Done drawing
      </button>
    </div>
  );
}

function LiePhase({ s, g, me, role }) {
  const c = g.cur;
  const isArtist = me === c.artist;
  const guessers = g.pids.filter((p) => p !== c.artist);
  const rejCount = c.rej[me] || 0;
  const [shake, setShake] = useState(false);
  const lastRej = useRef(rejCount);
  useEffect(() => {
    if (rejCount > lastRej.current) {
      sfx('wrong');
      setShake(true);
      setTimeout(() => setShake(false), 500);
    }
    lastRej.current = rejCount;
  }, [rejCount]);
  if (isArtist) {
    return (
      <>
        <Timer g={g} />
        <div class="label tight center-text">This is yours! Everyone is writing fake titles for it.</div>
        <SentCard s={s} pids={guessers} done={(p) => c.lies[p]} title="Shhh…" sub="Don't give anything away." />
      </>
    );
  }
  if (role !== 'player') return <SentCard s={s} pids={guessers} done={(p) => c.lies[p]} title="Writing lies…" sub="" />;
  if (c.lies[me]) return <SentCard s={s} pids={guessers} done={(p) => c.lies[p]} title="Nice lie." sub="Waiting for the other liars…" />;
  return (
    <>
      <Timer g={g} />
      <span class="eyebrow">Write a fake title for this drawing</span>
      {rejCount > 0 && <div class={'label tight sk-warn' + (shake ? ' shake' : '')}>That's too close to the real title! Write something else.</div>}
      <AnswerBox g={g} id={'lie' + g.qi + '-' + rejCount} max={60} placeholder="A believable fake title…" onSubmit={(text) => gsend({ t: 'lie', text })} cta="Submit lie" />
    </>
  );
}

function PickPhase({ s, g, me, role }) {
  const c = g.cur;
  const isArtist = me === c.artist;
  const myPick = c.picks[me];
  const canPick = role === 'player' && !isArtist;
  return (
    <>
      <Timer g={g} />
      <span class="eyebrow center-text">{isArtist ? 'Your drawing. Watch them squirm.' : 'Which one is the real title?'}</span>
      <div class="col">
        {c.opts.map((o) => {
          const own = o.by.includes(me);
          const liked = (c.likes[o.id] || []).includes(me);
          return (
            <div class="sk-opt-row" key={o.id}>
              <button
                class={'sk-opt' + (myPick === o.id ? ' on' : '') + (own ? ' own' : '')}
                disabled={!canPick || own}
                onClick={() => {
                  sfx('pop');
                  gsend({ t: 'pick', o: o.id });
                }}
              >
                {o.text}
                {own && <span class="badge paper">Your lie</span>}
              </button>
              {!own && (
                <button
                  class={'like-btn' + (liked ? ' on' : '')}
                  aria-label="Like this answer"
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

function RevealPhase({ s, g, me }) {
  const c = g.cur;
  const t = useNow(200);
  const elapsed = t - g.t0;
  const shown = Math.min(c.revealOrder.length, Math.max(0, Math.floor((elapsed - 1200) / mod.REVEAL_STEP) + 1));
  const last = useRef(0);
  useEffect(() => {
    if (shown > last.current) {
      const id = c.revealOrder[shown - 1];
      sfx(id === 'T' ? 'ding' : 'scratch');
      last.current = shown;
    }
  }, [shown]);
  const pickersOf = (oid) => Object.entries(c.picks).filter(([, v]) => v === oid).map(([p]) => p);
  return (
    <div class="col">
      {c.revealOrder.slice(0, shown).map((oid) => {
        const o = c.opts.find((x) => x.id === oid);
        if (!o) return null;
        const truth = o.id === 'T';
        const pickers = pickersOf(o.id);
        return (
          <div class={'sk-rev pop-in' + (truth ? ' truth' : '')} key={oid}>
            <div class="sk-rev-text">{o.text}</div>
            <div class="row spread" style={{ gap: 6, flexWrap: 'wrap' }}>
              {truth ? (
                <span class="badge" style={{ background: '#19b66a', color: '#fff' }}>
                  The truth
                </span>
              ) : (
                <span class="small">
                  Lie by{' '}
                  {o.by.map((p) => (
                    <PlayerChip key={p} p={s.players[p]} size={20} />
                  ))}
                </span>
              )}
              <div class="row" style={{ gap: 4 }}>
                {pickers.length > 0 && <span class="small muted">{truth ? 'Found by' : 'Fooled'}</span>}
                <Voters s={s} ids={pickers} size={22} />
              </div>
            </div>
          </div>
        );
      })}
      {shown >= c.revealOrder.length && c.pts[me] > 0 && <div class="pts-banner pop-in">You scored +{fmtScore(c.pts[me])}</div>}
    </div>
  );
}
