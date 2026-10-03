import { useEffect, useRef, useState } from 'preact/hooks';
import { Timer, gsend, useFinalTicks, fmtScore, toast } from '../../ui/common.jsx';
import { PlayerAvatar } from '../../ui/Avatar.jsx';
import { FaceCam } from '../../ui/FaceCam.jsx';
import { loadImage } from '../../ui/faces.jsx';
import { RoundHeader, SentCard, Spectate, useStepSound, Voters } from '../shared.jsx';
import { sfx } from '../../audio/sfx.js';
import { vibrate, saveImage } from '../../platform.js';
import './pull.css';

function nameOf(s, pid) {
  return (s.players[pid] && s.players[pid].name) || 'Someone';
}

function snapSrc(link, id) {
  const b = id && link ? link.blob(id) : null;
  return b && typeof b.img === 'string' ? b.img : null;
}

function Snap({ src, label, big }) {
  return (
    <div class={'pf-snap' + (big ? ' big' : '')}>
      {src ? <img src={src} alt={label || ''} /> : <div class="pf-dev">Developing…</div>}
    </div>
  );
}

export default function PullView({ s, g, me, role, link }) {
  useStepSound(g, { snap: 'bell', vote: 'whoosh', reveal: 'drumroll' });
  useFinalTicks(g, g.phase === 'snap' || g.phase === 'vote');
  const r = g.r;
  if (!r) return null;
  const head = <RoundHeader left={r.copy ? 'Final round: COPYCAT' : `Round ${g.round} of ${g.rounds}`} right="Pull a Face" />;
  if (g.phase === 'snap') return <SnapPhase s={s} g={g} r={r} me={me} role={role} link={link} head={head} />;
  if (g.phase === 'vote') return <Vote s={s} g={g} r={r} me={me} role={role} link={link} head={head} />;
  return <Reveal s={s} g={g} r={r} me={me} link={link} head={head} />;
}

function PromptCard({ r, mine, s, link }) {
  if (r.copy) {
    const c = mine;
    if (!c) return <div class="pf-prompt pop-in">Copycat round: recreate a friend's face.</div>;
    return (
      <div class="pf-prompt pf-copy pop-in">
        <Snap src={snapSrc(link, c.blob)} label="The face to copy" />
        <div class="col" style={{ gap: 2 }}>
          <span class="eyebrow">Copy {nameOf(s, c.by)}'s face</span>
          <span>“{c.prompt}”</span>
        </div>
      </div>
    );
  }
  return <div class="pf-prompt pop-in">{r.prompt}</div>;
}

function SnapPhase({ s, g, r, me, role, link, head }) {
  const need = r.copy ? Object.keys(r.copy) : g.pids;
  const sent = !!r.snaps[me];
  const [pending, setPending] = useState(false);
  useEffect(() => setPending(false), [g.step]);
  const doneFn = (p) => r.snaps[p];
  const mine = r.copy ? r.copy[me] : null;
  if (role !== 'player' || (r.copy && !mine)) {
    return (
      <div class="screen">
        {head}
        <PromptCard r={r} s={s} link={link} />
        <Spectate text="Everyone's pulling faces. Hang tight." />
        <Timer g={g} />
        <SentCard s={s} pids={need} done={doneFn} title="Snapping…" sub="" />
      </div>
    );
  }
  if (sent || pending) {
    return (
      <div class="screen">
        {head}
        <PromptCard r={r} mine={mine} s={s} link={link} />
        <Timer g={g} />
        <SentCard s={s} pids={need} done={doneFn} title="Snapped!" sub="Waiting for the other faces…" />
      </div>
    );
  }
  return (
    <div class="screen">
      {head}
      <Timer g={g} />
      <PromptCard r={r} mine={mine} s={s} link={link} />
      <FaceCam
        inline
        key={g.step}
        title=""
        hint={r.copy ? 'Match it as closely as you can.' : 'Act it out. Commit to the bit.'}
        doneLabel="Send it"
        note="Only this room sees your snaps. They vanish when the game ends."
        onDone={(img) => {
          setPending(true);
          vibrate(30);
          gsend({ t: 'snap', img });
        }}
      />
    </div>
  );
}

