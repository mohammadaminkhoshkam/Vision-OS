import { createStore, loadJson, saveJson } from '../lib/store';
import type { MarginalPaper } from '../platform';
import { notify } from './notifications';

export type Screen = 'home' | 'reader' | 'cinema' | 'calibrate' | 'settings' | 'focus' | 'board' | 'library' | 'planner';
export type PlannerTab = 'schedule' | 'tasks' | 'stats';
export type LibraryTab = 'papers' | 'notes';
export type Workspace = 'study' | 'research' | 'engineering' | 'entertainment';

export type ReaderDoc =
  | { source: 'marginal'; paper: MarginalPaper }
  | { source: 'file'; name: string; data: ArrayBuffer }
  | null;

export interface Toast {
  id: number;
  text: string;
  tone?: 'ok' | 'warn' | 'info';
}

interface Prefs {
  theme: 'day' | 'night';
  workspace: Workspace;
  reducedMotion: boolean;
  gardenProgress: boolean;
  /** user-chosen background image (data URL), replaces the painted scene */
  wallpaper: string | null;
  preset: Preset;
  companion: boolean;
  userName: string;
}

export type Preset = 'photo' | 'morning' | 'rainy' | 'sunset' | 'night';

const PREFS_KEY = 'vos.prefs';
const prefs = loadJson<Prefs>(PREFS_KEY, { theme: 'day', workspace: 'research', reducedMotion: false, gardenProgress: true, wallpaper: null, preset: 'photo', companion: true, userName: '' });

export const app = createStore({
  screen: 'home' as Screen,
  doc: null as ReaderDoc,
  focus: false,
  commandOpen: false,
  toasts: [] as Toast[],
  /** page to jump to when the reader next opens a document (from a board card or the garden) */
  pendingPage: null as number | null,
  pendingVideo: null as { id: string; t: number } | null,
  split: false,
  plannerTab: 'schedule' as PlannerTab,
  libraryTab: 'papers' as LibraryTab,
  ...prefs,
});

export function setPrefs(patch: Partial<Prefs>) {
  // a preset implies the theme; choosing day/night directly picks the matching preset
  if (patch.preset) patch = { ...patch, theme: patch.preset === 'night' || patch.preset === 'photo' ? 'night' : 'day' };
  else if (patch.theme) patch = { ...patch, preset: patch.theme === 'night' ? 'photo' : ['night', 'photo'].includes(app.get().preset) ? 'morning' : app.get().preset };
  app.set(patch);
  const s = app.get();
  saveJson(PREFS_KEY, { theme: s.theme, workspace: s.workspace, reducedMotion: s.reducedMotion, gardenProgress: s.gardenProgress, wallpaper: s.wallpaper, preset: s.preset, companion: s.companion, userName: s.userName });
}

let toastId = 0;
export function toast(text: string, tone: Toast['tone'] = 'info') {
  const id = ++toastId;
  if (tone !== 'info') notify(text, tone ?? 'info');
  app.set(s => ({ toasts: [...s.toasts.slice(-3), { id, text, tone }] }));
  setTimeout(() => app.set(s => ({ toasts: s.toasts.filter(t => t.id !== id) })), 3200);
}

export function go(screen: Screen) {
  app.set({ screen, focus: screen === app.get().screen ? app.get().focus : false });
}

export function openPaper(paper: MarginalPaper, page?: number) {
  app.set({ doc: { source: 'marginal', paper }, screen: 'reader', pendingPage: page ?? null });
}

export function openVideo(id: string, t = 0) {
  app.set({ screen: 'cinema', pendingVideo: { id, t } });
}

/** Screens expose imperative controls here so voice / command bar / radial menu can drive them. */
export interface MediaControls {
  page?(dir: 1 | -1): void;
  gotoPage?(n: number): void;
  zoom?(dir: 1 | -1): void;
  play?(): void;
  pause?(): void;
  seek?(seconds: number): void;
  volume?(dir: 1 | -1): void;
  bookmark?(): void;
  search?(q: string): void;
  /** ask the local AI about the current selection/page */
  ask?(action: string): void;
}
export const controls: { current: MediaControls } = { current: {} };
