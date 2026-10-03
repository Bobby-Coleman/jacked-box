import { useState } from 'preact/hooks';
import { AvatarSvg, Boxter, randomAvatar, AV_PARTS } from '../ui/Avatar.jsx';
import { Icon, Sheet, useStore } from '../ui/common.jsx';
import { profile, saveProfile, createParty, joinParty, lastRoom, cleanCode, clearError, myFace, saveFace } from './session.js';
import { FaceCam } from '../ui/FaceCam.jsx';
import { unlock } from '../audio/audio.js';
import { sfx } from '../audio/sfx.js';
import { cleanName } from '../engine/core.js';
import { GAME_META } from '../games/meta.jsx';
import { canInstall, onInstallable, promptInstall, isStandalone, isIOS, isNativeShell } from '../platform.js';
import { useEffect } from 'preact/hooks';

const PREVIEW_COLOR = '#ff4d3d';

export function Home() {
  const st = useStore();
  const p0 = profile();
  const params = new URLSearchParams(window.location.search);
  const [name, setName] = useState(p0.name);
  const [av, setAv] = useState(p0.av);
  const [code, setCode] = useState(cleanCode(params.get('r') || ''));
  const [editing, setEditing] = useState(false);
  const [screenMode, setScreenMode] = useState(false);
  const [about, setAbout] = useState(false);
  const last = lastRoom();
  const invited = cleanCode(params.get('r') || '').length === 4;

  const nameOk = cleanName(name).length > 0 || screenMode;
  const persist = () => saveProfile({ name: cleanName(name), av });

  const start = () => {
    unlock();
    sfx('pop');
    if (!nameOk) return;
    persist();
    createParty({ screen: screenMode });
  };
  const join = (e) => {
    if (e) e.preventDefault();
    unlock();
    sfx('pop');
    if (!nameOk || cleanCode(code).length !== 4) return;
    persist();
    joinParty(code, { screen: screenMode });
  };
  const rejoin = () => {
    unlock();
    persist();
    joinParty(last.code, { pid: last.pid });
  };

  return (
    <div class="screen home">
      <header class="home-hero">
        <div class="hero-mascot">
          <Boxter size={128} />
        </div>
        <h1 class="logo stencil">
          <span>Jacked</span>
          <span>Box</span>
        </h1>
        <p class="hero-sub">Party games for a room full of phones. No TV, no console, no app to install.</p>
      </header>

      {st.error && (
        <div class="label tight error-label" role="alert" onClick={clearError}>
          {st.error}
        </div>
      )}

      <section class="label tape col" aria-label="Your player">
        <span class="eyebrow">{screenMode ? 'Table screen' : 'Your name'}</span>
        {screenMode ? (
          <p class="small" style={{ margin: 0 }}>
            This device joins as a shared screen and speaker in the middle of the table. It shows the reveals and plays the host's voice, but doesn't play.
          </p>
        ) : (
          <div class="row">
            <button class="avatar-btn" onClick={() => setEditing(true)} aria-label="Change your look">
              <AvatarSvg av={av} color={PREVIEW_COLOR} size={64} face={myFace()} />
              <span class="avatar-edit-dot">
                <Icon name="dice" size={14} stroke={2.4} />
              </span>
            </button>
            <input
              id="name"
              class="field"
              value={name}
              maxLength={12}
              placeholder="NAME"
              autocomplete="nickname"
              autocapitalize="characters"
              onInput={(e) => setName(e.currentTarget.value)}
              style={{ textTransform: 'uppercase', fontFamily: 'var(--font-game)', fontWeight: 400, fontSize: '1.5rem' }}
            />
          </div>
        )}
      </section>

      {invited ? (
        <form class="col" onSubmit={join}>
          <button class="btn primary big-cta" type="submit" disabled={!nameOk}>
            Join room {cleanCode(code)}
          </button>
          <button type="button" class="btn ghost sm" style={{ alignSelf: 'center' }} onClick={start} disabled={!nameOk}>
            Start my own party instead
          </button>
        </form>
      ) : (
        <>
          <button class="btn primary big-cta" onClick={start} disabled={!nameOk}>
            {screenMode ? 'Open a room on this screen' : 'Start a party'}
          </button>
          <div class="or-rule">
            <span>or join one</span>
          </div>
          <form class="row join-row" onSubmit={join}>
            <input
              id="code"
              class="field code-field"
              value={code}
              maxLength={4}
              placeholder="CODE"
              autocomplete="off"
              autocapitalize="characters"
              spellcheck={false}
              inputMode="text"
              onInput={(e) => setCode(cleanCode(e.currentTarget.value))}
              aria-label="Room code"
            />
            <button class="btn blue join-btn" type="submit" disabled={!nameOk || code.length !== 4}>
              Join
            </button>
          </form>
        </>
      )}

      {!nameOk && !screenMode && <p class="small muted center-text" style={{ margin: 0 }}>Type a name first.</p>}

      {last && !invited && (
        <button class="btn sm yellow" style={{ alignSelf: 'center' }} onClick={rejoin}>
          Rejoin {last.code} as {last.name || 'me'}
        </button>
      )}

      <div class="home-games" aria-label="Games in the box">
        {Object.values(GAME_META).map((m) => (
          <span class="mini-game" style={{ background: m.bg, color: m.fg }} key={m.id}>
            {m.name}
          </span>
        ))}
      </div>

      <InstallHint />

      <div class="row wrap" style={{ justifyContent: 'center', gap: 8 }}>
        <button class="btn ghost sm" onClick={() => setScreenMode(!screenMode)}>
          {screenMode ? 'Play on this phone instead' : 'Use as table screen'}
        </button>
        <button class="btn ghost sm" onClick={() => setAbout(true)}>
          How it works
        </button>
      </div>

      {editing && (
        <AvatarEditor
          av={av}
          onChange={(a) => {
            setAv(a);
            saveProfile({ name: cleanName(name), av: a });
          }}
          onClose={() => setEditing(false)}
        />
      )}
      {about && <About onClose={() => setAbout(false)} />}
    </div>
  );
}