function Vote({ s, g, r, me, role, link, head }) {
  const authors = Object.keys(r.snaps);
  const mineVote = r.votes[me];
  const canVote = role === 'player' || role === 'audience';
  return (
    <div class="screen">
      {head}
      {r.copy ? <div class="pf-prompt small">Best impression?</div> : <div class="pf-prompt small">{r.prompt}</div>}
      <Timer g={g} />
      <div class={'pf-grid' + (r.copy ? ' copy' : '')}>
        {authors.map((a) => {
          const own = a === me;
          const c = r.copy && r.copy[a];
          return (
            <button
              key={a}
              class={'pf-tile' + (mineVote === a ? ' on' : '') + (own ? ' own' : '')}
              disabled={own || !canVote}
              onClick={() => {
                sfx('pop');
                vibrate(20);
                gsend({ t: 'vote', p: a });
              }}
            >
              {c ? (
                <div class="pf-pair">
                  <Snap src={snapSrc(link, c.blob)} label="Original" />
                  <Snap src={snapSrc(link, r.snaps[a])} label="Copy" />
                </div>
              ) : (
                <Snap src={snapSrc(link, r.snaps[a])} label={nameOf(s, a)} />
              )}
              <span class="pf-name">{own ? 'You' : c ? `${nameOf(s, a)} as ${nameOf(s, c.by)}` : nameOf(s, a)}</span>
            </button>
          );
        })}
      </div>
      <span class="small center-text" style={{ opacity: 0.8 }}>
        {mineVote ? 'Vote locked. You can change it until time runs out.' : 'Tap your favorite face.'}
      </span>
    </div>
  );
}

// A shareable contact sheet: every face from the round in a grid, with the prompt on top.
async function contactSheet(r, list) {
  const cols = list.length <= 4 ? 2 : 3;
  const rows = Math.ceil(list.length / cols);
  const cell = 300;
  const pad = 24;
  const top = 120;
  const W = cols * cell + (cols + 1) * pad;
  const H = top + rows * (cell + 54) + pad;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const x = c.getContext('2d');
  x.fillStyle = '#111';
  x.fillRect(0, 0, W, H);
  x.fillStyle = '#ffd400';
  x.textAlign = 'center';
  x.font = '900 44px Impact, "Arial Black", sans-serif';
  x.fillText('PULL A FACE', W / 2, 58);
  x.fillStyle = '#fff';
  x.font = '600 26px system-ui, sans-serif';
  x.fillText((r.prompt || 'Copycat round').slice(0, 60), W / 2, 96);
  for (let i = 0; i < list.length; i++) {
    const it = list[i];
    const cx = pad + (i % cols) * (cell + pad);
    const cy = top + Math.floor(i / cols) * (cell + 54);
    const img = await loadImage(it.src);
    x.fillStyle = '#fff';
    x.fillRect(cx - 6, cy - 6, cell + 12, cell + 48);
    if (img) x.drawImage(img, cx, cy, cell, cell);
    x.fillStyle = '#111';
    x.font = '800 24px system-ui, sans-serif';
    x.fillText(`${it.name}${it.votes ? `  ★${it.votes}` : ''}`.slice(0, 26), cx + cell / 2, cy + cell + 32);
  }
  return c.toDataURL('image/jpeg', 0.9);
}

function Reveal({ s, g, r, me, link, head }) {
  const once = useRef(false);
  useEffect(() => {
    if (once.current) return;
    once.current = true;
    if (r.winners && r.winners.includes(me)) sfx('fanfare');
    else sfx('reveal');
  }, []);
  const rows = Object.keys(r.snaps).sort((a, b) => (r.tally[b] || 0) - (r.tally[a] || 0));
  const top = rows[0];
  const save = async () => {
    const list = rows.map((a) => ({ src: snapSrc(link, r.snaps[a]), name: nameOf(s, a), votes: r.tally[a] || 0 })).filter((x) => x.src);
    const url = await contactSheet(r, list);
    const res = await saveImage(url, 'pull-a-face.jpg');
    if (res === 'downloaded') toast('Saved');
  };
  return (
    <div class="screen">
      {head}
      {top && r.winners && r.winners.length > 0 ? (
        <div class="pf-winner pop-in">
          <Snap src={snapSrc(link, r.snaps[top])} label={nameOf(s, top)} big />
          <span class="pf-crown" aria-hidden="true">
            ★
          </span>
          <strong class="stencil">{r.winners.length > 1 ? 'Tie!' : nameOf(s, top)}</strong>
        </div>
      ) : (
        <div class="pf-prompt small">No votes this round</div>
      )}
      <div class="col" style={{ gap: 6 }}>
        {rows.map((a) => {
          const vs = Object.entries(r.votes)
            .filter(([, w]) => w === a)
            .map(([v]) => v);
          return (
            <div class="score-row" key={a}>
              <PlayerAvatar p={s.players[a]} size={28} />
              <span class="nm">{nameOf(s, a)}</span>
              <Voters s={s} ids={vs} size={20} />
              <span class="sc">+{fmtScore(r.pts[a] || 0)}</span>
            </div>
          );
        })}
      </div>
      <button class="btn sm" style={{ alignSelf: 'center' }} onClick={save}>
        Save the contact sheet
      </button>
    </div>
  );
}
