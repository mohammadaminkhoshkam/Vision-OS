// Action router: turns UI-independent vision events into actions in the current context.
// A screen can register a handler (PDF reader, cinema, garden); whatever it does not consume
// falls through to generic behaviour (hover/click on the element under the cursor, scroll).
import { useEffect } from 'react';
import { createStore } from '../lib/store';
import { usePane } from '../state/pane';
import { vision } from './engine';
import type { VisionEvent } from './types';

export type Px = { x: number; y: number };
export type ContextHandler = (e: VisionEvent, px: Px | null) => boolean | void;

export interface RadialItem {
  id: string;
  label: string;
  icon: string;
  run: () => void;
}

export const radial = createStore<{ open: boolean; at: Px; items: RadialItem[]; hover: string | null }>({
  open: false,
  at: { x: 0, y: 0 },
  items: [],
  hover: null,
});

const handlers: ContextHandler[] = [];
let contextItems: RadialItem[] = [];
let globalItems: RadialItem[] = [];
let hovered: Element | null = null;
export let cursorPx: Px = { x: innerWidth / 2, y: innerHeight / 2 };

const TARGETS = 'button, a[href], input, select, textarea, [role="button"], [data-vt]';

function toPx(x: number, y: number): Px {
  return { x: x * innerWidth, y: y * innerHeight };
}

/** Target assistance: element under the cursor, else the nearest target within 40 px. */
function findTarget(p: Px): Element | null {
  const under = document.elementFromPoint(p.x, p.y);
  const direct = under?.closest(TARGETS);
  if (direct && !direct.closest('[data-vision-ignore]')) return direct;
  let best: Element | null = null;
  let bestD = 40;
  for (const el of document.querySelectorAll(TARGETS)) {
    if (el.closest('[data-vision-ignore], [inert]')) continue;
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    const dx = Math.max(r.left - p.x, 0, p.x - r.right);
    const dy = Math.max(r.top - p.y, 0, p.y - r.bottom);
    const d = Math.hypot(dx, dy);
    if (d < bestD) {
      bestD = d;
      best = el;
    }
  }
  return best;
}

function setHover(el: Element | null) {
  if (el === hovered) return;
  hovered?.removeAttribute('data-vhover');
  hovered = el;
  hovered?.setAttribute('data-vhover', '');
}

function scrollableAt(p: Px): Element {
  let el = document.elementFromPoint(p.x, p.y);
  while (el && el !== document.body) {
    const s = getComputedStyle(el);
    if (/(auto|scroll)/.test(s.overflowY) && el.scrollHeight > el.clientHeight + 2) return el;
    el = el.parentElement;
  }
  return document.scrollingElement ?? document.body;
}

function activate(el: Element) {
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) {
    el.focus();
    if (el instanceof HTMLInputElement && (el.type === 'checkbox' || el.type === 'radio' || el.type === 'file')) el.click();
    return;
  }
  (el as HTMLElement).click();
}

function handle(e: VisionEvent) {
  let px: Px | null = null;
  if ('x' in e && 'y' in e) px = toPx(e.x, e.y);
  if (e.type === 'POINTER_MOVE' && px) cursorPx = px;

  // radial menu takes priority while open
  const r = radial.get();
  if (r.open) {
    if (e.type === 'POINTER_MOVE' && px) radial.set({ hover: radialHit(px) });
    if (e.type === 'CLICK') {
      const item = r.items.find(i => i.id === radialHit(cursorPx));
      radial.set({ open: false, hover: null });
      item?.run();
      return;
    }
    if (e.type === 'MENU_CLOSE') radial.set({ open: false, hover: null });
    if (e.type !== 'POINTER_MOVE') return;
  }
  if (e.type === 'MENU_OPEN' && px) {
    radial.set({ open: true, at: clampMenu(px), items: [...contextItems, ...globalItems], hover: null });
    return;
  }

  for (let i = handlers.length - 1; i >= 0; i--) if (handlers[i](e, px)) return;

  switch (e.type) {
    case 'POINTER_MOVE':
      setHover(findTarget(px!));
      break;
    case 'CLICK': {
      const el = hovered ?? findTarget(px!);
      if (el) activate(el);
      break;
    }
    case 'SCROLL':
      scrollableAt(cursorPx).scrollBy({ top: e.dy * innerHeight, behavior: 'auto' });
      break;
    case 'STATE':
      if (e.state !== 'ACTIVE') setHover(null);
      break;
  }
}

const RADIUS = 150;
function clampMenu(p: Px): Px {
  const m = RADIUS + 60;
  return { x: Math.min(innerWidth - m, Math.max(m, p.x)), y: Math.min(innerHeight - m, Math.max(m, p.y)) };
}

export function radialLayout(n: number, i: number) {
  const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
  const r = Math.max(118, (n * 104) / (2 * Math.PI)); // keep 92px buttons from overlapping
  return { x: Math.cos(a) * r, y: Math.sin(a) * r };
}

function radialHit(p: Px): string | null {
  const { at, items } = radial.get();
  const dx = p.x - at.x, dy = p.y - at.y;
  if (Math.hypot(dx, dy) < 40) return null;
  let best: string | null = null;
  let bestD = Infinity;
  items.forEach((it, i) => {
    const o = radialLayout(items.length, i);
    const d = Math.hypot(dx - o.x, dy - o.y);
    if (d < bestD) {
      bestD = d;
      best = it.id;
    }
  });
  return bestD < 75 ? best : null;
}

vision.on(handle);

/** Register a context handler for the lifetime of a component. Return true to consume an event. */
export function useVisionHandler(handler: ContextHandler, deps: unknown[] = []) {
  // a pane that is hidden or floating does not take gestures
  const { visible } = usePane();
  useEffect(() => {
    if (!visible) return;
    handlers.push(handler);
    return () => {
      const i = handlers.lastIndexOf(handler);
      if (i >= 0) handlers.splice(i, 1);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, visible]);
}

/** Context-specific radial menu entries (e.g. Highlight in the reader, Seek in cinema). */
export function useRadialItems(items: RadialItem[], deps: unknown[] = []) {
  // only the active pane fills the radial menu
  const { active } = usePane();
  useEffect(() => {
    if (!active) return;
    contextItems = items;
    return () => {
      if (contextItems === items) contextItems = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, active]);
}

export function setGlobalRadialItems(items: RadialItem[]) {
  globalItems = items;
}
