import { useEffect, useState } from 'react';
import { lock, lockNow } from './lock/lock';
import { current, focus } from './focus/store';
import { LockScreen } from './lock/LockScreen';
import { refreshAppData } from './apps/data';
import { Cinema } from './cinema/Cinema';
import { GardenLayers } from './garden/GardenLayers';
import { GardenScene } from './garden/GardenScene';
import { Home } from './home/Home';
import { platform } from './platform';
import { Reader } from './reader/Reader';
import { BranchDock, FullscreenPod, SettingsPod } from './shell/BranchDock';
import { TitleBar } from './shell/TitleBar';
import { Library } from './screens/Library';
import { Planner } from './screens/Planner';
import { Settings, Toasts } from './shell/Shell';
import { Launcher } from './shell/Launcher';
import { AiPanel } from './ai/AiPanel';
import { Companion } from './shell/Companion';
import { Board } from './board/Board';
import { FocusOverlay, FocusStudio } from './focus/FocusUI';
import { cancelPlacing, garden } from './garden/gardenState';
import { app, go, setPrefs } from './state/app';
import { daypart } from './state/workspace';
import { Calibration } from './vision/Calibration';
import { vision, visionStatus } from './vision/engine';
import { setGlobalRadialItems } from './vision/router';
import { HandCursor, RadialMenu, VisionHUD } from './vision/VisionUI';
import { runText } from './voice/run';
import { listen, voiceState } from './voice/voice';

setGlobalRadialItems([
  { id: 'home', label: 'Garden', icon: 'garden', run: () => go('home') },
  { id: 'reader', label: 'Read', icon: 'book', run: () => go('reader') },
  { id: 'cinema', label: 'YouTube', icon: 'youtube', run: () => go('cinema') },
  { id: 'board', label: 'Knowledge board', icon: 'board', run: () => go('board') },
  { id: 'timer', label: 'Timer', icon: 'timer', run: () => focus.set(s => ({ overlayHidden: !s.overlayHidden })) },
]);

export function App() {
  const locked = lock.use(s => s.locked);
  return locked ? <LockScreen /> : <Desktop />;
}

function Desktop() {
  const screen = app.use(s => s.screen);
  const theme = app.use(s => s.theme);
  const focusMode = app.use(s => s.focus);
  const preset = app.use(s => s.preset);
  const gardenEditing = garden.use(s => s.editing);
  const photoScene = preset === 'photo' && !gardenEditing;
  const reduced = app.use(s => s.reducedMotion);
  const wallpaperPref = app.use(s => s.wallpaper);
  const [winWall, setWinWall] = useState<string | null>(null);
  useEffect(() => {
    if (wallpaperPref === 'windows') void platform.windowsWallpaper().then(setWinWall);
  }, [wallpaperPref]);
  const wallpaper = wallpaperPref === 'windows' ? winWall : wallpaperPref;

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.dataset.preset = preset;
    document.documentElement.dataset.motion = reduced ? 'reduced' : 'full';
  }, [theme, reduced, preset]);

  // Reactive environment: the scene follows the time of day, quiets down while a focus session
  // runs, and blooms briefly when one is completed. CSS reads these attributes (redesign.css).
  focus.use(s => s.sessions);
  const focusing = current()?.status === 'running';
  const reward = focus.use(s => s.lastReward);
  useEffect(() => {
    const set = () => (document.documentElement.dataset.daypart = daypart(new Date().getHours()));
    set();
    const t = setInterval(set, 60000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    document.documentElement.dataset.activity = focusing ? 'focus' : screen === 'reader' || screen === 'board' || screen === 'cinema' ? 'work' : 'idle';
  }, [focusing, screen]);
  useEffect(() => {
    if (!reward) return;
    document.documentElement.dataset.bloom = '1';
    const t = setTimeout(() => delete document.documentElement.dataset.bloom, 2600);
    return () => clearTimeout(t);
  }, [reward]);
  // a screen grows out of the dock button that opened it; other navigation uses the default
  useEffect(() => {
    const t = setTimeout(() => document.documentElement.style.removeProperty('--enter-origin'), 450);
    return () => clearTimeout(t);
  }, [screen]);

  useEffect(() => {
    void refreshAppData();
    const t = setInterval(() => void refreshAppData(), 60000);
    const onFocus = () => void refreshAppData();
    window.addEventListener('focus', onFocus);
    return () => {
      clearInterval(t);
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  // global shortcuts: kill switch, camera toggle, command bar, voice, fullscreen
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const st = visionStatus.get().state;
      if (e.key === 'Escape' && garden.get().placing) return cancelPlacing();
      if (e.key === 'Escape') {
        if (app.get().commandOpen) return app.set({ commandOpen: false });
        if (st === 'ACTIVE' || st === 'PAUSED') vision.setState('STANDBY', 'Esc kill switch');
        else if (app.get().focus) app.set({ focus: false });
      } else if (e.ctrlKey && e.altKey && e.key.toLowerCase() === 'v') {
        vision.setState(st === 'CAMERA_OFF' ? 'STANDBY' : 'CAMERA_OFF', 'shortcut');
      } else if (e.ctrlKey && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        app.set({ commandOpen: true });
      } else if (e.ctrlKey && e.shiftKey && e.code === 'Space') {
        e.preventDefault();
        if (voiceState.get().supported) listen(t => runText(t));
        else app.set({ commandOpen: true });
      } else if (e.ctrlKey && e.altKey && e.key.toLowerCase() === 'l') {
        lockNow();
      } else if (e.key === 'F11') {
        e.preventDefault();
        void platform.setFullscreen(!document.fullscreenElement);
      } else if (e.altKey && e.key === 'n') {
        setPrefs({ theme: app.get().theme === 'day' ? 'night' : 'day' });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const dim = screen === 'home' ? 0 : screen === 'reader' || screen === 'cinema' || screen === 'board' ? (focusMode ? 0.92 : 0.72) : 0.5;

  return (
    <div className={`shell screen-${screen} ${focusMode ? 'is-focus' : ''}`}>
      {!focusMode && <TitleBar />}
      {wallpaper ? (
        <div className="scene">
          <div className="wallpaper" style={{ backgroundImage: `url(${wallpaper})` }} />
          <div className="scene-dim" style={{ opacity: dim }} />
        </div>
      ) : (
        <GardenScene night={theme === 'night'} dim={dim} photo={photoScene ? '/scenes/greenhouse-night.webp' : undefined}>
          {screen === 'home' && <GardenLayers />}
        </GardenScene>
      )}
      {preset === 'rainy' && <div className="rain" aria-hidden />}
      {photoScene && screen === 'home' && <div className="scene-vignette" aria-hidden />}
      <div className="scene-tint" aria-hidden />
      <div className="scene-bloom" aria-hidden />
      <main className="stage">
        {screen === 'home' && <Home />}
        {screen === 'reader' && <Reader />}
        {screen === 'cinema' && <Cinema />}
        {screen === 'calibrate' && <Calibration />}
        {screen === 'settings' && <Settings />}
        {screen === 'focus' && <FocusStudio />}
        {screen === 'board' && <Board />}
        {screen === 'library' && <Library />}
        {screen === 'planner' && <Planner />}
      </main>
      {!focusMode && <BranchDock />}
      {!focusMode && <FullscreenPod />}
      {!focusMode && <SettingsPod />}
      <Companion />
      <FocusOverlay />
      <VisionHUD />
      <RadialMenu />
      <AiPanel />
      <Launcher />
      <Toasts />
      <HandCursor />
    </div>
  );
}
