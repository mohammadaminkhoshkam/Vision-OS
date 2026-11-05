// Opt-in usability study recorder. Off unless started in Settings; logs only coarse events
// (screens, documents and pages, board cards, timer starts, warnings) locally, for export by the
// person running the study. No content, no camera data, nothing sent anywhere.
import { board } from '../board/store';
import { focus } from '../focus/store';
import { createStore, loadJson, saveJson } from '../lib/store';
import { app } from '../state/app';
import { workspace } from '../state/workspace';
import type { StudyEvent } from './analyze';

const KEY = 'vos.study';
export const study = createStore(loadJson<{ active: boolean; participant: string; build: string; events: StudyEvent[] }>(KEY, { active: false, participant: '', build: 'redesign', events: [] }));

const persist = () => saveJson(KEY, study.get());

function log(e: StudyEvent) {
  if (!study.get().active) return;
  study.set(s => ({ events: [...s.events, e].slice(-5000) }));
  persist();
}

export function startStudy(participant: string, build: string) {
  study.set({ active: true, participant: participant.trim() || 'P?', build, events: [{ t: Date.now(), type: 'start' }] });
  persist();
}
export function stopStudy() {
  log({ t: Date.now(), type: 'stop' });
  study.set({ active: false });
  persist();
}
export function clearStudy() {
  study.set({ active: false, events: [] });
  persist();
}

export function watchStudy() {
  // reopening the app during a study counts as leaving and coming back
  if (study.get().active) log({ t: Date.now(), type: 'away' });
  let screen = app.get().screen;
  let toastIds = new Set(app.get().toasts.map(t => t.id));
  let doc = '';
  let cards = board.get().doc.nodes.length;
  let sessions = focus.get().sessions.length;
  const offs = [
    app.subscribe(() => {
      const s = app.get();
      if (s.screen !== screen) {
        log({ t: Date.now(), type: 'screen', screen: (screen = s.screen) });
        // arriving back in the reader shows where the open document is, even if the page is unchanged
        const a = workspace.get().recent[0];
        if (screen === 'reader' && s.doc && a && a.kind !== 'video') log({ t: Date.now(), type: 'doc', id: a.id, page: a.page ?? 1 });
      }
      for (const t of s.toasts) if (!toastIds.has(t.id) && t.tone === 'warn') log({ t: Date.now(), type: 'warn', text: t.text });
      toastIds = new Set(s.toasts.map(t => t.id));
    }),
    workspace.subscribe(() => {
      const a = workspace.get().recent[0];
      if (!a || a.kind === 'video') return;
      const key = `${a.id}@${a.page}`;
      if (key !== doc) log({ t: Date.now(), type: 'doc', id: a.id, page: a.page ?? 1 }), (doc = key);
    }),
    board.subscribe(() => {
      const n = board.get().doc.nodes.length;
      if (n > cards) log({ t: Date.now(), type: 'card' });
      cards = n;
    }),
    focus.subscribe(() => {
      const list = focus.get().sessions;
      if (list.length > sessions && list[list.length - 1].tag !== 'Break') log({ t: Date.now(), type: 'focus' });
      sessions = list.length;
    }),
  ];
  const vis = () => log({ t: Date.now(), type: document.hidden ? 'away' : 'back' });
  document.addEventListener('visibilitychange', vis);
  return () => {
    offs.forEach(f => f());
    document.removeEventListener('visibilitychange', vis);
  };
}
