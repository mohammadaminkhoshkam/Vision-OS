import { describe, expect, it } from 'vitest';
import { summarize } from './summarize';

describe('session summary', () => {
  const start = Date.parse('2026-11-04T10:00:00Z');
  const now = start + 30 * 60000;
  const a = (page: number) => ({ kind: 'paper' as const, id: 'p1', title: 'P', page, pages: 30, at: 0 });
  it('counts only what was made during the session', () => {
    const s = summarize({ activeMs: 25 * 60000, startedAt: start }, a(12), a(17), ['2026-11-04T09:59:00Z', '2026-11-04T10:05:00Z', '2026-11-04T10:20:00Z'], ['2026-11-04T10:10:00Z', 'bad'], now);
    expect(s).toMatchObject({ minutes: 25, pages: 5, highlights: 2, cards: 1 });
    expect(s.resume?.page).toBe(17);
  });
  it('does not count pages across different documents', () => {
    expect(summarize({ activeMs: 60000, startedAt: start }, a(3), { ...a(20), id: 'p2' }, [], [], now).pages).toBe(0);
  });
});
