// The companion's behaviour, kept pure so it can be tested (idea from MewoOS's cat: it wanders,
// blinks, sleeps and reacts to a click). Everything it does is driven by what the user is
// actually doing, and it never speaks or interrupts.

export type Mood =
  | 'idle' // looks at the cursor, bobs gently
  | 'rest' // a focus session is running: settles down, eyes closed
  | 'sleep' // nobody has touched the computer for a while
  | 'stretch' // a break is due: stretches its wings as a quiet hint
  | 'hop' // greeting / hand control turned on / welcome back
  | 'flap' // a focus session was completed
  | 'pet' // the user clicked it
  | 'walk' // a few steps along the branch
  | 'peck'; // idle fidget

export interface Memory {
  /** how often it was petted, ever */
  pets: number;
  /** last time the app was open with the companion visible */
  lastSeen: number;
  /** total focus sessions it has seen completed */
  celebrations: number;
}

export const SLEEP_AFTER_MS = 3 * 60 * 1000;

export interface Situation {
  now: number;
  lastInputAt: number;
  focusing: boolean;
  breakDue: boolean;
}

/** The resting state for the situation; transient moods (hop, flap, pet, walk, peck) play on top. */
export function baseMood(s: Situation): Mood {
  if (s.focusing) return 'rest';
  if (s.now - s.lastInputAt > SLEEP_AFTER_MS) return 'sleep';
  if (s.breakDue) return 'stretch';
  return 'idle';
}

/** Greeting when the app opens: a long absence earns an excited hop. */
export function greeting(mem: Memory, now: number): Mood | null {
  if (!mem.lastSeen) return 'hop';
  return now - mem.lastSeen > 8 * 3600 * 1000 ? 'hop' : null;
}

/** An idle fidget, chosen with a random number in [0, 1). A well-loved bird is livelier. */
export function idleFidget(r: number, mem: Memory): Mood | null {
  const lively = Math.min(0.25, mem.pets * 0.01);
  if (r < 0.35 + lively) return 'walk';
  if (r < 0.6 + lively) return 'peck';
  return null;
}

/** Milliseconds until the next fidget: 14–32 s. */
export const fidgetDelay = (r: number) => 14000 + Math.round(r * 18000);

/** Next blink in 2.5–6 s. */
export const blinkDelay = (r: number) => 2500 + Math.round(r * 3500);

/** A walk moves a few steps but stays on its stretch of branch. */
export function walkTarget(x: number, r: number, range = 46) {
  const step = 14 + r * 22;
  const dir = x > range / 2 ? -1 : x < -range / 2 ? 1 : r < 0.5 ? -1 : 1;
  return Math.max(-range, Math.min(range, Math.round(x + dir * step)));
}

export const TRANSIENT_MS: Partial<Record<Mood, number>> = { hop: 1100, flap: 1400, pet: 1300, walk: 1600, peck: 900 };
