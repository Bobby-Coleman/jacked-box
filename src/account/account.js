// Accounts and Premium. Everyone starts as a guest and can play right away (no login to join a
// party). Signing in (Supabase) saves your profile across devices and ties a subscription to you.
// Premium comes from the App Store / Google Play via RevenueCat on the apps, or from the
// account's server-side entitlement on the web (kept in sync by the RevenueCat webhook).
import { AUTH_ENABLED, AUTH_METHODS, SUPABASE, GOOGLE, EARLY_ACCESS } from '../config.js';
import { isNativeShell, platformName, load, save } from '../platform.js';
import * as store from './purchases.js';

export const account = {
  ready: false,
  user: null, // { id, email, provider }
  premium: false,
  premiumSource: null, // 'store' | 'account' | 'dev'
  premiumUntil: null,
  willRenew: false,
};

const subs = new Set();
export function onAccount(fn) {
  subs.add(fn);
  return () => subs.delete(fn);
}
function emit() {
  for (const fn of subs) fn(account);
}

export { AUTH_ENABLED, AUTH_METHODS };

// ---------- Supabase client (loaded only when configured) ----------

let sbPromise = null;
export function supabase() {
  if (!AUTH_ENABLED) return Promise.resolve(null);
  if (!sbPromise) {
    sbPromise = import('@supabase/supabase-js').then(({ createClient }) =>
      createClient(SUPABASE.url, SUPABASE.anonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: !isNativeShell(),
          flowType: 'pkce',
          storage: nativeStorage(),
        },
      }),
    );
  }
  return sbPromise;
}

// In the native apps, keep the session in Preferences (WebView storage can be evicted).
function nativeStorage() {
  if (!isNativeShell()) return undefined;
  const prefs = import('@capacitor/preferences').then((m) => m.Preferences);
  return {
    getItem: async (key) => (await (await prefs).get({ key })).value,
    setItem: async (key, value) => (await prefs).set({ key, value }),
    removeItem: async (key) => (await prefs).remove({ key }),
  };
}

// ---------- startup ----------

let started = false;
export async function initAccount() {
  if (started) return;
  started = true;
  const cached = load('rr.premium');
  if (cached && cached.until && Date.parse(cached.until) > Date.now()) setPremium(true, cached.source, cached.until, cached.renew);
  if (devPremium()) setPremium(true, 'dev');
  if (EARLY_ACCESS) setPremium(true, 'early');
  store.onStoreChange(applyStore);
  try {
    const sb = await supabase();
    if (sb) {
      const { data } = await sb.auth.getSession();
      await applySession(data && data.session);
      sb.auth.onAuthStateChange((_event, session) => {
        // Don't await inside the auth callback (supabase-js holds a lock during it).
        setTimeout(() => applySession(session), 0);
      });
    }
  } catch (e) {
    console.warn('accounts unavailable', e);
  }
  await store.initStore(account.user && account.user.id);
  account.ready = true;
  emit();
}

async function applySession(session) {
  const u = session && session.user;
  const before = account.user && account.user.id;
  account.user = u
    ? {
        id: u.id,
        email: u.email || '',
        provider: (u.app_metadata && u.app_metadata.provider) || 'email',
      }
    : null;
  if ((account.user && account.user.id) !== before) {
    await store.identify(account.user && account.user.id);
    if (account.user) {
      await syncProfile();
      await refreshEntitlement();
    } else if (account.premiumSource === 'account') {
      setPremium(false);
    }
  }
  emit();
}

// ---------- premium ----------

function setPremium(on, source = null, until = null, renew = false) {
  const changed = account.premium !== !!on || account.premiumSource !== source;
  account.premium = !!on;
  account.premiumSource = on ? source : null;
  account.premiumUntil = on ? until : null;
  account.willRenew = on ? !!renew : false;
  if (on && until && source !== 'dev') save('rr.premium', { source, until, renew });
  if (!on) save('rr.premium', null);
  if (changed) emit();
}

function applyStore(info) {
  // The store is the source of truth on the apps.
  if (devPremium() || EARLY_ACCESS) return;
  if (info && info.active) setPremium(true, 'store', info.until, info.willRenew);
  else if (account.premiumSource === 'store' || (account.premiumSource !== 'account' && account.premium)) setPremium(false);
}

// Web (and a backstop on the apps): the account's entitlement row, written by the webhook.
export async function refreshEntitlement() {
  const sb = await supabase();
  if (!sb || !account.user) return;
  const { data, error } = await sb.from('entitlements').select('premium, expires_at, will_renew').eq('user_id', account.user.id).maybeSingle();
  if (error) return;
  const active = !!(data && data.premium && (!data.expires_at || Date.parse(data.expires_at) > Date.now()));
  if (active) setPremium(true, account.premiumSource === 'store' ? 'store' : 'account', data.expires_at, data.will_renew);
  else if (account.premiumSource === 'account') setPremium(false);
}

