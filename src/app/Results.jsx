import { useStore, send, fmtScore } from '../ui/common.jsx';
import { PlayerAvatar } from '../ui/Avatar.jsx';
import { GAMES } from '../games/logic.js';
import { GAME_META, GameGlyph } from '../games/meta.jsx';
import { sfx } from '../audio/sfx.js';

export function Results() {
  const st = useStore();
  const link = st.link;
  if (!link || !link.state) return null;
  const s = link.state;
  const r = s.results;
  const meId = link.me.id;
  const isVip = s.vip === meId;
  if (!r) return null;
  const mod = GAMES[r.id];
  const m = GAME_META[r.id] || {};
  const ranked = r.ranking.map((pid) => ({ p: s.players[pid], score: r.scores[pid] || 0 })).filter((x) => x.p);
  // Dense ranking so ties share a place.
  let place = 0;
  let prev = null;
  ranked.forEach((x, i) => {
    if (x.score !== prev) place = i + 1;
    x.place = place;
    prev = x.score;
  });
  const podium = [ranked[1], ranked[0], ranked[2]];
  const rest = ranked.slice(3);
  const myPlace = ranked.find((x) => x.p.id === meId);

  return (
    <div class="screen results" style={{ '--gbg': m.bg, '--gfg': m.fg, '--gac': m.accent }}>
      <div class="row" style={{ justifyContent: 'center', gap: 12 }}>
        <span class="glyph-disc">
          <GameGlyph id={r.id} size={40} />
        </span>
        <h1 class="stencil results-title">{mod ? mod.name : 'Results'}</h1>
      </div>

      {r.coop ? (
        <div class="label center-text">
          <div class="stencil" style={{ fontSize: '2.4rem' }}>
            {r.coop}
          </div>
          {r.note && <p style={{ margin: '6px 0 0' }}>{r.note}</p>}
        </div>
      ) : (
        <>
          <div class="podium">
            {podium.map((x, i) =>
              x ? (
                <div class={`pod pod-${x.place <= 3 ? x.place : 3}`} key={x.p.id}>
                  {x.place === 1 && <div class="crown-float">★</div>}
                  <PlayerAvatar p={x.p} size={x.place === 1 ? 84 : 64} />
                  <span class="pod-name">{x.p.name}</span>
                  <div class="pod-block">
                    <span class="pod-place stencil">{x.place}</span>
                    <span class="pod-score tabular">{fmtScore(x.score)}</span>
                  </div>
                </div>
              ) : (
                <div class="pod empty" key={'x' + i} />
              ),
            )}
          </div>
          {r.note && <p class="center-text" style={{ margin: 0, fontWeight: 700 }}>{r.note}</p>}
          {rest.length > 0 && (
            <div class="label tight col" style={{ gap: 6 }}>
              {rest.map((x) => (
                <div class="row spread" key={x.p.id}>
                  <span class="player-chip">
                    <span class="place-num tabular">{x.place}</span>
                    <PlayerAvatar p={x.p} size={30} />
                    <span class="nm">{x.p.name}</span>
                  </span>
                  <strong class="tabular">{fmtScore(x.score)}</strong>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {r.awards && r.awards.length > 0 && (
        <div class="col awards">
          {r.awards.map((a, i) => {
            const p = s.players[a.pid];
            if (!p) return null;
            return (
              <div class="award label tight slide-in" key={i} style={{ animationDelay: `${0.3 + i * 0.15}s` }}>
                <PlayerAvatar p={p} size={40} />
                <div class="col" style={{ gap: 0, minWidth: 0 }}>
                  <span class="eyebrow">{a.title}</span>
                  <strong>{p.name}</strong>
                  {a.detail && <span class="small muted">{a.detail}</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {myPlace && !r.coop && (
        <p class="center-text" style={{ margin: 0 }}>
          You finished <strong>#{myPlace.place}</strong> with {fmtScore(myPlace.score)} points.
        </p>
      )}

      <div class="grow" />
      {isVip ? (
        <div class="col">
          <button
            class="btn primary"
            onClick={() => {
              sfx('bell');
              send('again', {});
            }}
          >
            Play {mod ? mod.name : 'it'} again
          </button>
          <button
            class="btn"
            onClick={() => {
              sfx('tap');
              send('lobby', {});
            }}
          >
            Pick another game
          </button>
        </div>
      ) : (
        <p class="center-text small muted" style={{ margin: 0 }}>
          Waiting for the VIP to pick what's next…
        </p>
      )}
    </div>
  );
}
