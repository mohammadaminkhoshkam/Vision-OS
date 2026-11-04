// Usability study analysis (pure). The protocol in docs/usability-test.md asks participants to do
// four tasks without guidance; the app records a local event log and this turns it into the
// numbers the protocol compares: time per task, errors, navigation and signs of confusion.

export type StudyEvent =
  | { t: number; type: 'start' | 'stop' }
  | { t: number; type: 'screen'; screen: string }
  | { t: number; type: 'doc'; id: string; page: number }
  | { t: number; type: 'card' }
  | { t: number; type: 'focus' }
  | { t: number; type: 'warn'; text: string }
  | { t: number; type: 'away' }
  | { t: number; type: 'back' };

export type TaskId = 'open' | 'clip' | 'timer' | 'resume';

export const TASKS: { id: TaskId; label: string; instruction: string }[] = [
  { id: 'open', label: 'Open a PDF', instruction: 'Open the paper «…» (or any PDF) and go to its introduction.' },
  { id: 'clip', label: 'Move a note to the board', instruction: 'Put one sentence from the paper on the knowledge board.' },
  { id: 'timer', label: 'Start the study timer', instruction: 'Start a focus session for this reading.' },
  { id: 'resume', label: 'Leave and come back', instruction: 'Go somewhere else in the app (or close it), then return to the same place in the paper.' },
];

export interface TaskResult {
  id: TaskId;
  done: boolean;
  /** ms from the end of the previous task (or study start) to completion */
  ms: number | null;
  errors: number;
  navigations: number;
  /** quick back-and-forth between two screens within 10 s: a common confusion signal */
  pingPongs: number;
}

export function analyze(events: StudyEvent[]): TaskResult[] {
  const ev = [...events].sort((a, b) => a.t - b.t);
  const start = ev.find(e => e.type === 'start')?.t ?? ev[0]?.t ?? 0;
  const firstDoc = ev.find(e => e.type === 'doc') as Extract<StudyEvent, { type: 'doc' }> | undefined;
  const doneAt: Record<TaskId, number | null> = {
    open: firstDoc?.t ?? null,
    clip: firstDoc ? ev.find(e => e.type === 'card' && e.t >= firstDoc.t)?.t ?? null : null,
    timer: ev.find(e => e.type === 'focus')?.t ?? null,
    resume: null,
  };
  // resume: after being away, the same document is open again within a page of where it was left
  // tasks are done in order, so leaving and returning only counts once the timer task is done
  const after = doneAt.timer ?? start;
  let left: { id: string; page: number } | null = null;
  let away = false;
  for (const e of ev) {
    if (e.t < after) {
      if (e.type === 'doc') left = { id: e.id, page: e.page };
      continue;
    }
    if (e.type === 'doc') {
      if (away && left && e.id === left.id && Math.abs(e.page - left.page) <= 1) {
        doneAt.resume = e.t;
        break;
      }
      left = { id: e.id, page: e.page };
    }
    if (e.type === 'away' || (e.type === 'screen' && left && e.screen !== 'reader')) away = !!left;
  }

  let prevEnd = start;
  return TASKS.map(task => {
    const end = doneAt[task.id];
    const from = prevEnd;
    const to = end ?? ev[ev.length - 1]?.t ?? from;
    const window = ev.filter(e => e.t >= from && e.t <= to);
    const screens = window.filter(e => e.type === 'screen') as Extract<StudyEvent, { type: 'screen' }>[];
    let pingPongs = 0;
    for (let i = 2; i < screens.length; i++) if (screens[i].screen === screens[i - 2].screen && screens[i].t - screens[i - 2].t < 10000) pingPongs++;
    if (end !== null) prevEnd = Math.max(prevEnd, end);
    return {
      id: task.id,
      done: end !== null,
      ms: end !== null ? Math.max(0, end - from) : null,
      errors: window.filter(e => e.type === 'warn').length,
      navigations: screens.length,
      pingPongs,
    };
  });
}

export function toCsv(participant: string, build: string, results: TaskResult[]) {
  const rows = [['participant', 'build', 'task', 'done', 'seconds', 'errors', 'navigations', 'pingPongs']];
  for (const r of results) rows.push([participant, build, r.id, String(r.done), r.ms === null ? '' : (r.ms / 1000).toFixed(1), String(r.errors), String(r.navigations), String(r.pingPongs)]);
  return rows.map(r => r.map(c => (/[",\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(',')).join('\n');
}
