import { useEffect, useRef, useState } from 'preact/hooks';
import { Timer, AnswerBox, gsend, useFinalTicks, useNow, PlayerChip, Icon } from '../../ui/common.jsx';
import { DrawPad, Drawing, isBlank } from '../../ui/DrawPad.jsx';
import { RoundHeader, SentCard, Spectate, useStepSound } from '../shared.jsx';
import { PHONE_STARTERS } from '../../content/phone.js';
import { sfx } from '../../audio/sfx.js';
import { PALETTE, chainFor } from './logic.js';
import './phone.css';

const LABEL = { write: 'Write', draw: 'Draw', desc: 'Describe' };

export default function PhoneView({ s, g, me, role, link }) {
  useStepSound(g, { write: 'bell', draw: 'bell', desc: 'bell', chainEnd: 'applause' });
  useFinalTicks(g, ['write', 'draw', 'desc'].includes(g.phase));
  if (g.phase === 'reveal' || g.phase === 'chainEnd') return <Reveal s={s} g={g} me={me} link={link} />;
  const head = <RoundHeader left={`Step ${g.k + 1} of ${g.steps}`} right={LABEL[g.phase]} />;
  const doneFn = (p) => {
    const c = chainFor(g, p, g.k);
    return c >= 0 && g.chains[c].e[g.k] != null;
  };
  const c = chainFor(g, me, g.k);
  if (c < 0 || role !== 'player') {
    return (
      <div class="screen">
        {head}
        <Spectate text="Chains are being passed around. Watch the replay at the end!" />
        <Timer g={g} />
        <SentCard s={s} pids={g.order} done={doneFn} title="In progress…" sub="" />
      </div>
    );
  }
  if (doneFn(me)) {
    return (
      <div class="screen">
        {head}
        <Timer g={g} />
        <SentCard s={s} pids={g.order} done={doneFn} title="Passed on!" sub="Waiting for the rest of the table…" />
      </div>
    );
  }
  const prev = g.k > 0 ? g.chains[c].e[g.k - 1] : null;
  if (g.phase === 'write') return <WriteStep g={g} head={head} />;
  if (g.phase === 'draw') return <DrawStep g={g} head={head} prev={prev} />;
  return <DescStep g={g} head={head} prev={prev} link={link} />;
}

function WriteStep({ g, head }) {
  const [idea, setIdea] = useState(null);
  return (
    <div class="screen">
      {head}
      <Timer g={g} />
      <div class="ph-card">
        <span class="eyebrow">Start a chain</span>
        <strong class="game-font">Write something weird for someone else to draw.</strong>
      </div>
      <AnswerBox g={g} id="ph-write" max={80} placeholder="A dog running for mayor…" onSubmit={(text) => gsend({ t: 'write', text })} cta="Pass it on" />
      {idea ? (
        <button
          class="btn sm yellow"
          style={{ alignSelf: 'center' }}
          onClick={() => {
            sfx('submit');
            gsend({ t: 'write', text: idea });
          }}
        >
          Use “{idea}”
        </button>
      ) : (
        <button
          class="btn ghost sm"
          style={{ alignSelf: 'center' }}
          onClick={() => {
            sfx('pop');
            setIdea(PHONE_STARTERS[Math.floor(Math.random() * PHONE_STARTERS.length)]);
          }}
        >
          Give me an idea
        </button>
      )}
    </div>
  );
}

function DrawStep({ g, head, prev }) {
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
    if (!sent.current && g.until && g.until - t < 900 && !isBlank(data)) submit();
  });
  return (
    <div class="screen">
      {head}
      <div class="ph-card">
        <span class="eyebrow">Draw this</span>
        <strong class="game-font">{prev && prev.t ? prev.t : 'Anything you like!'}</strong>
      </div>
      <DrawPad palette={PALETTE} onChange={setData} />
      <Timer g={g} />
      <button class="btn primary" disabled={isBlank(data)} onClick={submit}>
        Pass it on
      </button>
    </div>
  );
}

function DescStep({ g, head, prev, link }) {
  const data = prev && prev.b ? link.blob(prev.b) : null;
  return (
    <div class="screen">
      {head}
      <Timer g={g} />
      <span class="eyebrow">What is this?</span>
      <div class="ph-art">{prev && prev.b ? <Drawing data={data} /> : <div class="label center-text">They didn't draw anything. Make something up!</div>}</div>
      <AnswerBox g={g} id={'ph-desc' + g.k} max={80} placeholder="Describe the drawing…" onSubmit={(text) => gsend({ t: 'desc', text })} cta="Pass it on" autoFocus={false} />
    </div>
  );
}

function Reveal({ s, g, me, link }) {
  const chain = g.chains[g.ci];
  const endRef = useRef(null);
  useEffect(() => {
    if (endRef.current) endRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    if (g.phase === 'reveal') sfx('pop');
  }, [g.ei, g.ci, g.phase]);
  const starter = s.players[chain.by];
  const upto = Math.min(g.ei, chain.e.length - 1);
  return (
    <div class="screen ph-reveal">
      <RoundHeader left={`Chain ${g.ci + 1} of ${g.chains.length}`} right={g.phase === 'chainEnd' ? 'The end' : 'Replay'} />
      <div class="ph-chain-title">
        <span class="small">Started by</span> <PlayerChip p={starter} size={28} />
      </div>
      {chain.e.slice(0, upto + 1).map((e, i) => {
        const key = `${g.ci}-${i}`;
        const likes = (g.likes && g.likes[key]) || [];
        const liked = likes.includes(me);
        const latest = i === upto;
        const verb = i === 0 ? 'wrote' : e.b !== undefined ? 'drew' : 'thought it was';
        return (
          <div class={'ph-entry' + (latest ? ' slide-in' : '')} key={key}>
            <div class="row spread">
              <span class="small">
                <PlayerChip p={s.players[e.p]} size={22} /> <span class="muted">{verb}</span>
              </span>
              {e.p !== me && (
                <button
                  class={'like-pill' + (liked ? ' on' : '')}
                  onClick={() => {
                    sfx('tap');
                    gsend({ t: 'like', c: g.ci, e: i });
                  }}
                  aria-label="Like"
                >
                  <Icon name="heart" size={16} /> {likes.length || ''}
                </button>
              )}
              {e.p === me && likes.length > 0 && (
                <span class="like-pill on">
                  <Icon name="heart" size={16} /> {likes.length}
                </span>
              )}
            </div>
            {e.b !== undefined ? (
              e.b ? (
                <Drawing data={link.blob(e.b)} animate={latest} ms={1800} />
              ) : (
                <div class="ph-blank">(blank page)</div>
              )
            ) : (
              <div class="ph-text game-font">{e.t}</div>
            )}
          </div>
        );
      })}
      {g.phase === 'chainEnd' && (
        <div class="ph-end pop-in">
          <span class="small">Started as</span>
          <strong class="game-font">“{chain.e[0] && chain.e[0].t}”</strong>
          <Timer g={g} label="Next chain" />
        </div>
      )}
      <div ref={endRef} />
    </div>
  );
}
