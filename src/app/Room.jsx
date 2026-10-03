import { useEffect, useRef, useState } from 'preact/hooks';
import { useStore, Icon, Sheet, QR, toast, send, useNow, Switch } from '../ui/common.jsx';
import { leaveParty, saveProfile, profile, store } from './session.js';
import { Lobby } from './Lobby.jsx';
import { Results } from './Results.jsx';
import { GameScreen } from './GameScreen.jsx';
import { AvatarEditor } from './Home.jsx';
import { GAME_META } from '../games/meta.jsx';
import { GAMES } from '../games/logic.js';
import { joinUrl, shareLink, copyText } from '../platform.js';
import { audioPrefs, setAudioPref, isUnlocked, unlock, onAudioState } from '../audio/audio.js';
import { playMusic, stopMusic } from '../audio/music.js';
import { playCue, stopVoice, preloadLines } from '../audio/voice.js';
import { sfx } from '../audio/sfx.js';
import { Boxter } from '../ui/Avatar.jsx';
import { ReactButton, ReactTray, ReactLayer } from './Reactions.jsx';

export function Room() {
  const st = useStore();
  const link = st.link;
  const s = link && link.state;
  const [menu, setMenu] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [editMe, setEditMe] = useState(false);
  const [reacting, setReacting] = useState(false);
  if (!link || !s) return null;
  const meId = link.me.id;
  const me = s.players[meId];
  const isVip = s.vip === meId;
  if (typeof document !== 'undefined') document.body.classList.toggle('tv', !!(me && me.screen));
  const g = s.game;
  const title = s.scene === 'game' && g ? (GAME_META[g.id] || {}).name : s.scene === 'results' ? 'Results' : 'Lobby';

  const net = !link.connected ? 'bad' : !link.hostAlive ? 'warn' : '';

  return (
    <>
      <header class="topbar">
        <button class="code-chip" onClick={() => setShareOpen(true)} aria-label={`Room code ${s.code}. Tap to invite.`}>
          {s.code}
        </button>
        <span class="title">{title}</span>
        <span class={'net-dot ' + net} title={net === 'bad' ? 'Reconnecting…' : net === 'warn' ? 'Waiting for host…' : 'Connected'} />
        {me && s.scene !== 'lobby' && <ReactButton open={reacting} onToggle={() => setReacting(!reacting)} />}
        <SoundButton s={s} meId={meId} />
        <button class="icon-btn" onClick={() => setMenu(true)} aria-label="Menu">
          <Icon name="menu" />
        </button>
      </header>
      {net && <NetBanner net={net} />}
      {reacting && s.scene !== 'lobby' && <ReactTray onClose={() => setReacting(false)} />}
      <AudioDirector s={s} meId={meId} />
      <main class="room-main" key={s.scene + (g ? g.id : '')}>
        <Caption s={s} />
        {!me ? (
          <Joining />
        ) : s.scene === 'game' && g ? (
          <GameScreen />
        ) : s.scene === 'results' ? (
          <Results />
        ) : (
          <Lobby onShare={() => setShareOpen(true)} onEditMe={() => setEditMe(true)} />
        )}
      </main>
      <ReactLayer s={s} />
      {menu && <Menu s={s} meId={meId} isVip={isVip} onClose={() => setMenu(false)} onEditMe={() => setEditMe(true)} />}
      {shareOpen && <ShareSheet code={s.code} onClose={() => setShareOpen(false)} />}
      {editMe && me && (
        <AvatarEditor
          av={me.av}
          color={me.color}
          onChange={(av) => saveProfile({ ...profile(), name: me.name, av })}
          onClose={() => setEditMe(false)}
        />
      )}
    </>
  );
}

function Joining() {
  return (
    <div class="screen center" style={{ alignItems: 'center', textAlign: 'center' }}>
      <div class="bob">
        <Boxter size={120} />
      </div>
      <div class="row" style={{ justifyContent: 'center' }}>
        <div class="spin" />
        <strong>Joining the party…</strong>
      </div>
      <p class="small muted">Waiting for the host's phone to let you in.</p>
    </div>
  );
}

function NetBanner({ net }) {
  return (
    <div class={'net-banner ' + net} role="status">
      {net === 'bad' ? 'Connection lost. Reconnecting…' : "Host's phone went quiet. Another phone will take over in a few seconds…"}
    </div>
  );
}

