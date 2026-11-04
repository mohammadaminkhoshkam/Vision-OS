import { describe, expect, it } from 'vitest';
import { analyze, toCsv, type StudyEvent } from './analyze';

const log: StudyEvent[] = [
  { t: 0, type: 'start' },
  { t: 2000, type: 'screen', screen: 'library' },
  { t: 4000, type: 'screen', screen: 'home' },
  { t: 6000, type: 'screen', screen: 'library' },
  { t: 9000, type: 'doc', id: 'p1', page: 1 },
  { t: 9100, type: 'screen', screen: 'reader' },
  { t: 12000, type: 'warn', text: 'Select some text first' },
  { t: 20000, type: 'card' },
  { t: 25000, type: 'focus' },
  { t: 30000, type: 'doc', id: 'p1', page: 7 },
  { t: 31000, type: 'screen', screen: 'home' },
  { t: 40000, type: 'doc', id: 'p1', page: 7 },
  { t: 41000, type: 'stop' },
];

describe('usability analysis', () => {
  it('times each task from the end of the previous one', () => {
    const r = analyze(log);
    expect(r.map(x => [x.id, x.done, x.ms])).toEqual([
      ['open', true, 9000],
      ['clip', true, 11000],
      ['timer', true, 5000],
      ['resume', true, 15000],
    ]);
  });
  it('counts errors, navigation and back-and-forth confusion per task', () => {
    const [open, clip] = analyze(log);
    expect(open).toMatchObject({ navigations: 3, pingPongs: 1, errors: 0 });
    expect(clip).toMatchObject({ errors: 1 });
  });
  it('does not count a resume at a different place or without leaving', () => {
    const r = analyze([{ t: 0, type: 'start' }, { t: 1, type: 'doc', id: 'p1', page: 3 }, { t: 2, type: 'doc', id: 'p1', page: 3 }, { t: 3, type: 'away' }, { t: 4, type: 'doc', id: 'p1', page: 9 }]);
    expect(r.find(x => x.id === 'resume')!.done).toBe(false);
  });
  it('exports CSV rows', () => {
    const csv = toCsv('P3', 'redesign', analyze(log));
    expect(csv.split('\n')[0]).toBe('participant,build,task,done,seconds,errors,navigations,pingPongs');
    expect(csv).toContain('P3,redesign,open,true,9.0,0,3,1');
  });
});

describe('task order', () => {
  it('only counts a return after the timer task', () => {
    const r = analyze([
      { t: 0, type: 'start' },
      { t: 1000, type: 'doc', id: 'p1', page: 4 },
      { t: 2000, type: 'card' },
      { t: 3000, type: 'screen', screen: 'home' },
      { t: 4000, type: 'doc', id: 'p1', page: 4 },
      { t: 4000, type: 'focus' },
      { t: 6000, type: 'screen', screen: 'home' },
      { t: 9000, type: 'doc', id: 'p1', page: 4 },
    ]);
    expect(r.find(x => x.id === 'resume')).toMatchObject({ done: true, ms: 5000 });
  });
});
