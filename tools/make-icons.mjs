// Renders the PWA / app-store icons and the social share image from SVG.
// Usage: node tools/make-icons.mjs
import sharp from 'sharp';
import { readFileSync, writeFileSync } from 'node:fs';

const pub = new URL('../public/', import.meta.url);
const icon = readFileSync(new URL('icon.svg', pub));

// Maskable icon: same art with extra safe-zone padding on a full-bleed background.
const maskable = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#e23a2a"/>
  <g transform="translate(106 118) scale(2.85)" stroke="#1d1611" stroke-width="3.6" stroke-linejoin="round" stroke-linecap="round">
    <path d="M80 36 L92 24 L92 82 L80 94Z" fill="#a87a45"/>
    <path d="M16 36 L28 24 L92 24 L80 36Z" fill="#e8c08e"/>
    <rect x="16" y="36" width="64" height="58" fill="#d9a466"/>
    <path d="M14 38 L27 22 L94 22 L82 38Z" fill="#ffc928"/>
    <path d="M22 31 H86" stroke="#fff" stroke-width="2.6"/>
    <path d="M28 51 l12 4 M68 51 l-12 4"/>
    <circle cx="36" cy="60" r="4.4" fill="#1d1611" stroke="none"/>
    <circle cx="60" cy="60" r="4.4" fill="#1d1611" stroke="none"/>
    <path d="M34 74 Q48 90 62 74Z" fill="#fff"/>
    <path d="M34 74 H62"/>
  </g>
</svg>`;

// Social card (1200x630).
const og = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630">
  <defs>
    <pattern id="flutes" width="12" height="12" patternUnits="userSpaceOnUse">
      <rect width="12" height="12" fill="#d9a466"/>
      <rect width="2" height="12" fill="#c8924f"/>
    </pattern>
  </defs>
  <rect width="1200" height="630" fill="url(#flutes)"/>
  <g transform="translate(110 130) scale(3.7)" stroke="#1d1611" stroke-width="3.6" stroke-linejoin="round" stroke-linecap="round">
    <path d="M18 70 Q-6 74 -14 54 Q-20 40 -12 28 Q-6 20 2 26 Q4 36 -2 42 Q2 56 18 56Z" fill="#d9a466"/>
    <path d="M-12 28 Q-22 14 -10 6 Q2 2 4 16 Q4 24 2 26" fill="#e8c08e"/>
    <path d="M80 70 Q104 74 112 54 Q118 40 110 28 Q104 20 96 26 Q94 36 100 42 Q96 56 80 56Z" fill="#a87a45"/>
    <path d="M110 28 Q120 14 108 6 Q96 2 94 16 Q94 24 96 26" fill="#d9a466"/>
    <path d="M80 36 L92 24 L92 82 L80 94Z" fill="#a87a45"/>
    <path d="M16 36 L28 24 L92 24 L80 36Z" fill="#e8c08e"/>
    <rect x="16" y="36" width="64" height="58" fill="#d9a466"/>
    <path d="M14 38 L27 22 L94 22 L82 38Z" fill="#e23a2a"/>
    <path d="M22 31 H86" stroke="#fff" stroke-width="2.6"/>
    <path d="M28 51 l12 4 M68 51 l-12 4"/>
    <circle cx="36" cy="60" r="4.2" fill="#1d1611" stroke="none"/>
    <circle cx="60" cy="60" r="4.2" fill="#1d1611" stroke="none"/>
    <path d="M34 74 Q48 90 62 74Z" fill="#fff"/>
    <path d="M34 74 H62"/>
  </g>
  <g font-family="Impact, 'Arial Black', sans-serif" font-weight="900">
    <text x="590" y="250" font-size="150" fill="#e23a2a" stroke="#1d1611" stroke-width="6" paint-order="stroke">JACKED</text>
    <rect x="585" y="280" width="420" height="160" rx="12" fill="#1d1611"/>
    <text x="620" y="415" font-size="150" fill="#e9c08a">BOX</text>
  </g>
  <text x="590" y="510" font-family="'Segoe UI', Arial, sans-serif" font-weight="700" font-size="30" fill="#1d1611">Party games for a room full of phones.</text>
  <text x="590" y="560" font-family="'Segoe UI', Arial, sans-serif" font-weight="700" font-size="30" fill="#1d1611">No TV. No console. No app to install.</text>
</svg>`;

await sharp(icon).resize(192, 192).png().toFile(new URL('icon-192.png', pub).pathname.replace(/^\/(\w:)/, '$1'));
await sharp(icon).resize(512, 512).png().toFile(new URL('icon-512.png', pub).pathname.replace(/^\/(\w:)/, '$1'));
await sharp(Buffer.from(maskable)).resize(512, 512).png().toFile(new URL('icon-maskable-512.png', pub).pathname.replace(/^\/(\w:)/, '$1'));
await sharp(Buffer.from(maskable)).resize(1024, 1024).png().toFile(new URL('icon-store-1024.png', pub).pathname.replace(/^\/(\w:)/, '$1'));
await sharp(Buffer.from(og)).png().toFile(new URL('og.png', pub).pathname.replace(/^\/(\w:)/, '$1'));
writeFileSync(new URL('maskable.svg', pub), maskable);
console.log('icons written');
