// Vision settings & calibration: the only place the camera picture is shown.
import { useEffect, useRef, useState } from 'react';
import { Icon } from '../ui/icons';
import { vision, visionStatus } from './engine';
import { openTutorial } from './GestureTutorial';
import type { Side } from './types';
import { defaultSettings } from './types';

const CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8], [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16], [13, 17], [17, 18], [18, 19], [19, 20], [0, 17],
];
const POSE_FA: Record<string, string> = { fist: 'Fist', open: 'Open palm', point: 'Point', vsign: 'V (scroll)', pinch: 'Pinch', other: '—' };

function Slider({ label, value, min, max, step, onChange, hint }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; hint?: string }) {
  return (
    <label className="slider">
      <span>
        {label} <b dir="ltr">{value.toFixed(step < 0.1 ? 2 : 1)}</b>
      </span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(Number(e.target.value))} />
      {hint && <small className="muted">{hint}</small>}
    </label>
  );
}

export function Calibration() {
  const s = visionStatus.use(x => x);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [poses, setPoses] = useState<{ side: Side; pose: string; pinch: number }[]>([]);
  const [hits, setHits] = useState([0, 0, 0]);
  const set = vision.configure.bind(vision);
  const st = s.settings;

  useEffect(() => {
    let raf = 0;
    let frame = 0;
    const draw = () => {
      raf = requestAnimationFrame(draw);
      const c = canvas.current;
      if (!c) return;
      const g = c.getContext('2d')!;
      const W = c.width, H = c.height;
      g.save();
      g.clearRect(0, 0, W, H);
      if (vision.video.readyState >= 2) {
        g.translate(W, 0);
        g.scale(-1, 1); // mirror like a selfie
        g.drawImage(vision.video, 0, 0, W, H);
        g.setTransform(1, 0, 0, 1, 0, 0);
      }
      const b = visionStatus.get().settings.box;
      g.strokeStyle = '#f0c56a';
      g.setLineDash([8, 6]);
      g.lineWidth = 2;
      g.strokeRect(b.x0 * W, b.y0 * H, (b.x1 - b.x0) * W, (b.y1 - b.y0) * H);
      g.setLineDash([]);
      for (const { lm, side } of vision.lastLandmarks) {
        g.strokeStyle = side === 'Right' ? '#f0c56a' : '#9fd28a';
        g.lineWidth = 3;
        for (const [a, bb] of CONNECTIONS) {
          g.beginPath();
          g.moveTo((1 - lm[a].x) * W, lm[a].y * H);
          g.lineTo((1 - lm[bb].x) * W, lm[bb].y * H);
          g.stroke();
        }
        g.fillStyle = '#fff';
        for (const p of lm) {
          g.beginPath();
          g.arc((1 - p.x) * W, p.y * H, 3, 0, Math.PI * 2);
          g.fill();
        }
      }
      g.restore();
      if (++frame % 6 === 0)
        setPoses(vision.lastHands.map(h => ({ side: h.side, pose: vision.machine.poseOf(h.side) ?? 'other', pinch: h.pinchRatio })));
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="calib">
      <section className="card calib-cam">
        <header className="card-h">
          <Icon name="camera" />
          <h3>Camera and hand tracking</h3>
          <span className="card-src" dir="ltr">
            {s.fps} fps · {s.hands} hand(s)
          </span>
          <button className="btn small primary" onClick={openTutorial} title="A two-minute practice run of every gesture">
            <Icon name="hand" size={16} /> Practice gestures
          </button>
        </header>
        <div className="cam-wrap">
          <canvas ref={canvas} width={640} height={480} />
          {s.state === 'CAMERA_OFF' && (
            <div className="cam-off">
              <p>The camera is off. No image is stored or sent; only hand coordinates are processed.</p>
              <button className="btn primary big" onClick={() => vision.setState('STANDBY', 'calibration')}>
                <Icon name="camera" /> Turn the camera on
              </button>
              {s.error && <p className="error">{s.error}</p>}
            </div>
          )}
        </div>
        <div className="pose-row">
          {poses.length === 0 && <span className="muted">No hand in view</span>}
          {poses.map(p => (
            <span key={p.side} className="pose-chip">
              {p.side === 'Right' ? 'Right' : 'Left'}: <b>{POSE_FA[p.pose]}</b> <small dir="ltr">pinch {p.pinch.toFixed(2)}</small>
            </span>
          ))}
        </div>
        <ol className="howto">
          <li>
            <b>Turn control on:</b> make fists with both hands and raise them, then open both.
          </li>
          <li>
            <b>Point:</b> the cursor follows your index knuckle. <b>Short pinch</b> = click, <b>held pinch</b> = drag.
          </li>
          <li>
            <b>Scroll:</b> V sign (index + middle) and move vertically. <b>Turn pages:</b> open palm and a quick horizontal swipe.
          </li>
          <li>
            <b>Zoom:</b> pinch with both hands and move them apart or together. <b>Menu:</b> hold an open palm still.
          </li>
          <li>
            <b>Off:</b> two open palms → two fists. Lowering your hands = automatic pause. <b>Esc</b> always stops control.
          </li>
        </ol>
      </section>

      <section className="card calib-settings">
        <header className="card-h">
          <Icon name="settings" />
          <h3>Gesture settings</h3>
          <button className="btn small" onClick={() => set(defaultSettings)}>
            Reset
          </button>
        </header>
        <div className="seg-row">
          <span>Dominant hand</span>
          {(['Right', 'Left'] as Side[]).map(d => (
            <button key={d} className={`chip ${st.dominant === d ? 'on' : ''}`} onClick={() => set({ dominant: d })}>
              {d === 'Right' ? 'Right' : 'Left'}
            </button>
          ))}
        </div>
        <label className="check">
          <input type="checkbox" checked={st.requireActivationGesture} onChange={e => set({ requireActivationGesture: e.target.checked })} />
          Wake only with the two fists → open gesture (recommended)
        </label>
        <h4>Movement area (yellow box)</h4>
        <div className="grid2">
          <Slider label="Left" value={st.box.x0} min={0} max={0.45} step={0.01} onChange={v => set({ box: { ...st.box, x0: v } })} />
          <Slider label="Right" value={st.box.x1} min={0.55} max={1} step={0.01} onChange={v => set({ box: { ...st.box, x1: v } })} />
          <Slider label="Top" value={st.box.y0} min={0} max={0.45} step={0.01} onChange={v => set({ box: { ...st.box, y0: v } })} />
          <Slider label="Bottom" value={st.box.y1} min={0.5} max={1} step={0.01} onChange={v => set({ box: { ...st.box, y1: v } })} />
        </div>
        <h4>Cursor and pinch</h4>
        <Slider label="Smoothing at rest (minCutoff)" value={st.minCutoff} min={0.2} max={4} step={0.1} onChange={v => set({ minCutoff: v })} hint="Lower = steadier cursor, with a little lag" />
        <Slider label="Responsiveness in motion (beta)" value={st.beta} min={0} max={20} step={0.5} onChange={v => set({ beta: v })} />
        <Slider label="Pinch start threshold" value={st.pinchEnter} min={0.15} max={0.5} step={0.01} onChange={v => set({ pinchEnter: v, pinchExit: Math.max(v + 0.06, st.pinchExit) })} />
        <Slider label="Pinch release threshold" value={st.pinchExit} min={0.25} max={0.7} step={0.01} onChange={v => set({ pinchExit: Math.max(v, st.pinchEnter + 0.06) })} />
        <Slider label="Scroll speed" value={st.scrollGain} min={0.5} max={6} step={0.1} onChange={v => set({ scrollGain: v })} />
        <Slider label="Speed needed to turn a page" value={st.swipeVelocity} min={0.6} max={3} step={0.1} onChange={v => set({ swipeVelocity: v })} />
        <Slider label="Pause after the hand is lost (ms)" value={st.pauseAfterMs} min={200} max={2000} step={50} onChange={v => set({ pauseAfterMs: v })} />

        <h4>Target test</h4>
        <div className="targets">
          {hits.map((n, i) => (
            <button key={i} className="btn big target" onClick={() => setHits(h => h.map((x, j) => (j === i ? x + 1 : x)))}>
              Target {i + 1} · {n}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
