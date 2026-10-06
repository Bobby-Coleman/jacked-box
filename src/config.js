// App-wide configuration. Service keys come from build-time environment variables
// (see .env.example). Every service is optional: with nothing configured RiffRaff runs
// in guest mode, which is how the game has always worked. Only publishable keys belong
// here; secrets (ElevenLabs, Supabase service role, RevenueCat webhook secret) live on
// the server side, never in the app.
const env = import.meta.env || {};

export const APP = {
  name: 'RiffRaff',
  tagline: 'Party games for a room full of phones',
  version: '1.0.0',
  // Public website: invites from the native apps point here.
  url: env.VITE_PUBLIC_URL || 'https://bobby-coleman.github.io/jacked-box/',
  supportEmail: env.VITE_SUPPORT_EMAIL || '',
  supportUrl: env.VITE_SUPPORT_URL || 'https://github.com/Bobby-Coleman/jacked-box/issues',
  // Store pages, once the apps are live (shown on the web paywall).
  appStoreUrl: env.VITE_APP_STORE_URL || '',
  playStoreUrl: env.VITE_PLAY_STORE_URL || '',
};

// Accounts (Supabase: https://supabase.com, free tier; open source).
export const SUPABASE = {
  url: env.VITE_SUPABASE_URL || '',
  anonKey: env.VITE_SUPABASE_ANON_KEY || '',
};
export const AUTH_ENABLED = !!(SUPABASE.url && SUPABASE.anonKey);

// Sign-in methods. Email codes work as soon as Supabase is set up; Apple and Google
// also need their provider set up in Supabase (and client IDs for native Google).
export const AUTH_METHODS = {
  email: AUTH_ENABLED,
  apple: AUTH_ENABLED && env.VITE_AUTH_APPLE === 'true',
  google: AUTH_ENABLED && env.VITE_AUTH_GOOGLE === 'true',
};
export const GOOGLE = {
  webClientId: env.VITE_GOOGLE_WEB_CLIENT_ID || '',
  iosClientId: env.VITE_GOOGLE_IOS_CLIENT_ID || '',
};

// Subscriptions (RevenueCat over Apple / Google billing). Public SDK keys only.
export const PURCHASES = {
  iosKey: env.VITE_RC_IOS_KEY || '',
  androidKey: env.VITE_RC_ANDROID_KEY || '',
  entitlement: 'premium',
};

// Early access: everyone gets Premium (for a beta before the stores are set up).
export const EARLY_ACCESS = env.VITE_EARLY_ACCESS === 'true';

// Live host voice for things players type (premium rooms), served by the `tts`
// edge function, which holds the ElevenLabs key server-side.
export const LIVE_VOICE = AUTH_ENABLED && env.VITE_LIVE_VOICE === 'true';
