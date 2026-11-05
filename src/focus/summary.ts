// End-of-session summary: when a focus session completes, show what it produced — minutes, pages
// read, highlights and board cards made — and exactly where to pick up again.
import { board } from '../board/store';
import { createStore } from '../lib/store';
import { loadNotes } from '../reader/annotations';
import { workspace, type Activity } from '../state/workspace';
import { focus } from './store';
import { summarize, type SessionSummary } from './summarize';

interface Snapshot {
  id: string;
  activity: Activity | null;
}

export const sessionSummary = createStore({ summary: null as SessionSummary | null });

let snap: Snapshot | null = null;
let lastStatus = new Map<string, string>();

/** Watches focus sessions: snapshots where you were at the start, summarises at completion. */
export function watchSessions() {
  return focus.subscribe(() => {
    for (const s of focus.get().sessions.slice(-3)) {
      const prev = lastStatus.get(s.id);
      if (prev === s.status) continue;
      lastStatus.set(s.id, s.status);
      if (s.status === 'running' && !prev) snap = { id: s.id, activity: workspace.get().recent[0] ?? null };
      if (s.status === 'completed' && prev) {
        const end = workspace.get().recent[0] ?? null;
        const start = snap?.id === s.id ? snap.activity : null;
        const docId = end && end.kind !== 'video' ? (end.kind === 'paper' ? `m-${end.id}` : end.id) : null;
        const hl = docId ? loadNotes(docId).highlights.map(h => h.created) : [];
        const cards = board.get().doc.nodes.map(n => n.created);
        const sum = summarize(s, start, end, hl, cards, Date.now());
        if (sum.minutes >= 1) sessionSummary.set({ summary: sum });
      }
    }
    if (lastStatus.size > 50) lastStatus = new Map([...lastStatus].slice(-20));
  });
}
