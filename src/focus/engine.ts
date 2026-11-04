// Focus engine (FG-01/02/03, PP-02/06/07). Pure functions over plain data so it is testable and
// crash-safe: a running session is just timestamps, so reopening the app resumes it.

export type TimerMode = 'pomodoro' | 'flowtime';
export type SessionStatus = 'running' | 'paused' | 'completed' | 'cancelled';

export interface FocusLink {
  kind: 'paper' | 'video' | 'project' | 'task';
  id: string;
  title: string;
}

export interface FocusSession {
  id: string;
  mode: TimerMode;
  tag: string;
  link: FocusLink | null;
  plannedSec: number; // 0 for flowtime
  startedAt: number;
  activeMs: number; // accumulated before the current run
  runningSince: number | null;
  status: SessionStatus;
  endedAt: number | null;
}

export interface RewardEntry {
  eventId: string; // unique: one reward per session
  sessionId: string;
  delta: number;
  at: number;
}

export const DEFAULT_TAGS = ['Research', 'RF', 'Antenna', 'DSP', 'OFDM', 'Programming', 'YouTube Learning'];

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

export function startSession(mode: TimerMode, minutes: number, tag: string, link: FocusLink | null, now: number): FocusSession {
  return { id: uid(), mode, tag, link, plannedSec: mode === 'pomodoro' ? Math.round(minutes * 60) : 0, startedAt: now, activeMs: 0, runningSince: now, status: 'running', endedAt: null };
}

export function activeMs(s: FocusSession, now: number): number {
  return s.activeMs + (s.runningSince !== null ? Math.max(0, now - s.runningSince) : 0);
}

export function remainingSec(s: FocusSession, now: number): number {
  if (s.mode !== 'pomodoro') return Infinity;
  return Math.max(0, s.plannedSec - Math.floor(activeMs(s, now) / 1000));
}

export function pause(s: FocusSession, now: number): FocusSession {
  if (s.status !== 'running') return s;
  return { ...s, activeMs: activeMs(s, now), runningSince: null, status: 'paused' };
}

export function resume(s: FocusSession, now: number): FocusSession {
  if (s.status !== 'paused') return s;
  return { ...s, runningSince: now, status: 'running' };
}

export function finish(s: FocusSession, now: number, status: 'completed' | 'cancelled' = 'completed'): FocusSession {
  if (s.status === 'completed' || s.status === 'cancelled') return s;
  const ms = activeMs(s, now);
  const capped = s.mode === 'pomodoro' ? Math.min(ms, s.plannedSec * 1000) : ms;
  return { ...s, activeMs: capped, runningSince: null, status, endedAt: now };
}

/** A pomodoro that has run its full length should complete itself. */
export function isDue(s: FocusSession, now: number) {
  return s.status === 'running' && s.mode === 'pomodoro' && remainingSec(s, now) === 0;
}

/** Flowtime: suggest (never force) a break of about one fifth of the work time, 5–20 min. */
export function breakSuggestionMin(workMin: number, mode: TimerMode): number {
  if (mode === 'pomodoro') return workMin >= 45 ? 10 : 5;
  return Math.min(20, Math.max(5, Math.round(workMin / 5)));
}

/** Dew points for a finished session: 1 per 5 focused minutes, sessions under 5 min earn nothing. */
export function pointsFor(s: FocusSession): number {
  if (s.status !== 'completed') return 0;
  return Math.floor(s.activeMs / 60000 / 5);
}

/** Idempotent: a session can be rewarded only once, however many times this is called. */
export function grantReward(ledger: RewardEntry[], s: FocusSession, now: number): { ledger: RewardEntry[]; granted: number } {
  const eventId = `session:${s.id}`;
  if (ledger.some(e => e.eventId === eventId)) return { ledger, granted: 0 };
  const delta = pointsFor(s);
  if (delta <= 0) return { ledger, granted: 0 };
  return { ledger: [...ledger, { eventId, sessionId: s.id, delta, at: now }], granted: delta };
}

export function balance(ledger: RewardEntry[]) {
  return ledger.reduce((sum, e) => sum + e.delta, 0);
}

export function spend(ledger: RewardEntry[], eventId: string, cost: number, now: number): RewardEntry[] | null {
  if (ledger.some(e => e.eventId === eventId)) return ledger; // already bought: never charge twice
  if (balance(ledger) < cost) return null;
  return [...ledger, { eventId, sessionId: '', delta: -cost, at: now }];
}

const dayKey = (t: number) => {
  const d = new Date(t);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
};

export interface FocusStats {
  todayMin: number;
  week: { label: number; minutes: number }[]; // oldest → today, label = day offset (−6..0)
  byTag: { tag: string; minutes: number }[];
  sessions: number;
}

export function stats(sessions: FocusSession[], now: number): FocusStats {
  const done = sessions.filter(s => s.status === 'completed' || s.status === 'cancelled');
  const minutes = (s: FocusSession) => s.activeMs / 60000;
  const today = dayKey(now);
  const week = Array.from({ length: 7 }, (_, i) => {
    const key = dayKey(now - (6 - i) * 86400000);
    return { label: i - 6, minutes: Math.round(done.filter(s => dayKey(s.startedAt) === key).reduce((a, s) => a + minutes(s), 0)) };
  });
  const tags = new Map<string, number>();
  for (const s of done) if (now - s.startedAt < 7 * 86400000) tags.set(s.tag, (tags.get(s.tag) ?? 0) + minutes(s));
  return {
    todayMin: Math.round(done.filter(s => dayKey(s.startedAt) === today).reduce((a, s) => a + minutes(s), 0)),
    week,
    byTag: [...tags.entries()].map(([tag, m]) => ({ tag, minutes: Math.round(m) })).sort((a, b) => b.minutes - a.minutes),
    sessions: done.filter(s => dayKey(s.startedAt) === today).length,
  };
}
