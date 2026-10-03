// Resolves a player's face blob to an image data URL. No imports, so any UI module can use it.
let resolveBlob = () => null;

// session.js wires this to the live room link.
export function setBlobResolver(fn) {
  resolveBlob = fn;
}

export function faceSrc(p) {
  if (!p || !p.face) return null;
  const b = resolveBlob(p.face);
  return b && typeof b.img === 'string' ? b.img : null;
}
