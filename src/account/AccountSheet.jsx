// Sign in, your account, and your subscription.
import { useState } from 'preact/hooks';
import { Sheet, Icon, toast } from '../ui/common.jsx';
import { AvatarSvg } from '../ui/Avatar.jsx';
import { account, AUTH_ENABLED, AUTH_METHODS, sendEmailCode, verifyEmailCode, signInWithApple, signInWithGoogle, signOut, deleteAccount, purchases, setDevPremium } from './account.js';
import { useAccount, legalUrl } from './Paywall.jsx';
import { APP } from '../config.js';
import { isNativeShell, platformName, openExternal } from '../platform.js';
import { sfx } from '../audio/sfx.js';

const AppleLogo = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
    <path fill="currentColor" d="M16.4 12.6c0-2.6 2.1-3.8 2.2-3.9-1.2-1.8-3.1-2-3.7-2-1.6-.2-3.1.9-3.9.9s-2-.9-3.4-.9c-1.7 0-3.3 1-4.2 2.6-1.8 3.1-.5 7.7 1.3 10.2.9 1.2 1.9 2.6 3.2 2.6s1.8-.8 3.4-.8 2 .8 3.4.8 2.3-1.3 3.1-2.5c1-1.4 1.4-2.8 1.4-2.9 0 0-2.8-1.1-2.8-4.1zM13.9 4.9c.7-.9 1.2-2.1 1.1-3.3-1 0-2.3.7-3 1.6-.7.8-1.2 2-1.1 3.2 1.2.1 2.3-.6 3-1.5z" />
  </svg>
);

const GoogleLogo = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
    <path fill="#4285F4" d="M22.6 12.3c0-.8-.1-1.4-.2-2.1H12v4h6c-.1 1-.8 2.5-2.3 3.5v2.9h3.7c2.1-2 3.2-4.9 3.2-8.3z" />
    <path fill="#34A853" d="M12 23c3 0 5.6-1 7.4-2.7l-3.7-2.9c-1 .7-2.3 1.1-3.7 1.1-2.9 0-5.3-1.9-6.2-4.5H2v3c1.9 3.6 5.6 6 10 6z" />
    <path fill="#FBBC05" d="M5.8 14c-.2-.7-.4-1.4-.4-2.1s.1-1.4.4-2.1v-3H2C1.2 8.4.8 10.1.8 12s.4 3.6 1.2 5.1L5.8 14z" />
    <path fill="#EA4335" d="M12 5.4c1.6 0 3.1.6 4.2 1.7l3.2-3.2C17.5 2.1 15 1 12 1 7.6 1 3.9 3.4 2 7l3.8 3c.9-2.7 3.3-4.6 6.2-4.6z" />
  </svg>
);

// Sign-in options. Used here and in onboarding.
export function SignInPanel({ onDone, compact }) {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [stage, setStage] = useState('start'); // start | code
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  if (!AUTH_ENABLED) return null;
  const run = async (fn) => {
    setBusy(true);
    setErr('');
    try {
      await fn();
    } catch (e) {
      if (!/cancel/i.test(e.message)) setErr(e.message);
    } finally {
      setBusy(false);
    }
  };
  const done = () => {
    sfx('pop');
    onDone && onDone();
  };
  const isIOS = platformName() === 'ios';
  const showApple = AUTH_METHODS.apple && (isIOS || !isNativeShell());
  const showGoogle = AUTH_METHODS.google;
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());

  if (stage === 'code') {
    return (
      <form
        class="col"
        onSubmit={(e) => {
          e.preventDefault();
          run(async () => {
            await verifyEmailCode(email, code);
            done();
          });
        }}
      >
        <span class="small">
          We sent a 6-digit code to <strong>{email}</strong>.
        </span>
        <input
          class="field code-field"
          inputMode="numeric"
          autocomplete="one-time-code"
          maxLength={6}
          placeholder="123456"
          value={code}
          onInput={(e) => setCode(e.currentTarget.value.replace(/\D/g, '').slice(0, 6))}
          aria-label="Code from the email"
        />
        {err && <div class="label tight error-label">{err}</div>}
        <button class="btn primary" type="submit" disabled={busy || code.length !== 6}>
          {busy ? 'Checking…' : 'Sign in'}
        </button>
        <button type="button" class="btn ghost sm" style={{ alignSelf: 'center' }} onClick={() => setStage('start')}>
          Use a different email
        </button>
      </form>
    );
  }

  return (
    <div class="col">
      {showApple && (
        <button class="btn auth-apple" disabled={busy} onClick={() => run(async () => (await signInWithApple(), done()))}>
          <AppleLogo /> Sign in with Apple
        </button>
      )}
      {showGoogle && (
        <button class="btn auth-google" disabled={busy} onClick={() => run(async () => (await signInWithGoogle(), done()))}>
          <GoogleLogo /> Sign in with Google
        </button>
      )}
      {(showApple || showGoogle) && (
        <div class="or-rule">
          <span>or with email</span>
        </div>
      )}
      <form
        class="row join-row"
        onSubmit={(e) => {
          e.preventDefault();
          if (emailOk)
            run(async () => {
              await sendEmailCode(email);
              setStage('code');
            });
        }}
      >
        <input class="field" type="email" inputMode="email" autocomplete="email" placeholder="you@example.com" value={email} onInput={(e) => setEmail(e.currentTarget.value)} aria-label="Email" />
        <button class="btn blue join-btn" type="submit" disabled={busy || !emailOk}>
          <Icon name="arrow" />
        </button>
      </form>
      {!compact && <span class="small muted">We'll email you a code. No password needed.</span>}
      {err && <div class="label tight error-label">{err}</div>}
    </div>
  );
}

