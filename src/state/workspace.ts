// Living workspace: what the user is working on right now, so Home, the dock, the garden and the
// companion can all answer «where was I, and what is the best next step?». The pure helpers are
// tested in workspace.test.ts; the store persists the last activity across restarts.
import { createStore, loadJson, saveJson } from '../lib/store';

export type ActivityKind = 'paper' | 'file' | 'video';

export interface Activity {
  kind: ActivityKind;
  /** paper id, reader doc id (files) or YouTube video id */
  id: string;
  title: string;
  page?: number;
  pages?: number;
  /** video position in seconds */
  t?: number;
  /** last time the user touched it (ms) */
  at: number;
}

export type Daypart = 'dawn' | 'day' | 'dusk' | 'night';

export function daypart(hour: number): Daypart {
  if (hour >= 5 && hour < 8) return 'dawn';
  if (hour >= 8 && hour < 17) return 'day';
  if (hour >= 17 && hour < 20) return 'dusk';
  return 'night';
}

/** Most recent first, one entry per item, capped. */
export function upsertRecent(list: Activity[], a: Activity, max = 8): Activity[] {
  return [a, ...list.filter(x => !(x.kind === a.kind && x.id === a.id))].slice(0, max);
}

export interface NextAction {
  kind: 'focus' | 'resume' | 'task' | 'start';
  title: string;
  detail: string;
}

interface NextInput {
  last: Activity | null;
  /** a running or paused focus session */
  focus: { title: string; remainingSec: number | null } | null;
  /** today's undone timed items, any order */
  tasks: { title: string; time?: string; done: boolean }[];
  now: Date;
}

const STALE_MS = 14 * 24 * 3600 * 1000;

export function minutesUntil(time: string, now: Date) {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m - (now.getHours() * 60 + now.getMinutes());
}

/** The single most useful next step, in priority order:
 *  an ongoing focus session → a timed item starting within 30 minutes → the last thing worked on
 *  → the next item later today → a fresh start. */
export function nextAction({ last, focus, tasks, now }: NextInput): NextAction {
  if (focus) {
    const left = focus.remainingSec === null ? 'flow session' : `${Math.ceil(focus.remainingSec / 60)} min left`;
    return { kind: 'focus', title: focus.title, detail: `Focus session in progress · ${left}` };
  }
  const upcoming = tasks
    .filter(t => !t.done && t.time && minutesUntil(t.time, now) >= 0)
    .sort((a, b) => (a.time ?? '').localeCompare(b.time ?? ''));
  const soon = upcoming.find(t => minutesUntil(t.time!, now) <= 30);
  if (soon) return { kind: 'task', title: soon.title, detail: `Starts at ${soon.time}` };
  if (last && now.getTime() - last.at < STALE_MS) return { kind: 'resume', title: last.title, detail: describeActivity(last) };
  if (upcoming[0]) return { kind: 'task', title: upcoming[0].title, detail: `Next today at ${upcoming[0].time}` };
  return { kind: 'start', title: 'Start a calm session', detail: 'Open a paper from the library or drop in a PDF' };
}

export function describeActivity(a: Activity) {
  if (a.kind === 'video') return `Video · ${formatClock(a.t ?? 0)}`;
  const page = a.page ? `Page ${a.page}${a.pages ? ` of ${a.pages}` : ''}` : 'Not started';
  return a.kind === 'file' ? `${page} · local PDF` : page;
}

export function formatClock(sec: number) {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}` : `${m}:${String(r).padStart(2, '0')}`;
}

export function relativeTime(at: number, now: number) {
  const min = Math.floor((now - at) / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min} min ago`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  return d === 1 ? 'yesterday' : `${d} days ago`;
}

// ───────────── store

const KEY = 'vos.workspace';
const saved = loadJson<{ recent: Activity[] }>(KEY, { recent: [] });

export const workspace = createStore({
  recent: saved.recent,
  /** tools holding live state in this run (shown as dots on the dock) */
  live: {} as Partial<Record<'reader' | 'cinema', string>>,
});

let timer = 0;
function persist() {
  clearTimeout(timer);
  timer = window.setTimeout(() => saveJson(KEY, { recent: workspace.get().recent }), 400);
}

/** Record activity on a document or video; cheap enough to call on every page turn. */
export function touch(a: Omit<Activity, 'at'>) {
  const tool = a.kind === 'video' ? 'cinema' : 'reader';
  workspace.set(s => ({ recent: upsertRecent(s.recent, { ...a, at: Date.now() }), live: { ...s.live, [tool]: a.title } }));
  persist();
}

export const lastActivity = () => workspace.get().recent[0] ?? null;
