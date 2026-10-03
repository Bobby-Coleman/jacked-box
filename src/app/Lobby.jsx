import { useEffect, useRef } from 'preact/hooks';
import { useStore, Icon, send, QR } from '../ui/common.jsx';
import { PlayerAvatar } from '../ui/Avatar.jsx';
import { GAME_LIST } from '../games/logic.js';
import { GAME_META, GameGlyph } from '../games/meta.jsx';
import { sfx } from '../audio/sfx.js';
import { appUrl, joinUrl } from '../platform.js';

// Hidden test mode: add ?dev=1 to the URL to get bot players in the lobby.
const DEV = typeof location !== 'undefined' && new URLSearchParams(location.search).has('dev');

export function Lobby({ onShare, onEditMe }) {
  const st = useStore();
  const link = st.link;
  if (!link || !link.state) return null;
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
  const amScreen = !!(s.players[meId] && s.players[meId].screen);

  if (amScreen) return <ScreenLobby s={s} players={players} host={host} />;

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

      {s.played > 0 && <PartyStandings s={s} meId={meId} />}

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

function PartyStandings({ s, meId }) {
  const ids = Object.keys(s.tally || {}).filter((id) => s.players[id] && s.tally[id] > 0);
  if (!ids.length) return null;
  ids.sort((a, b) => s.tally[b] - s.tally[a]);
  return (
    <section class="label tight col party-standings" aria-label="Party standings">
      <span class="eyebrow">
        Party trophies · {s.played} {s.played === 1 ? 'game' : 'games'} played
      </span>
      {ids.slice(0, 6).map((id, i) => (
        <div class="row spread" key={id}>
          <span class="player-chip">
            <span class="tabular" style={{ width: 18, fontWeight: 800 }}>
              {i + 1}
            </span>
            <PlayerAvatar p={s.players[id]} size={28} />
            <span class="nm" style={{ color: id === meId ? 'var(--stamp-dk)' : undefined }}>
              {s.players[id].name}
            </span>
          </span>
          <span class="trophies" aria-label={`${s.tally[id]} trophies`}>
            {'🏆'.repeat(Math.min(5, s.tally[id]))}
            {s.tally[id] > 5 ? ` ×${s.tally[id]}` : ''}
          </span>
        </div>
      ))}
    </section>
  );
}

// Lobby for a shared table screen / TV: big code, QR right there, no player controls.
function ScreenLobby({ s, players, host }) {
  const vip = s.players[s.vip];
  return (
    <div class="screen lobby tv-lobby">
      <section class="label tape tv-join" aria-label="How to join">
        <div class="col" style={{ gap: 6, minWidth: 0 }}>
          <span class="eyebrow">Join on your phone</span>
          <strong class="tv-url">{host}</strong>
          <span class="eyebrow">Room code</span>
          <div class="code-big stencil" aria-label={`Room code ${s.code}`}>
            {s.code.split('').map((c, i) => (
              <span key={i}>{c}</span>
            ))}
          </div>
        </div>
        <div class="qr-wrap">
          <QR text={joinUrl(s.code)} size={190} />
        </div>
      </section>
      <section class="col">
        <span class="eyebrow">
          {players.length} {players.length === 1 ? 'player' : 'players'} in the box
        </span>
        <div class="roster">
          {players.map((p) => (
            <div class={'roster-item pop-in' + (p.on === false ? ' off' : '')} key={p.id}>
              <PlayerAvatar p={p} size={72} />
              <span class="nm">{p.name}</span>
              {p.id === s.vip && <span class="badge vip-badge">VIP</span>}
            </div>
          ))}
        </div>
      </section>
      <div class="label tight center-text">
        {players.length === 0 ? 'The first person to join becomes the VIP and picks the games.' : `${vip ? vip.name : 'The VIP'} picks the games from their phone.`}
      </div>
      {s.pick && <GameCard id={s.pick} active={players.length} selected />}
    </div>
  );
}

const SHELVES = [
  { title: 'Write, draw & bluff', ids: ['zinger', 'fib', 'sketch', 'phone', 'dead'] },
  { title: 'Talk it out', ids: ['blend', 'herd', 'seat', 'dial'] },
  { title: 'Phones on the table', ids: ['bomb', 'noon', 'head'] },
];

function GamePicker({ s, active }) {
  const pick = s.pick;
  const byId = Object.fromEntries(GAME_LIST.map((g) => [g.id, g]));
  const listed = new Set(SHELVES.flatMap((sh) => sh.ids));
  const extra = GAME_LIST.filter((g) => !listed.has(g.id)).map((g) => g.id);
  const shelves = extra.length ? SHELVES.concat([{ title: 'More', ids: extra }]) : SHELVES;
  return (
    <section class="col" aria-label="Pick a game">
      <span class="eyebrow">You're the VIP. Pick a game.</span>
      {shelves.map((sh) => (
        <div class="col" key={sh.title} style={{ gap: 10 }}>
          <h2 class="shelf-title stencil">{sh.title}</h2>
          <div class="game-list">
            {sh.ids
              .map((id) => byId[id])
              .filter(Boolean)
              .map((mod) => (
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
        </div>
      ))}
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
