// Visual identity for each game: colors and a small glyph used on cards and title screens.
const INK = '#1d1611';

const glyphs = {
  zinger: (a) => (
    <g stroke={INK} stroke-width="3" stroke-linejoin="round" stroke-linecap="round">
      <path d="M12 30c-3-8 0-18 9-20 6-1 13 0 16 5 3 5 2 12-2 15l-3 2H17z" fill={a} />
      <path d="M17 32h17v8a2 2 0 01-2 2H19a2 2 0 01-2-2z" fill="#fff" />
      <path d="M28 18c3 0 5 2 5 5" fill="none" />
    </g>
  ),
  fib: (a) => (
    <g stroke={INK} stroke-width="3" stroke-linejoin="round" stroke-linecap="round">
      <circle cx="17" cy="24" r="11" fill={a} />
      <path d="M26 22h16l-3 4H27" fill={a} />
      <circle cx="14" cy="21" r="1.8" fill={INK} stroke="none" />
      <path d="M11 29q4 3 8 0" fill="none" />
    </g>
  ),
  sketch: (a) => (
    <g stroke={INK} stroke-width="3" stroke-linejoin="round">
      <path d="M10 38l4-10 20-20 6 6-20 20z" fill={a} />
      <path d="M14 28l6 6" fill="none" />
      <path d="M10 38l4-10 6 6z" fill="#f3d9b1" />
      <path d="M30 12l6 6" fill="none" />
    </g>
  ),
  phone: (a) => (
    <g stroke={INK} stroke-width="3" stroke-linejoin="round" stroke-linecap="round">
      <path d="M8 18c0-5 7-8 16-8s16 3 16 8l-1 4h-8l-1-4H18l-1 4H9z" fill={a} />
      <path d="M14 26h20l4 12H10z" fill="#fff" />
      <circle cx="24" cy="32" r="3" fill={a} />
    </g>
  ),
  blend: (a) => (
    <g stroke={INK} stroke-width="3" stroke-linecap="round">
      <circle cx="24" cy="24" r="15" fill={a} />
      <path d="M24 24c2 0 3 1 3 3s-2 4-5 4-6-3-6-7 4-9 9-9 10 4 10 10" fill="none" />
    </g>
  ),
  dial: (a) => (
    <g stroke={INK} stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
      <path d="M6 34a18 18 0 0136 0z" fill="#fff" />
      <path d="M24 34L15 18" />
      <path d="M30 18.5a18 18 0 016 6.5l-12 9z" fill={a} />
      <circle cx="24" cy="34" r="3" fill={INK} />
    </g>
  ),
  herd: (a) => (
    <g stroke={INK} stroke-width="3" stroke-linejoin="round">
      <path d="M8 16l6 3M40 16l-6 3" stroke-linecap="round" />
      <path d="M13 17h22c2 6 2 14-2 20H15c-4-6-4-14-2-20z" fill="#fff" />
      <path d="M15 17h9v8c-4 2-8 0-10-3z" fill={INK} stroke="none" />
      <ellipse cx="24" cy="34" rx="9" ry="6" fill={a} />
      <circle cx="21" cy="34" r="1.3" fill={INK} stroke="none" />
      <circle cx="27" cy="34" r="1.3" fill={INK} stroke="none" />
    </g>
  ),
  bomb: (a) => (
    <g stroke={INK} stroke-width="3" stroke-linejoin="round" stroke-linecap="round">
      <circle cx="21" cy="28" r="13" fill="#2a2a2a" />
      <path d="M29 17l4-4" />
      <path d="M33 13q3-5 7-3" fill="none" />
      <path d="M40 6l1 4M44 10l-4 1M37 7l2 3" stroke={a} />
      <circle cx="16" cy="23" r="3" fill="#fff" stroke="none" opacity="0.6" />
    </g>
  ),
  noon: (a) => (
    <g stroke={INK} stroke-width="3" stroke-linejoin="round">
      <path d="M24 5l5 10 11 1-8 8 2 11-10-5-10 5 2-11-8-8 11-1z" fill={a} />
      <circle cx="24" cy="21" r="4" fill="#fff" />
    </g>
  ),
  dead: (a) => (
    <g stroke={INK} stroke-width="3" stroke-linejoin="round" stroke-linecap="round">
      <path d="M8 24h32" />
      <rect x="4" y="15" width="8" height="18" rx="2" fill="#555" />
      <rect x="36" y="15" width="8" height="18" rx="2" fill="#555" />
      <path d="M17 20a7 7 0 0114 0v3l-2 2v3h-10v-3l-2-2z" fill={a} />
      <circle cx="21.5" cy="21" r="1.8" fill={INK} stroke="none" />
      <circle cx="26.5" cy="21" r="1.8" fill={INK} stroke="none" />
      <path d="M22 28v-2M24 28v-2M26 28v-2" stroke-width="2" />
    </g>
  ),
  seat: (a) => (
    <g stroke={INK} stroke-width="3" stroke-linejoin="round" stroke-linecap="round">
      <path d="M14 26h20v-14a3 3 0 00-3-3H17a3 3 0 00-3 3z" fill={a} />
      <path d="M11 26h26v6H11z" fill="#fff" />
      <path d="M14 32l-2 10M34 32l2 10" />
      <path d="M19 9c-1-4 2-5 2-7M27 9c1-3-1-5 1-7" stroke={a} />
    </g>
  ),
  head: (a) => (
    <g stroke={INK} stroke-width="3" stroke-linejoin="round" stroke-linecap="round">
      <path d="M12 42c0-10 5-16 12-16s12 6 12 16" fill="#fff" />
      <circle cx="24" cy="18" r="9" fill="#fff" />
      <rect x="13" y="3" width="22" height="12" rx="2.5" fill={a} />
      <path d="M17 9h14" stroke="#fff" />
    </g>
  ),
};

