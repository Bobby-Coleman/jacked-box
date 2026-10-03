// Touch drawing pad + renderer.
// Drawing format (compact, JSON-safe):
//   { v: 1, p: ['#hex', ...palette], s: [[colorIdx, sizeIdx, x0, y0, dx1, dy1, ...], ...] }
// Coordinates live on a 1000x1000 grid; points after the first are deltas.
import { useEffect, useRef, useState } from 'preact/hooks';
import { Icon } from './common.jsx';
import { sfx } from '../audio/sfx.js';

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

function paint(canvas, data, upto = Infinity, partial = 1) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, canvas.height);
  if (!data || !data.s) return;
  const scale = w / GRID;
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

// Static (optionally animated) rendering of a drawing.
export function Drawing({ data, animate = false, ms = 1800, label = 'Drawing' }) {
  const ref = useRef(null);
  const dataRef = useRef(data);
  dataRef.current = data;
  const redraw = () => paint(ref.current, dataRef.current);
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
      paint(ref.current, data, Math.floor(f), f - Math.floor(f));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [data, animate]);
  return (
    <div class="drawing-frame">
      <canvas ref={ref} role="img" aria-label={label} />
      {!data && <div class="drawing-loading">Loading drawing…</div>}
    </div>
  );
}

// Interactive drawing pad.
export function DrawPad({ palette, onChange, disabled = false, initial = null }) {
  const ref = useRef(null);
  const strokes = useRef(initial ? initial.s.slice() : []);
  const cur = useRef(null);
  const last = useRef(null);
  const [color, setColor] = useState(0);
  const [size, setSize] = useState(1);
  const [count, setCount] = useState(strokes.current.length);
  const [confirmClear, setConfirmClear] = useState(false);
  const totalPts = useRef(0);

  const data = () => ({ v: 1, p: palette, s: strokes.current });
  const redraw = () => paint(ref.current, data());
  useCanvasSize(ref, redraw);

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

  const down = (e) => {
    if (disabled || totalPts.current > MAX_POINTS) return;
    e.preventDefault();
    ref.current.setPointerCapture(e.pointerId);
    const [x, y] = toGrid(e);
    cur.current = [color, size, x, y];
    last.current = [x, y];
    totalPts.current++;
    const c = ref.current.getContext('2d');
    drawStroke(c, cur.current, palette, ref.current.width / GRID);
  };

  const move = (e) => {
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
    if (!cur.current) return;
    strokes.current.push(cur.current);
    cur.current = null;
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

  return (
    <div class="drawpad">
      <div class="drawing-frame pad">
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
      <div class="pad-tools">
        <div class="swatches" role="radiogroup" aria-label="Color">
          {palette.map((c, i) => (
            <button key={c} class={'swatch' + (color === i ? ' on' : '')} style={{ background: c }} onClick={() => setColor(i)} role="radio" aria-checked={color === i} aria-label={`Color ${i + 1}`} />
          ))}
        </div>
        <div class="row" style={{ gap: 6 }}>
          {SIZES.map((sz, i) => (
            <button key={sz} class={'size-btn' + (size === i ? ' on' : '')} onClick={() => setSize(i)} aria-label={['Thin', 'Medium', 'Thick'][i]}>
              <span style={{ width: Math.max(6, sz / 2.2), height: Math.max(6, sz / 2.2) }} />
            </button>
          ))}
          <button class="icon-btn" onClick={undo} disabled={!count} aria-label="Undo">
            <Icon name="undo" />
          </button>
          <button class={'icon-btn' + (confirmClear ? ' danger' : '')} onClick={clear} disabled={!count} aria-label={confirmClear ? 'Tap again to clear' : 'Clear'}>
            <Icon name="trash" />
          </button>
        </div>
      </div>
    </div>
  );
}

export function isBlank(d) {
  return !d || !d.s || d.s.length === 0;
}
