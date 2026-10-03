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
  photo: (a) => (
    <g stroke={INK} stroke-width="3" stroke-linejoin="round" stroke-linecap="round">
      <rect x="5" y="8" width="38" height="32" rx="2" fill={a} />
      <rect x="11" y="14" width="26" height="20" fill="#fff" />
      <ellipse cx="20" cy="24" rx="5" ry="6" fill="#f3c9a0" />
      <ellipse cx="30" cy="25" rx="4.5" ry="5.5" fill="#d9a07a" />
      <path d="M15 33l5-4 4 3 5-5 8 6" fill="none" stroke-width="2.4" />
    </g>
  ),
  zoom: (a) => (
    <g stroke={INK} stroke-width="3" stroke-linejoin="round" stroke-linecap="round">
      <circle cx="20" cy="20" r="13" fill="#0f2a24" />
      <path d="M14 14h4v4h-4zM22 14h4v4h-4zM18 18h4v4h-4zM14 22h4v4h-4zM22 22h4v4h-4z" fill={a} stroke="none" />
      <circle cx="20" cy="20" r="13" fill="none" />
      <path d="M30 30l11 11" stroke-width="5" />
    </g>
  ),
  frank: (a) => (
    <g stroke={INK} stroke-width="3" stroke-linejoin="round" stroke-linecap="round">
      <path d="M11 10h26v26a6 6 0 01-6 6H17a6 6 0 01-6-6z" fill={a} />
      <path d="M11 10h26v7H11z" fill={INK} />
      <path d="M6 28h5M37 28h5" stroke-width="4" />
      <path d="M11 24h26" stroke-width="2" />
      <path d="M16 22v4M22 22v4M28 22v4M34 22v4" stroke-width="1.8" />
      <circle cx="18" cy="31" r="1.8" fill={INK} stroke="none" />
      <circle cx="30" cy="31" r="1.8" fill={INK} stroke="none" />
      <path d="M19 37h10" />
    </g>
  ),
  wanted: (a) => (
    <g stroke={INK} stroke-width="3" stroke-linejoin="round" stroke-linecap="round">
      <path d="M9 5h30v38H9z" fill={a} />
      <path d="M14 11h20" stroke-width="3.5" />
      <rect x="16" y="16" width="16" height="15" fill="#c9a46a" />
      <circle cx="24" cy="22" r="3.5" fill={INK} stroke="none" />
      <path d="M18 31c1-4 3-5 6-5s5 1 6 5" fill={INK} stroke="none" />
      <path d="M15 37h18" stroke-width="2.4" />
    </g>
  ),
  pull: (a) => (
    <g stroke={INK} stroke-width="3" stroke-linejoin="round" stroke-linecap="round">
      <path d="M6 16a3 3 0 013-3h7l3-5h10l3 5h7a3 3 0 013 3v20a3 3 0 01-3 3H9a3 3 0 01-3-3z" fill={a} />
      <circle cx="24" cy="26" r="9" fill="#fff" />
      <circle cx="21" cy="24" r="1.4" fill={INK} stroke="none" />
      <circle cx="27" cy="24" r="1.4" fill={INK} stroke="none" />
      <ellipse cx="24" cy="29.5" rx="3" ry="2.2" fill={INK} stroke="none" />
    </g>
  ),
  fraud: (a) => (
    <g stroke={INK} stroke-width="3" stroke-linejoin="round" stroke-linecap="round">
      <path d="M24 6C13 6 5 13 5 22c0 8 7 12 12 10 3-1 4 2 3 5-1 4 2 6 6 5 9-2 17-9 17-19S35 6 24 6z" fill={a} />
      <circle cx="15" cy="18" r="3" fill="#ff3b3b" />
      <circle cx="24" cy="13" r="3" fill="#2f7bff" />
      <circle cx="33" cy="17" r="3" fill="#19b66a" />
      <path d="M30 27q2-4 5-2t-1 5l-2 1v2" fill="none" stroke-width="2.6" />
      <circle cx="32" cy="36" r="1.2" fill={INK} stroke="none" />
    </g>
  ),
  pants: (a) => (
    <g stroke={INK} stroke-width="3" stroke-linejoin="round" stroke-linecap="round">
      <path d="M13 12h22l3 30h-9l-5-19-5 19h-9z" fill="#3d6cc9" />
      <path d="M13 12h22v5H13z" fill="#2c4f96" />
      <path d="M20 44c-5-3-4-8 0-12 0 3 2 4 3 4 0-3 0-5 3-8 1 4 5 7 3 12-1 3-4 5-9 4z" fill={a} />
      <path d="M22 41c-1-2 0-4 2-5 0 1 1 2 2 2 1 2 0 3-1 4z" fill="#ffd400" stroke-width="1.5" />
    </g>
  ),
  split: (a) => (
    <g stroke={INK} stroke-width="3" stroke-linejoin="round" stroke-linecap="round">
      <path d="M24 6a18 18 0 000 36z" fill={a} />
      <path d="M24 6a18 18 0 010 36z" fill="#ff3d7f" />
      <path d="M24 4v40" />
      <path d="M12 24l3 3 5-6" stroke="#fff" stroke-width="2.6" fill="none" />
      <path d="M29 20l7 8M36 20l-7 8" stroke="#fff" stroke-width="2.6" />
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
  photo: { id: 'photo', name: 'Photobomb', bg: '#1e4d4a', fg: '#fff7e0', accent: '#e3b23c' },
  zoom: { id: 'zoom', name: 'Zoom & Enhance', bg: '#0a1214', fg: '#c8ffe9', accent: '#2bffb0' },
  frank: { id: 'frank', name: 'Frankenface', bg: '#16231d', fg: '#eaf7e0', accent: '#c9ff4a' },
  wanted: { id: 'wanted', name: 'Most Wanted', bg: '#6b3f1d', fg: '#fbecd0', accent: '#ead2a2' },
  pull: { id: 'pull', name: 'Pull a Face', bg: '#141414', fg: '#ffffff', accent: '#ffd400' },
  fraud: { id: 'fraud', name: 'Art Fraud', bg: '#5b1220', fg: '#fff4e2', accent: '#d9a441' },
  pants: { id: 'pants', name: 'Pants on Fire', bg: '#22201f', fg: '#fff1e6', accent: '#ff6a1f' },
  split: { id: 'split', name: 'Split Decision', bg: '#181634', fg: '#f6f3ff', accent: '#12c2a9' },
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
