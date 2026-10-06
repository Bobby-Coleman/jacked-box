// First launch: what RiffRaff is, how a party works, your name and look, and (optionally) an
// account. People who arrive from an invite link skip this and go straight to joining.
import { useState } from 'preact/hooks';
import { AvatarSvg, Boxter, randomAvatar } from '../ui/Avatar.jsx';
import { Icon } from '../ui/common.jsx';
import { FaceCam } from '../ui/FaceCam.jsx';
import { profile, saveProfile, myFace, saveFace } from './session.js';
import { cleanName } from '../engine/core.js';
import { AUTH_ENABLED, account } from '../account/account.js';
import { SignInPanel } from '../account/AccountSheet.jsx';
import { FREE_GAMES } from '../games/catalog.js';
import { GAME_LIST } from '../games/logic.js';
import { GAME_META, GameGlyph } from '../games/meta.jsx';
import { save, load } from '../platform.js';
import { unlock } from '../audio/audio.js';
import { sfx } from '../audio/sfx.js';

export function needsOnboarding() {
  const invited = new URLSearchParams(location.search).get('r');
  return !load('rr.onboarded') && !invited;
}

export function Onboarding({ onDone }) {
  const p0 = profile();
  const [step, setStep] = useState(0);
  const [name, setName] = useState(p0.name);
  const [av, setAv] = useState(p0.av);
  const [cam, setCam] = useState(false);
  const [, bump] = useState(0);
  const steps = ['welcome', 'how', 'you', ...(AUTH_ENABLED && !account.user ? ['account'] : [])];
  const id = steps[step];
  const last = step === steps.length - 1;
  const nameOk = cleanName(name).length > 0;

  const finish = () => {
    save('rr.onboarded', 1);
    if (nameOk) saveProfile({ name: cleanName(name), av });
    onDone();
  };
  const next = () => {
    unlock();
    sfx('pop');
    if (id === 'you') saveProfile({ name: cleanName(name), av });
    if (last) finish();
    else setStep(step + 1);
  };

  if (cam) {
    return (
      <FaceCam
        title="Put your face in the box"
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
    <div class="screen onboard">
      <div class="ob-dots" aria-hidden="true">
        {steps.map((s, i) => (
          <span key={s} class={i === step ? 'on' : ''} />
        ))}
      </div>

      {id === 'welcome' && (
        <div class="ob-card pop-in" key="welcome">
          <div class="bob">
            <Boxter size={150} />
          </div>
          <h1 class="logo stencil">
            <span>Riff</span>
            <span>Raff</span>
          </h1>
          <p class="ob-big">Party games for a room full of phones.</p>
          <p class="ob-sub">No TV. No console. Everyone plays on their own phone, and the host talks you through every game.</p>
        </div>
      )}

      {id === 'how' && (
        <div class="ob-card pop-in" key="how">
          <h2 class="stencil ob-title">How a party works</h2>
          <ol class="ob-steps">
            <li>
              <span class="ob-num">1</span>
              <div>
                <strong>One phone starts a party</strong>
                <span>and gets a 4-letter room code.</span>
              </div>
            </li>
            <li>
              <span class="ob-num">2</span>
              <div>
                <strong>Friends join with the code</strong>
                <span>on the app or at the website. No account needed.</span>
              </div>
            </li>
            <li>
              <span class="ob-num">3</span>
              <div>
                <strong>Everyone plays on their own phone</strong>
                <span>while one phone is the speaker for the host and music.</span>
              </div>
            </li>
          </ol>
          <div class="ob-free">
            <span class="small">
              <strong>Free:</strong> the classics
            </span>
            <div class="row wrap" style={{ gap: 6, justifyContent: 'center' }}>
              {GAME_LIST.filter((g) => FREE_GAMES.includes(g.id)).map((g) => (
                <span class="pw-game" key={g.id} style={{ background: GAME_META[g.id].bg, color: GAME_META[g.id].fg }}>
                  <GameGlyph id={g.id} size={18} />
                  {g.name}
                </span>
              ))}
            </div>
            <span class="small muted">Premium unlocks {GAME_LIST.length - FREE_GAMES.length} more, including the face games, for your whole party.</span>
          </div>
        </div>
      )}

      {id === 'you' && (
        <div class="ob-card pop-in" key="you">
          <h2 class="stencil ob-title">Who's playing?</h2>
          <div class="ob-avatar">
            <AvatarSvg av={av} color="#ff4d3d" size={150} face={myFace()} />
            <button
              class="icon-btn ob-shuffle"
              aria-label="Shuffle your look"
              onClick={() => {
                sfx('tap');
                setAv(randomAvatar());
              }}
            >
              <Icon name="dice" />
            </button>
          </div>
          <input
            class="field ob-name"
            value={name}
            maxLength={12}
            placeholder="YOUR NAME"
            autocomplete="nickname"
            autocapitalize="characters"
            onInput={(e) => setName(e.currentTarget.value)}
            aria-label="Your name"
          />
          <div class="label tight face-card">
            <div class="col" style={{ gap: 2, flex: 1, minWidth: 0 }}>
              <strong>{myFace() ? 'Your face is in the box!' : 'Add your face (optional)'}</strong>
              <span class="small muted">Face games put your friends' faces into drawings, wanted posters and mash-ups. Your photo stays on your phone until you join a party.</span>
            </div>
            <button class="btn sm primary" onClick={() => setCam(true)}>
              {myFace() ? 'Retake' : 'Selfie'}
            </button>
          </div>
        </div>
      )}

      {id === 'account' && (
        <div class="ob-card pop-in" key="account">
          <h2 class="stencil ob-title">Save your stuff?</h2>
          <p class="ob-sub">Sign in to keep your name, look and Premium on every phone. You can always do this later.</p>
          <SignInPanel onDone={finish} />
        </div>
      )}

      <div class="grow" />
      <div class="col" style={{ gap: 8 }}>
        <button class="btn primary big-cta" onClick={next} disabled={id === 'you' && !nameOk}>
          {id === 'welcome' ? "Let's go" : id === 'account' ? 'Maybe later' : last ? 'Done' : 'Next'}
        </button>
        {id === 'you' && !nameOk && <span class="small muted center-text">Type a name to continue.</span>}
        {step > 0 && (
          <button class="btn ghost sm" style={{ alignSelf: 'center' }} onClick={() => setStep(step - 1)}>
            Back
          </button>
        )}
      </div>
    </div>
  );
}
