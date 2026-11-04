// Interactive gesture tutorial: a short practice run of every hand gesture on a real research task
// (point at a paper, open it, carry a quote to the board, scroll, turn a page, open the menu).
// The step logic is pure and tested; the overlay (GestureTutorial.tsx) only renders it.
import type { VisionEvent } from './types';

export type StepId = 'wake' | 'point' | 'click' | 'carry' | 'scroll' | 'swipe' | 'menu';

export interface Step {
  id: StepId;
  title: string;
  how: string;
  /** what the user is practising, in research terms */
  why: string;
}

export const STEPS: Step[] = [
  { id: 'wake', title: 'Wake hand control', how: 'Show both fists for a moment, then open your hands.', why: 'Control only starts when you ask for it, so a stray wave never clicks anything.' },
  { id: 'point', title: 'Point at the paper', how: 'Move your hand until the ring rests on the paper card, and hold it there.', why: 'Your index knuckle is the cursor; nearby targets attract it.' },
  { id: 'click', title: 'Open it with a pinch', how: 'Touch thumb and index finger together briefly, then let go.', why: 'A quick pinch is a click. Hold it longer and it becomes a drag.' },
  { id: 'carry', title: 'Carry a quote to the board', how: 'Pinch the quote and hold, move it onto the board, then open your fingers.', why: 'This is how clips, figures and AI answers reach the knowledge board.' },
  { id: 'scroll', title: 'Scroll the page', how: 'Make a V with two fingers and move your hand up or down.', why: 'Scrolling works in the reader, lists and side panels.' },
  { id: 'swipe', title: 'Turn a page', how: 'Swipe an open hand quickly to the left or right.', why: 'In the reader a swipe turns the page; in a video it seeks 10 seconds.' },
  { id: 'menu', title: 'Open the hand menu', how: 'Hold an open palm still for about a second.', why: 'The radial menu holds the actions of the screen you are on.' },
];

export type Box = { x0: number; y0: number; x1: number; y1: number };

/** Target zones of the practice scene, in normalised screen coordinates. */
export interface Targets {
  paper: Box;
  quote: Box;
  board: Box;
}

export interface TutorialState {
  step: number;
  /** 0..1 progress within the current step */
  progress: number;
  /** pointer dwell start inside the paper card */
  dwellSince: number | null;
  carrying: boolean;
  scrolled: number;
  done: boolean;
  /** short feedback after a mistake, e.g. «that was a drag — release sooner» */
  hint: string | null;
}

export const DWELL_MS = 700;
export const SCROLL_NEEDED = 0.5;

export const initialTutorial = (skipWake = false): TutorialState => ({ step: skipWake ? 1 : 0, progress: 0, dwellSince: null, carrying: false, scrolled: 0, done: false, hint: null });

const inside = (b: Box, x: number, y: number) => x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1;

function next(s: TutorialState): TutorialState {
  const step = s.step + 1;
  return { ...s, step, progress: 0, dwellSince: null, carrying: false, scrolled: 0, hint: null, done: step >= STEPS.length };
}

export function skip(s: TutorialState): TutorialState {
  return s.done ? s : next(s);
}

/** Feed one gesture event (with its timestamp) into the tutorial. */
export function advance(s: TutorialState, e: VisionEvent, t: number, tg: Targets, active: boolean): TutorialState {
  if (s.done) return s;
  const id = STEPS[s.step].id;
  if (id === 'wake') return active || (e.type === 'STATE' && e.state === 'ACTIVE') ? next(s) : s;
  switch (id) {
    case 'point': {
      if (e.type !== 'POINTER_MOVE') return s;
      if (!inside(tg.paper, e.x, e.y)) return { ...s, dwellSince: null, progress: 0 };
      const since = s.dwellSince ?? t;
      const progress = Math.min(1, (t - since) / DWELL_MS);
      return progress >= 1 ? next(s) : { ...s, dwellSince: since, progress };
    }
    case 'click':
      if (e.type === 'CLICK') return inside(tg.paper, e.x, e.y) ? next(s) : { ...s, hint: 'That pinch landed outside the paper; point at it first.' };
      if (e.type === 'DRAG_START' && inside(tg.paper, e.x, e.y)) return { ...s, hint: 'That became a drag; release the pinch a little sooner.' };
      return s;
    case 'carry':
      if (e.type === 'DRAG_START') return inside(tg.quote, e.x, e.y) ? { ...s, carrying: true, progress: 0.4, hint: null } : { ...s, hint: 'Start the pinch on the quote card.' };
      if (e.type === 'DRAG_MOVE' && s.carrying) return { ...s, progress: inside(tg.board, e.x, e.y) ? 0.8 : 0.4 };
      if (e.type === 'DRAG_END' && s.carrying) return inside(tg.board, e.x, e.y) ? next(s) : { ...s, carrying: false, progress: 0, hint: 'Let go over the board to drop it there.' };
      if (e.type === 'CLICK' && inside(tg.quote, e.x, e.y)) return { ...s, hint: 'Keep the pinch closed while you move.' };
      return s;
    case 'scroll': {
      if (e.type !== 'SCROLL') return s;
      const scrolled = s.scrolled + Math.abs(e.dy);
      return scrolled >= SCROLL_NEEDED ? next(s) : { ...s, scrolled, progress: scrolled / SCROLL_NEEDED };
    }
    case 'swipe':
      return e.type === 'SWIPE' && (e.dir === 'left' || e.dir === 'right') ? next(s) : s;
    case 'menu':
      return e.type === 'MENU_OPEN' ? next(s) : s;
  }
  return s;
}
