// Dev-only data bridge. In the browser (npm run dev) the UI reads the same local data the Tauri
// shell reads in production: Marginal's workspace, Rooznegar's data.json and HabitWall's SQLite.
// Everything here is read-only except /api/launch, which starts one of the known apps.
import type { Plugin } from 'vite';
import { existsSync, readFileSync, createReadStream } from 'node:fs';
import { join, basename } from 'node:path';
import { execSync, spawn } from 'node:child_process';

const APPDATA = process.env.APPDATA ?? '';
const LOCAL = process.env.LOCALAPPDATA ?? '';
const HOME = process.env.USERPROFILE ?? '';

export const paths = {
  marginalWorkspace: join(APPDATA, 'marginal-research', 'workspace'),
  rooznegarData: join(LOCAL, 'Rooznegar', 'data.json'),
  habitwallDb: join(APPDATA, 'app.habitwall.desktop', 'habitwall.db'),
};

export const appCandidates: Record<string, string[]> = {
  marginal: [join(LOCAL, 'Programs', 'Marginal Research', 'Marginal Research.exe')],
  habitwall: [join(LOCAL, 'HabitWall', 'habitwall.exe')],
  rooznegar: [join(LOCAL, 'Programs', 'Rooznegar', 'Rooznegar.exe'), join(HOME, 'Desktop', 'Rooznegar', 'build', 'Rooznegar.exe')],
};

function json(res: import('node:http').ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

function marginalPapers() {
  const file = join(paths.marginalWorkspace, 'workspace.json');
  if (!existsSync(file)) return { available: false, papers: [] };
  const ws = JSON.parse(readFileSync(file, 'utf8'));
  const papers = (ws.papers ?? []).map((p: Record<string, unknown>) => ({
    id: p.id, title: p.title, authors: p.authors, year: p.year, venue: p.venue, status: p.status,
    collection: p.collection ?? '', favorite: !!p.favorite, pdf: p.pdf ?? '', pages: p.pages ?? 0,
    lastPage: p.lastPage ?? 0, maxPage: p.maxPage ?? 0, opened: p.opened ?? '', added: p.added ?? '',
    notes: Array.isArray(p.notes) ? p.notes.length : 0,
  }));
  return { available: true, papers };
}

async function habitwall() {
  if (!existsSync(paths.habitwallDb)) return { available: false, habits: [], checkins: [] };
  const { DatabaseSync } = await import('node:sqlite');
  const db = new DatabaseSync(paths.habitwallDb, { readOnly: true });
  try {
    const habits = db.prepare('SELECT id, title, color, icon, kind, target_value, unit, archived_at FROM habits ORDER BY sort_order, created_at').all();
    const checkins = db.prepare("SELECT habit_id, day, status, value FROM checkins WHERE day >= date('now','-2 day')").all();
    return { available: true, habits, checkins };
  } finally {
    db.close();
  }
}

/** The current Windows desktop wallpaper: the registry path, else Windows' cached copy. */
export function windowsWallpaper(): string | null {
  try {
    const out = execSync('reg query "HKCU\\Control Panel\\Desktop" /v WallPaper', { encoding: 'utf8' });
    const m = out.match(/WallPaper\s+REG_SZ\s+(.+)/i);
    if (m && existsSync(m[1].trim())) return m[1].trim();
  } catch {
    /* fall through */
  }
  const cached = join(APPDATA, 'Microsoft', 'Windows', 'Themes', 'TranscodedWallpaper');
  return existsSync(cached) ? cached : null;
}

export function devApi(): Plugin {
  return {
    name: 'vision-os-dev-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url ?? '';
        if (!url.startsWith('/api/')) return next();
        try {
          if (url === '/api/marginal') return json(res, 200, marginalPapers());
          if (url.startsWith('/api/marginal/file/')) {
            const name = basename(decodeURIComponent(url.slice('/api/marginal/file/'.length)));
            const file = join(paths.marginalWorkspace, 'files', name);
            if (!name.endsWith('.pdf') || !existsSync(file)) return json(res, 404, { error: 'not found' });
            res.setHeader('Content-Type', 'application/pdf');
            createReadStream(file).pipe(res);
            return;
          }
          if (url === '/api/rooznegar') {
            if (!existsSync(paths.rooznegarData)) return json(res, 200, { available: false });
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            return res.end(readFileSync(paths.rooznegarData, 'utf8').replace(/^﻿/, ''));
          }
          if (url === '/api/habitwall') return json(res, 200, await habitwall());
          if (url.startsWith('/api/wallpaper')) {
            const file = windowsWallpaper();
            if (!file) return json(res, 404, { error: 'no wallpaper' });
            res.setHeader('Content-Type', /\.png$/i.test(file) ? 'image/png' : 'image/jpeg');
            res.setHeader('Cache-Control', 'no-cache');
            createReadStream(file).pipe(res);
            return;
          }
          if (url === '/api/apps') {
            const found = Object.fromEntries(Object.entries(appCandidates).map(([k, list]) => [k, list.find(existsSync) ?? null]));
            return json(res, 200, found);
          }
          if (url.startsWith('/api/launch/')) {
            const id = url.slice('/api/launch/'.length);
            const exe = appCandidates[id]?.find(existsSync);
            if (!exe) return json(res, 404, { error: 'app not found' });
            spawn(exe, [], { detached: true, stdio: 'ignore' }).unref();
            return json(res, 200, { ok: true });
          }
          json(res, 404, { error: 'unknown endpoint' });
        } catch (e) {
          json(res, 500, { error: String(e) });
        }
      });
    },
  };
}
