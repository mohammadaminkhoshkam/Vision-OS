import { useEffect, useState } from 'react';
import { createStore, loadJson, saveJson } from '../lib/store';
import { toast } from '../state/app';
import { breakSuggestionMin, finish, grantReward, isDue, pause, resume, startSession, uid, type FocusLink, type FocusSession, type RewardEntry, type TimerMode } from './engine';

const KEY = 'vos.focus';
const fa = new Intl.NumberFormat('en-US');

export interface Task {
  id: string;
  title: string;
  tag: string;
  done: boolean;
  /** optional HH:MM for today's schedule */
  time?: string;
  /** day the timed item belongs to (YYYY-MM-DD); undefined = every day list */
  day?: string;
  priority?: 'high' | 'normal';
}

export const todayKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

interface Saved {
  sessions: FocusSession[];
  ledger: RewardEntry[];
  tasks: Task[];
  rewardMode: boolean;
  customTags: string[];
  defaultMinutes: number;
}

const saved = loadJson<Saved>(KEY, { sessions: [], ledger: [], tasks: [], rewardMode: true, customTags: [], defaultMinutes: 25 });

export const focus = createStore({
  ...saved,
  overlayHidden: false,
  breakSuggestion: null as null | { minutes: number },
  /** dock bird and garden listen to this to celebrate gently */
  lastReward: null as null | { points: number; at: number },
});

function persist() {
  const { sessions, ledger, tasks, rewardMode, customTags, defaultMinutes } = focus.get();
  saveJson(KEY, { sessions: sessions.slice(-500), ledger, tasks, rewardMode, customTags, defaultMinutes });
}

export const current = () => focus.get().sessions.find(s => s.status === 'running' || s.status === 'paused') ?? null;

function replace(s: FocusSession) {
  focus.set(st => ({ sessions: st.sessions.map(x => (x.id === s.id ? s : x)) }));
  persist();
}

export function start(mode: TimerMode, minutes: number, tag: string, link: FocusLink | null) {
  const cur = current();
  if (cur) stop('cancelled');
  const s = startSession(mode, minutes, tag, link, Date.now());
  focus.set(st => ({ sessions: [...st.sessions, s], overlayHidden: false, breakSuggestion: null }));
  persist();
}

export function togglePause() {
  const s = current();
  if (!s) return;
  replace(s.status === 'running' ? pause(s, Date.now()) : resume(s, Date.now()));
}

export function stop(status: 'completed' | 'cancelled' = 'completed') {
  const s = current();
  if (!s) return;
  const done = finish(s, Date.now(), status);
  replace(done);
  const minutes = Math.round(done.activeMs / 60000);
  if (status === 'completed') {
    if (focus.get().rewardMode) {
      const r = grantReward(focus.get().ledger, done, Date.now());
      if (r.granted) {
        focus.set({ ledger: r.ledger, lastReward: { points: r.granted, at: Date.now() } });
        toast(`${fa.format(minutes)}-minute session finished · ${fa.format(r.granted)} dew drops 💧`, 'ok');
      } else toast(`${fa.format(minutes)}-minute session logged`, 'ok');
    } else toast(`${fa.format(minutes)}-minute session logged`, 'ok');
    if (minutes >= 5) focus.set({ breakSuggestion: { minutes: breakSuggestionMin(minutes, done.mode) } });
    persist();
  }
}

export function setFocusPrefs(patch: Partial<Saved>) {
  focus.set(patch);
  persist();
}

export function addTask(title: string, tag: string, extra: Partial<Task> = {}) {
  focus.set(st => ({ tasks: [...st.tasks, { id: uid(), title, tag, done: false, ...extra }] }));
  persist();
}
export function toggleTask(id: string) {
  focus.set(st => ({ tasks: st.tasks.map(t => (t.id === id ? { ...t, done: !t.done } : t)) }));
  persist();
}
export function removeTask(id: string) {
  focus.set(st => ({ tasks: st.tasks.filter(t => t.id !== id) }));
  persist();
}

/** Re-renders every second while mounted; also completes a pomodoro that reached zero. */
export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

// reminders for timed schedule items: once per item per day, at its HH:MM
const reminded = new Set<string>(loadJson<{ keys: string[] }>('vos.reminded', { keys: [] }).keys);
function checkReminders() {
  const d = new Date();
  const hhmm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  const today = todayKey(d);
  for (const t of focus.get().tasks) {
    if (!t.time || t.done || (t.day && t.day !== today) || t.time !== hhmm) continue;
    const key = `${t.id}@${today}`;
    if (reminded.has(key)) continue;
    reminded.add(key);
    saveJson('vos.reminded', { keys: [...reminded].filter(k => k.endsWith(today)) });
    toast(`Reminder: ${t.title} (${fa.format(d.getHours())}:${String(d.getMinutes()).padStart(2, '0')})`, 'warn');
  }
}

// one global ticker completes due pomodoros and fires reminders even when no UI is mounted
setInterval(() => {
  const s = current();
  if (s && isDue(s, Date.now())) stop('completed');
  checkReminders();
}, 1000);
