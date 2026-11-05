// Reopening work exactly where it was left: single activities («continue») and whole research
// spaces (layout + paper + video + scene + soundscape), the daedalOS idea of a desktop that comes
// back the way you left it.
import { appData } from '../apps/data';
import { ambience, setAmbience } from '../focus/ambient';
import { app, go, openPaper, openVideo, setPrefs, toast, type Preset } from './app';
import { effectiveSide, isPane, layout, openPane, saveWorkspaces, setRatio, setSide, upsertWorkspace, type PaneId, type SavedWorkspace } from './layout';
import { loadFileDoc } from './fileStore';
import { workspace, type Activity } from './workspace';

/** Reopen an activity exactly where it was left. */
export async function resumeActivity(a: Activity, opts: { split?: boolean; stay?: boolean } = {}) {
  if (a.kind === 'video') {
    if (opts.stay) {
      openPane('cinema');
      app.set({ pendingVideo: { id: a.id, t: a.t ?? 0 } });
    } else openVideo(a.id, a.t ?? 0);
  } else if (a.kind === 'paper') {
    const doc = app.get().doc;
    const paper = appData.get().papers.find(p => p.id === a.id) ?? (doc?.source === 'marginal' && doc.paper.id === a.id ? doc.paper : null);
    if (!paper) return toast('That paper is no longer in the Marginal library', 'warn');
    openPaper(paper, a.page);
  } else {
    const doc = app.get().doc;
    const same = doc?.source === 'file' && `f-${doc.name}-${doc.data.byteLength}` === a.id;
    if (!same) {
      // local PDFs are kept on this computer (IndexedDB) so they reopen after a restart
      const stored = await loadFileDoc(a.id);
      if (stored) app.set({ doc: { source: 'file', name: stored.name, data: stored.data }, pendingPage: a.page ?? null });
      else toast('This file is no longer stored; open it again to continue (your highlights are kept)', 'info');
    } else app.set({ pendingPage: a.page ?? null });
    go('reader');
  }
  if (opts.split) setSide('board');
}

const uid = () => Math.random().toString(36).slice(2, 10);

/** Snapshot of the current research space. */
export function captureSpace(name: string): SavedWorkspace {
  const screen = app.get().screen;
  const l = layout.get();
  const recent = workspace.get().recent;
  const paper = recent.find(a => a.kind !== 'video');
  const video = recent.find(a => a.kind === 'video');
  const main: PaneId = isPane(screen) ? screen : paper ? 'reader' : 'board';
  const levels = ambience.get().levels;
  const anySound = Object.values(levels).some(v => v > 0);
  const withVideo = l.opened.includes('cinema') && video;
  return {
    id: uid(),
    name: name.trim() || 'Research space',
    main,
    side: effectiveSide(main, l.side),
    ratio: l.ratio,
    paper: paper ? { kind: paper.kind as 'paper' | 'file', id: paper.id, page: paper.page } : undefined,
    video: withVideo ? { id: video.id, t: video.t ?? 0 } : undefined,
    preset: app.get().preset,
    ambient: anySound ? { ...levels } : null,
    created: Date.now(),
  };
}

export function saveSpace(name: string) {
  const w = captureSpace(name);
  saveWorkspaces(upsertWorkspace(layout.get().workspaces, w));
  toast(`Saved the space «${w.name}»`, 'ok');
  return w;
}

export function deleteSpace(id: string) {
  saveWorkspaces(layout.get().workspaces.filter(w => w.id !== id));
}

export async function restoreSpace(w: SavedWorkspace) {
  if (w.preset) setPrefs({ preset: w.preset as Preset });
  // the soundscape comes back only because the user explicitly asked for this space
  if (w.ambient) setAmbience(w.ambient);
  const recent = workspace.get().recent;
  if (w.paper) {
    const a = recent.find(x => x.kind === w.paper!.kind && x.id === w.paper!.id) ?? { kind: w.paper.kind, id: w.paper.id, title: '', page: w.paper.page, at: 0 };
    await resumeActivity({ ...a, page: w.paper.page ?? a.page });
  }
  if (w.video) await resumeActivity({ kind: 'video', id: w.video.id, title: '', t: w.video.t, at: 0 }, { stay: true });
  setRatio(w.ratio);
  setSide(w.side);
  go(w.main);
}
