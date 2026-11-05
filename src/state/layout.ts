// Persistent workspace layout. The research tools (reader, knowledge board, video) are panes that
// stay mounted once opened, so switching between them never loses a scroll position, a playing
// video or a half-drawn selection. A pane sits in one slot at a time:
//   main   — the screen the user navigated to
//   side   — shown beside main, behind a draggable splitter
//   pip    — the video keeps playing in a small floating window while you work elsewhere
//   hidden — mounted but invisible and inert
// The pure functions below decide slots and focus; they are tested in layout.test.ts.
import { createStore, loadJson, saveJson } from '../lib/store';
import type { Screen } from './app';

export type PaneId = 'reader' | 'board' | 'cinema';
export type Slot = 'main' | 'side' | 'pip' | 'hidden';
export const PANES: PaneId[] = ['reader', 'board', 'cinema'];
export const isPane = (s: string): s is PaneId => (PANES as string[]).includes(s);

export const MIN_RATIO = 0.3;
export const MAX_RATIO = 0.75;
export const clampRatio = (r: number) => Math.min(MAX_RATIO, Math.max(MIN_RATIO, Number.isFinite(r) ? r : 0.58));

export interface SlotInput {
  screen: Screen;
  side: PaneId | null;
  /** the video is playing (it floats instead of hiding when you leave it) */
  playing: boolean;
  /** the user closed the floating player */
  pipDismissed: boolean;
}

/** The main pane is the screen itself; side only exists beside a pane screen and never equals main. */
export function effectiveSide(screen: Screen, side: PaneId | null): PaneId | null {
  return isPane(screen) && side && side !== screen ? side : null;
}

export function slotOf(pane: PaneId, s: SlotInput): Slot {
  if (s.screen === pane) return 'main';
  if (effectiveSide(s.screen, s.side) === pane) return 'side';
  if (pane === 'cinema' && s.playing && !s.pipDismissed && s.screen !== 'focus') return 'pip';
  return 'hidden';
}

/** Keyboard shortcuts, voice/command controls and the radial menu go to one pane: the visible
 *  one the user last touched, otherwise the main pane. A floating video takes media controls only
 *  when no pane is on screen. */
export function activePane(s: SlotInput, focused: PaneId | null): PaneId | null {
  const visible = PANES.filter(p => ['main', 'side'].includes(slotOf(p, s)));
  if (focused && visible.includes(focused)) return focused;
  if (isPane(s.screen)) return s.screen;
  return slotOf('cinema', s) === 'pip' ? 'cinema' : null;
}

// ───────────── saved workspaces (layout + what was open + environment)

export interface SavedWorkspace {
  id: string;
  name: string;
  main: PaneId;
  side: PaneId | null;
  ratio: number;
  /** activities to reopen: a paper / local file id and a video id */
  paper?: { kind: 'paper' | 'file'; id: string; page?: number };
  video?: { id: string; t: number };
  /** personal environment: scene preset and focus ambience */
  preset?: string;
  ambient?: Record<string, number> | null;
  created: number;
}

export function upsertWorkspace(list: SavedWorkspace[], w: SavedWorkspace, max = 12): SavedWorkspace[] {
  const rest = list.filter(x => x.id !== w.id && x.name.trim().toLowerCase() !== w.name.trim().toLowerCase());
  return [w, ...rest].slice(0, max);
}

// ───────────── store

const KEY = 'vos.layout';
const saved = loadJson<{ side: PaneId | null; ratio: number; workspaces: SavedWorkspace[] }>(KEY, { side: null, ratio: 0.58, workspaces: [] });

export const layout = createStore({
  side: saved.side,
  ratio: clampRatio(saved.ratio),
  workspaces: saved.workspaces,
  /** panes mounted in this run */
  opened: [] as PaneId[],
  focused: null as PaneId | null,
  playing: false,
  pipDismissed: false,
});

function persist() {
  const { side, ratio, workspaces } = layout.get();
  saveJson(KEY, { side, ratio, workspaces });
}

export function openPane(p: PaneId) {
  if (!layout.get().opened.includes(p)) layout.set(s => ({ opened: [...s.opened, p] }));
}

export function setSide(side: PaneId | null) {
  if (side) openPane(side);
  layout.set({ side });
  persist();
}

export function setRatio(r: number) {
  layout.set({ ratio: clampRatio(r) });
}
export const commitRatio = persist;

export function closePane(p: PaneId) {
  layout.set(s => ({ opened: s.opened.filter(x => x !== p), side: s.side === p ? null : s.side, focused: s.focused === p ? null : s.focused }));
  persist();
}

export function saveWorkspaces(workspaces: SavedWorkspace[]) {
  layout.set({ workspaces });
  persist();
}
