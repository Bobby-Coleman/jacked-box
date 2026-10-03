// Procedural "box buddy" avatars: every player is a little cardboard box with a face.
// Parts: b = box style (0-7), e = eyes (0-11), m = mouth (0-11), h = headwear (0-13).
// If the player added a selfie, their real face peeks out of the front of the box.
import { useRef } from 'preact/hooks';
import { faceSrc } from './faceRegistry.js';

const INK = '#1d1611';
let clipSeq = 0;

export const AV_PARTS = { b: 8, e: 12, m: 12, h: 14 };

export function randomAvatar() {
  const r = (n) => Math.floor(Math.random() * n);
  return { b: r(8), e: r(12), m: r(12), h: r(14) };
}

export function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255;
  let g = (n >> 8) & 255;
  let b = n & 255;
  if (amt > 0) {
    r += (255 - r) * amt;
    g += (255 - g) * amt;
    b += (255 - b) * amt;
  } else {
    r *= 1 + amt;
    g *= 1 + amt;
    b *= 1 + amt;
  }
  const h = (x) => Math.round(x).toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`;
}

function geom(b) {
  if (b === 6) return { x0: 20, x1: 76, y0: 26, y1: 94, d: 12 };
  if (b === 7) return { x0: 10, x1: 84, y0: 46, y1: 94, d: 10 };
  return { x0: 16, x1: 80, y0: 36, y1: 94, d: 12 };
}

function Eyes({ e, cx, y, w }) {
  const L = cx - w * 0.2;
  const R = cx + w * 0.2;
  const sw = 3.2;
  switch (e) {
    case 1:
      return (
        <g>
          <circle cx={L} cy={y} r="7.5" fill="#fff" stroke={INK} stroke-width={sw} />
          <circle cx={R} cy={y} r="7.5" fill="#fff" stroke={INK} stroke-width={sw} />
          <circle cx={L + 1.5} cy={y + 1} r="3.4" fill={INK} />
          <circle cx={R + 1.5} cy={y + 1} r="3.4" fill={INK} />
        </g>
      );
    case 2:
      return (
        <g stroke={INK} stroke-width={sw} stroke-linecap="round">
          <circle cx={L} cy={y + 2} r="3.6" fill={INK} stroke="none" />
          <circle cx={R} cy={y + 2} r="3.6" fill={INK} stroke="none" />
          <path d={`M${L - 7} ${y - 8} L${L + 5} ${y - 3}`} />
          <path d={`M${R + 7} ${y - 8} L${R - 5} ${y - 3}`} />
        </g>
      );
    case 3:
      return (
        <g stroke={INK} stroke-width={sw} stroke-linecap="round" fill="none">
          <path d={`M${L - 6} ${y} Q${L} ${y + 4} ${L + 6} ${y}`} />
          <path d={`M${R - 6} ${y} Q${R} ${y + 4} ${R + 6} ${y}`} />
          <path d={`M${L - 6} ${y - 1} L${L + 6} ${y - 1}`} />
          <path d={`M${R - 6} ${y - 1} L${R + 6} ${y - 1}`} />
        </g>
      );
    case 4:
      return (
        <g stroke={INK} stroke-width={sw} stroke-linecap="round" fill="none">
          <circle cx={L} cy={y} r="3.8" fill={INK} stroke="none" />
          <path d={`M${R - 6} ${y + 1} Q${R} ${y - 5} ${R + 6} ${y + 1}`} />
        </g>
      );
    case 5:
      return (
        <g>
          <path d={`M${L - 9} ${y - 5} H${R + 9}`} stroke={INK} stroke-width={sw} />
          <rect x={L - 9} y={y - 5} width="16" height="10" rx="4" fill={INK} />
          <rect x={R - 7} y={y - 5} width="16" height="10" rx="4" fill={INK} />
          <path d={`M${L - 5} ${y - 2} l4 0`} stroke="#fff" stroke-width="2" stroke-linecap="round" />
          <path d={`M${R - 3} ${y - 2} l4 0`} stroke="#fff" stroke-width="2" stroke-linecap="round" />
        </g>
      );
    case 6: {
      const star = (x) =>
        `M${x} ${y - 7} L${x + 2.2} ${y - 2.2} L${x + 7} ${y - 1.6} L${x + 3.4} ${y + 1.8} L${x + 4.4} ${y + 6.6} L${x} ${y + 4} L${x - 4.4} ${y + 6.6} L${x - 3.4} ${y + 1.8} L${x - 7} ${y - 1.6} L${x - 2.2} ${y - 2.2}Z`;
      return (
        <g fill="#ffd21f" stroke={INK} stroke-width="2.2" stroke-linejoin="round">
          <path d={star(L)} />
          <path d={star(R)} />
        </g>
      );
    }
    case 7:
      return (
        <g stroke={INK} stroke-width={sw} stroke-linecap="round">
          <path d={`M${L - 4} ${y - 4} l8 8 M${L + 4} ${y - 4} l-8 8`} />
          <path d={`M${R - 4} ${y - 4} l8 8 M${R + 4} ${y - 4} l-8 8`} />
        </g>
      );
    case 8:
      return (
        <g>
          <ellipse cx={L} cy={y} rx="7" ry="6" fill="#fff" stroke={INK} stroke-width={sw} />
          <ellipse cx={R} cy={y} rx="7" ry="6" fill="#fff" stroke={INK} stroke-width={sw} />
          <circle cx={L + 3.6} cy={y} r="3" fill={INK} />
          <circle cx={R + 3.6} cy={y} r="3" fill={INK} />
          <path d={`M${L - 7} ${y - 2} H${L + 7} M${R - 7} ${y - 2} H${R + 7}`} stroke={INK} stroke-width="2.4" />
        </g>
      );
    case 9: {
      const heart = (x) => `M${x} ${y + 6} C${x - 9} ${y - 1} ${x - 5} ${y - 9} ${x} ${y - 3} C${x + 5} ${y - 9} ${x + 9} ${y - 1} ${x} ${y + 6}Z`;
      return (
        <g fill="#ff3b5c" stroke={INK} stroke-width="2.2" stroke-linejoin="round">
          <path d={heart(L)} />
          <path d={heart(R)} />
        </g>
      );
    }
    case 10:
      return (
        <g>
          <circle cx={cx} cy={y} r="10" fill="#fff" stroke={INK} stroke-width={sw} />
          <circle cx={cx} cy={y + 1} r="5" fill={INK} />
          <circle cx={cx + 2} cy={y - 1} r="1.6" fill="#fff" />
        </g>
      );
    case 11:
      return (
        <g stroke={INK} stroke-width={sw} stroke-linecap="round" fill="none">
          <path d={`M${L - 6} ${y + 2} Q${L} ${y - 7} ${L + 6} ${y + 2}`} />
          <path d={`M${R - 6} ${y + 2} Q${R} ${y - 7} ${R + 6} ${y + 2}`} />
        </g>
      );
    default:
      return (
        <g fill={INK}>
          <circle cx={L} cy={y} r="4" />
          <circle cx={R} cy={y} r="4" />
          <circle cx={L + 1.3} cy={y - 1.3} r="1.2" fill="#fff" />
          <circle cx={R + 1.3} cy={y - 1.3} r="1.2" fill="#fff" />
        </g>
      );
  }
}

function Mouth({ m, cx, y }) {
  const sw = 3.2;
  const common = { stroke: INK, 'stroke-width': sw, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' };
  switch (m) {
    case 1:
      return (
        <g {...common}>
          <path d={`M${cx - 11} ${y - 3} H${cx + 11} Q${cx + 10} ${y + 11} ${cx} ${y + 11} Q${cx - 10} ${y + 11} ${cx - 11} ${y - 3}Z`} fill={INK} />
          <path d={`M${cx - 6} ${y + 7} Q${cx} ${y + 2} ${cx + 6} ${y + 7}`} fill="#ff6b81" stroke="none" />
        </g>
      );
    case 2:
      return <path d={`M${cx - 9} ${y + 2} H${cx + 9}`} {...common} fill="none" />;
    case 3:
      return <ellipse cx={cx} cy={y + 2} rx="5" ry="6.5" fill={INK} />;
    case 4:
      return (
        <g {...common}>
          <path d={`M${cx - 10} ${y} Q${cx} ${y + 6} ${cx + 10} ${y}`} fill="none" />
          <path d={`M${cx + 1} ${y + 3} q1 8 6 7 q4 -1 2 -9`} fill="#ff6b81" />
        </g>
      );
    case 5:
      return (
        <g {...common}>
          <rect x={cx - 11} y={y - 4} width="22" height="11" rx="3" fill="#fff" />
          <path d={`M${cx - 11} ${y + 1.5} H${cx + 11} M${cx - 4} ${y - 4} V${y + 7} M${cx + 4} ${y - 4} V${y + 7}`} stroke-width="2" />
        </g>
      );
    case 6:
      return <path d={`M${cx - 9} ${y + 3} Q${cx + 2} ${y + 6} ${cx + 10} ${y - 3}`} {...common} fill="none" />;
    case 7:
      return (
        <g {...common}>
          <path d={`M${cx - 6} ${y + 6} Q${cx} ${y + 10} ${cx + 6} ${y + 6}`} fill="none" />
          <path d={`M${cx} ${y - 3} Q${cx - 6} ${y - 6} ${cx - 13} ${y + 2} Q${cx - 6} ${y + 1} ${cx} ${y + 1} Q${cx + 6} ${y + 1} ${cx + 13} ${y + 2} Q${cx + 6} ${y - 6} ${cx} ${y - 3}Z`} fill={INK} />
        </g>
      );
    case 8:
      return (
        <g {...common}>
          <path d={`M${cx - 11} ${y - 1} Q${cx} ${y + 10} ${cx + 11} ${y - 1}`} fill="none" />
          <path d={`M${cx - 6} ${y + 2} l2 5 l2 -4 M${cx + 6} ${y + 2} l-2 5 l-2 -4`} fill="#fff" stroke-width="1.8" />
        </g>
      );
    case 9:
      return <path d={`M${cx - 11} ${y + 2} q3 -4 5.5 0 t5.5 0 t5.5 0 t5.5 0`} {...common} fill="none" />;
    case 10:
      return (
        <g {...common} fill="#ff3b5c">
          <path d={`M${cx - 4} ${y} q4 -4 8 0 q-4 7 -8 0Z`} />
        </g>
      );
    case 11:
      return <path d={`M${cx - 10} ${y + 6} Q${cx} ${y - 4} ${cx + 10} ${y + 6}`} {...common} fill="none" />;
    default:
      return <path d={`M${cx - 12} ${y - 2} Q${cx} ${y + 12} ${cx + 12} ${y - 2}`} {...common} fill="none" />;
  }
}

function Hat({ h, x, y, w }) {
  // (x, y) = center of the box's top face; w = its width
  const sw = 3;
  const s = { stroke: INK, 'stroke-width': sw, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' };
  switch (h) {
    case 1: // sweatband
      return (
        <g {...s}>
          <path d={`M${x - w / 2 - 2} ${y + 2} L${x - w / 2 + 6} ${y - 6} L${x + w / 2 + 2} ${y - 6} L${x + w / 2 - 6} ${y + 2}Z`} fill="#ff3b3b" />
          <path d={`M${x - w / 2 + 4} ${y - 1} H${x + w / 2 - 4}`} stroke="#fff" stroke-width="2.4" />
          <path d={`M${x + w / 2 - 2} ${y - 3} l10 6 l-3 6`} fill="none" stroke-width="3" />
        </g>
      );
    case 2: // cap
      return (
        <g {...s}>
          <path d={`M${x - 20} ${y + 2} Q${x - 20} ${y - 22} ${x} ${y - 22} Q${x + 20} ${y - 22} ${x + 20} ${y + 2}Z`} fill="#2155ff" />
          <path d={`M${x + 14} ${y + 1} Q${x + 30} ${y - 2} ${x + 38} ${y + 4} L${x + 16} ${y + 6}Z`} fill="#2155ff" />
          <circle cx={x} cy={y - 22} r="2.5" fill={INK} />
        </g>
      );
    case 3: // crown
      return (
        <g {...s}>
          <path d={`M${x - 18} ${y + 2} L${x - 20} ${y - 18} L${x - 9} ${y - 8} L${x} ${y - 22} L${x + 9} ${y - 8} L${x + 20} ${y - 18} L${x + 18} ${y + 2}Z`} fill="#ffd21f" />
          <circle cx={x} cy={y - 4} r="3" fill="#ff3b5c" stroke-width="2" />
        </g>
      );
    case 4: // top hat
      return (
        <g {...s}>
          <rect x={x - 14} y={y - 30} width="28" height="30" rx="2" fill={INK} />
          <rect x={x - 14} y={y - 10} width="28" height="6" fill="#e23a2a" stroke="none" />
          <path d={`M${x - 22} ${y + 1} H${x + 22}`} stroke-width="5" />
        </g>
      );
    case 5: // party hat
      return (
        <g {...s}>
          <path d={`M${x - 14} ${y + 2} L${x + 2} ${y - 32} L${x + 14} ${y + 2}Z`} fill="#ff7ac6" />
          <circle cx={x - 3} cy={y - 8} r="2.4" fill="#ffd21f" stroke="none" />
          <circle cx={x + 5} cy={y - 16} r="2.4" fill="#2155ff" stroke="none" />
          <circle cx={x + 2} cy={y - 34} r="4" fill="#ffd21f" />
        </g>
      );
    case 6: // beanie
      return (
        <g {...s}>
          <path d={`M${x - 19} ${y + 2} Q${x - 19} ${y - 24} ${x} ${y - 24} Q${x + 19} ${y - 24} ${x + 19} ${y + 2}Z`} fill="#19b66a" />
          <rect x={x - 21} y={y - 4} width="42" height="8" rx="3" fill="#0f7a45" />
          <circle cx={x} cy={y - 27} r="5" fill="#fff" />
        </g>
      );
    case 7: // cowboy
      return (
        <g {...s}>
          <path d={`M${x - 30} ${y - 2} Q${x - 26} ${y + 6} ${x} ${y + 5} Q${x + 26} ${y + 6} ${x + 30} ${y - 2} Q${x + 18} ${y - 4} ${x} ${y - 3} Q${x - 18} ${y - 4} ${x - 30} ${y - 2}Z`} fill="#a66a2c" />
          <path d={`M${x - 14} ${y - 3} Q${x - 16} ${y - 24} ${x - 6} ${y - 22} Q${x} ${y - 16} ${x + 6} ${y - 22} Q${x + 16} ${y - 24} ${x + 14} ${y - 3}Z`} fill="#a66a2c" />
        </g>
      );
    case 8: // bow
      return (
        <g {...s} fill="#ff3b5c">
          <path d={`M${x} ${y - 8} L${x - 16} ${y - 18} L${x - 16} ${y + 2}Z`} />
          <path d={`M${x} ${y - 8} L${x + 16} ${y - 18} L${x + 16} ${y + 2}Z`} />
          <circle cx={x} cy={y - 8} r="4.5" />
        </g>
      );
    case 9: // horns
      return (
        <g {...s} fill="#e23a2a">
          <path d={`M${x - 16} ${y} Q${x - 24} ${y - 14} ${x - 18} ${y - 26} Q${x - 14} ${y - 12} ${x - 6} ${y - 2}Z`} />
          <path d={`M${x + 16} ${y} Q${x + 24} ${y - 14} ${x + 18} ${y - 26} Q${x + 14} ${y - 12} ${x + 6} ${y - 2}Z`} />
        </g>
      );
    case 10: // halo
      return <ellipse cx={x} cy={y - 16} rx="18" ry="5.5" fill="none" stroke="#ffc928" stroke-width="5" />;
    case 11: // antenna
      return (
        <g {...s}>
          <path d={`M${x} ${y - 2} L${x - 4} ${y - 26}`} fill="none" />
          <circle cx={x - 4} cy={y - 29} r="5.5" fill="#e23a2a" />
        </g>
      );
    case 12: // chef
      return (
        <g {...s} fill="#fff">
          <path d={`M${x - 15} ${y + 2} V${y - 12} Q${x - 26} ${y - 18} ${x - 16} ${y - 28} Q${x - 10} ${y - 38} ${x} ${y - 30} Q${x + 10} ${y - 38} ${x + 16} ${y - 28} Q${x + 26} ${y - 18} ${x + 15} ${y - 12} V${y + 2}Z`} />
          <path d={`M${x - 15} ${y - 5} H${x + 15}`} />
        </g>
      );
    case 13: // mohawk
      return (
        <g {...s} fill="#8b5cf6">
          <path d={`M${x - 16} ${y} L${x - 14} ${y - 18} L${x - 8} ${y - 6} L${x - 4} ${y - 26} L${x + 1} ${y - 7} L${x + 7} ${y - 24} L${x + 9} ${y - 5} L${x + 16} ${y - 16} L${x + 16} ${y}Z`} />
        </g>
      );
    default:
      return null;
  }
}

function BoxBody({ b, color }) {
  const { x0, x1, y0, y1, d } = geom(b);
  const top = shade(color, 0.32);
  const side = shade(color, -0.28);
  const sw = 3.4;
  return (
    <g stroke={INK} stroke-width={sw} stroke-linejoin="round">
      <path d={`M${x1} ${y0} L${x1 + d} ${y0 - d} L${x1 + d} ${y1 - d} L${x1} ${y1}Z`} fill={side} />
      <path d={`M${x0} ${y0} L${x0 + d} ${y0 - d} L${x1 + d} ${y0 - d} L${x1} ${y0}Z`} fill={top} />
      <rect x={x0} y={y0} width={x1 - x0} height={y1 - y0} fill={color} />
      {b === 1 && (
        <g stroke="none" fill="rgba(255,240,200,0.75)">
          <path d={`M${(x0 + x1) / 2 - 5} ${y0} H${(x0 + x1) / 2 + 5} V${y0 + 12} H${(x0 + x1) / 2 - 5}Z`} />
          <path d={`M${(x0 + x1) / 2 - 5 + d / 2} ${y0 - d / 2} l10 0 l-${d / 2} ${d / 2} h-10Z`} />
        </g>
      )}
      {b === 2 && (
        <g fill={top}>
          <path d={`M${x0} ${y0} L${x0 - 8} ${y0 - 16} L${x0 + d - 4} ${y0 - d - 6} L${x0 + d} ${y0 - d}Z`} />
          <path d={`M${x1 + d} ${y0 - d} L${x1 + d + 8} ${y0 - d - 14} L${x1 + 6} ${y0 - 4} L${x1} ${y0}Z`} />
        </g>
      )}
      {b === 3 && <rect x={x0 + 5} y={y1 - 15} width="22" height="10" rx="1.5" fill="#e23a2a" stroke-width="2" />}
      {b === 4 && (
        <g stroke-width="2.6" fill="none">
          <path d={`M${x1 + d / 2 - 2} ${y1 - 14} v-14 m-3 4 l3 -4 l3 4`} />
        </g>
      )}
      {b === 5 && (
        <g stroke-width="2">
          <rect x={x1 - 22} y={y1 - 17} width="18" height="12" fill="#fff" />
          <path d={`M${x1 - 19} ${y1 - 13} h12 M${x1 - 19} ${y1 - 9} h8`} />
        </g>
      )}
    </g>
  );
}

export function AvatarSvg({ av, color = '#d9a466', size = 64, title, face }) {
  const a = av || { b: 0, e: 0, m: 0, h: 0 };
  const { x0, x1, y0, y1, d } = geom(a.b);
  const w = x1 - x0;
  const cx = (x0 + x1) / 2;
  const hgt = y1 - y0;
  const clip = useRef(null);
  if (face && !clip.current) clip.current = 'avc' + ++clipSeq;
  // The face window is a little inset from the box edge, like a cut-out flap.
  const fx = x0 + 4;
  const fy = y0 + 4;
  const fw = w - 8;
  const fh = hgt - 8;
  return (
    <span class="avatar" style={{ width: size, height: size }} role="img" aria-label={title || 'avatar'}>
      <svg viewBox="-4 -16 108 116" aria-hidden="true">
        <BoxBody b={a.b} color={color} />
        {face ? (
          <g>
            <defs>
              <clipPath id={clip.current}>
                <rect x={fx} y={fy} width={fw} height={fh} rx="6" />
              </clipPath>
            </defs>
            <image href={face} x={fx - fw * 0.08} y={fy - fh * 0.06} width={fw * 1.16} height={fh * 1.16} preserveAspectRatio="xMidYMid slice" clip-path={`url(#${clip.current})`} />
            <rect x={fx} y={fy} width={fw} height={fh} rx="6" fill="none" stroke={INK} stroke-width="2.6" />
          </g>
        ) : (
          <>
            <Eyes e={a.e} cx={cx} y={y0 + hgt * 0.36} w={w} />
            <Mouth m={a.m} cx={cx} y={y0 + hgt * 0.68} />
          </>
        )}
        <Hat h={a.h} x={cx + d / 2} y={y0 - d / 2} w={w} />
      </svg>
    </span>
  );
}

