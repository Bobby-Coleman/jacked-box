// Touch drawing pad + renderer.
// Drawing format (compact, JSON-safe):
//   { v: 1, p: ['#hex', ...palette], s: [[colorIdx, sizeIdx, x0, y0, dx1, dy1, ...], ...],
//     k: [{ who, x, y, z, r }] }   // optional face stickers: center, size, rotation (deg)
// Coordinates live on a 1000x1000 grid; stroke points after the first are deltas.
// Stickers render under the ink, so players can draw hats and mustaches on their friends.
import { useEffect, useRef, useState } from 'preact/hooks';
import { Icon } from './common.jsx';
import { sfx } from '../audio/sfx.js';
import { loadImage } from './faces.jsx';

export const SIZES = [7, 16, 34];
const GRID = 1000;
const MAX_POINTS = 7000;

function strokePoints(st) {
  const pts = [];
  let x = st[2];
  let y = st[3];
  pts.push([x, y]);
  for (let i = 4; i + 1 < st.length; i += 2) {
    x += st[i];
    y += st[i + 1];
    pts.push([x, y]);
  }
  return pts;
}

function drawStroke(ctx, st, palette, scale) {
  const pts = strokePoints(st);
  ctx.strokeStyle = palette[st[0]] || '#1d1611';
  ctx.fillStyle = ctx.strokeStyle;
  ctx.lineWidth = SIZES[st[1]] * scale;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (pts.length === 1) {
    ctx.beginPath();
    ctx.arc(pts[0][0] * scale, pts[0][1] * scale, (SIZES[st[1]] * scale) / 2, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  ctx.beginPath();
  ctx.moveTo(pts[0][0] * scale, pts[0][1] * scale);
  for (let i = 1; i < pts.length - 1; i++) {
    const mx = ((pts[i][0] + pts[i + 1][0]) / 2) * scale;
    const my = ((pts[i][1] + pts[i + 1][1]) / 2) * scale;
    ctx.quadraticCurveTo(pts[i][0] * scale, pts[i][1] * scale, mx, my);
  }
  const last = pts[pts.length - 1];
  ctx.lineTo(last[0] * scale, last[1] * scale);
  ctx.stroke();
}

// A face sticker: an oval cut-out of the selfie with a white sticker border.
export function drawSticker(ctx, k, img, scale, selected = false) {
  const ry = (k.z * scale) / 2;
  const rx = ry * 0.84;
  const b = Math.max(2, ry * 0.07);
  ctx.save();
  ctx.translate(k.x * scale, k.y * scale);
  ctx.rotate(((k.r || 0) * Math.PI) / 180);
  ctx.shadowColor = 'rgba(0,0,0,0.28)';
  ctx.shadowBlur = ry * 0.12;
  ctx.shadowOffsetY = ry * 0.04;
  ctx.beginPath();
  ctx.ellipse(0, 0, rx + b, ry + b, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.beginPath();
  ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
  ctx.save();
  ctx.clip();
  if (img) ctx.drawImage(img, -ry, -ry, ry * 2, ry * 2);
  else {
    ctx.fillStyle = '#d9cbb8';
    ctx.fillRect(-ry, -ry, ry * 2, ry * 2);
  }
  ctx.restore();
  if (selected) {
    ctx.setLineDash([ry * 0.12, ry * 0.08]);
    ctx.lineWidth = Math.max(2, ry * 0.05);
    ctx.strokeStyle = '#2155ff';
    ctx.beginPath();
    ctx.ellipse(0, 0, rx + b * 2.2, ry + b * 2.2, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function paint(canvas, data, upto = Infinity, partial = 1, imgs = {}, selected = -1) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, canvas.height);
  if (!data) return;
  const scale = w / GRID;
  (data.k || []).forEach((k, i) => drawSticker(ctx, k, imgs[k.who], scale, i === selected));
  if (!data.s) return;
  const n = Math.min(upto, data.s.length);
  for (let i = 0; i < n; i++) drawStroke(ctx, data.s[i], data.p, scale);
  if (n < data.s.length && partial < 1 && partial > 0) {
    const st = data.s[n];
    const pts = strokePoints(st);
    const k = Math.max(1, Math.floor(pts.length * partial));
    // rebuild a truncated stroke
    const cut = [st[0], st[1], st[2], st[3]];
    for (let i = 1; i < k; i++) cut.push(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    drawStroke(ctx, cut, data.p, scale);
  }
}

// Size the canvas backing store from its layout box (clientWidth ignores CSS transforms,
// so a pop-in animation can't shrink it). Display size comes from CSS (100% of the frame).
function useCanvasSize(ref, onSize) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fit = () => {
      const css = el.clientWidth || (el.parentElement && el.parentElement.clientWidth) || 300;
      const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
      const px = Math.max(1, Math.round(css * dpr));
      if (el.width !== px || el.height !== px) {
        el.width = px;
        el.height = px;
      }
      onSize();
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
}

// Load sticker face images ({ who: src }) into { who: HTMLImageElement }.
function useImages(faces) {
  const [imgs, setImgs] = useState({});
  const key = faces ? Object.entries(faces).map(([k, v]) => k + ':' + (v ? v.length : 0)).join('|') : '';
  useEffect(() => {
    let alive = true;
    const entries = Object.entries(faces || {});
    Promise.all(entries.map(([who, src]) => loadImage(src).then((img) => [who, img]))).then((pairs) => {
      if (alive) setImgs(Object.fromEntries(pairs));
    });
    return () => (alive = false);
  }, [key]);
  return imgs;
}

// Static (optionally animated) rendering of a drawing. `faces` maps sticker ids to image srcs.
export function Drawing({ data, faces, animate = false, ms = 1800, label = 'Drawing' }) {
  const ref = useRef(null);
  const dataRef = useRef(data);
  dataRef.current = data;
  const imgs = useImages(faces);
  const imgsRef = useRef(imgs);
  imgsRef.current = imgs;
  const redraw = () => paint(ref.current, dataRef.current, Infinity, 1, imgsRef.current);
  useCanvasSize(ref, redraw);
  useEffect(() => {
    if (!animate || !data || !data.s || !data.s.length) {
      redraw();
      return;
    }
    let raf;
    const t0 = performance.now();
    const total = data.s.length;
    const step = (t) => {
      const k = Math.min(1, (t - t0) / ms);
      const f = k * total;
      paint(ref.current, data, Math.floor(f), f - Math.floor(f), imgsRef.current);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [data, animate, imgs]);
  return (
    <div class="drawing-frame">
      <canvas ref={ref} role="img" aria-label={label} />
      {!data && <div class="drawing-loading">Loading drawing…</div>}
    </div>
  );
}

// Render a drawing (with stickers) to a PNG data URL, e.g. for saving or sharing.
export async function drawingToDataUrl(data, faces = {}, px = 900) {
  const c = document.createElement('canvas');
  c.width = px;
  c.height = px;
  const entries = await Promise.all(Object.entries(faces).map(async ([who, src]) => [who, await loadImage(src)]));
  paint(c, data, Infinity, 1, Object.fromEntries(entries));
  return c.toDataURL('image/png');
}

// Interactive drawing pad.
//  stickers: [{ who, src }] adds movable face stickers (Photobomb)
//  base: a drawing to show underneath (Art Fraud's shared canvas)
//  single: one stroke only; onStroke(stroke) fires when the finger lifts
export function DrawPad({ palette, onChange, disabled = false, initial = null, stickers = null, base = null, single = false, onStroke = null, fixedColor = null }) {
  const ref = useRef(null);
  const strokes = useRef(initial && initial.s ? initial.s.slice() : []);
  const stk = useRef(
    stickers
      ? stickers.map((st, i) => ({ who: st.who, x: stickers.length === 1 ? 500 : i === 0 ? 300 : 700, y: 360, z: 330, r: i === 0 ? -6 : 6 }))
      : [],
  );
  const faces = stickers ? Object.fromEntries(stickers.map((st) => [st.who, st.src])) : null;
  const imgs = useImages(faces);
  const imgsRef = useRef(imgs);
  imgsRef.current = imgs;
  const cur = useRef(null);
  const last = useRef(null);
  const drag = useRef(null);
  const [color, setColor] = useState(fixedColor != null ? fixedColor : 0);
  const [size, setSize] = useState(1);
  const [count, setCount] = useState(strokes.current.length);
  const [confirmClear, setConfirmClear] = useState(false);
  const [mode, setMode] = useState('draw');
  const [sel, setSel] = useState(0);
  const [, bump] = useState(0);
  const totalPts = useRef(0);
  const baseRef = useRef(base);
  baseRef.current = base;

  const data = () => {
    const d = { v: 1, p: palette, s: strokes.current };
    if (stk.current.length) d.k = stk.current.map((k) => ({ ...k, x: Math.round(k.x), y: Math.round(k.y), z: Math.round(k.z), r: Math.round(k.r) }));
    return d;
  };
  const redraw = () => {
    const d = data();
    if (baseRef.current && baseRef.current.s) d.s = baseRef.current.s.concat(d.s);
    paint(ref.current, d, Infinity, 1, imgsRef.current, mode === 'move' ? sel : -1);
  };
  useCanvasSize(ref, redraw);
  useEffect(redraw, [imgs, mode, sel, base]);

  const emit = () => {
    setCount(strokes.current.length);
    if (onChange) onChange(data());
  };

  const toGrid = (e) => {
    const r = ref.current.getBoundingClientRect();
    const x = Math.round(((e.clientX - r.left) / r.width) * GRID);
    const y = Math.round(((e.clientY - r.top) / r.height) * GRID);
    return [Math.max(0, Math.min(GRID, x)), Math.max(0, Math.min(GRID, y))];
  };

  const hitSticker = (x, y) => {
    for (let i = stk.current.length - 1; i >= 0; i--) {
      const k = stk.current[i];
      const ry = k.z / 2;
      const rx = ry * 0.84;
      const dx = (x - k.x) / rx;
      const dy = (y - k.y) / ry;
      if (dx * dx + dy * dy <= 1.1) return i;
    }
    return -1;
  };

  const down = (e) => {
    if (disabled) return;
    e.preventDefault();
    ref.current.setPointerCapture(e.pointerId);
    const [x, y] = toGrid(e);
    if (mode === 'move') {
      const i = hitSticker(x, y);
      if (i >= 0) {
        setSel(i);
        drag.current = { i, dx: x - stk.current[i].x, dy: y - stk.current[i].y };
      }
      return;
    }
    if (totalPts.current > MAX_POINTS || (single && strokes.current.length)) return;
    cur.current = [color, size, x, y];
    last.current = [x, y];
    totalPts.current++;
    const c = ref.current.getContext('2d');
    drawStroke(c, cur.current, palette, ref.current.width / GRID);
  };

  const move = (e) => {
    if (drag.current) {
      e.preventDefault();
      const [x, y] = toGrid(e);
      const k = stk.current[drag.current.i];
      k.x = Math.max(0, Math.min(GRID, x - drag.current.dx));
      k.y = Math.max(0, Math.min(GRID, y - drag.current.dy));
      redraw();
      return;
    }
    if (!cur.current) return;
    e.preventDefault();
    const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
    const c = ref.current.getContext('2d');
    const scale = ref.current.width / GRID;
    for (const ev of evs.length ? evs : [e]) {
      const [x, y] = toGrid(ev);
      const [lx, ly] = last.current;
      if (Math.abs(x - lx) + Math.abs(y - ly) < 6) continue;
      cur.current.push(x - lx, y - ly);
      c.strokeStyle = palette[color];
      c.lineWidth = SIZES[size] * scale;
      c.lineCap = 'round';
      c.lineJoin = 'round';
      c.beginPath();
      c.moveTo(lx * scale, ly * scale);
      c.lineTo(x * scale, y * scale);
      c.stroke();
      last.current = [x, y];
      totalPts.current++;
    }
  };

  const up = () => {
    if (drag.current) {
      drag.current = null;
      emit();
      return;
    }
    if (!cur.current) return;
    const st = cur.current;
    cur.current = null;
    if (single && onStroke) {
      onStroke(st);
      return;
    }
    strokes.current.push(st);
    redraw();
    emit();
  };

  const undo = () => {
    sfx('tap');
    const st = strokes.current.pop();
    if (st) totalPts.current -= Math.max(1, (st.length - 2) / 2);
    redraw();
    emit();
  };

  const clear = () => {
    if (!confirmClear) {
      setConfirmClear(true);
      setTimeout(() => setConfirmClear(false), 2500);
      return;
    }
    sfx('swoop');
    strokes.current = [];
    totalPts.current = 0;
    setConfirmClear(false);
    redraw();
    emit();
  };

  const tweak = (fn) => {
    const k = stk.current[sel];
    if (!k) return;
    fn(k);
    redraw();
    emit();
    bump((v) => v + 1);
  };

  const selected = stk.current[sel];
  return (
    <div class="drawpad">
      {stickers && (
        <div class="seg pad-mode" role="group" aria-label="Pad mode">
          <button class={mode === 'draw' ? 'on' : ''} onClick={() => setMode('draw')}>
            Draw
          </button>
          <button class={mode === 'move' ? 'on' : ''} onClick={() => setMode('move')}>
            Move faces
          </button>
        </div>
      )}
      <div class={'drawing-frame pad' + (mode === 'move' ? ' moving' : '')}>
        <canvas
          ref={ref}
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={up}
          onPointerLeave={(e) => e.buttons === 0 && up()}
          aria-label="Drawing canvas"
        />
      </div>
      {mode === 'move' && selected ? (
        <div class="pad-tools">
          <span class="small" style={{ fontWeight: 800 }}>
            Drag a face to move it
          </span>
          <div class="row" style={{ gap: 6 }}>
            <button class="icon-btn" aria-label="Shrink" onClick={() => tweak((k) => (k.z = Math.max(140, k.z - 40)))}>
              −
            </button>
            <button class="icon-btn" aria-label="Grow" onClick={() => tweak((k) => (k.z = Math.min(700, k.z + 40)))}>
              +
            </button>
            <button class="icon-btn" aria-label="Rotate left" onClick={() => tweak((k) => (k.r = (k.r || 0) - 15))}>
              ↺
            </button>
            <button class="icon-btn" aria-label="Rotate right" onClick={() => tweak((k) => (k.r = (k.r || 0) + 15))}>
              ↻
            </button>
          </div>
        </div>
      ) : (
        <div class="pad-tools">
          {fixedColor == null ? (
            <div class="swatches" role="radiogroup" aria-label="Color">
              {palette.map((c, i) => (
                <button key={c} class={'swatch' + (color === i ? ' on' : '')} style={{ background: c }} onClick={() => setColor(i)} role="radio" aria-checked={color === i} aria-label={`Color ${i + 1}`} />
              ))}
            </div>
          ) : (
            <span class="row" style={{ gap: 6, fontWeight: 800 }}>
              <span class="swatch on" style={{ background: palette[fixedColor], display: 'inline-block' }} /> Your color
            </span>
          )}
          <div class="row" style={{ gap: 6 }}>
            {SIZES.map((sz, i) => (
              <button key={sz} class={'size-btn' + (size === i ? ' on' : '')} onClick={() => setSize(i)} aria-label={['Thin', 'Medium', 'Thick'][i]}>
                <span style={{ width: Math.max(6, sz / 2.2), height: Math.max(6, sz / 2.2) }} />
              </button>
            ))}
            {!single && (
              <>
                <button class="icon-btn" onClick={undo} disabled={!count} aria-label="Undo">
                  <Icon name="undo" />
                </button>
                <button class={'icon-btn' + (confirmClear ? ' danger' : '')} onClick={clear} disabled={!count} aria-label={confirmClear ? 'Tap again to clear' : 'Clear'}>
                  <Icon name="trash" />
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function isBlank(d) {
  return !d || !d.s || d.s.length === 0;
}
