import { appData } from '../apps/data';
import { platform } from '../platform';
import { app, controls, go, openPaper, setPrefs, toast } from '../state/app';
import { vision, visionStatus } from '../vision/engine';
import { parseCommand, type Command } from './commands';
import { focus, start, stop, togglePause } from '../focus/store';

const APP_NAMES = { marginal: 'Marginal', habitwall: 'HabitWall', rooznegar: 'Rooznegar' } as const;

export function runText(text: string): boolean {
  const cmd = parseCommand(text);
  if (!cmd) {
    toast(`Command not recognized: “${text}”`, 'warn');
    return false;
  }
  run(cmd);
  return true;
}

function need(fn: (() => void) | undefined, what: string) {
  if (fn) fn();
  else toast(`${what} is not available on this screen`, 'warn');
}

export function run(cmd: Command) {
  const c = controls.current;
  switch (cmd.kind) {
    case 'go':
      return go(cmd.screen);
    case 'page':
      return need(c.page && (() => c.page!(cmd.dir)), 'Turning pages');
    case 'goto-page':
      return need(c.gotoPage && (() => c.gotoPage!(cmd.page)), 'Going to a page');
    case 'zoom':
      return need(c.zoom && (() => c.zoom!(cmd.dir)), 'Zoom');
    case 'play':
      return need(c.play, 'Play');
    case 'pause':
      return need(c.pause, 'Pause');
    case 'seek':
      return need(c.seek && (() => c.seek!(cmd.seconds)), 'Seeking');
    case 'volume':
      return need(c.volume && (() => c.volume!(cmd.dir)), 'Volume');
    case 'bookmark':
      return need(c.bookmark, 'Bookmarking');
    case 'focus':
      return app.set({ focus: !app.get().focus });
    case 'fullscreen':
      return void platform.setFullscreen(!document.fullscreenElement);
    case 'theme':
      return setPrefs({ theme: cmd.to === 'toggle' ? (app.get().theme === 'day' ? 'night' : 'day') : cmd.to });
    case 'vision':
      if (cmd.to === 'camera-off') return vision.setState('CAMERA_OFF', 'voice');
      if (cmd.to === 'off') return vision.setState(visionStatus.get().state === 'CAMERA_OFF' ? 'CAMERA_OFF' : 'STANDBY', 'voice');
      return vision.setState('ACTIVE', 'voice');
    case 'launch':
      platform
        .launch(cmd.app)
        .then(() => toast(`${APP_NAMES[cmd.app]} opened`, 'ok'))
        .catch(() => toast(`${APP_NAMES[cmd.app]} not found`, 'warn'));
      return;
    case 'open-paper': {
      const q = cmd.query.toLowerCase();
      const words = q.split(/\s+/);
      const hit = appData
        .get()
        .papers.map(p => ({ p, score: words.filter(w => p.title.toLowerCase().includes(w)).length }))
        .filter(x => x.score > 0)
        .sort((a, b) => b.score - a.score)[0];
      if (hit) return openPaper(hit.p);
      return toast(`No paper found for “${cmd.query}”`, 'warn');
    }
    case 'timer':
      if (cmd.action === 'stop') return stop('completed');
      if (cmd.action === 'pause') return togglePause();
      start('pomodoro', cmd.minutes ?? focus.get().defaultMinutes, 'Research', null);
      return toast('Focus session started', 'ok');
    case 'ai':
      return need(c.ask && (() => c.ask!(cmd.action)), 'AI (in the reader)');
    case 'preset':
      return setPrefs({ preset: cmd.to });
    case 'youtube':
      go('cinema');
      setTimeout(() => controls.current.search?.(cmd.query), 50);
      return;
  }
}
