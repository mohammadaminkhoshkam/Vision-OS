import { describe, expect, it } from 'vitest';
import { fireflies, journey, projects, STAGES, type PaperFacts } from './growth';

const p = (id: string, over: Partial<PaperFacts> = {}): PaperFacts => ({ id, collection: 'A', progress: 0, highlights: 0, clips: 0, lastTouched: 0, ...over });

describe('research journey', () => {
  it('starts as a seedbed and ignores untouched papers', () => {
    const j = journey({ papers: [p('a'), p('b')], labelledLinks: 0, focusMinutes: 0 });
    expect(j).toMatchObject({ points: 0, stage: 0, name: 'Seedbed', next: 15 });
  });
  it('grows from finished, annotated and mapped papers, links and focus', () => {
    const j = journey({ papers: [p('a', { progress: 1, highlights: 4, clips: 3 }), p('b', { highlights: 5 })], labelledLinks: 2, focusMinutes: 95 });
    // finished 10 + annotated 2×3 + mapped 2 + clips 3 + links 4 + focus 3
    expect(j.points).toBe(28);
    expect(j.name).toBe('Sprouting');
    expect(j.within).toBeCloseTo((28 - 15) / 25);
  });
  it('caps clip spam per paper and tops out at the last stage', () => {
    const spam = journey({ papers: [p('a', { clips: 500 })], labelledLinks: 0, focusMinutes: 0 });
    expect(spam.points).toBe(2 + 10);
    const big = journey({ papers: Array.from({ length: 30 }, (_, i) => p(`p${i}`, { progress: 1, highlights: 3 })), labelledLinks: 0, focusMinutes: 0 });
    expect(big.stage).toBe(STAGES.length - 1);
    expect(big.next).toBeNull();
    expect(big.within).toBe(1);
    expect(fireflies(big.stage)).toBeGreaterThan(fireflies(0));
  });
  it('remembers projects by their most recent work and what to continue', () => {
    const list = projects([p('a', { collection: 'Antennas', lastTouched: 5, progress: 1 }), p('b', { collection: 'Antennas', lastTouched: 3, progress: 0.4 }), p('c', { collection: 'ML', lastTouched: 9 })]);
    expect(list.map(x => x.name)).toEqual(['ML', 'Antennas']);
    expect(list[1]).toMatchObject({ papers: 2, resumeId: 'b', lastTouched: 5 });
  });
});
