import { describe, expect, it } from 'vitest';
import { advance, DWELL_MS, initialTutorial, skip, STEPS, type Targets } from './tutorial';

const tg: Targets = { paper: { x0: 0.1, y0: 0.1, x1: 0.3, y1: 0.3 }, quote: { x0: 0.1, y0: 0.6, x1: 0.3, y1: 0.8 }, board: { x0: 0.6, y0: 0.4, x1: 0.9, y1: 0.9 } };
const at = (step: number) => ({ ...initialTutorial(), step });

describe('gesture tutorial', () => {
  it('starts with waking control unless it is already active', () => {
    expect(initialTutorial().step).toBe(0);
    expect(advance(initialTutorial(), { type: 'HAND_FOUND' }, 0, tg, true).step).toBe(1);
    expect(advance(initialTutorial(), { type: 'STATE', state: 'ACTIVE', prev: 'STANDBY', reason: '' }, 0, tg, false).step).toBe(1);
  });
  it('needs a steady dwell on the paper', () => {
    let s = advance(at(1), { type: 'POINTER_MOVE', x: 0.2, y: 0.2, confidence: 1 }, 1000, tg, true);
    s = advance(s, { type: 'POINTER_MOVE', x: 0.2, y: 0.2, confidence: 1 }, 1000 + DWELL_MS / 2, tg, true);
    expect(s.progress).toBeCloseTo(0.5);
    const left = advance(s, { type: 'POINTER_MOVE', x: 0.5, y: 0.5, confidence: 1 }, 1000 + DWELL_MS, tg, true);
    expect(left.progress).toBe(0);
    expect(advance(s, { type: 'POINTER_MOVE', x: 0.21, y: 0.2, confidence: 1 }, 1000 + DWELL_MS, tg, true).step).toBe(2);
  });
  it('explains a click that turned into a drag', () => {
    const s = advance(at(2), { type: 'DRAG_START', x: 0.2, y: 0.2 }, 0, tg, true);
    expect(s.step).toBe(2);
    expect(s.hint).toMatch(/sooner/);
    expect(advance(s, { type: 'CLICK', x: 0.2, y: 0.2 }, 0, tg, true).step).toBe(3);
  });
  it('carries the quote from its card onto the board', () => {
    let s = advance(at(3), { type: 'DRAG_START', x: 0.2, y: 0.7 }, 0, tg, true);
    expect(s.carrying).toBe(true);
    s = advance(s, { type: 'DRAG_MOVE', x: 0.7, y: 0.5 }, 0, tg, true);
    expect(s.progress).toBe(0.8);
    expect(advance(s, { type: 'DRAG_END', x: 0.4, y: 0.4 }, 0, tg, true).hint).toMatch(/over the board/);
    expect(advance(s, { type: 'DRAG_END', x: 0.7, y: 0.5 }, 0, tg, true).step).toBe(4);
  });
  it('counts scrolling, accepts a sideways swipe and finishes on the menu', () => {
    let s = advance(at(4), { type: 'SCROLL', dy: 0.3 }, 0, tg, true);
    expect(s.step).toBe(4);
    s = advance(s, { type: 'SCROLL', dy: -0.3 }, 0, tg, true);
    expect(s.step).toBe(5);
    expect(advance(s, { type: 'SWIPE', dir: 'up' }, 0, tg, true).step).toBe(5);
    s = advance(s, { type: 'SWIPE', dir: 'left' }, 0, tg, true);
    const end = advance(s, { type: 'MENU_OPEN', x: 0.5, y: 0.5 }, 0, tg, true);
    expect(end.done).toBe(true);
    expect(end.step).toBe(STEPS.length);
  });
  it('can skip a step', () => {
    expect(skip(at(3)).step).toBe(4);
    expect(skip({ ...at(STEPS.length - 1) }).done).toBe(true);
  });
});