function SoundButton({ s, meId }) {
  const [, force] = useState(0);
  const prefs = audioPrefs();
  const isSpeaker = s.speaker === meId;
  return (
    <button
      class={'icon-btn' + (isSpeaker ? ' speaker-on' : '')}
      onClick={() => {
        unlock();
        setAudioPref('muted', !prefs.muted);
        force((v) => v + 1);
        toast(prefs.muted ? 'Sound off on this phone' : isSpeaker ? 'Sound on. This phone is the room speaker.' : 'Sound on');
      }}
      aria-label={prefs.muted ? 'Unmute' : 'Mute'}
    >
      <Icon name={prefs.muted ? 'mute' : 'sound'} />
    </button>
  );
}

function ShareSheet({ code, onClose }) {
  const url = joinUrl(code);
  const pretty = url.replace(/^https?:\/\//, '').replace(/\?.*$/, '');
  return (
    <Sheet title="Invite friends" onClose={onClose}>
      <div class="share-code stencil">{code.split('').map((c, i) => <span key={i}>{c}</span>)}</div>
      <div class="qr-wrap">
        <QR text={url} size={210} />
      </div>
      <p class="center-text small" style={{ margin: 0 }}>
        Scan with a phone camera, or go to <strong>{pretty}</strong> and enter the code.
      </p>
      <div class="row">
        <button
          class="btn"
          onClick={async () => {
            const r = await copyText(url);
            toast(r === 'copied' ? 'Link copied' : 'Could not copy. Long-press the code instead.');
          }}
        >
          Copy link
        </button>
        <button
          class="btn primary"
          onClick={async () => {
            const r = await shareLink(url, `Join my Jacked Box party! Room code ${code}`);
            if (r === 'copied') toast('Link copied');
          }}
        >
          <Icon name="share" /> Share
        </button>
      </div>
    </Sheet>
  );
}

function Menu({ s, meId, isVip, onClose, onEditMe }) {
  const [confirmLeave, setConfirmLeave] = useState(false);
  const set = (k, v) => send('settings', { [k]: v });
  const st = s.settings;
  const players = s.order.map((id) => s.players[id]).filter(Boolean);
  const isSpeaker = s.speaker === meId;
  const prefs = audioPrefs();
  const [, force] = useState(0);
  return (
    <Sheet title="Menu" onClose={onClose}>
      {s.scene === 'game' && isVip && (
        <div class="row">
          <button
            class="btn sm"
            onClick={() => {
              send('skip', {});
              onClose();
            }}
          >
            <Icon name="skip" /> Skip ahead
          </button>
          <button
            class="btn sm"
            onClick={() => {
              send('end', {});
              onClose();
            }}
          >
            End game
          </button>
        </div>
      )}

      <div class="col">
        <span class="eyebrow">This phone</span>
        <div class="toggle-row">
          <div>
            <strong>Room speaker</strong>
            <div class="small muted">Plays the host's voice and music for everyone.</div>
          </div>
          {isSpeaker ? (
            <span class="badge">This phone</span>
          ) : (
            <button
              class="btn sm"
              onClick={() => {
                unlock();
                send('speaker', { pid: meId });
                toast('This phone is now the room speaker');
              }}
            >
              Use this one
            </button>
          )}
        </div>
        <div class="toggle-row">
          <strong>Sound effects</strong>
          <Switch
            id="sfx-toggle"
            on={prefs.sfx > 0}
            label="Sound effects"
            onChange={(v) => {
              setAudioPref('sfx', v ? 0.8 : 0);
              force((x) => x + 1);
            }}
          />
        </div>
        <button
          class="btn sm"
          onClick={() => {
            onClose();
            onEditMe();
          }}
        >
          Change my look
        </button>
      </div>

      {isVip && (
        <div class="col">
          <span class="eyebrow">Party settings (VIP)</span>
          <div class="toggle-row">
            <div>
              <strong>Spicy content</strong>
              <div class="small muted">Adds adult-ish prompts. Off = family friendly.</div>
            </div>
            <Switch id="spicy-toggle" on={st.spicy} label="Spicy content" onChange={(v) => set('spicy', v)} />
          </div>
          <div class="toggle-row">
            <div>
              <strong>Questions about us</strong>
              <div class="small muted">Some prompts are about the players in the room.</div>
            </div>
            <Switch id="aboutus-toggle" on={st.aboutUs} label="Questions about us" onChange={(v) => set('aboutUs', v)} />
          </div>
          <div class="toggle-row">
            <strong>Timers</strong>
            <div class="seg" role="group" aria-label="Timer speed">
              {['fast', 'normal', 'chill'].map((t) => (
                <button key={t} class={st.timer === t ? 'on' : ''} onClick={() => set('timer', t)}>
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div class="toggle-row">
            <strong>Host voice</strong>
            <Switch id="voice-toggle" on={st.voice} label="Host voice" onChange={(v) => set('voice', v)} />
          </div>
          <div class="toggle-row">
            <strong>Music</strong>
            <Switch id="music-toggle" on={st.music} label="Music" onChange={(v) => set('music', v)} />
          </div>
        </div>
      )}

      {isVip && players.length > 1 && (
        <div class="col">
          <span class="eyebrow">Players</span>
          {players.map((p) => (
            <div class="toggle-row" key={p.id}>
              <span class="player-chip">
                <span class="nm">{p.name}</span>
                {p.id === s.vip && <span class="badge">VIP</span>}
                {p.id === s.speaker && <span class="badge paper">Speaker</span>}
                {p.screen && <span class="badge blue">Screen</span>}
                {p.on === false && <span class="badge red">Away</span>}
              </span>
              {p.id !== meId && (
                <div class="row" style={{ gap: 6 }}>
                  {!p.screen && (
                    <button class="btn sm" onClick={() => send('vip', { pid: p.id })}>
                      Make VIP
                    </button>
                  )}
                  <button class="btn sm" onClick={() => send('kick', { pid: p.id })}>
                    Remove
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {!confirmLeave ? (
        <button class="btn" onClick={() => setConfirmLeave(true)}>
          Leave party
        </button>
      ) : (
        <div class="col label tight">
          <strong>Leave this party?</strong>
          <div class="row">
            <button class="btn sm" onClick={() => setConfirmLeave(false)}>
              Stay
            </button>
            <button class="btn sm primary" onClick={() => leaveParty()}>
              Leave
            </button>
            {isVip && (
              <button
                class="btn sm"
                onClick={() => {
                  send('close', {});
                }}
              >
                End for everyone
              </button>
            )}
          </div>
        </div>
      )}
    </Sheet>
  );
}

// Shows BOXTER's latest line on every phone (captions double as subtitles).
function Caption({ s }) {
  const t = useNow(500);
  const cue = s.cues && s.cues[s.cues.length - 1];
  const [shown, setShown] = useState(null);
  useEffect(() => {
    if (!cue) return;
    if (t - cue.at < 6000 && (!shown || shown.n !== cue.n)) setShown(cue);
  }, [cue && cue.n]);
  if (!shown) return null;
  const age = t - shown.at;
  const life = Math.min(9000, 2600 + (shown.t || '').length * 55);
  if (age > life + 400) return null;
  return (
    <div class={'caption' + (age > life ? ' out' : '')} aria-live="polite">
      <Boxter size={52} flex={false} />
      <div class="bubble">
        <span class="who">BOXTER</span>
        {shown.t}
      </div>
    </div>
  );
}

// Plays narration + music on the room's speaker phone only.
function AudioDirector({ s, meId }) {
  const lastCue = useRef(null);
  const [, bump] = useState(0);
  useEffect(() => onAudioState(() => bump((v) => v + 1)), []);
  const isSpeaker = s.speaker === meId;
  const wantMusic = isSpeaker && s.settings.music;
  const track = s.music;
  const unlocked = isUnlocked();

  useEffect(() => {
    if (wantMusic && unlocked) playMusic(track);
    else stopMusic();
  }, [wantMusic, track, unlocked]);

  useEffect(() => () => stopMusic(), []);

  useEffect(() => {
    if (s.scene === 'game' && s.game) preloadLines([s.game.id + '.', 'gen.']);
  }, [s.scene, s.game && s.game.id]);

  useEffect(() => {
    const cues = s.cues || [];
    if (lastCue.current === null) {
      // First render: don't replay history.
      lastCue.current = s.cueN || 0;
      return;
    }
    if (!isSpeaker) {
      lastCue.current = s.cueN || 0;
      return;
    }
    const hostNow = store.link ? store.link.now() : Date.now();
    for (const c of cues) {
      if (c.n <= lastCue.current) continue;
      lastCue.current = c.n;
      if (!s.settings.voice) continue;
      if (hostNow - c.at > 12000) continue;
      playCue(c);
    }
  }, [s.cueN, isSpeaker]);

  useEffect(() => {
    if (!isSpeaker) stopVoice();
  }, [isSpeaker]);

  // Game-level stingers that every phone hears (results fanfare etc.)
  const lastScene = useRef(s.scene);
  useEffect(() => {
    if (lastScene.current !== s.scene) {
      if (s.scene === 'results') sfx('fanfare');
      if (s.scene === 'game') sfx('whoosh');
      lastScene.current = s.scene;
    }
  }, [s.scene]);

  if (isSpeaker && !unlocked && (s.settings.music || s.settings.voice)) {
    return (
      <button
        class="unlock-banner"
        onClick={() => {
          unlock();
          bump((v) => v + 1);
        }}
      >
        Tap to turn on sound. This phone is the room speaker.
      </button>
    );
  }
  return null;
}
