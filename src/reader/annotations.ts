import { loadJson, saveJson } from '../lib/store';

/** Rects are normalized to the page (0..1) so they survive any zoom level. */
export type NRect = [number, number, number, number];

export interface Highlight {
  id: string;
  page: number;
  rects: NRect[];
  color: string;
  text: string;
  created: string;
}
export interface Stroke {
  id: string;
  page: number;
  pts: [number, number][];
  color: string;
  width: number;
  created?: string;
}
export interface DocNotes {
  highlights: Highlight[];
  strokes: Stroke[];
  bookmarks: number[];
  lastPage: number;
}

const empty: DocNotes = { highlights: [], strokes: [], bookmarks: [], lastPage: 1 };
const key = (docId: string) => `vos.notes.${docId}`;

export function loadNotes(docId: string): DocNotes {
  return loadJson(key(docId), empty);
}
export function saveNotes(docId: string, n: DocNotes) {
  saveJson(key(docId), n);
}

export const uid = () => Math.random().toString(36).slice(2, 10);

/** Merge span rects that sit on the same text line into one band per line. */
export function mergeLineRects(rects: NRect[]): NRect[] {
  const sorted = [...rects].sort((a, b) => a[1] - b[1] || a[0] - b[0]);
  const out: NRect[] = [];
  for (const r of sorted) {
    const last = out[out.length - 1];
    if (last && Math.abs(last[1] - r[1]) < r[3] * 0.5 && r[0] <= last[0] + last[2] + 0.02) {
      const x0 = Math.min(last[0], r[0]), x1 = Math.max(last[0] + last[2], r[0] + r[2]);
      const y0 = Math.min(last[1], r[1]), y1 = Math.max(last[1] + last[3], r[1] + r[3]);
      out[out.length - 1] = [x0, y0, x1 - x0, y1 - y0];
    } else out.push([...r]);
  }
  return out;
}
