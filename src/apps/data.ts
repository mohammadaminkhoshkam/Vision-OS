// Shared, periodically refreshed view of the user's own apps' data.
import { createStore } from '../lib/store';
import { platform, type AppId, type CheckinRow, type HabitRow, type MarginalPaper } from '../platform';
import { summarize, type RzData, type RzSummary } from './rooznegar';

export interface HabitToday {
  id: string;
  title: string;
  color: string;
  icon: string | null;
  done: boolean;
  value: number;
  target: number;
  unit: string | null;
}

export const appData = createStore({
  papers: [] as MarginalPaper[],
  marginal: false,
  habits: [] as HabitToday[],
  habitwall: false,
  rooz: null as RzSummary | null,
  apps: { marginal: null, habitwall: null, rooznegar: null } as Record<AppId, string | null>,
  loaded: false,
});

/** HabitWall's day starts at 04:00 by default, so 01:30 still belongs to "yesterday". */
export function habitDay(now = new Date(), dayStartMinutes = 240) {
  const d = new Date(now.getTime() - dayStartMinutes * 60000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function habitsToday(habits: HabitRow[], checkins: CheckinRow[], day = habitDay()): HabitToday[] {
  const byHabit = new Map(checkins.filter(c => c.day === day).map(c => [c.habit_id, c]));
  return habits
    .filter(h => !h.archived_at)
    .map(h => {
      const c = byHabit.get(h.id);
      const value = c?.value ?? 0;
      return {
        id: h.id,
        title: h.title,
        color: h.color,
        icon: h.icon,
        value,
        target: h.target_value,
        unit: h.unit,
        done: c?.status === 'done' || (h.kind === 'count' && value >= h.target_value),
      };
    });
}

export async function refreshAppData() {
  const [m, h, r, a] = await Promise.allSettled([platform.marginalPapers(), platform.habitwall(), platform.rooznegarRaw(), platform.apps()]);
  appData.set({
    loaded: true,
    ...(m.status === 'fulfilled' && {
      marginal: m.value.available,
      papers: [...m.value.papers].sort((x, y) => (y.opened || y.added).localeCompare(x.opened || x.added)),
    }),
    ...(h.status === 'fulfilled' && { habitwall: h.value.available, habits: habitsToday(h.value.habits, h.value.checkins) }),
    ...(r.status === 'fulfilled' && { rooz: summarize(r.value as RzData) }),
    ...(a.status === 'fulfilled' && { apps: a.value }),
  });
}
