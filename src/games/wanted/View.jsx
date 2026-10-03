import { useEffect, useRef, useState } from 'preact/hooks';
import { Timer, AnswerBox, gsend, useFinalTicks, fmtScore, PlayerChip, toast } from '../../ui/common.jsx';
import { PlayerAvatar } from '../../ui/Avatar.jsx';
import { playerImageSrc, loadImage } from '../../ui/faces.jsx';
import { RoundHeader, SentCard, Spectate, useStepSound, Voters } from '../shared.jsx';
import { CRIME_IDEAS } from '../../content/faces.js';
import { sfx } from '../../audio/sfx.js';
import { vibrate, saveImage } from '../../platform.js';
import './wanted.css';

function Poster({ s, P, crime, bounty, stamp, compact }) {
  const p = s.players[P.target];
  const src = playerImageSrc(p);
  return (
    <div class={'wt-poster pop-in' + (compact ? ' compact' : '')}>
      <div class="wt-wanted">WANTED</div>
      <div class="wt-sub">DEAD OR ALIVE</div>
      <div class="wt-photo">{src ? <img src={src} alt={p ? p.name : ''} /> : <PlayerAvatar p={p} size={140} />}</div>
      <div class="wt-name">{p ? p.name : 'Unknown'}</div>
      {crime && <div class="wt-crime">for {crime}</div>}
      {bounty != null && <div class="wt-bounty">Reward ${bounty.toLocaleString('en-US')}</div>}
      {stamp && <div class="wt-stamp">{stamp}</div>}
    </div>
  );
}

// Draw a poster onto a canvas for saving/sharing.
async function posterPng(s, P, crime, bounty) {
  const W = 800;
  const H = 1060;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const x = c.getContext('2d');
  x.fillStyle = '#e9d3a5';
  x.fillRect(0, 0, W, H);
  x.strokeStyle = '#5a3a1a';
  x.lineWidth = 16;
  x.strokeRect(24, 24, W - 48, H - 48);
  x.fillStyle = '#3b2412';
  x.textAlign = 'center';
  x.font = '900 150px Impact, "Arial Black", sans-serif';
  x.fillText('WANTED', W / 2, 200);
  x.font = '700 40px Georgia, serif';
  x.fillText('DEAD OR ALIVE', W / 2, 255);
  const img = await loadImage(playerImageSrc(s.players[P.target]));
  if (img) {
    x.save();
    x.filter = 'sepia(0.8) contrast(1.1)';
    x.drawImage(img, 160, 290, 480, 480);
    x.restore();
    x.lineWidth = 8;
    x.strokeRect(160, 290, 480, 480);
  }
  x.font = '900 72px Impact, "Arial Black", sans-serif';
  x.fillText(((s.players[P.target] && s.players[P.target].name) || '').toUpperCase(), W / 2, 860);
  x.font = 'italic 34px Georgia, serif';
  const words = ('for ' + crime).split(' ');
  let line = '';
  let y = 915;
  for (const w of words) {
    const t = line ? line + ' ' + w : w;
    if (x.measureText(t).width > W - 140) {
      x.fillText(line, W / 2, y);
      y += 42;
      line = w;
    } else line = t;
  }
  x.fillText(line, W / 2, y);
  x.font = '900 46px Impact, "Arial Black", sans-serif';
  x.fillText(`REWARD $${bounty.toLocaleString('en-US')}`, W / 2, H - 60);
  return c.toDataURL('image/png');
}

export default function WantedView({ s, g, me, role }) {
  useStepSound(g, { write: 'bell', vote: 'whoosh', verdict: 'bang' });
  useFinalTicks(g, g.phase === 'write' || g.phase === 'vote');
  if (g.phase === 'write') return <Write s={s} g={g} me={me} role={role} />;
  const P = g.posters[g.pi];
  if (!P) return null;
  const head = <RoundHeader left={`Poster ${g.pi + 1} of ${g.posters.length}`} right="Most Wanted" />;
  if (g.phase === 'vote') return <Vote s={s} g={g} P={P} me={me} role={role} head={head} />;
  return <Verdict s={s} g={g} P={P} me={me} head={head} />;
}

