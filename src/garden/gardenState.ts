// Garden Studio state: decorative plants and objects (PP-01/03/04, BM-02/03/05).
// Care is purely decorative: nothing ever wilts or disappears because the user was away.
import { History } from '../board/model';
import { focus, setFocusPrefs } from '../focus/store';
import { spend } from '../focus/engine';
import { createStore, loadJson, saveJson } from '../lib/store';
import type { MarginalPaper } from '../platform';
import { toast } from '../state/app';
import type { DecorKind } from './plants';

export interface DecorItem {
  id: string;
  kind: DecorKind;
  x: number;
  y: number;
  color?: string;
  planted?: string;
  watered?: string;
}

export interface JournalEntry {
  at: string;
  text: string;
}

const KEY = 'vos.garden';
const GRID = 20;
export const AREA = { x0: 40, x1: 1560, y0: 668, y1: 800 };

const starter: DecorItem[] = [
  { id: 'd1', kind: 'lantern', x: 640, y: 760 },
  { id: 'd2', kind: 'snake', x: 480, y: 780 },
  { id: 'd3', kind: 'fern', x: 560, y: 790 },
  { id: 'd4', kind: 'bench', x: 1480, y: 770 },
  { id: 'd5', kind: 'monstera', x: 1580, y: 790 },
];

const saved = loadJson<{ decor: DecorItem[]; journal: JournalEntry[]; careSim: boolean }>(KEY, {
  decor: starter,
  journal: [],
  careSim: false,
});

const history = new History<DecorItem[]>(saved.decor);

export const garden = createStore({
  decor: saved.decor,
  journal: saved.journal,
  careSim: saved.careSim,
  editing: false,
  selected: null as string | null,
  placing: null as null | { kind: DecorKind; color?: string },
  ghost: null as null | { x: number; y: number; ok: boolean },
  inspect: null as string | null,
  /** a connection thread chosen in the garden (two related papers) */
  thread: null as null | { a: string; b: string; terms: string[] },
  picked: null as MarginalPaper | null,
  hover: null as { paper: MarginalPaper; rect: DOMRect } | null,
  canUndo: false,
  canRedo: false,
});

function persist() {
  const { decor, journal, careSim } = garden.get();
  saveJson(KEY, { decor, journal: journal.slice(-200), careSim });
}

function sync() {
  garden.set({ decor: history.present, canUndo: history.canUndo, canRedo: history.canRedo });
  persist();
}

function commit(next: DecorItem[]) {
  history.push(next);
  sync();
}

export function log(text: string) {
  garden.set(s => ({ journal: [...s.journal, { at: new Date().toISOString(), text }] }));
  persist();
}

export const snap = (v: number) => Math.round(v / GRID) * GRID;

/** A spot is valid inside the planting area and not on top of another item. */
export function validSpot(decor: DecorItem[], x: number, y: number, ignoreId?: string) {
  if (x < AREA.x0 || x > AREA.x1 || y < AREA.y0 || y > AREA.y1) return false;
  if (x > 690 && x < 1430 && y < 750) return false; // the central planter
  return !decor.some(d => d.id !== ignoreId && Math.abs(d.x - x) < 46 && Math.abs(d.y - y) < 24);
}

export function undoGarden() {
  if (history.undo()) sync();
}
export function redoGarden() {
  if (history.redo()) sync();
}

export function beginPlacing(kind: DecorKind, color?: string) {
  garden.set({ placing: { kind, color }, editing: true, selected: null, inspect: null });
}

export function updateGhost(x: number, y: number) {
  const sx = snap(x), sy = snap(y);
  garden.set({ ghost: { x: sx, y: sy, ok: validSpot(garden.get().decor, sx, sy) } });
}

export function placeAtGhost(label: string) {
  const { placing, ghost, decor } = garden.get();
  if (!placing || !ghost) return;
  if (!ghost.ok) return toast('You can’t plant here; pick an empty spot on the greenhouse floor', 'warn');
  const id = Math.random().toString(36).slice(2, 9);
  commit([...decor, { id, kind: placing.kind, color: placing.color, x: ghost.x, y: ghost.y, planted: new Date().toISOString() }]);
  log(`${label} planted`);
  garden.set({ placing: null, ghost: null, selected: id });
}

export function cancelPlacing() {
  garden.set({ placing: null, ghost: null });
}

/** While dragging only the view changes; history keeps the pre-drag state for Undo. */
export function moveDecorLive(id: string, x: number, y: number) {
  garden.set(s => ({ decor: s.decor.map(d => (d.id === id ? { ...d, x: Math.min(AREA.x1, Math.max(AREA.x0, x)), y: Math.min(AREA.y1, Math.max(AREA.y0, y)) } : d)) }));
}

export function commitMove(id: string) {
  const moved = garden.get().decor.map(d => (d.id === id ? { ...d, x: snap(d.x), y: snap(d.y) } : d));
  const d = moved.find(x => x.id === id);
  if (!d || !validSpot(moved, d.x, d.y, id)) {
    toast('That spot is taken; moved back to where it was', 'warn');
    garden.set({ decor: history.present });
    return;
  }
  commit(moved);
}

export function removeDecor(id: string, label: string) {
  commit(garden.get().decor.filter(d => d.id !== id));
  log(`${label} removed`);
  garden.set({ selected: null, inspect: null });
}

export function water(id: string, label: string) {
  const now = new Date().toISOString();
  commit(garden.get().decor.map(d => (d.id === id ? { ...d, watered: now } : d)));
  log(`${label} watered`);
  toast('Watered 💧', 'ok');
}

export function setCareSim(on: boolean) {
  garden.set({ careSim: on });
  persist();
}

/** Decorative only: a plant looks thirsty after 3 days without water, and recovers at once. */
export function isThirsty(d: DecorItem, careSim: boolean) {
  if (!careSim || ['lantern', 'bench', 'desk'].includes(d.kind)) return false;
  const last = d.watered ?? d.planted;
  return !!last && Date.now() - Date.parse(last) > 3 * 86400000;
}

/** Unlock a catalog item with dew points (PP-05). Returns false if not affordable. */
export function unlock(kind: DecorKind, cost: number): boolean {
  if (!cost || !focus.get().rewardMode) return true;
  const ledger = spend(focus.get().ledger, `unlock:${kind}`, cost, Date.now());
  if (!ledger) return false;
  setFocusPrefs({ ledger });
  return true;
}

export const isUnlocked = (kind: DecorKind, cost: number) =>
  !cost || !focus.get().rewardMode || focus.get().ledger.some(e => e.eventId === `unlock:${kind}`);
