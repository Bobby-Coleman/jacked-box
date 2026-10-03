import { useStore, Timer, send } from '../ui/common.jsx';
import { GAMES } from '../games/logic.js';
import { GAME_META, GameGlyph } from '../games/meta.jsx';
import { VIEWS } from '../games/views.js';
import { sfx } from '../audio/sfx.js';

export function GameScreen() {
  const st = useStore();
  const link = st.link;
  const s = link.state;
  const g = s.game;
  const meId = link.me.id;
  const m = GAME_META[g.id] || {};
  const View = VIEWS[g.id];
  const me = s.players[meId];
  const role = g.pids.includes(meId) ? 'player' : me && me.screen ? 'screen' : 'audience';
  return (
    <div class={`game theme-${g.id}`} style={{ '--gbg': m.bg, '--gfg': m.fg, '--gac': m.accent }}>
      {g.phase === 'intro' ? (
        <Intro s={s} g={g} meId={meId} />
      ) : View ? (
        <View s={s} g={g} me={meId} role={role} link={link} />
      ) : (
        <div class="screen">Unknown game.</div>
      )}
    </div>
  );
}

function Intro({ s, g, meId }) {
  const mod = GAMES[g.id];
  const isVip = s.vip === meId;
  return (
    <div class="screen intro">
      <div class="intro-title pop-in">
        <span class="glyph-disc big">
          <GameGlyph id={g.id} size={64} />
        </span>
        <h1 class="stencil">{mod.name}</h1>
        <p class="intro-tag">{mod.tagline}</p>
      </div>
      <ol class="rules">
        {mod.rules.map((r, i) => (
          <li key={i} class="slide-in" style={{ animationDelay: `${0.15 + i * 0.12}s` }}>
            {r}
          </li>
        ))}
      </ol>
      <div class="grow" />
      <Timer g={g} label="Starting in" />
      {isVip ? (
        <button
          class="btn primary"
          onClick={() => {
            sfx('pop');
            send('skip', {});
          }}
        >
          Got it, let's go
        </button>
      ) : (
        <p class="center-text small" style={{ margin: 0, opacity: 0.8 }}>
          The VIP can skip the rules.
        </p>
      )}
    </div>
  );
}
