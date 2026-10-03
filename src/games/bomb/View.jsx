import { useEffect, useRef } from 'preact/hooks';
import { Timer, gsend, useNow, PlayerChip } from '../../ui/common.jsx';
import { PlayerAvatar } from '../../ui/Avatar.jsx';
import { RoundHeader } from '../shared.jsx';
import { sfx } from '../../audio/sfx.js';
import { vibrate } from '../../platform.js';
import { store } from '../../app/session.js';
import './bomb.css';

function Hearts({ n }) {
  return (
    <span class="bm-hearts" aria-label={`${n} lives`}>
      {[0, 1, 2].map((i) => (
        <span key={i} class={'bm-heart' + (i < n ? '' : ' lost')}>
          ♥
        </span>
      ))}
    </span>
  );
}

function BombSvg({ size = 160, lit = true }) {
  return (
    <svg viewBox="0 0 120 120" width={size} height={size} aria-hidden="true" class="bm-svg">
      <g stroke="#1d1611" stroke-width="4" stroke-linejoin="round" stroke-linecap="round">
        <circle cx="54" cy="70" r="40" fill="#2a2a2a" />
        <rect x="70" y="24" width="20" height="16" rx="3" transform="rotate(35 80 32)" fill="#555" />
        <path d="M86 22 Q96 8 108 12" fill="none" />
        <circle cx="40" cy="56" r="9" fill="#fff" opacity="0.25" stroke="none" />
      </g>
      {lit && (
        <g class="bm-spark">
          <circle cx="108" cy="12" r="7" fill="#ffc928" />
          <path d="M108 0v6M120 12h-6M108 24v-6M96 12h6M116 4l-4 4M116 20l-4-4M100 4l4 4" stroke="#ff8a1f" stroke-width="3" stroke-linecap="round" />
        </g>
      )}
    </svg>
  );
}

export default function BombView({ s, g, me, role }) {
  const r = g.r;
  if (!r) return null;
  const head = <RoundHeader left={`Round ${g.round}`} right="Tick Tock Boom" />;
  return (
    <div class={'screen bm-screen' + (g.phase === 'live' && r.holder === me ? ' holding' : '')}>
      {g.phase !== 'live' || r.holder !== me ? head : null}
      {g.phase === 'ready' && <Ready s={s} g={g} r={r} me={me} />}
      {g.phase === 'live' && (r.holder === me ? <Holding g={g} r={r} /> : <Watching s={s} g={g} r={r} me={me} />)}
      {g.phase === 'boom' && <Boom s={s} g={g} r={r} me={me} />}
      {!(g.phase === 'live' && r.holder === me) && <LivesTable s={s} g={g} me={me} />}
    </div>
  );
}

function Ready({ s, g, r, me }) {
  return (
    <>
      <div class="bm-cat pop-in">
        <span class="eyebrow">Category</span>
        <strong class="game-font">{r.cat}</strong>
      </div>
      <div class="bm-instr">
        Phones face up on the table! The bomb starts with <PlayerChip p={s.players[r.holder]} size={24} />
      </div>
      <Timer g={g} label="Lighting the fuse" />
    </>
  );
}

function Holding({ g, r }) {
  const t = useNow(100);
  const tapped = useRef(0);
  // Accelerating tick on THIS phone only, so the whole table hears where the bomb is.
  useEffect(() => {
    sfx('swoop');
    vibrate([60, 40, 60]);
    let stop = false;
    let to;
    const loop = () => {
      if (stop) return;
      const nowH = store.link ? store.link.now() : Date.now();
      const frac = (nowH - r.lit) / r.fuseMs;
      sfx('tick');
      to = setTimeout(loop, frac < 0.5 ? 650 : frac < 0.8 ? 360 : 180);
    };
    loop();
    return () => {
      stop = true;
      clearTimeout(to);
    };
  }, [r.passes]);
  const throwIt = (e) => {
    e.preventDefault();
    const nowL = Date.now();
    if (nowL - tapped.current < 400) return;
    tapped.current = nowL;
    sfx('whoosh');
    vibrate(20);
    gsend({ t: 'pass' });
  };
  const frac = Math.min(1, (t - r.lit) / r.fuseMs);
  return (
    <button class="bm-hold" onPointerDown={throwIt} aria-label="Throw the bomb">
      <span class="bm-hold-cat game-font">{r.cat}</span>
      <span class={'bm-shake' + (frac > 0.8 ? ' fast' : frac > 0.5 ? ' med' : '')}>
        <BombSvg size={190} />
      </span>
      <span class="bm-hold-cta stencil">Shout an answer, then tap to throw!</span>
    </button>
  );
}

function Watching({ s, g, r, me }) {
  const holder = s.players[r.holder];
  const last = useRef(r.holder);
  useEffect(() => {
    if (last.current !== r.holder) {
      last.current = r.holder;
    }
  }, [r.holder]);
  return (
    <>
      <div class="bm-cat">
        <span class="eyebrow">Category</span>
        <strong class="game-font">{r.cat}</strong>
      </div>
      <div class="bm-where pop-in" key={r.passes}>
        <BombSvg size={64} />
        <div class="col" style={{ gap: 2 }}>
          <span class="eyebrow">The bomb is with</span>
          <span class="row" style={{ gap: 8 }}>
            <PlayerAvatar p={holder} size={40} />
            <strong class="stencil bm-holder">{holder ? holder.name : '…'}</strong>
          </span>
        </div>
      </div>
      <p class="center-text" style={{ margin: 0, fontWeight: 700 }}>
        {r.passes} {r.passes === 1 ? 'throw' : 'throws'} so far. Have your answer ready!
      </p>
    </>
  );
}

function Boom({ s, g, r, me }) {
  const mine = r.boom === me;
  const played = useRef(false);
  useEffect(() => {
    if (played.current) return;
    played.current = true;
    if (mine) {
      sfx('boom');
      vibrate([400, 100, 300]);
    } else sfx('bang');
  }, []);
  const p = s.players[r.boom];
  return (
    <div class={'bm-boom' + (mine ? ' mine' : '')}>
      <div class="bm-blast stencil">BOOM!</div>
      <div class="row" style={{ justifyContent: 'center', gap: 10 }}>
        <PlayerAvatar p={p} size={56} />
        <strong class="stencil" style={{ fontSize: '2rem' }}>
          {mine ? 'You blew up!' : `${p ? p.name : 'Someone'} blew up!`}
        </strong>
      </div>
      <p class="center-text" style={{ margin: 0 }}>
        The fuse was {(r.fuseMs / 1000).toFixed(1)} seconds. The bomb was thrown {r.passes} times.
      </p>
      <Timer g={g} label="Next round" />
    </div>
  );
}

function LivesTable({ s, g, me }) {
  return (
    <div class="bm-lives">
      {g.pids
        .filter((p) => s.players[p])
        .map((pid) => (
          <div class={'bm-life' + (pid === me ? ' me' : '') + (g.lives[pid] <= 0 ? ' out' : '')} key={pid}>
            <PlayerChip p={s.players[pid]} size={22} />
            <Hearts n={g.lives[pid] || 0} />
          </div>
        ))}
    </div>
  );
}
