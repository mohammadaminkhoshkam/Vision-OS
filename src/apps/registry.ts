// App registry (after Puter's app model): every tool is declared once — id, name, icon, search
// keywords and how it opens — and the dock, the command launcher and the hand radial menu are all
// built from this list. Adding a tool means adding one entry here.
import type { IconName } from '../ui/icons';
import type { PlannerTab, Screen } from '../state/app';

export interface AppEntry {
  id: string;
  label: string;
  icon: IconName;
  /** words the launcher matches besides the label */
  keywords: string;
  screen: Screen;
  tab?: PlannerTab;
  /** shown on the dock (in this order) */
  dock?: boolean;
  /** offered in the hand radial menu */
  radial?: boolean;
}

export const APPS: AppEntry[] = [
  { id: 'schedule', label: 'Planner', icon: 'calendar', keywords: 'schedule planner calendar day', screen: 'planner', tab: 'schedule', dock: true },
  { id: 'tasks', label: 'Tasks', icon: 'tasks', keywords: 'tasks todo', screen: 'planner', tab: 'tasks', dock: true },
  { id: 'focus', label: 'Focus', icon: 'timer', keywords: 'focus timer pomodoro flowtime', screen: 'focus', dock: true },
  { id: 'reader', label: 'Reader', icon: 'book', keywords: 'reader pdf read paper', screen: 'reader', dock: true, radial: true },
  { id: 'home', label: 'Garden', icon: 'garden', keywords: 'home garden', screen: 'home', dock: true, radial: true },
  { id: 'cinema', label: 'Video', icon: 'monitor', keywords: 'youtube video cinema lecture', screen: 'cinema', dock: true, radial: true },
  { id: 'board', label: 'Knowledge board', icon: 'network', keywords: 'board canvas knowledge map', screen: 'board', dock: true, radial: true },
  { id: 'library', label: 'Library', icon: 'folder', keywords: 'library papers notes', screen: 'library', dock: true },
  { id: 'stats', label: 'Stats', icon: 'chart', keywords: 'stats statistics progress', screen: 'planner', tab: 'stats' },
  { id: 'calibrate', label: 'Gestures and calibration', icon: 'hand', keywords: 'gesture calibrate hand tutorial practice', screen: 'calibrate' },
  { id: 'settings', label: 'Settings', icon: 'settings', keywords: 'settings preferences', screen: 'settings' },
];

export const dockApps = () => APPS.filter(a => a.dock);
export const appById = (id: string) => APPS.find(a => a.id === id);
