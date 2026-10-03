// Throw a reaction: tap an emoji and it floats up on every phone in the room.
import { useEffect, useRef, useState } from 'preact/hooks';
import { Icon, send, now as hostNow } from '../ui/common.jsx';
import { sfx } from '../audio/sfx.js';

export const REACTIONS = ['😂', '🔥', '😱', '👏', '🍅', '💀'];

export function ReactButton({ open, onToggle }) {
  return (
    <button class={'icon-btn' + (open ? ' speaker-on' : '')} onClick={onToggle} aria-label="Throw a reaction" aria-expanded={open}>
      <Icon name="smile" />
    </button>
  );
}

export function ReactTray({ onClose }) {
  const last = useRef(0);
  const fire = (e) => {
    const t = Date.now();
    if (t - last.current < 600) return;
    last.current = t;
    sfx('pop');
    send('react', { e });
  };
  return (
    <div class="react-tray" role="toolbar" aria-label="Reactions">
      {REACTIONS.map((e) => (
        <button key={e} class="react-btn" onClick={() => fire(e)} aria-label={`React ${e}`}>
          {e}
        </button>
      ))}
      <button class="react-btn close" onClick={onClose} aria-label="Close reactions">
        <Icon name="close" size={18} />
      </button>
    </div>
  );
}

// Floating layer: shows reactions as they arrive (including your own).
export function ReactLayer({ s }) {
  const seen = useRef(null);
  const [items, setItems] = useState([]);
  useEffect(() => {
    const list = s.reacts || [];
    if (seen.current === null) {
      seen.current = s.reactN || 0;
      return;
    }
    const t = hostNow();
    const fresh = list.filter((r) => r.n > seen.current && t - r.at < 5000);
    seen.current = s.reactN || 0;
    if (!fresh.length) return;
    const add = fresh.map((r) => ({
      key: r.n,
      e: r.e,
      who: s.players[r.p] ? s.players[r.p].name : '',
      color: s.players[r.p] ? s.players[r.p].color : '#888',
      x: 8 + Math.random() * 74,
    }));
    setItems((cur) => cur.concat(add).slice(-14));
    const keys = add.map((a) => a.key);
    setTimeout(() => setItems((cur) => cur.filter((c) => !keys.includes(c.key))), 2600);
  }, [s.reactN]);
  if (!items.length) return null;
  return (
    <div class="react-layer" aria-hidden="true">
      {items.map((it) => (
        <span class="react-pop" key={it.key} style={{ left: it.x + '%' }}>
          <span>{it.e}</span>
          <span class="react-who" style={{ background: it.color }}>
            {it.who}
          </span>
        </span>
      ))}
    </div>
  );
}
