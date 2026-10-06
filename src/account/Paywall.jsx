// RiffRaff Premium: what you get, the plans from the App Store / Google Play, restore, and the
// subscription terms both stores require on a paywall.
import { useEffect, useState } from 'preact/hooks';
import { Sheet, Icon, toast } from '../ui/common.jsx';
import { Boxter } from '../ui/Avatar.jsx';
import { GAME_LIST } from '../games/logic.js';
import { GAME_META, GameGlyph } from '../games/meta.jsx';
import { isPremiumGame } from '../games/catalog.js';
import { account, onAccount, purchases, AUTH_ENABLED } from './account.js';
import { APP } from '../config.js';
import { isNativeShell, platformName, openExternal } from '../platform.js';
import { sfx } from '../audio/sfx.js';

export const LEGAL = {
  terms: () => new URL('terms.html', document.baseURI).toString(),
  privacy: () => new URL('privacy.html', document.baseURI).toString(),
  support: () => new URL('support.html', document.baseURI).toString(),
};

export function legalUrl(page) {
  // In the apps the pages live on the public website.
  return isNativeShell() ? new URL(page + '.html', APP.url).toString() : LEGAL[page]();
}

export function useAccount() {
  const [, bump] = useState(0);
  useEffect(() => onAccount(() => bump((v) => v + 1)), []);
  return account;
}

const PERIOD = { month: 'month', year: 'year', week: 'week', lifetime: 'one-time' };

