import { describe, expect, it } from 'vitest';
import { sceneMode, weatherMood } from './ambience';

describe('considerate scene', () => {
  const base = { hidden: false, covered: false, battery: null, reducedMotion: false };
  it('pauses when hidden or on a nearly empty battery, calms under work screens', () => {
    expect(sceneMode(base)).toBe('live');
    expect(sceneMode({ ...base, hidden: true })).toBe('paused');
    expect(sceneMode({ ...base, battery: { level: 0.15, charging: false } })).toBe('paused');
    expect(sceneMode({ ...base, battery: { level: 0.15, charging: true } })).toBe('live');
    expect(sceneMode({ ...base, battery: { level: 0.35, charging: false } })).toBe('calm');
    expect(sceneMode({ ...base, covered: true })).toBe('calm');
  });
  it('maps weather codes to moods', () => {
    expect([0, 2, 45, 61, 71, 95, undefined].map(weatherMood)).toEqual(['clear', 'cloud', 'fog', 'rain', 'snow', 'storm', 'clear']);
  });
});
