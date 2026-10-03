import { h } from 'preact';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import qrcode from 'qrcode-generator';
import { store, subscribe } from '../app/session.js';
import { PlayerAvatar } from './Avatar.jsx';
import { sfx } from '../audio/sfx.js';

export function useStore() {
  const [, set] = useState(0);
  useEffect(() => subscribe(() => set((v) => v + 1)), []);
  return store;
}

// Host-synced clock that re-renders every `ms`.
export function useNow(ms = 250) {
  const [, set] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => set((v) => v + 1), ms);
    return () => clearInterval(iv);
  }, [ms]);
  return store.link ? store.link.now() : Date.now();
}

export function now() {
  return store.link ? store.link.now() : Date.now();
}

// ---------- icons ----------
const P = {
  sound: 'M4 9v6h4l5 4V5L8 9H4z M16 8.5a5 5 0 010 7 M18.5 6a8.5 8.5 0 010 12',
  mute: 'M4 9v6h4l5 4V5L8 9H4z M17 9l5 6 M22 9l-5 6',
  menu: 'M4 6h16 M4 12h16 M4 18h16',
  share: 'M12 3v12 M7 8l5-5 5 5 M5 13v6a2 2 0 002 2h10a2 2 0 002-2v-6',
  close: 'M6 6l12 12 M18 6L6 18',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  gear: 'M12 8.5a3.5 3.5 0 110 7 3.5 3.5 0 010-7z M12 2v3 M12 19v3 M2 12h3 M19 12h3 M4.9 4.9l2.1 2.1 M17 17l2.1 2.1 M4.9 19.1L7 17 M17 7l2.1-2.1',
  qr: 'M4 4h6v6H4z M14 4h6v6h-6z M4 14h6v6H4z M14 14h2v2h-2z M18 18h2v2h-2z M14 18h2 M18 14h2',
  crown: 'M3 8l4 4 5-7 5 7 4-4-2 11H5z',
  speaker: 'M7 3h10a1 1 0 011 1v16a1 1 0 01-1 1H7a1 1 0 01-1-1V4a1 1 0 011-1z M12 14a2.5 2.5 0 100 5 2.5 2.5 0 000-5z M12 6.5a1 1 0 100 2 1 1 0 000-2z',
  skip: 'M5 5l9 7-9 7z M17 5v14',
  back: 'M15 5l-7 7 7 7',
  dice: 'M5 4h14a1 1 0 011 1v14a1 1 0 01-1 1H5a1 1 0 01-1-1V5a1 1 0 011-1z M8.5 8.5h.01 M15.5 8.5h.01 M12 12h.01 M8.5 15.5h.01 M15.5 15.5h.01',
  undo: 'M9 14L4 9l5-5 M4 9h11a5 5 0 010 10h-3',
  trash: 'M4 7h16 M9 7V4h6v3 M6 7l1 13h10l1-13',
  heart: 'M12 20s-7-4.4-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.6-7 10-7 10z',
  smile: 'M12 3a9 9 0 110 18 9 9 0 010-18z M8.5 14.5s1.3 2 3.5 2 3.5-2 3.5-2 M9 9.5h.01 M15 9.5h.01',
};

export function Icon({ name, size = 22, stroke = 2.6 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" stroke-width={stroke} stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d={P[name] || ''} />
    </svg>
  );
}

// ---------- timer ----------
export function Timer({ g, label }) {
  const t = useNow(200);
  if (!g || !g.until) return null;
  const total = Math.max(1, g.until - g.t0);
  const left = Math.max(0, g.until - t);
  const frac = Math.min(1, left / total);
  const secs = Math.ceil(left / 1000);
  return (
    <div class={'timer' + (secs <= 5 && left > 0 ? ' low' : '')} aria-label={`${secs} seconds left`}>
      {label && <span class="eyebrow" style={{ color: 'inherit' }}>{label}</span>}
      <div class="timer-track">
        <div class="timer-fill" style={{ transform: `scaleX(${frac})` }} />
      </div>
      <span class="timer-num">{secs}</span>
    </div>
  );
}

// Plays a soft tick for the final seconds of a phase (on this phone only).
export function useFinalTicks(g, enabled = true) {
  const t = useNow(250);
  const last = useRef(-1);
  useEffect(() => {
    if (!enabled || !g || !g.until) return;
    const secs = Math.ceil((g.until - t) / 1000);
    if (secs !== last.current && secs > 0 && secs <= 5) sfx(secs % 2 ? 'tick' : 'tock');
    last.current = secs;
  });
}

