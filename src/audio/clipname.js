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

// Pre-rendered player names: "n-bobby". Null when nothing pronounceable is left.
export function nameClip(name) {
  const t = String(name || '')
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
  return t ? 'n-' + t : null;
}

// Host lines may splice a player's name in at the start or the end: "{name}, phone up!"
// or "A masterpiece by {name}!". The line is rendered without the name; the name clip is
// played before or after it.
export function nameFirst(tpl) {
  return /^\s*\{name\}/.test(tpl);
}

export function lineSpoken(tpl) {
  return String(tpl || '')
    .replace(/^\s*\{name\}[\s,!?.:;]*/, '')
    .replace(/[\s,]*\{name\}[\s!?.,]*$/, '')
    .trim();
}