export function AccountSheet({ onClose, onPremium, profile }) {
  const acct = useAccount();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const dev = import.meta.env.DEV || new URLSearchParams(location.search).get('dev') === '1';
  const manage = purchases.manageUrl();
  const until = acct.premiumUntil ? new Date(acct.premiumUntil).toLocaleDateString() : null;

  const doDelete = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setBusy(true);
    try {
      await deleteAccount();
      toast('Account deleted');
      onClose();
    } catch (e) {
      toast(e.message);
    } finally {
      setBusy(false);
      setConfirmDelete(false);
    }
  };

  return (
    <Sheet title="Account" onClose={onClose}>
      <div class="acct-card">
        {profile && <AvatarSvg av={profile.av} color="#ff4d3d" size={56} face={profile.face} />}
        <div class="col" style={{ gap: 2, minWidth: 0 }}>
          <strong class="acct-name">{(profile && profile.name) || 'Player'}</strong>
          <span class="small muted acct-email">{acct.user ? acct.user.email || 'Signed in' : 'Playing as a guest'}</span>
        </div>
      </div>

      <section class="label tight col" style={{ gap: 8, color: 'var(--ink)' }}>
        <div class="row spread">
          <strong>RiffRaff Premium</strong>
          <span class={'badge ' + (acct.premium ? 'yellow' : 'paper')}>{acct.premium ? 'Active' : 'Free'}</span>
        </div>
        {acct.premium ? (
          <span class="small">
            {acct.premiumSource === 'dev' ? 'Test mode.' : acct.premiumSource === 'early' ? 'Early access, on the house.' : until ? (acct.willRenew ? `Renews ${until}.` : `Ends ${until}.`) : 'Active.'} Every game is unlocked for everyone in your parties.
          </span>
        ) : (
          <span class="small">The classics are free. Premium unlocks every game for your whole party.</span>
        )}
        <div class="row wrap" style={{ gap: 8 }}>
          {!acct.premium && (
            <button class="btn sm primary" onClick={onPremium}>
              See Premium
            </button>
          )}
          {isNativeShell() && purchases.storeAvailable() && (
            <button
              class="btn sm"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  const info = await purchases.restore();
                  toast(info && info.active ? 'Premium restored' : 'No active subscription found');
                } catch (e) {
                  toast(e.message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              Restore purchases
            </button>
          )}
          {acct.premium && acct.premiumSource === 'store' && manage && (
            <button class="btn sm" onClick={() => openExternal(manage)}>
              Manage subscription
            </button>
          )}
        </div>
      </section>

      {AUTH_ENABLED && !acct.user && (
        <section class="col" style={{ gap: 8 }}>
          <strong>Sign in to save your profile</strong>
          <span class="small muted">Keep your name, look and Premium on every device. You never need an account to join a party.</span>
          <SignInPanel onDone={() => toast('Signed in')} />
        </section>
      )}

      {acct.user && (
        <div class="row wrap" style={{ gap: 8 }}>
          <button
            class="btn sm"
            onClick={async () => {
              await signOut();
              toast('Signed out');
            }}
          >
            Sign out
          </button>
          <button class={'btn sm ' + (confirmDelete ? 'danger-btn' : 'ghost')} disabled={busy} onClick={doDelete}>
            <Icon name="trash" size={18} /> {confirmDelete ? 'Tap again to delete forever' : 'Delete account'}
          </button>
        </div>
      )}
      {acct.user && confirmDelete && (
        <p class="small" style={{ margin: 0 }}>
          This permanently deletes your account and profile. An active App Store / Google Play subscription isn't cancelled automatically: cancel it in your store settings.
        </p>
      )}

      {dev && (
        <label class="row small" style={{ gap: 8 }}>
          <input type="checkbox" checked={acct.premium && acct.premiumSource === 'dev'} onChange={(e) => setDevPremium(e.currentTarget.checked)} />
          Test Premium on this device (developer mode)
        </label>
      )}

      <div class="row wrap acct-links">
        <a href={legalUrl('privacy')} target="_blank" rel="noopener" onClick={(e) => isNativeShell() && (e.preventDefault(), openExternal(legalUrl('privacy')))}>
          Privacy
        </a>
        <a href={legalUrl('terms')} target="_blank" rel="noopener" onClick={(e) => isNativeShell() && (e.preventDefault(), openExternal(legalUrl('terms')))}>
          Terms
        </a>
        <a href={legalUrl('support')} target="_blank" rel="noopener" onClick={(e) => isNativeShell() && (e.preventDefault(), openExternal(legalUrl('support')))}>
          Help &amp; contact
        </a>
        <span class="muted">v{APP.version}</span>
      </div>
    </Sheet>
  );
}
