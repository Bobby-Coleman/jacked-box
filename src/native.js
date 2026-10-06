// Glue for the iOS/Android apps: Android's back button, coming back from the background, and the
// launch splash screen. Does nothing on the web.
import { isNativeShell } from './platform.js';
import { store, leaveParty } from './app/session.js';

export async function initNative() {
  if (!isNativeShell()) return;
  const [{ App }, splash] = await Promise.all([import('@capacitor/app'), import('@capacitor/splash-screen').catch(() => null)]);

  App.addListener('backButton', () => {
    // 1) close an open sheet (account, paywall, menus)
    const close = document.querySelector('.sheet-backdrop .icon-btn[aria-label="Close"]');
    if (close) {
      close.click();
      return;
    }
    // 2) in a party: leaving is a big deal, so ask
    if (store.view === 'room' || store.view === 'busy') {
      if (window.confirm('Leave this party?')) leaveParty();
      return;
    }
    // 3) home: put the app in the background (like other apps do)
    App.minimizeApp().catch(() => {});
  });

  // Phones pause apps in the background; reconnect right away when we're back.
  App.addListener('resume', () => {
    if (store.link) store.link.wake();
  });

  if (splash) splash.SplashScreen.hide({ fadeOutDuration: 250 }).catch(() => {});
}
