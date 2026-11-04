// Practice overlay for hand control. Opens automatically the first time hand control turns on
// (and from the calibration screen); every step is a small piece of the real research flow.
import { useEffect, useRef, useState } from 'react';
import { createStore, loadJson, saveJson } from '../lib/store';
import { toast } from '../state/app';
import { Icon } from '../ui/icons';
import { vision, visionStatus } from './engine';
import { useVisionHandler } from './router';
import { advance, initialTutorial, skip, STEPS, type Box, type Targets } from './tutorial';

const KEY = 'vos.tutorial';
export const tutorial = createStore({ open: false, ...loadJson<{ done: boolean }>(KEY, { done: false }) });
export const openTutorial = () => tutorial.set({ open: true });

// first activation of hand control offers the practice run once
vision.on(e => {
  if (e.type === 'STATE' && e.state === 'ACTIVE' && !tutorial.get().done && !tutorial.get().open) tutorial.set({ open: true });
});

function finish(completed: boolean) {
  tutorial.set({ open: false, done: true });
  saveJson(KEY, { done: true });
  if (completed) toast('All gestures practised: hand control is yours ✋', 'ok');
}

function boxOf(el: Element | null): Box {
  const r = el?.getBoundingClientRect();
  if (!r) return { x0: 0, y0: 0, x1: 0, y1: 0 };
  return { x0: r.left / innerWidth, y0: r.top / innerHeight, x1: r.right / innerWidth, y1: r.bottom / innerHeight };
}

export function GestureTutorial() {
  const open = tutorial.use(s => s.open);
  if (!open) return null;
  return <Practice />;
}

function Practice() {
  const active = visionStatus.use(s => s.state === 'ACTIVE');
  const [st, setSt] = useState(() => initialTutorial(visionStatus.get().state === 'ACTIVE'));
  const [carryAt, setCarryAt] = useState<{ x: number; y: number } | null>(null);
  const [page, setPage] = useState(1);
  const paper = useRef<HTMLDivElement>(null), quote = useRef<HTMLDivElement>(null), boardZone = useRef<HTMLDivElement>(null), text = useRef<HTMLDivElement>(null);
  const stRef = useRef(st);
  stRef.current = st;

  const targets = (): Targets => ({ paper: boxOf(paper.current), quote: boxOf(quote.current), board: boxOf(boardZone.current) });
  const feed = (e: Parameters<typeof advance>[1]) => setSt(s => advance(s, e, performance.now(), targets(), visionStatus.get().state === 'ACTIVE'));

  // the router handles the menu and state changes before context handlers: watch them directly
  useEffect(
    () =>
      vision.on(e => {
        if (e.type === 'STATE' || e.type === 'MENU_OPEN') feed(e);
      }),
    [],
  );
  useEffect(() => {
    if (active) feed({ type: 'HAND_FOUND' });
  }, [active]);

  // practice gestures are consumed here so nothing underneath reacts to them
  useVisionHandler(e => {
    if (stRef.current.done) return false;
    feed(e);
    if (e.type === 'DRAG_START' || e.type === 'DRAG_MOVE') setCarryAt(stRef.current.carrying || e.type === 'DRAG_START' ? { x: e.x, y: e.y } : null);
    if (e.type === 'DRAG_END') setCarryAt(null);
    if (e.type === 'SCROLL' && text.current) text.current.scrollBy({ top: e.dy * 600 });
    if (e.type === 'SWIPE' && (e.dir === 'left' || e.dir === 'right')) setPage(p => Math.max(1, p + (e.dir === 'left' ? 1 : -1)));
    return e.type !== 'POINTER_MOVE' && e.type !== 'MENU_OPEN' && e.type !== 'MENU_CLOSE' && e.type !== 'STATE';
  }, []);

  const step = STEPS[Math.min(st.step, STEPS.length - 1)];
  const C = 2 * Math.PI * 16;
  const focusOn = (id: string) => (st.done ? '' : step.id === id ? 'tut-focus' : '');

  return (
    <div className="tutorial" role="dialog" aria-modal="true" aria-label="Hand gesture practice">
      <div className="tut-panel">
        {st.done ? (
          <>
            <div className="tut-count">Practice complete</div>
            <h2>You know every gesture</h2>
            <p className="muted">Wake with two fists then open hands, point, pinch to click, hold the pinch to carry, V to scroll, swipe to turn pages, hold an open palm for the menu. Esc always stops hand control.</p>
            <div className="tut-actions">
              <button className="sh-btn primary" onClick={() => finish(true)}>
                <Icon name="check" size={18} /> Start working
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="tut-count">
              Step {st.step + 1} of {STEPS.length}
              <span className="tut-dots">
                {STEPS.map((s, i) => (
                  <span key={s.id} className={i < st.step ? 'done' : i === st.step ? 'now' : ''} />
                ))}
              </span>
            </div>
            <div className="tut-step">
              <svg width="40" height="40" viewBox="0 0 40 40" className="tut-ring" aria-hidden>
                <circle cx="20" cy="20" r="16" className="ring-bg" />
                <circle cx="20" cy="20" r="16" className="ring-fg" strokeDasharray={`${C * st.progress} ${C}`} transform="rotate(-90 20 20)" />
              </svg>
              <div>
                <h2>{step.title}</h2>
                <p className="tut-how">{step.how}</p>
                <p className="muted small">{step.why}</p>
              </div>
            </div>
            {st.hint && (
              <p className="tut-hint" role="status">
                {st.hint}
              </p>
            )}
            {!active && step.id !== 'wake' && <p className="tut-hint">Hand control is paused; raise your hand into the camera view.</p>}
            <div className="tut-actions">
              <button className="sh-btn" onClick={() => setSt(s => skip(s))}>
                Skip this step
              </button>
              <button className="sh-btn" onClick={() => finish(false)}>
                Close
              </button>
            </div>
          </>
        )}
      </div>

      <div className="tut-scene" aria-hidden>
        <div ref={paper} className={`tut-paper ${focusOn('point')} ${focusOn('click')}`}>
          <Icon name="file" size={28} />
          <b>Beam Steering with Metasurfaces</b>
          <small>pinch to open</small>
        </div>
        <div ref={quote} className={`tut-quote ${focusOn('carry')} ${st.carrying ? 'lifted' : ''}`} style={carryAt && st.carrying ? { position: 'fixed', left: carryAt.x * innerWidth - 120, top: carryAt.y * innerHeight - 30 } : undefined}>
          “A phase gradient across the surface steers the reflected beam.” <small>p. 3</small>
        </div>
        <div ref={boardZone} className={`tut-board ${focusOn('carry')} ${st.step > 3 ? 'filled' : ''}`}>
          <Icon name="network" size={22} />
          <span>{st.step > 3 ? 'Quote on the board ✓' : 'Knowledge board'}</span>
        </div>
        <div ref={text} className={`tut-text ${focusOn('scroll')}`}>
          {Array.from({ length: 14 }, (_, i) => (
            <p key={i}>Line {i + 1}: metasurfaces impose a spatial phase profile on the incident wave, steering it toward the chosen angle.</p>
          ))}
        </div>
        <div className={`tut-pages ${focusOn('swipe')}`}>
          <Icon name="left" size={18} /> Page {page} <Icon name="right" size={18} />
        </div>
        <div className={`tut-menu ${focusOn('menu')}`}>
          <Icon name="hand" size={22} /> Hold an open palm
        </div>
      </div>
    </div>
  );
}
