import { describe, expect, it } from 'vitest';
import { parseCommand } from './commands';

describe('command parser', () => {
  const cases: [string, unknown][] = [
    ['Next page', { kind: 'page', dir: 1 }],
    ['next', { kind: 'page', dir: 1 }],
    ['previous page', { kind: 'page', dir: -1 }],
    ['go to page 12', { kind: 'goto-page', page: 12 }],
    ['zoom in', { kind: 'zoom', dir: 1 }],
    ['make it smaller', { kind: 'zoom', dir: -1 }],
    ['play', { kind: 'play' }],
    ['pause', { kind: 'pause' }],
    ['skip forward ten seconds', { kind: 'seek', seconds: 10 }],
    ['30 seconds back', { kind: 'seek', seconds: -30 }],
    ['open Marginal', { kind: 'launch', app: 'marginal' }],
    ['open habitwall', { kind: 'launch', app: 'habitwall' }],
    ['rooznegar', { kind: 'launch', app: 'rooznegar' }],
    ['turn vision on', { kind: 'vision', to: 'on' }],
    ['vision off', { kind: 'vision', to: 'off' }],
    ['camera off', { kind: 'vision', to: 'camera-off' }],
    ['go back to the garden', { kind: 'go', screen: 'home' }],
    ['YouTube', { kind: 'go', screen: 'cinema' }],
    ['youtube OFDM lecture', { kind: 'youtube', query: 'ofdm lecture' }],
    ['open paper RIS localization', { kind: 'open-paper', query: 'ris localization' }],
    ['focus mode', { kind: 'focus' }],
    ['bookmark this', { kind: 'bookmark' }],
    ['night mode', { kind: 'theme', to: 'night' }],
    ['timer 50 minutes', { kind: 'timer', action: 'start', minutes: 50 }],
    ['end session', { kind: 'timer', action: 'stop' }],
    ['start pomodoro', { kind: 'timer', action: 'start', minutes: undefined }],
    ['knowledge board', { kind: 'go', screen: 'board' }],
    ['rainy weather', { kind: 'preset', to: 'rainy' }],
    ['sunset', { kind: 'preset', to: 'sunset' }],
    ['explain this', { kind: 'ai', action: 'explain' }],
    ['summarize', { kind: 'ai', action: 'summarize' }],
    ['highlight', null],
    ['something unclear', null],
  ];
  for (const [input, expected] of cases) {
    it(input, () => expect(parseCommand(input)).toEqual(expected));
  }
});
