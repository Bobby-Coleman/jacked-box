// Stable file name for a pre-rendered spoken line (shared by the voice player and the generator).
export function clipName(text) {
  const t = String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
  let h = 0x811c9dc5;
  for (let i = 0; i < t.length; i++) {
    h ^= t.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return 'p-' + h.toString(36);
}
