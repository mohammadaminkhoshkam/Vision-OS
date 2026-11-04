// Notification center behind the bell: keeps recent meaningful events (focus sessions, tasks
// coming due, model installs…) so a toast that disappeared can still be found.
import { createStore, loadList, saveJson } from '../lib/store';

export interface Note {
  id: string;
  text: string;
  tone: 'ok' | 'warn' | 'info';
  at: number;
}

const KEY = 'vos.notifications';

export const notes = createStore({ list: loadList<Note>(KEY).slice(-40), seenAt: Number(localStorage.getItem('vos.notifications.seen') ?? 0), open: false });

export function notify(text: string, tone: Note['tone'] = 'info') {
  const n = { id: Math.random().toString(36).slice(2, 9), text, tone, at: Date.now() };
  notes.set(s => ({ list: [...s.list, n].slice(-40) }));
  saveJson(KEY, notes.get().list);
}

export function markSeen() {
  const t = Date.now();
  notes.set({ seenAt: t });
  try {
    localStorage.setItem('vos.notifications.seen', String(t));
  } catch {
    /* ignore */
  }
}

export function clearNotes() {
  notes.set({ list: [] });
  saveJson(KEY, []);
}

export const unread = (s: { list: Note[]; seenAt: number }) => s.list.filter(n => n.at > s.seenAt).length;
