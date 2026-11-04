import { describe, expect, it } from 'vitest';
import { summarize, ticksToMs } from './rooznegar';

const msToTicks = (ms: number) => ms * 10000 + 621355968000000000;

describe('rooznegar summary', () => {
  it('converts .NET ticks', () => {
    expect(ticksToMs(621355968000000000)).toBe(0);
    expect(new Date(ticksToMs(msToTicks(Date.UTC(2026, 10, 3)))).toISOString()).toBe('2026-11-03T00:00:00.000Z');
  });

  it('sums today, splits at midnight and includes the running timer', () => {
    const now = new Date(2026, 10, 3, 12, 0).getTime();
    const s = summarize(
      {
        Projects: [{ Id: 'a', Name: 'DSP', Color: '#0F766E', Archived: false }, { Id: 'b', Name: 'Radar', Color: '#D99A21', Archived: false }],
        Sessions: [
          { ProjectId: 'a', StartUtc: msToTicks(new Date(2026, 10, 2, 23, 0).getTime()), EndUtc: msToTicks(new Date(2026, 10, 3, 1, 0).getTime()) },
          { ProjectId: 'a', StartUtc: msToTicks(new Date(2026, 10, 3, 9, 0).getTime()), EndUtc: msToTicks(new Date(2026, 10, 3, 10, 0).getTime()) },
        ],
        Active: { ProjectId: 'b', StartUtc: msToTicks(new Date(2026, 10, 3, 11, 30).getTime()) },
        Settings: { DailyGoalMinutes: 300 },
      },
      now,
    );
    expect(s.todayMinutes).toBe(60 + 60 + 30);
    expect(s.running?.name).toBe('Radar');
    expect(s.top[0]).toMatchObject({ name: 'DSP', minutes: 120 });
    expect(s.goalMinutes).toBe(300);
  });

  it('handles missing data', () => {
    expect(summarize({ available: false }).available).toBe(false);
  });
});
