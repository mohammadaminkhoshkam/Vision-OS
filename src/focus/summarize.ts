// Pure part of the end-of-session summary (tested in summary.test.ts).
import type { Activity } from '../state/workspace';
import type { FocusSession } from './engine';

export interface SessionSummary {
  minutes: number;
  pages: number;
  highlights: number;
  cards: number;
  resume: Activity | null;
  at: number;
}


/** Pure: what a finished session produced. */
export function summarize(s: Pick<FocusSession, 'activeMs' | 'startedAt'>, start: Activity | null, end: Activity | null, highlightTimes: string[], cardTimes: string[], now: number): SessionSummary {
  const after = (iso: string) => {
    const t = Date.parse(iso);
    return Number.isFinite(t) && t >= s.startedAt && t <= now;
  };
  const sameDoc = start && end && start.kind === end.kind && start.id === end.id;
  return {
    minutes: Math.round(s.activeMs / 60000),
    pages: sameDoc && start!.page && end!.page ? Math.max(0, end!.page - start!.page) : 0,
    highlights: highlightTimes.filter(after).length,
    cards: cardTimes.filter(after).length,
    resume: end,
    at: now,
  };
}

