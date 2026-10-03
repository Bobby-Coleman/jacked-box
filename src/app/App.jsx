import { useEffect } from 'preact/hooks';
import { useStore, Toaster } from '../ui/common.jsx';
import { resume } from './session.js';
import { Home } from './Home.jsx';
import { Room } from './Room.jsx';
import { Boxter } from '../ui/Avatar.jsx';

let resumed = false;

export function App() {
  const st = useStore();
  useEffect(() => {
    if (!resumed) {
      resumed = true;
      resume();
    }
  }, []);
  return (
    <div class="frame">
      {st.view === 'home' && <Home />}
      {st.view === 'busy' && <Busy text={st.busyText} />}
      {st.view === 'room' && <Room />}
      <Toaster />
    </div>
  );
}

function Busy({ text }) {
  return (
    <div class="screen center" style={{ alignItems: 'center', textAlign: 'center' }}>
      <div class="bob">
        <Boxter size={140} />
      </div>
      <div class="row" style={{ justifyContent: 'center' }}>
        <div class="spin" />
        <strong style={{ fontSize: '1.15rem' }}>{text}</strong>
      </div>
      <p class="muted small">Connecting through two relay servers at once, for reliability.</p>
    </div>
  );
}
