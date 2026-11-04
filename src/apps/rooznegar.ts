// Read-only view over Rooznegar's data.json (%LOCALAPPDATA%\Rooznegar\data.json).
// Times are .NET DateTime ticks in UTC: 100 ns since 0001-01-01.

const TICKS_AT_UNIX_EPOCH = 621355968000000000;
export const ticksToMs = (ticks: number) => (ticks - TICKS_AT_UNIX_EPOCH) / 10000;

export interface RzProject { Id: string; Name: string; Color: string; Archived: boolean }
export interface RzSession { ProjectId: string; StartUtc: number; EndUtc: number }
export interface RzData {
  Projects?: RzProject[];
  Sessions?: RzSession[];
  Active?: { ProjectId: string; StartUtc: number } | null;
  Settings?: { DailyGoalMinutes?: number };
}

export interface RzSummary {
  available: boolean;
  todayMinutes: number;
  goalMinutes: number;
  weekMinutes: number;
  running: { name: string; color: string; sinceMs: number } | null;
  top: { name: string; color: string; minutes: number }[];
}

function overlapMinutes(start: number, end: number, from: number, to: number) {
  return Math.max(0, Math.min(end, to) - Math.max(start, from)) / 60000;
}

export function summarize(data: RzData | { available: false }, now = Date.now()): RzSummary {
  if (!('Projects' in data) || !data.Projects) {
    return { available: false, todayMinutes: 0, goalMinutes: 480, weekMinutes: 0, running: null, top: [] };
  }
  const d = new Date(now);
  const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const weekStart = dayStart - 6 * 86400000;
  const byProject = new Map<string, number>();
  let today = 0, week = 0;

  const sessions = [...(data.Sessions ?? [])];
  if (data.Active?.ProjectId) sessions.push({ ProjectId: data.Active.ProjectId, StartUtc: data.Active.StartUtc, EndUtc: 0 });
  for (const s of sessions) {
    const start = ticksToMs(s.StartUtc);
    const end = s.EndUtc ? ticksToMs(s.EndUtc) : now;
    const t = overlapMinutes(start, end, dayStart, now);
    today += t;
    week += overlapMinutes(start, end, weekStart, now);
    if (t > 0) byProject.set(s.ProjectId, (byProject.get(s.ProjectId) ?? 0) + t);
  }
  const proj = new Map(data.Projects.map(p => [p.Id, p]));
  const active = data.Active?.ProjectId ? proj.get(data.Active.ProjectId) : undefined;
  return {
    available: true,
    todayMinutes: Math.round(today),
    goalMinutes: data.Settings?.DailyGoalMinutes ?? 480,
    weekMinutes: Math.round(week),
    running: active && data.Active ? { name: active.Name, color: active.Color, sinceMs: ticksToMs(data.Active.StartUtc) } : null,
    top: [...byProject.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([id, minutes]) => ({ name: proj.get(id)?.Name ?? '—', color: proj.get(id)?.Color ?? '#888', minutes: Math.round(minutes) })),
  };
}
