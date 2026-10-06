import { useEffect, useState } from 'preact/hooks';
import { useStore, Toaster } from '../ui/common.jsx';
import { resume } from './session.js';
import { Home } from './Home.jsx';
import { Room } from './Room.jsx';
import { Onboarding, needsOnboarding } from './Onboarding.jsx';
import { Boxter } from '../ui/Avatar.jsx';
import { initAccount } from '../account/account.js';

let resumed = false;

export function App() {
  const st = useStore();
  const [onboard, setOnboard] = useState(() => needsOnboarding());
  useEffect(() => {
    if (!resumed) {
      resumed = true;
      initAccount();
      if (resume()) setOnboard(false);
    }
  }, []);
  return (
    <div class="frame">
      {st.view === 'home' && (onboard ? <Onboarding onDone={() => setOnboard(false)} /> : <Home />)}
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
      <p class="muted small">Connecting through several relay servers at once, for reliability.</p>
    </div>
  );
}
