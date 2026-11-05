import { describe, expect, it } from 'vitest';
import { baseMood, blinkDelay, fidgetDelay, greeting, idleFidget, SLEEP_AFTER_MS, walkTarget } from './companionBrain';

const mem = { pets: 0, lastSeen: 0, celebrations: 0 };

describe('companion behaviour', () => {
  it('mirrors what the user is doing, focus first', () => {
    const now = 10_000_000;
    expect(baseMood({ now, lastInputAt: now, focusing: true, breakDue: true })).toBe('rest');
    expect(baseMood({ now, lastInputAt: now - SLEEP_AFTER_MS - 1, focusing: false, breakDue: true })).toBe('sleep');
    expect(baseMood({ now, lastInputAt: now, focusing: false, breakDue: true })).toBe('stretch');
    expect(baseMood({ now, lastInputAt: now, focusing: false, breakDue: false })).toBe('idle');
  });
  it('greets on first meeting and after a long absence only', () => {
    const now = 100 * 3600 * 1000;
    expect(greeting(mem, now)).toBe('hop');
    expect(greeting({ ...mem, lastSeen: now - 3600 * 1000 }, now)).toBeNull();
    expect(greeting({ ...mem, lastSeen: now - 12 * 3600 * 1000 }, now)).toBe('hop');
  });
  it('fidgets sometimes, more when it has been petted a lot', () => {
    expect(idleFidget(0.1, mem)).toBe('walk');
    expect(idleFidget(0.5, mem)).toBe('peck');
    expect(idleFidget(0.7, mem)).toBeNull();
    expect(idleFidget(0.7, { ...mem, pets: 40 })).toBe('peck');
  });
  it('keeps timings and walks within bounds', () => {
    expect(fidgetDelay(0)).toBe(14000);
    expect(blinkDelay(1)).toBe(6000);
    for (const x of [-46, -10, 0, 10, 46]) for (const r of [0, 0.3, 0.7, 0.99]) expect(Math.abs(walkTarget(x, r))).toBeLessThanOrEqual(46);
    expect(walkTarget(40, 0.9)).toBeLessThan(40);
    expect(walkTarget(-40, 0.1)).toBeGreaterThan(-40);
  });
});
