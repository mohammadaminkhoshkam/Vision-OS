// Curved dock: nine round buttons on a thin gold arc, the garden in the centre. Kept compact so
// the scene and the work stay the subject. The active tool gets a lit rim and a label; tools that
// hold live state in this run (an open paper, a paused video, a running focus timer, cards on the
// board) show a small glowing dot, so the dock reads like a task bar of an OS rather than a menu.
// On reading/video/board screens the dock tucks away until the mouse or hand cursor nears the edge.
import { useEffect, useState } from 'react';
import { appData } from '../apps/data';
import { isTauri, platform, type AppId } from '../platform';
import { board } from '../board/store';
import { current, focus } from '../focus/store';
import { app, go, toast, type PlannerTab, type Screen } from '../state/app';
import { workspace } from '../state/workspace';
import { Icon, type IconName } from '../ui/icons';
import { useVisionHandler } from '../vision/router';

type Item = { id: string; icon: IconName; label: string; screen?: Screen; tab?: PlannerTab; run?: () => void };

const T = [0.06, 0.175, 0.29, 0.405, 0.5, 0.595, 0.71, 0.825, 0.94];
const SAG = 30;

/** Screen transitions grow out of the button that started them. */
export function setEnterOrigin(el: Element) {
  const r = el.getBoundingClientRect();
  const stage = document.querySelector('.stage')?.getBoundingClientRect();
  const x = r.left + r.width / 2 - (stage?.left ?? 0), y = r.top + r.height / 2 - (stage?.top ?? 0);
  document.documentElement.style.setProperty('--enter-origin', `${Math.round(x)}px ${Math.round(y)}px`);
}

function useWidth() {
  const [w, setW] = useState(innerWidth);
  useEffect(() => {
    const on = () => setW(innerWidth);
    addEventListener('resize', on);
    return () => removeEventListener('resize', on);
  }, []);
  return w;
}

function AppsPopover({ onClose }: { onClose: () => void }) {
  const apps = appData.use(s => s.apps);
  const launch = async (id: AppId, name: string) => {
    onClose();
    try {
      await platform.launch(id);
      toast(`${name} opened`, 'ok');
    } catch {
      toast(`${name} not found`, 'warn');
    }
  };
  const tiles: [AppId, string, IconName][] = [
    ['marginal', 'Marginal', 'file'],
    ['habitwall', 'HabitWall', 'leaf'],
    ['rooznegar', 'Rooznegar', 'clock'],
  ];
  return (
    <div className="apps-pop">
      {tiles.map(([id, name, icon]) => (
        <button key={id} className={`tile ${apps[id] ? '' : 'off'}`} onClick={() => launch(id, name)} title={apps[id] ? name : 'Installation not found'}>
          <Icon name={icon} size={26} />
          <span>{name}</span>
        </button>
      ))}
      <button className="tile" onClick={() => (onClose(), go('calibrate'))}>
        <Icon name="hand" size={26} />
        <span>Gestures</span>
      </button>
      {isTauri && (
        <button className="tile" onClick={() => platform.exit()}>
          <Icon name="power" size={26} />
          <span>Quit</span>
        </button>
      )}
    </div>
  );
}

