import { describe, expect, it } from 'vitest';
import { BlinkDetector, distance, enroll, KEY_POINTS, score, template, type P3 } from './face';

function rand(seed: number) {
  return () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
}

/** A synthetic face: fixed geometry per "person", with jitter, scale, shift and roll applied. */
function face(person: number, opts: { jitter?: number; scale?: number; dx?: number; roll?: number; seed?: number } = {}): P3[] {
  const base = rand(person * 7919 + 1);
  const noise = rand(opts.seed ?? 99);
  const lm: P3[] = Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.5, z: 0 }));
  const s = opts.scale ?? 1, roll = opts.roll ?? 0, j = opts.jitter ?? 0.002;
  for (const i of KEY_POINTS) {
    const x = (base() - 0.5) * 0.3, y = (base() - 0.5) * 0.4, z = (base() - 0.5) * 0.05;
    const rx = x * Math.cos(roll) - y * Math.sin(roll), ry = x * Math.sin(roll) + y * Math.cos(roll);
    lm[i] = { x: 0.5 + (opts.dx ?? 0) + rx * s + (noise() - 0.5) * j, y: 0.5 + ry * s + (noise() - 0.5) * j, z: z * s };
  }
  return lm;
}

describe('face template', () => {
  it('is invariant to position, distance and in-plane rotation', () => {
    const a = template(face(1, { jitter: 0 }), 1);
    const b = template(face(1, { jitter: 0, scale: 1.4, dx: 0.1, roll: 0.2 }), 1);
    expect(distance(a, b)).toBeLessThan(1e-6);
  });

  it('accepts the enrolled person and rejects someone else', () => {
    const samples = Array.from({ length: 24 }, (_, i) => template(face(1, { seed: i + 1, scale: 0.9 + (i % 5) * 0.05 }), 1));
    const e = enroll(samples);
    const me = template(face(1, { seed: 500, roll: 0.1 }), 1);
    const other = template(face(2, { seed: 501 }), 1);
    expect(score(e, me)).toBeLessThan(e.threshold);
    expect(score(e, other)).toBeGreaterThan(e.threshold);
  });

  it('requires enough samples', () => {
    expect(() => enroll([template(face(1), 1)])).toThrow();
  });
});

describe('blink', () => {
  it('detects a closed-then-open blink, not a long close', () => {
    const b = new BlinkDetector();
    b.update(0.1, 0.1, 0);
    b.update(0.8, 0.7, 100);
    expect(b.update(0.1, 0.1, 300)).toBe(true);
    const slow = new BlinkDetector();
    slow.update(0.9, 0.9, 0);
    expect(slow.update(0.1, 0.1, 2000)).toBe(false);
  });
});