export const GAME_META = {
  zinger: { id: 'zinger', name: 'Zinger Ring', bg: '#1d2a5c', fg: '#ffffff', accent: '#ff3b3b' },
  fib: { id: 'fib', name: 'Fib Factory', bg: '#2a2a2a', fg: '#ffc928', accent: '#ffc928' },
  sketch: { id: 'sketch', name: 'Sketchy', bg: '#f4f1e8', fg: '#1d1611', accent: '#ff5a36' },
  phone: { id: 'phone', name: 'Telephoney', bg: '#ff9fbe', fg: '#1d1611', accent: '#18b39c' },
  blend: { id: 'blend', name: 'Blend In', bg: '#1f6a3e', fg: '#f2ffd6', accent: '#b6e34a' },
  dial: { id: 'dial', name: 'Mind Dial', bg: '#15284a', fg: '#ffe9c9', accent: '#ff8a1f' },
  herd: { id: 'herd', name: 'Moojority', bg: '#8fcf5a', fg: '#1d1611', accent: '#ff7ac6' },
  bomb: { id: 'bomb', name: 'Tick Tock Boom', bg: '#151515', fg: '#ff4040', accent: '#ff4040' },
  noon: { id: 'noon', name: 'High Noon', bg: '#f0a04b', fg: '#3b1d0e', accent: '#c4441c' },
  head: { id: 'head', name: 'Forehead', bg: '#ffde3b', fg: '#1d1611', accent: '#ff3d8b' },
  dead: { id: 'dead', name: 'Dead Lift', bg: '#1f2b2a', fg: '#efe9dc', accent: '#9ff5d0' },
  seat: { id: 'seat', name: 'Hot Seat', bg: '#c4271c', fg: '#fff3e2', accent: '#ffd36b' },
};

export function GameGlyph({ id, size = 44 }) {
  const m = GAME_META[id];
  const g = glyphs[id];
  if (!m || !g) return null;
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden="true" style={{ flex: 'none' }}>
      {g(m.accent === m.bg ? '#fff' : m.accent)}
    </svg>
  );
}
