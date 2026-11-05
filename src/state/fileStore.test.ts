import { describe, expect, it } from 'vitest';
import { evictions } from './fileStore';

const e = (id: string, size: number, at: number) => ({ id, name: id, size, at });

describe('evictions', () => {
  it('keeps the most recent files within the count budget', () => {
    expect(evictions([e('a', 1, 1), e('b', 1, 3), e('c', 1, 2)], 2, 100)).toEqual(['a']);
  });
  it('drops older files once the byte budget is spent, but keeps smaller recent ones', () => {
    expect(evictions([e('new', 60, 3), e('mid', 50, 2), e('old', 30, 1)], 10, 100).sort()).toEqual(['mid']);
  });
  it('keeps everything under budget', () => {
    expect(evictions([e('a', 10, 1), e('b', 10, 2)])).toEqual([]);
  });
});
