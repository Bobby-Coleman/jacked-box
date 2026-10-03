import { useEffect, useRef, useState } from 'preact/hooks';
import { Timer, gsend, useFinalTicks, useNow, fmtScore, PlayerChip, toast } from '../../ui/common.jsx';
import { PlayerAvatar } from '../../ui/Avatar.jsx';
import { DrawPad, Drawing, isBlank, drawingToDataUrl } from '../../ui/DrawPad.jsx';
import { playerImageSrc } from '../../ui/faces.jsx';
import { RoundHeader, SentCard, Spectate, useStepSound, Voters } from '../shared.jsx';
import { sfx } from '../../audio/sfx.js';
import { saveImage } from '../../platform.js';
import { PALETTE, sceneText } from './logic.js';
import './photo.css';

function nameOf(s, pid) {
  return (s.players[pid] && s.players[pid].name) || 'Someone';
}

function facesFor(s, art) {
  return { a: playerImageSrc(s.players[art.a]), b: playerImageSrc(s.players[art.b]) };
}

function titleOf(s, art) {
  return sceneText(art.tpl, nameOf(s, art.a), nameOf(s, art.b));
}

export default function PhotoView({ s, g, me, role, link }) {
  useStepSound(g, { draw: 'bell', gallery: 'whoosh', vote: 'pop', reveal: 'drumroll' });
  useFinalTicks(g, g.phase === 'draw' || g.phase === 'vote');
  const head = <RoundHeader left={g.rounds > 1 ? `Round ${g.round} of ${g.rounds}` : 'Photobomb'} right={g.phase === 'gallery' ? `Gallery ${g.gi + 1} of ${g.queue.length}` : null} />;
  if (g.phase === 'draw') return <DrawPhase s={s} g={g} me={me} role={role} head={head} />;
  if (g.phase === 'gallery') return <Gallery s={s} g={g} link={link} head={head} />;
  if (g.phase === 'vote') return <Vote s={s} g={g} me={me} role={role} link={link} head={head} />;
  return <Reveal s={s} g={g} me={me} link={link} head={head} />;
}

function DrawPhase({ s, g, me, role, head }) {
  const mine = g.art[me];
  const [data, setData] = useState(null);
  const sent = useRef(false);
  const t = useNow(250);
  const submit = () => {
    if (sent.current || !data) return;
    sent.current = true;
    sfx('submit');
    gsend({ t: 'draw', d: { s: data.s, k: data.k } });
  };
  useEffect(() => {
    sent.current = !!(mine && mine.blob);
  }, [g.step]);
  useEffect(() => {
    // Auto-submit near the buzzer (stickers alone still count).
    if (!sent.current && g.until && g.until - t < 1000 && data) submit();
  });
  const doneFn = (p) => g.art[p] && g.art[p].blob;
  if (role !== 'player' || !mine) {
    return (
      <div class="screen">
        {head}
        <Spectate text="Artists are photobombing their friends. Hang tight." />
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
        <SentCard s={s} pids={Object.keys(g.art)} done={doneFn} title="Framed!" sub="Waiting for the other artists…" />
      </div>
    );
  }
  const stickers = [
    { who: 'a', src: playerImageSrc(s.players[mine.a]) },
    { who: 'b', src: playerImageSrc(s.players[mine.b]) },
  ];
  return (
    <div class="screen pb-draw">
      {head}
      <div class="pb-prompt">
        <span class="eyebrow">Draw this scene</span>
        <strong class="game-font">{titleOf(s, mine)}</strong>
        <span class="row" style={{ gap: 6 }}>
          <PlayerChip p={s.players[mine.a]} size={22} />
          <span class="small">+</span>
          <PlayerChip p={s.players[mine.b]} size={22} />
        </span>
      </div>
      <DrawPad palette={PALETTE} stickers={stickers} onChange={setData} />
      <Timer g={g} />
      <button class="btn primary" disabled={!data || (isBlank(data) && !data.k)} onClick={submit}>
        Frame it
      </button>
    </div>
  );
}