export function BranchDock() {
  const screen = app.use(s => s.screen);
  const tab = app.use(s => s.plannerTab);
  const vw = useWidth();
  const [peek, setPeek] = useState(false);
  const [hover, setHover] = useState<string | null>(null);
  const [appsOpen, setAppsOpen] = useState(false);
  const compact = screen === 'reader' || screen === 'cinema' || screen === 'board';
  const open = !compact || peek || appsOpen;

  const W = Math.min(760, vw - 340);
  const H = 136;
  const base = 82;
  // quadratic arc through the button row; highest in the middle
  const P = (t: number) => ({ x: W * t, y: base - 4 * (1 - t) * t * SAG });

  const docOpen = app.use(s => !!s.doc);
  const live = workspace.use(s => s.live);
  const cards = board.use(s => s.doc.nodes.length);
  focus.use(s => s.sessions);
  const timer = current();
  /** what each tool is holding right now (tooltip detail + dot) */
  const state: Record<string, string | undefined> = {
    reader: docOpen ? live.reader ?? 'Document open' : undefined,
    cinema: live.cinema,
    board: cards ? `${cards} card${cards === 1 ? '' : 's'}` : undefined,
    focus: timer ? (timer.status === 'paused' ? 'Paused' : 'Running') : undefined,
  };

  const items: Item[] = [
    { id: 'schedule', icon: 'calendar', label: 'Planner', screen: 'planner', tab: 'schedule' },
    { id: 'tasks', icon: 'tasks', label: 'Tasks', screen: 'planner', tab: 'tasks' },
    { id: 'focus', icon: 'timer', label: 'Focus', screen: 'focus' },
    { id: 'reader', icon: 'book', label: 'Reader', screen: 'reader' },
    { id: 'home', icon: 'garden', label: 'Garden', screen: 'home' },
    { id: 'cinema', icon: 'monitor', label: 'Video', screen: 'cinema' },
    { id: 'board', icon: 'network', label: 'Knowledge board', screen: 'board' },
    { id: 'library', icon: 'folder', label: 'Library', screen: 'library' },
    { id: 'apps', icon: 'apps', label: 'Apps', run: () => setAppsOpen(v => !v) },
  ];
  const isActive = (it: Item) => (it.id === 'apps' ? appsOpen : it.screen === screen && (!it.tab || it.tab === tab));

  useVisionHandler(
    (e, px) => {
      if (e.type === 'POINTER_MOVE' && px && compact) setPeek(px.y > innerHeight - (peek ? H + 40 : 70));
      return false;
    },
    [compact, peek],
  );

  // the arc continues past the outer buttons and fades out
  const ext = 170;
  // endpoints below the button row, control point chosen so the arc passes through the centre button
  const arc = `M${-ext},${base + 34} Q${W / 2},${base - 2 * SAG - 34} ${W + ext},${base + 34}`;
  const nav = (
    <nav
      className={`branch-dock arc-dock ${open ? 'open' : 'tucked'} ${compact ? 'compact' : ''}`}
      style={{ width: W, height: H }}
      onMouseEnter={() => setPeek(true)}
      onMouseLeave={() => {
        setPeek(false);
        setHover(null);
      }}
    >
      <svg className="branch" viewBox={`${-ext} 0 ${W + 2 * ext} ${H}`} width={W + 2 * ext} height={H} style={{ left: -ext }} aria-hidden>
        <defs>
          <linearGradient id="arcGold" x1="0" x2="1">
            <stop offset="0" stopColor="#d5a64f" stopOpacity="0" />
            <stop offset="0.16" stopColor="#d5a64f" stopOpacity="0.8" />
            <stop offset="0.5" stopColor="#f1cd84" stopOpacity="1" />
            <stop offset="0.84" stopColor="#d5a64f" stopOpacity="0.8" />
            <stop offset="1" stopColor="#d5a64f" stopOpacity="0" />
          </linearGradient>
          <filter id="arcGlow" x="-10%" y="-300%" width="120%" height="700%">
            <feGaussianBlur stdDeviation="3.5" />
          </filter>
        </defs>
        <path d={arc} stroke="url(#arcGold)" strokeWidth="7" fill="none" filter="url(#arcGlow)" opacity="0.6" />
        <path d={arc} stroke="url(#arcGold)" strokeWidth="1.8" fill="none" />
      </svg>
      {items.map((it, i) => {
        const p = P(T[i]);
        const center = it.id === 'home';
        const active = isActive(it);
        const size = center ? 78 : 52;
        const detail = state[it.id];
        return (
          <div key={it.id} className="pod-slot" style={{ left: p.x, top: p.y, ['--r' as string]: `${size / 2}px` }}>
            {center && <span className="pod-halo" />}
            <button
              className={`pod ${active ? 'on' : ''} ${center ? 'center' : ''} ${detail ? 'has-live' : ''}`}
              style={{ width: size, height: size }}
              aria-current={active && it.id !== 'apps' ? 'page' : undefined}
              onClick={e => {
                if (it.run) return it.run();
                setEnterOrigin(e.currentTarget);
                if (it.tab) app.set({ plannerTab: it.tab });
                go(it.screen!);
                setAppsOpen(false);
              }}
              onMouseEnter={() => setHover(it.id)}
              onFocus={() => setHover(it.id)}
              aria-label={detail ? `${it.label}: ${detail}` : it.label}
            >
              <Icon name={it.icon} size={center ? 34 : 21} stroke={center ? 1.6 : 1.8} />
            </button>
            {detail && <span className={`pod-live ${it.id === 'focus' && timer?.status === 'running' ? 'pulse-live' : ''}`} aria-hidden />}
            <span className={`pod-label ${active && it.id !== 'apps' ? 'on' : ''} ${hover === it.id ? 'show' : ''} ${center ? 'center' : ''}`}>
              {it.label}
              {detail && hover === it.id && <small dir="auto">{detail.length > 34 ? detail.slice(0, 33) + '…' : detail}</small>}
            </span>
            {it.id === 'apps' && appsOpen && <AppsPopover onClose={() => setAppsOpen(false)} />}
          </div>
        );
      })}
    </nav>
  );
  return (
    <>
      {nav}
      {compact && !open && (
        <button className="branch-handle" onMouseEnter={() => setPeek(true)} onClick={() => setPeek(true)} aria-label="Show the dock">
          <Icon name="garden" size={18} />
        </button>
      )}
    </>
  );
}

export function FullscreenPod() {
  return (
    <button className="pod corner-pod" onClick={() => platform.setFullscreen(!document.fullscreenElement)} title="Fullscreen (F11)">
      <Icon name="expand" size={20} />
    </button>
  );
}

export function SettingsPod() {
  const on = app.use(s => s.screen === 'settings');
  return (
    <button className={`pod corner-pod left ${on ? 'on' : ''}`} onClick={() => go('settings')} title="Settings">
      <Icon name="settings" size={22} />
    </button>
  );
}
