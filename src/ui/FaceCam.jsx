// Selfie capture: live front camera with a face guide; falls back to picking a photo
// (with drag-to-position and zoom) when the camera isn't available or allowed.
// Produces a small square JPEG data URL (~15 KB).
import { useEffect, useRef, useState } from 'preact/hooks';
import { Icon } from './common.jsx';
import { sfx } from '../audio/sfx.js';

const SIZE = 240;
const QUALITY = 0.72;

//  inline: render in the page instead of a bottom sheet (Pull a Face)
export function FaceCam({ onDone, onCancel, title = 'Say cheese', hint = 'Line your face up with the circle.', countdown = 3, inline = false, doneLabel = 'Use it', note = null }) {
  const [mode, setMode] = useState('starting'); // starting | live | file | review
  const [shot, setShot] = useState(null);
  const [count, setCount] = useState(0);
  const [img, setImg] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const fileRef = useRef(null);
  const vpRef = useRef(null);
  const drag = useRef(null);

  const stop = () => {
    const st = streamRef.current;
    if (st) st.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  const startCamera = async () => {
    setMode('starting');
    const md = navigator.mediaDevices;
    if (!md || !md.getUserMedia) {
      setMode('file');
      return;
    }
    try {
      const st = await md.getUserMedia({ video: { facingMode: 'user', width: { ideal: 720 }, height: { ideal: 720 } }, audio: false });
      streamRef.current = st;
      const v = videoRef.current;
      if (v) {
        v.srcObject = st;
        await v.play().catch(() => {});
      }
      setMode('live');
    } catch (e) {
      setMode('file');
    }
  };

  useEffect(() => {
    startCamera();
    return stop;
  }, []);

  const captureVideo = () => {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    const s = Math.min(v.videoWidth, v.videoHeight);
    const c = document.createElement('canvas');
    c.width = SIZE;
    c.height = SIZE;
    const ctx = c.getContext('2d');
    // Keep the mirrored selfie view people just saw.
    ctx.translate(SIZE, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(v, (v.videoWidth - s) / 2, (v.videoHeight - s) / 2, s, s, 0, 0, SIZE, SIZE);
    setShot(c.toDataURL('image/jpeg', QUALITY));
    sfx('cash');
    setMode('review');
  };

  const snap = () => {
    if (!countdown) {
      captureVideo();
      return;
    }
    let n = countdown;
    setCount(n);
    sfx('count');
    const iv = setInterval(() => {
      n--;
      if (n <= 0) {
        clearInterval(iv);
        setCount(0);
        captureVideo();
      } else {
        setCount(n);
        sfx('count');
      }
    }, 650);
  };

  const pickFile = (e) => {
    const f = e.currentTarget.files && e.currentTarget.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      const im = new Image();
      im.onload = () => {
        setImg(im);
        setZoom(1);
        setPan({ x: 0, y: 0 });
        setMode('file');
      };
      im.src = r.result;
    };
    r.readAsDataURL(f);
  };

  // Geometry of the photo inside the square viewport (cover-fit, then zoom + pan).
  const vpSize = () => (vpRef.current ? vpRef.current.clientWidth : 280);
  const layout = () => {
    if (!img) return null;
    const vp = vpSize();
    const base = vp / Math.min(img.naturalWidth, img.naturalHeight);
    const sc = base * zoom;
    const w = img.naturalWidth * sc;
    const h = img.naturalHeight * sc;
    const maxX = Math.max(0, (w - vp) / 2);
    const maxY = Math.max(0, (h - vp) / 2);
    const x = Math.max(-maxX, Math.min(maxX, pan.x));
    const y = Math.max(-maxY, Math.min(maxY, pan.y));
    return { vp, sc, w, h, left: vp / 2 - w / 2 + x, top: vp / 2 - h / 2 + y };
  };

  const captureFile = () => {
    const L = layout();
    if (!L) return;
    const c = document.createElement('canvas');
    c.width = SIZE;
    c.height = SIZE;
    const ctx = c.getContext('2d');
    const sx = -L.left / L.sc;
    const sy = -L.top / L.sc;
    const ss = L.vp / L.sc;
    ctx.drawImage(img, sx, sy, ss, ss, 0, 0, SIZE, SIZE);
    setShot(c.toDataURL('image/jpeg', QUALITY));
    setMode('review');
  };

  const L = mode === 'file' ? layout() : null;

  const Wrap = inline ? InlineWrap : SheetWrap;
  return (
    <Wrap
      title={title}
      onClose={() => {
        stop();
        if (onCancel) onCancel();
      }}
    >

        <div class="fc-viewport" ref={vpRef}>
          <video ref={videoRef} class="fc-video" playsInline muted autoPlay hidden={mode !== 'live' && mode !== 'starting'} />
          {mode === 'file' && img && L && (
            <img
              src={img.src}
              alt=""
              class="fc-photo"
              draggable={false}
              style={{ width: L.w + 'px', height: L.h + 'px', left: L.left + 'px', top: L.top + 'px' }}
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId);
                drag.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y };
              }}
              onPointerMove={(e) => {
                if (!drag.current) return;
                setPan({ x: drag.current.px + (e.clientX - drag.current.x), y: drag.current.py + (e.clientY - drag.current.y) });
              }}
              onPointerUp={() => (drag.current = null)}
              onPointerCancel={() => (drag.current = null)}
            />
          )}
          {mode === 'file' && !img && (
            <div class="fc-empty">
              <Icon name="smile" size={48} />
              <span>Pick a selfie to use</span>
            </div>
          )}
          {mode === 'review' && shot && <img src={shot} alt="Your selfie" class="fc-shot" />}
          {mode === 'starting' && <div class="fc-empty">Starting camera…</div>}
          <div class="fc-ring" aria-hidden="true" />
          {count > 0 && <div class="fc-count stencil">{count}</div>}
        </div>

        <p class="small center-text" style={{ margin: 0 }}>
          {mode === 'review' ? 'Looking good?' : mode === 'file' && img ? 'Drag to line up your face. Use the slider to zoom.' : hint}
        </p>

        {mode === 'file' && img && (
          <input id="fc-zoom" class="dl-range" type="range" min="1" max="3" step="0.01" value={zoom} onInput={(e) => setZoom(Number(e.currentTarget.value))} aria-label="Zoom" />
        )}

        <input ref={fileRef} type="file" accept="image/*" capture="user" hidden onChange={pickFile} />

        {mode === 'live' && (
          <button class="btn primary big-cta" onClick={snap} disabled={count > 0}>
            Snap it
          </button>
        )}
        {mode === 'file' && (
          <div class="col">
            {img && (
              <button class="btn primary" onClick={captureFile}>
                Use this crop
              </button>
            )}
            <button class="btn" onClick={() => fileRef.current && fileRef.current.click()}>
              {img ? 'Pick a different photo' : 'Choose or take a photo'}
            </button>
          </div>
        )}
        {mode === 'review' && (
          <div class="row">
            <button
              class="btn"
              onClick={() => {
                setShot(null);
                if (streamRef.current) setMode('live');
                else if (img) setMode('file');
                else startCamera();
              }}
            >
              Retake
            </button>
            <button
              class="btn primary"
              onClick={() => {
                stop();
                sfx('pop');
                onDone(shot);
              }}
            >
              {doneLabel}
            </button>
          </div>
        )}
        {mode === 'live' && (
          <button
            class="btn ghost sm"
            style={{ alignSelf: 'center' }}
            onClick={() => {
              stop();
              setMode('file');
            }}
          >
            Use a photo instead
          </button>
        )}
        <p class="small muted center-text" style={{ margin: 0 }}>
          {note || 'Your photo stays on this phone and is only shared, encrypted, with the rooms you join. You can remove it anytime.'}
        </p>
    </Wrap>
  );
}

function SheetWrap({ title, onClose, children }) {
  return (
    <div class="sheet-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div class="sheet facecam" role="dialog" aria-modal="true" aria-label="Take a selfie">
        <div class="row spread">
          <h2 class="stencil" style={{ fontSize: '1.9rem' }}>
            {title}
          </h2>
          <button class="icon-btn" onClick={onClose} aria-label="Close">
            <Icon name="close" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function InlineWrap({ children }) {
  return <div class="facecam inline">{children}</div>;
}