function Gallery({ s, g, link, head }) {
  const artist = g.queue[g.gi];
  const art = g.art[artist];
  if (!art) return null;
  return (
    <div class="screen">
      {head}
      <div class="pb-frame pop-in" key={g.gi}>
        <div class="pb-plaque">
          <strong class="game-font">{titleOf(s, art)}</strong>
          <span class="small">
            by <PlayerChip p={s.players[artist]} size={20} />
          </span>
        </div>
        <Drawing data={link.blob(art.blob)} faces={facesFor(s, art)} animate ms={2200} label={titleOf(s, art)} />
      </div>
      <p class="center-text small" style={{ margin: 0, fontWeight: 700 }}>
        Throw reactions with the smiley button up top!
      </p>
    </div>
  );
}

function Vote({ s, g, me, role, link, head }) {
  const [picks, setPicks] = useState([]);
  const locked = !!g.votes[me];
  const canVote = role === 'player' || role === 'audience';
  const toggle = (pid) => {
    if (locked || pid === me) return;
    sfx('tap');
    setPicks((p) => (p.includes(pid) ? p.filter((x) => x !== pid) : p.length >= 2 ? [p[1], pid] : [...p, pid]));
  };
  return (
    <div class="screen">
      {head}
      <Timer g={g} />
      <span class="eyebrow center-text">{locked ? 'Votes in. Nice taste.' : 'Pick your two favorites'}</span>
      <div class="pb-grid">
        {g.queue.map((pid) => {
          const art = g.art[pid];
          const on = picks.includes(pid) || (locked && g.votes[me].includes(pid));
          return (
            <button key={pid} class={'pb-thumb' + (on ? ' on' : '') + (pid === me ? ' own' : '')} disabled={!canVote || locked || pid === me} onClick={() => toggle(pid)}>
              <Drawing data={link.blob(art.blob)} faces={facesFor(s, art)} label={titleOf(s, art)} />
              <span class="pb-thumb-title">{titleOf(s, art)}</span>
              {pid === me && <span class="badge paper">Yours</span>}
              {on && <span class="badge red">{(locked ? g.votes[me] : picks).indexOf(pid) === 0 ? '1st' : '2nd'}</span>}
            </button>
          );
        })}
      </div>
      {canVote && !locked && (
        <button
          class="btn primary"
          disabled={!picks.length}
          onClick={() => {
            sfx('submit');
            gsend({ t: 'vote', picks });
          }}
        >
          Vote ({picks.length}/2)
        </button>
      )}
    </div>
  );
}

function Reveal({ s, g, me, link, head }) {
  const tally = g.tally || {};
  const ranked = g.queue.slice().sort((a, b) => (tally[b] || 0) - (tally[a] || 0));
  const save = async (pid) => {
    const art = g.art[pid];
    const data = link.blob(art.blob);
    if (!data) return;
    const url = await drawingToDataUrl(data, facesFor(s, art));
    const r = await saveImage(url, 'photobomb.png');
    if (r === 'downloaded') toast('Saved');
  };
  return (
    <div class="screen">
      {head}
      <div class="col">
        {ranked.map((pid, i) => {
          const art = g.art[pid];
          const voters = Object.entries(g.votes || {})
            .filter(([, ps]) => ps.includes(pid))
            .map(([v]) => v);
          return (
            <div class={'pb-result slide-in' + (i === 0 && tally[pid] ? ' top' : '')} key={pid} style={{ animationDelay: `${i * 0.15}s` }}>
              <div class="pb-result-art">
                <Drawing data={link.blob(art.blob)} faces={facesFor(s, art)} label={titleOf(s, art)} />
              </div>
              <div class="col" style={{ gap: 4, minWidth: 0, flex: 1 }}>
                <strong class="game-font pb-result-title">{titleOf(s, art)}</strong>
                <PlayerChip p={s.players[pid]} size={22} />
                <Voters s={s} ids={voters} size={20} />
                <span class="row spread" style={{ gap: 6 }}>
                  <strong>+{fmtScore((tally[pid] || 0) * 500)}</strong>
                  <button class="btn sm" onClick={() => save(pid)}>
                    Save
                  </button>
                </span>
              </div>
            </div>
          );
        })}
      </div>
      <Timer g={g} label={g.round < g.rounds ? 'Next round in' : 'Final scores in'} />
    </div>
  );
}