function Write({ s, g, me, role }) {
  const jobs = g.posters.map((P, i) => ({ P, i })).filter(({ P }) => P.w.includes(me));
  const todo = jobs.find(({ P }) => !P.crimes[me]);
  const [idea, setIdea] = useState(null);
  const doneFn = (pid) => g.posters.filter((P) => P.w.includes(pid)).every((P) => P.crimes[pid]);
  const head = <RoundHeader left="Write the charges" right="Most Wanted" />;
  if (role !== 'player' || !jobs.length) {
    return (
      <div class="screen">
        {head}
        <Spectate text="The accusers are writing up charges…" />
        <Timer g={g} />
        <SentCard s={s} pids={g.pids} done={doneFn} title="Investigating…" sub="" />
      </div>
    );
  }
  if (!todo) {
    return (
      <div class="screen">
        {head}
        <Timer g={g} />
        <SentCard s={s} pids={g.pids} done={doneFn} title="Charges filed" sub="Waiting for the other detectives…" />
      </div>
    );
  }
  return (
    <div class="screen">
      {head}
      <Timer g={g} />
      <span class="eyebrow">
        Charge {jobs.indexOf(todo) + 1} of {jobs.length}
      </span>
      <Poster s={s} P={todo.P} compact key={todo.i} />
      <span class="eyebrow center-text">What is {s.players[todo.P.target] ? s.players[todo.P.target].name : 'this outlaw'} wanted for?</span>
      <AnswerBox g={g} id={'wt' + todo.i} max={70} placeholder="Eating the last slice and blaming the dog" onSubmit={(text) => gsend({ t: 'crime', i: todo.i, text })} cta="File the charge" />
      {idea ? (
        <div class="row" style={{ justifyContent: 'center', gap: 8, flexWrap: 'wrap' }}>
          <button
            class="btn sm yellow"
            onClick={() => {
              sfx('submit');
              gsend({ t: 'crime', i: todo.i, text: idea });
              setIdea(null);
            }}
          >
            Use “{idea}”
          </button>
          <button class="btn ghost sm" onClick={() => setIdea(CRIME_IDEAS[Math.floor(Math.random() * CRIME_IDEAS.length)])}>
            Another
          </button>
        </div>
      ) : (
        <button class="btn ghost sm" style={{ alignSelf: 'center' }} onClick={() => setIdea(CRIME_IDEAS[Math.floor(Math.random() * CRIME_IDEAS.length)])}>
          Need an idea?
        </button>
      )}
    </div>
  );
}

function Vote({ s, g, P, me, role, head }) {
  const mine = P.votes[me];
  const isWriter = P.w.includes(me);
  const canVote = !isWriter && (role === 'player' || role === 'audience');
  const authors = Object.keys(P.crimes);
  return (
    <div class="screen">
      {head}
      <Poster s={s} P={P} />
      <Timer g={g} />
      <span class="eyebrow center-text">{isWriter ? "You wrote one of these. Hands off." : P.target === me ? "They're accusing YOU. Which charge sticks?" : 'Which charge sticks?'}</span>
      <div class="col">
        {authors.map((a, i) => (
          <button
            key={a}
            class={'wt-charge' + (mine === a ? ' on' : '')}
            disabled={!canVote}
            onClick={() => {
              sfx('pop');
              vibrate(25);
              gsend({ t: 'vote', w: a });
            }}
          >
            <span class="wt-num">{i === 0 ? 'A' : 'B'}</span>
            <span>for {P.crimes[a]}</span>
            {a === me && <span class="badge paper">Yours</span>}
          </button>
        ))}
      </div>
    </div>
  );
}

function Verdict({ s, g, P, me, head }) {
  const counts = P.counts || {};
  const save = async () => {
    const url = await posterPng(s, P, P.crimes[P.winner], P.bounty);
    const r = await saveImage(url, 'wanted.png');
    if (r === 'downloaded') toast('Saved');
  };
  return (
    <div class="screen">
      {head}
      <Poster s={s} P={P} crime={P.crimes[P.winner]} bounty={P.bounty} stamp="CHARGED" />
      <div class="col" style={{ gap: 6 }}>
        {Object.keys(P.crimes).map((a) => {
          const vs = Object.entries(P.votes)
            .filter(([, w]) => w === a)
            .map(([v]) => v);
          return (
            <div class={'score-row' + (a === P.winner ? ' wt-win' : '')} key={a}>
              <PlayerAvatar p={s.players[a]} size={28} />
              <span class="nm">{s.players[a] ? s.players[a].name : '?'}</span>
              <Voters s={s} ids={vs} size={20} />
              <span class="sc">+{fmtScore(P.pts[a] || 0)}</span>
            </div>
          );
        })}
      </div>
      <button class="btn sm" style={{ alignSelf: 'center' }} onClick={save}>
        Save this poster
      </button>
    </div>
  );
}
