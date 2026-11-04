// Offline command interpreter for spoken or typed English commands.
// The same parser serves voice, the command bar (Ctrl+K) and tests, so nothing depends on a
// particular speech engine.

export type Command =
  | { kind: 'go'; screen: 'home' | 'reader' | 'cinema' | 'calibrate' | 'settings' | 'focus' | 'board' }
  | { kind: 'timer'; action: 'start' | 'stop' | 'pause'; minutes?: number }
  | { kind: 'preset'; to: 'photo' | 'morning' | 'rainy' | 'sunset' | 'night' }
  | { kind: 'ai'; action: 'explain' | 'simplify' | 'summarize' | 'expand' }
  | { kind: 'page'; dir: 1 | -1 }
  | { kind: 'goto-page'; page: number }
  | { kind: 'zoom'; dir: 1 | -1 }
  | { kind: 'play' }
  | { kind: 'pause' }
  | { kind: 'seek'; seconds: number }
  | { kind: 'volume'; dir: 1 | -1 }
  | { kind: 'launch'; app: 'marginal' | 'habitwall' | 'rooznegar' }
  | { kind: 'vision'; to: 'on' | 'off' | 'camera-off' }
  | { kind: 'focus' }
  | { kind: 'fullscreen' }
  | { kind: 'bookmark' }
  | { kind: 'theme'; to: 'day' | 'night' | 'toggle' }
  | { kind: 'open-paper'; query: string }
  | { kind: 'youtube'; query: string };

export function normalize(input: string): string {
  return input
    .toLowerCase()
    .replace(/[.,!?;:]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const WORD_NUMBERS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  fifteen: 15, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60,
};

function number(s: string): number | null {
  const m = s.match(/\d+/);
  if (m) return Number(m[0]);
  for (const [w, n] of Object.entries(WORD_NUMBERS)) if (new RegExp(`(^|\\s)${w}(\\s|$)`).test(s)) return n;
  return null;
}

// Each keyword must start at a word boundary ("light" does not match "highlight"),
// but may be a prefix ("calibrat" matches "calibrate" and "calibration").
const has = (s: string, ...words: string[]) => words.some(w => (' ' + s).includes(' ' + w));

export function parseCommand(raw: string): Command | null {
  const s = normalize(raw);
  if (!s) return null;

  // apps
  if (has(s, 'marginal')) return { kind: 'launch', app: 'marginal' };
  if (has(s, 'habit')) return { kind: 'launch', app: 'habitwall' };
  if (has(s, 'rooznegar', 'project timer')) return { kind: 'launch', app: 'rooznegar' };

  // vision control
  if (has(s, 'camera off', 'turn off the camera', 'turn the camera off')) return { kind: 'vision', to: 'camera-off' };
  if (has(s, 'vision', 'hand control', 'camera')) {
    if (has(s, 'off', 'stop', 'disable')) return { kind: 'vision', to: 'off' };
    return { kind: 'vision', to: 'on' };
  }
  if (has(s, 'calibrat')) return { kind: 'go', screen: 'calibrate' };

  // local AI on the current selection / page
  if (has(s, 'explain')) return { kind: 'ai', action: 'explain' };
  if (has(s, 'simplify', 'make it simple')) return { kind: 'ai', action: 'simplify' };
  if (has(s, 'summarize', 'summary', 'summarise')) return { kind: 'ai', action: 'summarize' };
  if (has(s, 'expand', 'elaborate')) return { kind: 'ai', action: 'expand' };

  // focus timer: "timer 25 minutes", "end session", "start pomodoro"
  if (has(s, 'pomodoro', 'timer', 'focus session', 'session')) {
    if (has(s, 'stop', 'end', 'finish')) return { kind: 'timer', action: 'stop' };
    if (has(s, 'pause')) return { kind: 'timer', action: 'pause' };
    const m = s.match(/\d+/);
    return { kind: 'timer', action: 'start', minutes: m ? Number(m[0]) : undefined };
  }
  if (has(s, 'focus studio')) return { kind: 'go', screen: 'focus' };
  if (has(s, 'board', 'canvas')) return { kind: 'go', screen: 'board' };
  if (has(s, 'rain')) return { kind: 'preset', to: 'rainy' };
  if (has(s, 'sunset')) return { kind: 'preset', to: 'sunset' };
  if (has(s, 'morning')) return { kind: 'preset', to: 'morning' };

  // youtube search / open: "youtube ofdm lecture"
  const yt = s.match(/^(?:youtube|video)\s+(.{2,})$/);
  if (yt && !has(yt[1], 'open', 'go')) return { kind: 'youtube', query: yt[1] };

  // open a paper by title: "open paper ris localization", "paper ofdm open"
  const paper = s.match(/(?:paper|article)\s+(.+?)(?:\s+open)?$/);
  if (paper && paper[1] && !/^(?:open|next|previous)/.test(paper[1])) {
    const q = paper[1].replace(/^open\s+/, '').trim();
    if (q.length >= 2) return { kind: 'open-paper', query: q };
  }

  // navigation between screens
  if (has(s, 'home', 'garden')) return { kind: 'go', screen: 'home' };
  if (has(s, 'youtube', 'cinema', 'video')) return { kind: 'go', screen: 'cinema' };
  if (has(s, 'settings', 'preferences')) return { kind: 'go', screen: 'settings' };

  if (has(s, 'bookmark', 'mark this')) return { kind: 'bookmark' };

  // pages
  const goto = s.match(/page\s+(\d+)/);
  if (goto && !has(s, 'next', 'prev')) return { kind: 'goto-page', page: Number(goto[1]) };
  if (has(s, 'next page', 'next')) return { kind: 'page', dir: 1 };
  if (has(s, 'previous', 'prev', 'back page', 'page back')) return { kind: 'page', dir: -1 };
  if (has(s, 'pdf', 'read', 'book')) return { kind: 'go', screen: 'reader' };

  // zoom
  if (has(s, 'zoom in', 'bigger', 'larger')) return { kind: 'zoom', dir: 1 };
  if (has(s, 'zoom out', 'smaller')) return { kind: 'zoom', dir: -1 };

  // media
  const n = number(s);
  if (has(s, 'forward', 'skip', 'ahead')) return { kind: 'seek', seconds: n ?? 10 };
  if (has(s, 'rewind', 'backward', 'back')) return { kind: 'seek', seconds: -(n ?? 10) };
  if (has(s, 'volume', 'louder', 'quieter')) return { kind: 'volume', dir: has(s, 'down', 'lower', 'quieter') ? -1 : 1 };
  if (has(s, 'pause', 'stop', 'hold')) return { kind: 'pause' };
  if (has(s, 'play', 'resume', 'continue')) return { kind: 'play' };

  // misc
  if (has(s, 'focus')) return { kind: 'focus' };
  if (has(s, 'fullscreen', 'full screen')) return { kind: 'fullscreen' };
  if (has(s, 'night', 'dark')) return { kind: 'theme', to: 'night' };
  if (has(s, 'day', 'light')) return { kind: 'theme', to: 'day' };

  return null;
}
