// One data bridge for both runtimes: Tauri commands in the desktop shell, /api/* (dev-api.ts)
// when the UI runs in a browser during development.
import { invoke } from '@tauri-apps/api/core';

export const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

export interface MarginalPaper {
  id: string;
  title: string;
  authors: string;
  year: number | string;
  venue: string;
  status: string;
  collection: string;
  favorite: boolean;
  pdf: string;
  pages: number;
  lastPage: number;
  maxPage: number;
  opened: string;
  added: string;
  notes: number;
}

export interface HabitRow {
  id: string;
  title: string;
  color: string;
  icon: string | null;
  kind: 'check' | 'count';
  target_value: number;
  unit: string | null;
  archived_at: string | null;
}
export interface CheckinRow {
  habit_id: string;
  day: string;
  status: string | null;
  value: number;
}

export type AppId = 'marginal' | 'habitwall' | 'rooznegar';

async function get<T>(path: string): Promise<T> {
  const r = await fetch(path);
  if (!r.ok) throw new Error(`${path}: ${r.status}`);
  return r.json() as Promise<T>;
}

export const platform = {
  async marginalPapers(): Promise<{ available: boolean; papers: MarginalPaper[] }> {
    return isTauri ? invoke('marginal_papers') : get('/api/marginal');
  },
  async marginalPdf(name: string): Promise<ArrayBuffer> {
    if (isTauri) return invoke<ArrayBuffer>('marginal_file', { name });
    const r = await fetch(`/api/marginal/file/${encodeURIComponent(name)}`);
    if (!r.ok) throw new Error('PDF not found');
    return r.arrayBuffer();
  },
  async rooznegarRaw(): Promise<unknown> {
    if (isTauri) {
      const text = await invoke<string | null>('rooznegar_data');
      return text ? JSON.parse(text.replace(/^﻿/, '')) : { available: false };
    }
    return get('/api/rooznegar');
  },
  async habitwall(): Promise<{ available: boolean; habits: HabitRow[]; checkins: CheckinRow[] }> {
    return isTauri ? invoke('habitwall_today') : get('/api/habitwall');
  },
  async apps(): Promise<Record<AppId, string | null>> {
    return isTauri ? invoke('find_apps') : get('/api/apps');
  },
  async launch(id: AppId): Promise<void> {
    if (isTauri) return invoke('launch_app', { id });
    await get(`/api/launch/${id}`);
  },
  /** URL of the user's current Windows wallpaper, or null if none is found. */
  async windowsWallpaper(): Promise<string | null> {
    if (isTauri) {
      const bytes = await invoke<ArrayBuffer | null>('windows_wallpaper').catch(() => null);
      return bytes ? URL.createObjectURL(new Blob([bytes])) : null;
    }
    const r = await fetch('/api/wallpaper', { method: 'HEAD' }).catch(() => null);
    return r?.ok ? `/api/wallpaper?t=${Date.now()}` : null;
  },
  async setFullscreen(on: boolean) {
    if (isTauri) {
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      await getCurrentWindow().setFullscreen(on);
    } else if (on) await document.documentElement.requestFullscreen?.().catch(() => {});
    else if (document.fullscreenElement) await document.exitFullscreen().catch(() => {});
  },
  async exit() {
    if (isTauri) {
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      await getCurrentWindow().close();
    }
  },
};