// Dev builds and ?dev=1: a switch to try Premium games without buying anything.
function devPremium() {
  return !!load('rr.devPremium') && (import.meta.env.DEV || new URLSearchParams(location.search).get('dev') === '1');
}
export function setDevPremium(on) {
  save('rr.devPremium', on ? 1 : null);
  if (on) setPremium(true, 'dev');
  else {
    setPremium(false);
    store.refresh();
    refreshEntitlement();
  }
}

// ---------- sign in ----------

export async function sendEmailCode(email) {
  const sb = await supabase();
  if (!sb) throw new Error('Sign-in is not set up yet.');
  const { error } = await sb.auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: true } });
  if (error) throw new Error(friendly(error));
}

export async function verifyEmailCode(email, code) {
  const sb = await supabase();
  const { error } = await sb.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'email' });
  if (error) throw new Error(friendly(error));
}

let socialReady = null;
async function social() {
  if (!socialReady) {
    socialReady = import('@capgo/capacitor-social-login').then(async ({ SocialLogin }) => {
      await SocialLogin.initialize({
        google: AUTH_METHODS.google ? { webClientId: GOOGLE.webClientId, iOSClientId: GOOGLE.iosClientId, iOSServerClientId: GOOGLE.webClientId, mode: 'online' } : undefined,
        apple: AUTH_METHODS.apple ? {} : undefined,
      });
      return SocialLogin;
    });
  }
  return socialReady;
}

async function sha256Hex(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function randomNonce() {
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  return [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
}

function webRedirect() {
  const u = new URL(location.href);
  u.search = '';
  u.hash = '';
  return u.toString();
}

export async function signInWithApple() {
  const sb = await supabase();
  if (!sb) throw new Error('Sign-in is not set up yet.');
  if (isNativeShell() && platformName() === 'ios') {
    const SocialLogin = await social();
    const raw = randomNonce();
    const res = await SocialLogin.login({ provider: 'apple', options: { scopes: ['email', 'name'], nonce: await sha256Hex(raw) } });
    const token = res && res.result && res.result.idToken;
    if (!token) throw new Error('Apple sign-in was cancelled.');
    const { error } = await sb.auth.signInWithIdToken({ provider: 'apple', token, nonce: raw });
    if (error) throw new Error(friendly(error));
    return;
  }
  const { error } = await sb.auth.signInWithOAuth({ provider: 'apple', options: { redirectTo: webRedirect() } });
  if (error) throw new Error(friendly(error));
}

export async function signInWithGoogle() {
  const sb = await supabase();
  if (!sb) throw new Error('Sign-in is not set up yet.');
  if (isNativeShell()) {
    const SocialLogin = await social();
    const res = await SocialLogin.login({ provider: 'google', options: { scopes: ['email', 'profile'] } });
    const token = res && res.result && res.result.idToken;
    if (!token) throw new Error('Google sign-in was cancelled.');
    const { error } = await sb.auth.signInWithIdToken({ provider: 'google', token });
    if (error) throw new Error(friendly(error));
    return;
  }
  const { error } = await sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: webRedirect() } });
  if (error) throw new Error(friendly(error));
}

export async function signOut() {
  const sb = await supabase();
  if (sb) await sb.auth.signOut();
  await applySession(null);
}

// Permanently delete the account and its data (required by both app stores).
export async function deleteAccount() {
  const sb = await supabase();
  if (!sb || !account.user) return;
  const { error } = await sb.functions.invoke('delete-account', { method: 'POST' });
  if (error) throw new Error('Could not delete the account. Try again, or contact support.');
  await sb.auth.signOut();
  save('rr.premium', null);
  await applySession(null);
}

function friendly(error) {
  const m = String((error && error.message) || error || '');
  if (/rate limit|too many/i.test(m)) return 'Too many tries. Wait a minute and try again.';
  if (/expired|invalid/i.test(m) && /token|otp|code/i.test(m)) return 'That code is wrong or expired. Check your email for the latest one.';
  if (/network|fetch/i.test(m)) return "Can't reach the server. Check your connection.";
  return m || 'Something went wrong. Try again.';
}

// ---------- profile sync ----------
// Name and avatar follow your account. Your selfie never leaves your phone except
// (encrypted) to rooms you join.

let profileHooks = { get: () => null, set: () => {} };
export function useProfileHooks(get, set) {
  profileHooks = { get, set };
}

async function syncProfile() {
  const sb = await supabase();
  if (!sb || !account.user) return;
  const { data } = await sb.from('profiles').select('name, avatar').eq('id', account.user.id).maybeSingle();
  const local = profileHooks.get();
  if (data && data.name && (!local || !local.name)) profileHooks.set({ name: data.name, av: data.avatar || local.av });
  else if (local && local.name) await pushProfile(local);
}

export async function pushProfile(p) {
  const sb = await supabase();
  if (!sb || !account.user || !p || !p.name) return;
  await sb.from('profiles').upsert({ id: account.user.id, name: p.name, avatar: p.av, updated_at: new Date().toISOString() });
}

// ---------- subscriptions (re-exported for the paywall) ----------

export const purchases = store;
