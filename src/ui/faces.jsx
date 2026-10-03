// Face photos: players can add a selfie that then stars in their avatar and in face games.
// Faces travel as blobs ({ img: dataURL }) through the room's (encrypted) relay channel.
// This module resolves a player's face to an image and caches decoded <img> elements.
import { render } from 'preact';
import { AvatarSvg } from './Avatar.jsx';
import { faceSrc, setBlobResolver } from './faceRegistry.js';

export { faceSrc, setBlobResolver };

const imgCache = new Map();

export function loadImage(src) {
  if (!src) return Promise.resolve(null);
  const hit = imgCache.get(src);
  if (hit) return hit;
  const p = new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
  imgCache.set(src, p);
  if (imgCache.size > 120) imgCache.delete(imgCache.keys().next().value);
  return p;
}

// Render a box avatar to a data URL (used as a stand-in face for players without a selfie,
// and to give test bots faces in dev mode).
export function avatarSvgDataUrl(av, color) {
  const host = document.createElement('div');
  render(<AvatarSvg av={av} color={color} size={240} />, host);
  const svg = host.querySelector('svg');
  if (!svg) return null;
  svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  svg.setAttribute('width', '240');
  svg.setAttribute('height', '240');
  const markup = new XMLSerializer().serializeToString(svg);
  render(null, host);
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(markup);
}

export async function avatarJpeg(av, color, bg = '#e9c08a') {
  const img = await loadImage(avatarSvgDataUrl(av, color));
  const c = document.createElement('canvas');
  c.width = 240;
  c.height = 240;
  const ctx = c.getContext('2d');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 240, 240);
  if (img) ctx.drawImage(img, 12, 6, 216, 216);
  return c.toDataURL('image/jpeg', 0.8);
}

// The best image we have for a player: their selfie, else their box avatar.
export function playerImageSrc(p) {
  return faceSrc(p) || (p ? avatarSvgDataUrl(p.av, p.color) : null);
}
