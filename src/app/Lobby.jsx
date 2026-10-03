import { useEffect, useRef } from 'preact/hooks';
import { useStore, Icon, send } from '../ui/common.jsx';
import { PlayerAvatar } from '../ui/Avatar.jsx';
import { GAME_LIST } from '../games/logic.js';
import { GAME_META, GameGlyph } from '../games/meta.jsx';
import { sfx } from '../audio/sfx.js';
import { appUrl } from '../platform.js';

// Hidden test mode: add ?dev=1 to the URL to get bot players in the lobby.
const DEV = typeof location !== 'undefined' && new URLSearchParams(location.search).has('dev');

export function Lobby({ onShare, onEditMe }) {
  const st = useStore();
  const link = st.link;
  const s = link.state;
  const meId = link.me.id;
  const isVip = s.vip === meId;
  const players = s.order.map((id) => s.players[id]).filter((p) => p && !p.screen);
  const screens = s.order.map((id) => s.players[id]).filter((p) => p && p.screen);
  const active = players.filter((p) => p.on !== false).length;
  const vip = s.players[s.vip];
  const host = appUrl().replace(/^https?:\/\//, '').replace(/\/$/, '');

  // Little "boing" when someone new arrives.
  const count = useRef(players.length);
  useEffect(() => {
    if (players.length > count.current) sfx('pop');
    count.current = players.length;
  }, [players.length]);

  const empties = Math.max(0, 4 - players.length);

  return (
    <div class="screen lobby">
      <section class="label tape code-label" aria-label="Room code">
        <span class="eyebrow">Room code</span>
        <button class="code-big stencil" onClick={onShare} aria-label={`Room code ${s.code}. Tap to share.`}>
          {s.code.split('').map((c, i) => (
            <span key={i}>{c}</span>
          ))}
        </button>
        <p class="small" style={{ margin: 0 }}>
          Friends join at <strong>{host}</strong>
        </p>
        <button class="btn sm blue" onClick={onShare}>
          <Icon name="qr" /> Invite: QR & link
        </button>
      </section>

      <section class="col" aria-label="Players">
        <div class="row spread">
          <span class="eyebrow">
            {players.length} {players.length === 1 ? 'player' : 'players'}
            {screens.length ? ` + ${screens.length} table screen` : ''}
          </span>
          <button class="btn sm ghost" onClick={onEditMe}>
            Change my look
          </button>
        </div>
        <div class="roster">
          {players.map((p) => (
            <div class={'roster-item pop-in' + (p.on === false ? ' off' : '')} key={p.id}>
              <PlayerAvatar p={p} size={64} />
              <span class="nm" style={{ color: p.id === meId ? 'var(--stamp-dk)' : undefined }}>
                {p.name}
              </span>
              {p.id === s.vip && <span class="badge vip-badge">VIP</span>}
            </div>
          ))}
          {Array.from({ length: empties }).map((_, i) => (
            <div class="roster-item empty" key={'e' + i}>
              <div class="slot" />
              <span class="nm muted small">waiting…</span>
            </div>
          ))}
        </div>
      </section>

      {isVip && DEV && (
        <div class="row" style={{ justifyContent: 'center' }}>
          <button class="btn sm" onClick={() => send('addbot', {})}>
            + Add test bot
          </button>
          {players.some((p) => p.bot) && (
            <button class="btn sm ghost" onClick={() => send('dropbots', {})}>
              Remove bots
            </button>
          )}
        </div>
      )}

      {isVip ? (
        <GamePicker s={s} active={active} />
      ) : (
        <section class="col">
          <div class="label tight center-text">
            <strong>{vip ? vip.name : 'The VIP'}</strong> is picking a game.
          </div>
          {s.pick && <GameCard id={s.pick} active={active} selected />}
        </section>
      )}
    </div>
  );
}

function GamePicker({ s, active }) {
  const pick = s.pick;
  return (
    <section class="col" aria-label="Pick a game">
      <span class="eyebrow">You're the VIP. Pick a game.</span>
      <div class="game-list">
        {GAME_LIST.map((mod) => (
          <div key={mod.id} class="col" style={{ gap: 8 }}>
            <GameCard
              id={mod.id}
              active={active}
              selected={pick === mod.id}
              onClick={() => {
                sfx('tap');
                send('pick', { id: pick === mod.id ? null : mod.id });
              }}
            />
            {pick === mod.id && (
              <button
                class="btn primary slide-in"
                disabled={active < mod.min}
                onClick={() => {
                  sfx('bell');
                  send('start', { id: mod.id });
                }}
              >
                {active < mod.min ? `Need ${mod.min - active} more ${mod.min - active === 1 ? 'player' : 'players'}` : `Start ${mod.name}`}
              </button>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

export function GameCard({ id, active, selected, onClick }) {
  const mod = GAME_LIST.find((g) => g.id === id);
  const m = GAME_META[id];
  if (!mod || !m) return null;
  const tooFew = active < mod.min;
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      class={'game-card' + (selected ? ' selected' : '') + (tooFew ? ' dim' : '')}
      style={{ '--gbg': m.bg, '--gfg': m.fg, '--gac': m.accent }}
      onClick={onClick}
      aria-pressed={onClick ? selected : undefined}
      aria-label={`${mod.name}: ${mod.tagline} ${mod.min} to ${mod.max} players.`}
    >
      <span class="glyph-disc">
        <GameGlyph id={id} size={40} />
      </span>
      <span class="gc-body">
        <span class="gc-name stencil">{mod.name}</span>
        <span class="gc-tag">{mod.tagline}</span>
        <span class="gc-meta">
          {mod.min}–{mod.max} players · ~{mod.minutes} min
          {mod.tags && mod.tags.length ? ' · ' + mod.tags.join(' · ') : ''}
        </span>
      </span>
    </Tag>
  );
}
