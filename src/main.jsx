import { render } from 'preact';
import '@fontsource/big-shoulders-stencil-display/latin-900';
import '@fontsource/lilita-one/latin-400';
import '@fontsource-variable/bricolage-grotesque/wght';
import './styles/base.css';
import './styles/app.css';
import { App } from './app/App.jsx';
import { unlock } from './audio/audio.js';
import { isNativeShell } from './platform.js';
import { initNative } from './native.js';

render(<App />, document.getElementById('app'));
initNative();

if (import.meta.env.DEV) {
  Promise.all([import('./app/session.js'), import('./audio/audio.js'), import('./audio/music.js')]).then(([session, audio, music]) => {
    window.__jb = { ...session, audio, music };
  });
}

// Any first touch unlocks audio (phones block sound until the user interacts).
const firstTouch = () => {
  unlock();
};
window.addEventListener('pointerdown', firstTouch, { passive: true });
window.addEventListener('keydown', firstTouch);

// Offline-capable shell + faster reloads at parties with bad Wi-Fi.
if ('serviceWorker' in navigator && import.meta.env.PROD && !isNativeShell()) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}