// Offer "install as an app" where the browser supports it; a short tip on iPhone.
function InstallHint() {
  const [, bump] = useState(0);
  useEffect(() => onInstallable(() => bump((v) => v + 1)), []);
  if (isNativeShell() || isStandalone()) return null;
  if (canInstall()) {
    return (
      <button
        class="btn sm blue"
        style={{ alignSelf: 'center' }}
        onClick={async () => {
          sfx('pop');
          await promptInstall();
          bump((v) => v + 1);
        }}
      >
        Install Jacked Box on this phone
      </button>
    );
  }
  if (isIOS()) {
    return (
      <p class="small muted center-text" style={{ margin: 0 }}>
        Tip: in Safari tap <strong>Share</strong>, then <strong>Add to Home Screen</strong> to keep Jacked Box like an app.
      </p>
    );
  }
  return null;
}

const PART_LABELS = { e: 'Eyes', m: 'Mouth', h: 'Headwear', b: 'Box' };

export function AvatarEditor({ av, color = PREVIEW_COLOR, onChange, onClose }) {
  const [cam, setCam] = useState(false);
  const [, bump] = useState(0);
  const face = myFace();
  const step = (k, d) => {
    sfx('tap');
    const n = AV_PARTS[k];
    onChange({ ...av, [k]: (av[k] + d + n) % n });
  };
  if (cam) {
    return (
      <FaceCam
        onCancel={() => setCam(false)}
        onDone={(img) => {
          saveFace(img);
          setCam(false);
          bump((v) => v + 1);
        }}
      />
    );
  }
  return (
    <Sheet title="Your look" onClose={onClose}>
      <div class="avatar-stage">
        <AvatarSvg av={av} color={color} size={150} face={face} />
      </div>
      <div class="label tight face-card">
        <div class="col" style={{ gap: 2, flex: 1, minWidth: 0 }}>
          <strong>{face ? 'Your face is in the box!' : 'Put your face in the box'}</strong>
          <span class="small muted">{face ? 'It shows on your avatar and stars in the face games.' : 'Face games use selfies: Photobomb, Zoom & Enhance, Frankenface and more.'}</span>
        </div>
        <div class="col" style={{ gap: 6 }}>
          <button class="btn sm primary" onClick={() => setCam(true)}>
            {face ? 'Retake' : 'Add selfie'}
          </button>
          {face && (
            <button
              class="btn sm ghost"
              onClick={() => {
                saveFace(null);
                bump((v) => v + 1);
              }}
            >
              Remove
            </button>
          )}
        </div>
      </div>
      {['h', 'e', 'm', 'b'].map((k) => (
        <div class="part-row" key={k}>
          <button class="icon-btn" onClick={() => step(k, -1)} aria-label={`Previous ${PART_LABELS[k]}`}>
            <Icon name="back" />
          </button>
          <span class="part-name">{PART_LABELS[k]}</span>
          <button class="icon-btn" onClick={() => step(k, 1)} aria-label={`Next ${PART_LABELS[k]}`} style={{ transform: 'scaleX(-1)' }}>
            <Icon name="back" />
          </button>
        </div>
      ))}
      <div class="row">
        <button
          class="btn"
          onClick={() => {
            sfx('pop');
            onChange(randomAvatar());
          }}
        >
          <Icon name="dice" /> Shuffle
        </button>
        <button class="btn primary" onClick={onClose}>
          Done
        </button>
      </div>
    </Sheet>
  );
}

function About({ onClose }) {
  return (
    <Sheet title="How it works" onClose={onClose}>
      <ol class="how-list">
        <li>
          <strong>One person starts a party.</strong> Their phone shows a 4-letter room code and a QR code.
        </li>
        <li>
          <strong>Everyone else joins</strong> on this website with the code. No app, no account.
        </li>
        <li>
          <strong>Every phone is your screen.</strong> Prompts, drawings and reveals show up on all phones at once. One phone acts as the speaker for the host's voice and music.
        </li>
        <li>
          <strong>Some games are played on the table:</strong> phones face up in the middle, on your forehead, or passed around.
        </li>
      </ol>
      <p class="small muted" style={{ margin: 0 }}>
        If someone's phone sleeps or drops, the game keeps going: another phone takes over hosting automatically, and they rejoin right where they left off.
      </p>
      <p class="small muted" style={{ margin: 0 }}>
        Music and sound effects are generated live in your browser. Fonts: Big Shoulders, Lilita One, Bricolage Grotesque (SIL Open Font License).
      </p>
    </Sheet>
  );
}
