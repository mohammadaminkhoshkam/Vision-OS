import { createStore, loadJson, saveJson } from '../lib/store';
import { toast } from '../state/app';
import { addNode, History, nextSlot, type BoardDoc, type BoardNode, type Source, type Viewport } from './model';

const KEY = 'vos.board';
const saved = loadJson<{ doc: BoardDoc; view: Viewport }>(KEY, { doc: { nodes: [], edges: [] }, view: { x: 300, y: 200, scale: 1 } });

export const history = new History<BoardDoc>(saved.doc);

export const board = createStore({
  doc: saved.doc,
  view: saved.view,
  linking: null as string | null,
  selected: null as string | null,
  canUndo: false,
  canRedo: false,
});

let saveTimer = 0;
function persist() {
  clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    const { doc, view } = board.get();
    try {
      saveJson(KEY, { doc, view });
    } catch {
      toast('Storage is full; delete a few large figures', 'warn');
    }
  }, 300);
}

function sync() {
  board.set({ doc: history.present, canUndo: history.canUndo, canRedo: history.canRedo });
  persist();
}

/** A finished edit: recorded for undo and saved. */
export function commit(next: BoardDoc) {
  history.push(next);
  sync();
}

/** An edit in progress (dragging): shown live, recorded once on commit. */
export function live(next: BoardDoc) {
  history.replace(next);
  board.set({ doc: next });
}

export function undo() {
  if (history.undo()) sync();
}
export function redo() {
  if (history.redo()) sync();
}

export function setView(view: Viewport) {
  board.set({ view });
  persist();
}

function drop(n: Omit<BoardNode, 'id' | 'created' | 'x' | 'y'>) {
  const { doc, view } = board.get();
  const p = nextSlot(doc, view, innerWidth * 0.6, innerHeight);
  commit(addNode(doc, { ...n, ...p }));
}

export function clipText(text: string, source: Source) {
  drop({ type: 'text', w: 280, text, source });
  toast('Clip sent to the knowledge board', 'ok');
}

export function clipFigure(image: string, source: Source, caption = '') {
  drop({ type: 'figure', w: 300, text: caption, image, source });
  toast('Figure sent to the knowledge board', 'ok');
}

export function clipVideo(note: string, source: Source) {
  drop({ type: 'video', w: 260, text: note, source });
  toast('Video moment sent to the knowledge board', 'ok');
}

export function addNote(x?: number, y?: number) {
  const { doc, view } = board.get();
  const p = x !== undefined && y !== undefined ? { x, y } : nextSlot(doc, view, innerWidth * 0.6, innerHeight);
  const next = addNode(doc, { type: 'note', w: 240, text: '', source: null, ...p });
  commit(next);
  board.set({ selected: next.nodes[next.nodes.length - 1].id });
}

/** Scale a canvas region down to a compact JPEG so clips stay small on disk. */
export function cropToDataUrl(src: HTMLCanvasElement, sx: number, sy: number, sw: number, sh: number, maxW = 560) {
  const k = Math.min(1, maxW / sw);
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(sw * k));
  c.height = Math.max(1, Math.round(sh * k));
  c.getContext('2d')!.drawImage(src, sx, sy, sw, sh, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.82);
}