// ---------- people ----------
export function PlayerChip({ p, size = 28, suffix }) {
  if (!p) return null;
  return (
    <span class="player-chip">
      <PlayerAvatar p={p} size={size} />
      <span class="nm">{p.name}</span>
      {suffix}
    </span>
  );
}

export function WaitList({ s, pids, done, size = 44 }) {
  return (
    <div class="waitlist">
      {pids.map((pid) => {
        const p = s.players[pid];
        if (!p) return null;
        const ok = done(pid);
        return (
          <span class={'w ' + (ok ? 'done' : 'pending')} key={pid} title={p.name}>
            <PlayerAvatar p={p} size={size} />
          </span>
        );
      })}
    </div>
  );
}

// ---------- answer box ----------
// Text entry that submits on Enter, and auto-submits a draft just before time runs out.
export function AnswerBox({ g, max = 60, placeholder = 'Type your answer…', onSubmit, cta = 'Submit', multiline = false, autoFocus = true, id = 'answer' }) {
  const [text, setText] = useState('');
  const ref = useRef(null);
  const sent = useRef(false);
  const t = useNow(250);
  useEffect(() => {
    sent.current = false;
    setText('');
    if (autoFocus && ref.current) setTimeout(() => ref.current && ref.current.focus(), 60);
  }, [g && g.step, id]);
  const submit = (e) => {
    if (e) e.preventDefault();
    const v = text.trim();
    if (!v || sent.current) return;
    sent.current = true;
    sfx('submit');
    onSubmit(v);
  };
  useEffect(() => {
    if (!g || !g.until || sent.current) return;
    if (g.until - t < 700 && text.trim()) submit();
  });
  const Tag = multiline ? 'textarea' : 'input';
  return (
    <form class="col" onSubmit={submit}>
      <Tag
        ref={ref}
        id={id}
        class="field"
        value={text}
        maxLength={max}
        placeholder={placeholder}
        autocomplete="off"
        autocorrect="on"
        enterkeyhint="send"
        onInput={(e) => setText(e.currentTarget.value.slice(0, max))}
        onKeyDown={(e) => {
          if (multiline && e.key === 'Enter' && !e.shiftKey) submit(e);
        }}
      />
      <div class="row spread">
        <span class="charcount">{max - text.length}</span>
      </div>
      <button class="btn primary" type="submit" disabled={!text.trim()}>
        {cta}
      </button>
    </form>
  );
}

// ---------- sheet ----------
export function Sheet({ onClose, children, title }) {
  return (
    <div class="sheet-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div class="sheet" role="dialog" aria-modal="true" aria-label={title}>
        <div class="row spread">
          <h2 class="stencil" style={{ fontSize: '1.9rem' }}>
            {title}
          </h2>
          <button class="icon-btn" onClick={onClose} aria-label="Close">
            <Icon name="close" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Switch({ on, onChange, label, id }) {
  return <button id={id} class={'switch' + (on ? ' on' : '')} role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)} />;
}

// ---------- QR ----------
export function QR({ text, size = 180 }) {
  const path = useMemo(() => {
    const qr = qrcode(0, 'M');
    qr.addData(text);
    qr.make();
    const n = qr.getModuleCount();
    let d = '';
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) d += `M${c} ${r}h1v1h-1z`;
    return { d, n };
  }, [text]);
  return (
    <svg viewBox={`-2 -2 ${path.n + 4} ${path.n + 4}`} width={size} height={size} style={{ background: '#fff', borderRadius: 10, maxWidth: '100%' }} role="img" aria-label="QR code to join">
      <path d={path.d} fill="#1d1611" shape-rendering="crispEdges" />
    </svg>
  );
}

// ---------- toast ----------
let toastSet = null;
export function Toaster() {
  const [msg, setMsg] = useState(null);
  useEffect(() => {
    toastSet = setMsg;
    return () => (toastSet = null);
  }, []);
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(null), 2200);
    return () => clearTimeout(t);
  }, [msg]);
  return msg ? <div class="toast" role="status">{msg.text}</div> : null;
}

export function toast(text) {
  if (toastSet) toastSet({ text, at: Date.now() });
}

// Utility: who am I in this state?
export function useMe() {
  const link = store.link;
  const s = link && link.state;
  const id = link && link.me.id;
  return { link, s, id, p: s && s.players[id] };
}

export function send(y, d) {
  if (store.link) store.link.send(y, d);
}

export function gsend(d) {
  const s = store.link && store.link.state;
  const g = s && s.game;
  send('g', { step: g ? g.step : undefined, ...d });
}

export function fmtScore(n) {
  return (n || 0).toLocaleString('en-US');
}
