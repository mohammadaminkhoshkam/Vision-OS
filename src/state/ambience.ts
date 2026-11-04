// Living but considerate background (ideas from Lively Wallpaper): the scene follows the real
// weather, and its motion pauses when it cannot be seen or would cost too much — the window is
// hidden, a work screen covers it, or the laptop is on a low battery.

export type WeatherMood = 'clear' | 'cloud' | 'fog' | 'rain' | 'snow' | 'storm';

export function weatherMood(code: number | null | undefined): WeatherMood {
  if (code === null || code === undefined) return 'clear';
  if (code === 0 || code === 1) return 'clear';
  if (code <= 3) return 'cloud';
  if (code <= 48) return 'fog';
  if (code <= 67 || (code >= 80 && code <= 82)) return 'rain';
  if (code <= 77 || code === 85 || code === 86) return 'snow';
  return 'storm';
}

export interface SceneInput {
  hidden: boolean;
  /** a full-screen work surface (reader, board, video) covers the garden */
  covered: boolean;
  battery: { level: number; charging: boolean } | null;
  reducedMotion: boolean;
}

export type SceneMode = 'live' | 'calm' | 'paused';

/** live: everything moves; calm: only slow light changes; paused: nothing animates. */
export function sceneMode(s: SceneInput): SceneMode {
  if (s.hidden) return 'paused';
  if (s.battery && !s.battery.charging && s.battery.level <= 0.2) return 'paused';
  if (s.covered || s.reducedMotion) return 'calm';
  if (s.battery && !s.battery.charging && s.battery.level <= 0.4) return 'calm';
  return 'live';
}
