// Gesture HUD, the hand cursor and the radial menu.
import { useEffect, useRef, useState } from 'react';
import { go, toast } from '../state/app';
import { Icon, type IconName } from '../ui/icons';
import { vision, visionStatus } from './engine';
import { radial, radialLayout } from './router';
import type { VisionState } from './types';

const LABEL: Record<VisionState, string> = {
  CAMERA_OFF: 'Camera off',
  STANDBY: 'Standby: two fists, then open',
  ACTIVE: 'Hand control active',
  PAUSED: 'Paused: raise your hand',
  CALIBRATING: 'Calibrating',
};
const MODE_FA: Record<string, string> = { idle: '', pointer: 'Pointer', drag: 'Drag', scroll: 'Scroll', zoom: 'Zoom', menu: 'Menu' };

export function VisionHUD() {
  const s = visionStatus.use(x => x);
  const dots = useRef<HTMLCanvasElement>(null);

  useEffect(
    () =>
      vision.on(e => {
        if (e.type !== 'STATE') return;
        if (e.state === 'ACTIVE' && e.prev !== 'PAUSED') toast('Hand control on ✋', 'ok');
        if (e.state === 'STANDBY' && e.prev === 'ACTIVE') toast('Hand control off', 'info');
      }),
    [],
  );

  // tiny hand-position glyph instead of a live webcam picture
  useEffect(() => {
    if (s.state === 'CAMERA_OFF') return;
    let raf = 0;
    const draw = () => {
      raf = requestAnimationFrame(draw);
      const c = dots.current;
      if (!c) return;
      const g = c.getContext('2d')!;
      g.clearRect(0, 0, c.width, c.height);
      for (const h of vision.lastHands) {
        g.fillStyle = h.side === 'Right' ? '#f0c56a' : '#9fd28a';
        g.beginPath();
        g.arc(h.palm.x * c.width, h.palm.y * c.height, 4, 0, Math.PI * 2);
        g.fill();
      }
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [s.state]);

  const toggle = () => {
    if (s.state === 'CAMERA_OFF') vision.setState('STANDBY', 'hud');
    else if (s.state === 'ACTIVE' || s.state === 'PAUSED') vision.setState('STANDBY', 'hud');
    else vision.setState('ACTIVE', 'hud button');
  };

  return (
    <div className={`hud hud-${s.state.toLowerCase()}`} data-vision-ignore>
      <button className="hud-pill" onClick={toggle} title="Ctrl+Alt+V camera on/off · Esc stop immediately">
        <span className="hud-led" />
        <Icon name={s.state === 'CAMERA_OFF' ? 'cameraOff' : 'hand'} size={18} />
        <span>{s.loading ? 'Preparing…' : LABEL[s.state]}</span>
        {s.state === 'ACTIVE' && MODE_FA[s.mode] && <span className="hud-mode">{MODE_FA[s.mode]}</span>}
        {s.state !== 'CAMERA_OFF' && <canvas ref={dots} width={44} height={30} className="hud-dots" />}
        {s.state !== 'CAMERA_OFF' && <span className="hud-fps">{s.fps}fps</span>}
      </button>
      {s.state !== 'CAMERA_OFF' && (
        <button className="hud-x" onClick={() => vision.setState('CAMERA_OFF', 'hud')} title="Turn the camera fully off">
          <Icon name="close" size={14} />
        </button>
      )}
      {s.error && (
        <div className="hud-error">
          Camera unavailable: {s.error}{' '}
          <button className="link" onClick={() => go('calibrate')}>
            Help
          </button>
        </div>
      )}
    </div>
  );
}

/** What the cursor tells you about the gesture being read: a ring that fills while a pinch is
 *  held (release before it closes = click, keep holding = drag) and a short confirmation chip for
 *  every recognised command. */
const CONFIRM: Partial<Record<string, string>> = { CLICK: 'Click', DOUBLE_CLICK: 'Double click', DRAG_START: 'Drag', MENU_OPEN: 'Menu' };

export function HandCursor() {
  const el = useRef<HTMLDivElement>(null);
  const [cls, setCls] = useState('');
  const [chip, setChip] = useState<{ text: string; n: number } | null>(null);
  const state = visionStatus.use(s => s.state);
  const holdMs = visionStatus.use(s => s.settings.clickMaxMs);
  useEffect(() => {
    let n = 0;
    let t = 0;
    const say = (text: string) => {
      clearTimeout(t);
      setChip({ text, n: ++n });
      t = window.setTimeout(() => setChip(null), 900);
    };
    const off = vision.on(e => {
      const c = el.current;
      if (!c) return;
      if (e.type === 'POINTER_MOVE') c.style.transform = `translate(${e.x * innerWidth}px, ${e.y * innerHeight}px)`;
      else if (e.type === 'PINCH_START') setCls('pinch holding');
      else if (e.type === 'DRAG_START') setCls('drag');
      else if (e.type === 'PINCH_END') setCls('');
      else if (e.type === 'CLICK') {
        c.classList.remove('clicked');
        void c.offsetWidth;
        c.classList.add('clicked');
      } else if (e.type === 'MODE') {
        setCls(e.mode === 'scroll' ? 'scroll' : e.mode === 'zoom' ? 'zoom' : e.mode === 'drag' ? 'drag' : '');
        if (e.mode === 'scroll') say('Scroll');
        if (e.mode === 'zoom') say('Zoom');
      }
      if (e.type === 'SWIPE') say(e.dir === 'left' ? 'Next ›' : e.dir === 'right' ? '‹ Back' : e.dir === 'up' ? 'Swipe up' : 'Swipe down');
      const label = CONFIRM[e.type];
      if (label) say(label);
    });
    return () => {
      off();
      clearTimeout(t);
    };
  }, []);
  return (
    <div ref={el} className={`hand-cursor ${cls} ${state === 'ACTIVE' ? 'on' : ''}`} style={{ ['--hold' as string]: `${holdMs}ms` }} data-vision-ignore>
      <span className="hc-ring" />
      <svg className="hc-hold" width="56" height="56" viewBox="0 0 56 56" aria-hidden>
        <circle cx="28" cy="28" r="24" />
      </svg>
      <span className="hc-dot" />
      {chip && (
        <span key={chip.n} className="hc-chip" role="status">
          {chip.text}
        </span>
      )}
    </div>
  );
}

export function RadialMenu() {
  const r = radial.use(x => x);
  if (!r.open) return null;
  return (
    <div className="radial" style={{ left: r.at.x, top: r.at.y }} data-vision-ignore>
      <div className="radial-core">
        <Icon name="hand" size={20} />
      </div>
      {r.items.map((it, i) => {
        const o = radialLayout(r.items.length, i);
        return (
          <button
            key={it.id}
            className={`radial-item ${r.hover === it.id ? 'hover' : ''}`}
            style={{ transform: `translate(${o.x}px, ${o.y}px)` }}
            onClick={() => {
              radial.set({ open: false });
              it.run();
            }}
          >
            <Icon name={it.icon as IconName} size={22} />
            <span>{it.label}</span>
          </button>
        );
      })}
    </div>
  );
}