export function PlayerAvatar({ p, size = 56, noFace = false }) {
  if (!p) return <AvatarSvg av={{ b: 0, e: 3, m: 2, h: 0 }} color="#9c8a74" size={size} />;
  return <AvatarSvg av={p.av} color={p.color} size={size} title={p.name} face={noFace ? null : faceSrc(p)} />;
}

// BOXTER — the host. A swole cardboard box with a sweatband.
export function Boxter({ size = 120, flex = true, mood = 'grin' }) {
  const kraft = '#d9a466';
  const top = shade(kraft, 0.28);
  const side = shade(kraft, -0.25);
  return (
    <span class="avatar" style={{ width: size, height: size }} role="img" aria-label="Boxter, the host">
      <svg viewBox="-34 -22 168 150" aria-hidden="true">
        <g stroke={INK} stroke-width="3.6" stroke-linejoin="round" stroke-linecap="round">
          {flex && (
            <g fill={kraft}>
              {/* left arm flexing */}
              <path d="M18 70 Q-6 74 -14 54 Q-20 40 -12 28 Q-6 20 2 26 Q4 36 -2 42 Q2 56 18 56Z" />
              <path d="M-12 28 Q-22 14 -10 6 Q2 2 4 16 Q4 24 2 26" fill={top} />
              {/* right arm flexing */}
              <path d="M80 70 Q104 74 112 54 Q118 40 110 28 Q104 20 96 26 Q94 36 100 42 Q96 56 80 56Z" fill={side} />
              <path d="M110 28 Q120 14 108 6 Q96 2 94 16 Q94 24 96 26" fill={kraft} />
            </g>
          )}
          <path d="M80 36 L92 24 L92 82 L80 94Z" fill={side} />
          <path d="M16 36 L28 24 L92 24 L80 36Z" fill={top} />
          <rect x="16" y="36" width="64" height="58" fill={kraft} />
          <path d="M43 36 h10 v13 h-10Z" fill="rgba(255,240,200,0.75)" stroke="none" />
          {/* sweatband */}
          <path d="M14 38 L27 22 L94 22 L82 38Z" fill="#e23a2a" />
          <path d="M22 31 H86" stroke="#fff" stroke-width="2.6" />
          <path d="M92 25 l14 4 l-4 9 M93 30 l11 10" fill="none" stroke-width="3" />
          {/* brows + eyes */}
          <path d="M28 51 l12 4 M68 51 l-12 4" stroke-width="3.6" />
          <circle cx="36" cy="60" r="4.2" fill={INK} stroke="none" />
          <circle cx="60" cy="60" r="4.2" fill={INK} stroke="none" />
          {mood === 'shock' ? (
            <ellipse cx="48" cy="79" rx="7" ry="8" fill={INK} />
          ) : (
            <g>
              <path d="M34 74 Q48 90 62 74Z" fill="#fff" />
              <path d="M34 74 H62" />
            </g>
          )}
          <path d="M22 88 h8 M66 88 h8" stroke-width="2.4" opacity="0.4" />
        </g>
      </svg>
    </span>
  );
}
