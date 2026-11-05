import { describe, expect, it } from 'vitest';
import { daypart, describeActivity, formatClock, nextAction, relativeTime, upsertRecent, type Activity } from './workspace';

const at = (h: number, m = 0) => new Date(2026, 10, 4, h, m);
const paper = (over: Partial<Activity> = {}): Activity => ({ kind: 'paper', id: 'p1', title: 'Beam Steering', page: 12, pages: 30, at: at(9).getTime(), ...over });

describe('daypart', () => {
  it('splits the day into four moods', () => {
    expect([4, 6, 12, 18, 22].map(daypart)).toEqual(['night', 'dawn', 'day', 'dusk', 'night']);
  });
});

describe('upsertRecent', () => {
  it('moves a re-touched item to the front without duplicating it', () => {
    const a = paper(), b = paper({ id: 'p2' });
    const list = upsertRecent(upsertRecent([], a), b);
    expect(upsertRecent(list, { ...a, page: 13 }).map(x => [x.id, x.page])).toEqual([['p1', 13], ['p2', 12]]);
  });
  it('keeps papers and videos with the same id apart and caps the list', () => {
    const list = upsertRecent([paper()], { kind: 'video', id: 'p1', title: 'v', at: 0 });
    expect(list).toHaveLength(2);
    let big: Activity[] = [];
    for (let i = 0; i < 20; i++) big = upsertRecent(big, paper({ id: `p${i}` }), 5);
    expect(big.map(x => x.id)).toEqual(['p19', 'p18', 'p17', 'p16', 'p15']);
  });
});

describe('nextAction', () => {
  const none = { focus: null, tasks: [], last: null };
  it('prefers a running focus session', () => {
    const r = nextAction({ ...none, last: paper(), focus: { title: 'Deep work', remainingSec: 610 }, now: at(10) });
    expect(r.kind).toBe('focus');
    expect(r.detail).toContain('11 min left');
  });
  it('surfaces a timed item that starts within half an hour before resuming', () => {
    const r = nextAction({ ...none, last: paper(), tasks: [{ title: 'Lab meeting', time: '10:20', done: false }], now: at(10) });
    expect(r).toMatchObject({ kind: 'task', title: 'Lab meeting' });
  });
  it('resumes the last activity when nothing is imminent', () => {
    const r = nextAction({ ...none, last: paper(), tasks: [{ title: 'Later', time: '15:00', done: false }], now: at(10) });
    expect(r).toMatchObject({ kind: 'resume', title: 'Beam Steering', detail: 'Page 12 of 30' });
  });
  it('ignores stale activity and past or finished items', () => {
    const old = paper({ at: at(10).getTime() - 30 * 24 * 3600 * 1000 });
    const r = nextAction({ ...none, last: old, tasks: [{ title: 'Past', time: '08:00', done: false }, { title: 'Done', time: '12:00', done: true }, { title: 'Gym', time: '18:00', done: false }], now: at(10) });
    expect(r).toMatchObject({ kind: 'task', title: 'Gym' });
    expect(nextAction({ ...none, now: at(10) }).kind).toBe('start');
  });
});

describe('formatting', () => {
  it('describes activities and times', () => {
    expect(describeActivity({ kind: 'video', id: 'v', title: 'x', t: 3725, at: 0 })).toBe('Video · 1:02:05');
    expect(describeActivity(paper({ kind: 'file', pages: undefined }))).toBe('Page 12 · local PDF');
    expect(formatClock(65)).toBe('1:05');
    expect(relativeTime(0, 30_000)).toBe('just now');
    expect(relativeTime(0, 3 * 3600_000)).toBe('3 h ago');
    expect(relativeTime(0, 26 * 3600_000)).toBe('yesterday');
  });
});
