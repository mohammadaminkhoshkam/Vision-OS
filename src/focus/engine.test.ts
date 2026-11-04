import { describe, expect, it } from 'vitest';
import { activeMs, balance, breakSuggestionMin, finish, grantReward, isDue, pause, remainingSec, resume, spend, startSession, stats } from './engine';

const MIN = 60000;

describe('focus timer', () => {
  it('counts down a pomodoro and excludes paused time', () => {
    let s = startSession('pomodoro', 25, 'RF', null, 0);
    expect(remainingSec(s, 10 * MIN)).toBe(15 * 60);
    s = pause(s, 10 * MIN);
    expect(remainingSec(s, 30 * MIN)).toBe(15 * 60); // paused for 20 min
    s = resume(s, 30 * MIN);
    expect(remainingSec(s, 35 * MIN)).toBe(10 * 60);
    expect(isDue(s, 45 * MIN)).toBe(true);
  });

  it('caps a completed pomodoro at its planned length (no overcounting after sleep)', () => {
    const s = finish(startSession('pomodoro', 25, 'RF', null, 0), 300 * MIN);
    expect(s.activeMs).toBe(25 * MIN);
  });

  it('flowtime counts up and suggests a proportional, optional break', () => {
    const s = startSession('flowtime', 0, 'DSP', null, 0);
    expect(activeMs(s, 50 * MIN)).toBe(50 * MIN);
    expect(breakSuggestionMin(50, 'flowtime')).toBe(10);
    expect(breakSuggestionMin(10, 'flowtime')).toBe(5);
    expect(breakSuggestionMin(200, 'flowtime')).toBe(20);
  });

  it('finishing twice does not change the result', () => {
    const a = finish(startSession('flowtime', 0, 'x', null, 0), 30 * MIN);
    expect(finish(a, 90 * MIN)).toBe(a);
  });
});

describe('rewards', () => {
  it('grants once per session (idempotent)', () => {
    const s = finish(startSession('pomodoro', 25, 'RF', null, 0), 25 * MIN);
    const first = grantReward([], s, 1);
    expect(first.granted).toBe(5);
    const second = grantReward(first.ledger, s, 2);
    expect(second.granted).toBe(0);
    expect(balance(second.ledger)).toBe(5);
  });

  it('gives nothing for cancelled or very short sessions', () => {
    const c = finish(startSession('pomodoro', 25, 'RF', null, 0), 20 * MIN, 'cancelled');
    expect(grantReward([], c, 1).granted).toBe(0);
    const short = finish(startSession('flowtime', 0, 'x', null, 0), 3 * MIN);
    expect(grantReward([], short, 1).granted).toBe(0);
  });

  it('spending needs enough balance and is idempotent per purchase', () => {
    const s = finish(startSession('flowtime', 0, 'x', null, 0), 50 * MIN);
    const { ledger } = grantReward([], s, 1);
    expect(spend(ledger, 'buy:rose', 20, 2)).toBeNull();
    const after = spend(ledger, 'buy:fern', 6, 2)!;
    expect(balance(after)).toBe(4);
    expect(spend(after, 'buy:fern', 6, 3)).toBe(after);
  });
});

describe('stats', () => {
  it('sums today, the week and tags', () => {
    const now = new Date(2026, 10, 4, 18).getTime();
    const day = (offset: number, h: number) => new Date(2026, 10, 4 + offset, h).getTime();
    const sessions = [
      finish(startSession('pomodoro', 25, 'RF', null, day(0, 9)), day(0, 10)),
      finish(startSession('flowtime', 0, 'DSP', null, day(0, 11)), day(0, 11) + 40 * MIN),
      finish(startSession('pomodoro', 50, 'RF', null, day(-1, 9)), day(-1, 10)),
    ];
    const st = stats(sessions, now);
    expect(st.todayMin).toBe(65);
    expect(st.week[6].minutes).toBe(65);
    expect(st.week[5].minutes).toBe(50);
    expect(st.byTag[0]).toEqual({ tag: 'RF', minutes: 75 });
  });
});