export function Paywall({ onClose, onSignIn, reason }) {
  const acct = useAccount();
  const [plans, setPlans] = useState(null);
  const [pick, setPick] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const native = isNativeShell() && purchases.storeAvailable();

  useEffect(() => {
    let alive = true;
    if (!native) {
      setPlans([]);
      return;
    }
    purchases
      .getPlans()
      .then((p) => {
        if (!alive) return;
        setPlans(p);
        setPick((p.find((x) => x.period === 'year') || p[0] || {}).id || null);
      })
      .catch(() => alive && setPlans([]));
    return () => (alive = false);
  }, []);

  useEffect(() => {
    if (acct.premium) {
      sfx('fanfare');
      toast('Premium unlocked. Enjoy!');
      onClose && onClose();
    }
  }, [acct.premium]);

  const premiumGames = GAME_LIST.filter((g) => isPremiumGame(g.id));
  const plan = plans && plans.find((p) => p.id === pick);

  const subscribe = async () => {
    if (!plan) return;
    setBusy(true);
    setErr('');
    try {
      const r = await purchases.buy(plan);
      if (r === 'purchased') sfx('fanfare');
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  const restore = async () => {
    setBusy(true);
    setErr('');
    try {
      const info = await purchases.restore();
      if (!info || !info.active) setErr('No active RiffRaff Premium subscription found for this Apple ID / Google account.');
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  const store = platformName() === 'ios' ? 'Apple ID' : 'Google Play account';

  return (
    <Sheet title="RiffRaff Premium" onClose={onClose}>
      <div class="pw-hero">
        <Boxter size={84} />
        <div class="col" style={{ gap: 4 }}>
          <strong class="pw-head">{reason || `Unlock all ${GAME_LIST.length} games`}</strong>
          <span class="small">One Premium player unlocks every game for the whole room. Friends play free.</span>
        </div>
      </div>

      <div class="pw-games" aria-label="Premium games">
        {premiumGames.map((g) => {
          const m = GAME_META[g.id];
          return (
            <span class="pw-game" key={g.id} style={{ background: m.bg, color: m.fg }}>
              <GameGlyph id={g.id} size={20} />
              {g.name}
            </span>
          );
        })}
      </div>

      <ul class="pw-perks">
        <li>
          <Icon name="star" size={18} /> {premiumGames.length} more games, including every face game
        </li>
        <li>
          <Icon name="user" size={18} /> Everyone in your party gets them while you're in the room
        </li>
        <li>
          <Icon name="check" size={18} /> New games as they launch
        </li>
      </ul>

      {native ? (
        plans === null ? (
          <div class="row" style={{ justifyContent: 'center' }}>
            <div class="spin" />
          </div>
        ) : plans.length === 0 ? (
          <p class="small center-text" style={{ margin: 0 }}>
            Plans couldn't load right now. Check your connection and try again.
          </p>
        ) : (
          <div class="pw-plans" role="radiogroup" aria-label="Plans">
            {plans.map((p) => (
              <button key={p.id} role="radio" aria-checked={pick === p.id} class={'pw-plan' + (pick === p.id ? ' on' : '')} onClick={() => setPick(p.id)}>
                <span class="pw-plan-name">{p.period === 'year' ? 'Yearly' : p.period === 'month' ? 'Monthly' : p.title}</span>
                <span class="pw-plan-price">
                  {p.price}
                  {p.period !== 'lifetime' && <small> / {PERIOD[p.period]}</small>}
                </span>
                {p.perMonth && <span class="pw-plan-note">{p.perMonth} a month</span>}
                {p.intro && <span class="pw-plan-note">{p.intro}</span>}
              </button>
            ))}
          </div>
        )
      ) : (
        <div class="label tight col" style={{ gap: 8, color: 'var(--ink)' }}>
          <strong>Get Premium in the RiffRaff app</strong>
          <span class="small">Subscribe on your iPhone or Android phone{AUTH_ENABLED ? ', then sign in here with the same account to play Premium games on the web too' : ''}.</span>
          <div class="row wrap" style={{ gap: 8 }}>
            {APP.appStoreUrl && (
              <button class="btn sm" onClick={() => openExternal(APP.appStoreUrl)}>
                App Store
              </button>
            )}
            {APP.playStoreUrl && (
              <button class="btn sm" onClick={() => openExternal(APP.playStoreUrl)}>
                Google Play
              </button>
            )}
            {!APP.appStoreUrl && !APP.playStoreUrl && <span class="small muted">The apps are coming soon to the App Store and Google Play.</span>}
          </div>
          {AUTH_ENABLED && !acct.user && onSignIn && (
            <button class="btn sm ghost" style={{ alignSelf: 'flex-start' }} onClick={onSignIn}>
              Already subscribed? Sign in
            </button>
          )}
        </div>
      )}

      {err && (
        <div class="label tight error-label" role="alert">
          {err}
        </div>
      )}

      {native && (
        <>
          <button class="btn primary big-cta" disabled={!plan || busy} onClick={subscribe}>
            {busy ? 'One moment…' : plan ? `Continue with ${plan.period === 'year' ? 'yearly' : plan.period === 'month' ? 'monthly' : 'this plan'}` : 'Choose a plan'}
          </button>
          <div class="row" style={{ justifyContent: 'center', gap: 8 }}>
            <button class="btn ghost sm" disabled={busy} onClick={restore}>
              Restore purchases
            </button>
            {AUTH_ENABLED && !acct.user && onSignIn && (
              <button class="btn ghost sm" disabled={busy} onClick={onSignIn}>
                Sign in
              </button>
            )}
          </div>
          <p class="pw-fine">
            Payment is charged to your {store} when you confirm. The subscription renews automatically at the same price unless you cancel at least 24 hours before the end of the current period. Manage or cancel any time in your {store} settings.
          </p>
        </>
      )}

      <div class="row" style={{ justifyContent: 'center', gap: 14 }}>
        <a class="small pw-link" href={legalUrl('terms')} target="_blank" rel="noopener" onClick={(e) => isNativeShell() && (e.preventDefault(), openExternal(legalUrl('terms')))}>
          Terms of Use
        </a>
        <a class="small pw-link" href={legalUrl('privacy')} target="_blank" rel="noopener" onClick={(e) => isNativeShell() && (e.preventDefault(), openExternal(legalUrl('privacy')))}>
          Privacy Policy
        </a>
      </div>
    </Sheet>
  );
}
