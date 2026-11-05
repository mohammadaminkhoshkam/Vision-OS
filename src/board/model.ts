// Spatial Knowledge Board data model (SR-02/03). Pure reducers + an undo history.

export type NodeType = 'text' | 'figure' | 'note' | 'video' | 'ai' | 'frame' | 'paper';

export type Source =
  | { kind: 'pdf'; docId: string; paperId?: string; title: string; page: number; rect?: [number, number, number, number] }
  | { kind: 'video'; videoId: string; t: number; title: string }
  | null;

export interface BoardNode {
  id: string;
  type: NodeType;
  x: number;
  y: number;
  w: number;
  text: string;
  image?: string; // data URL for figure clips
  source: Source;
  color?: string;
  /** frames have a height; cards size to their content */
  h?: number;
  /** paper nodes on the paper map */
  paperId?: string;
  created: string;
}

export interface BoardEdge {
  id: string;
  from: string;
  to: string;
  label?: string;
}

export interface BoardDoc {
  nodes: BoardNode[];
  edges: BoardEdge[];
}

export interface Viewport {
  x: number;
  y: number;
  scale: number;
}

export const uid = () => Math.random().toString(36).slice(2, 10);

export function addNode(doc: BoardDoc, n: Omit<BoardNode, 'id' | 'created'> & { id?: string }): BoardDoc {
  return { ...doc, nodes: [...doc.nodes, { ...n, id: n.id ?? uid(), created: new Date().toISOString() }] };
}

export function moveNode(doc: BoardDoc, id: string, x: number, y: number): BoardDoc {
  return { ...doc, nodes: doc.nodes.map(n => (n.id === id ? { ...n, x, y } : n)) };
}

export function updateNode(doc: BoardDoc, id: string, patch: Partial<BoardNode>): BoardDoc {
  return { ...doc, nodes: doc.nodes.map(n => (n.id === id ? { ...n, ...patch } : n)) };
}

export function removeNode(doc: BoardDoc, id: string): BoardDoc {
  return { nodes: doc.nodes.filter(n => n.id !== id), edges: doc.edges.filter(e => e.from !== id && e.to !== id) };
}

export function link(doc: BoardDoc, from: string, to: string, label?: string): BoardDoc {
  if (from === to || doc.edges.some(e => (e.from === from && e.to === to) || (e.from === to && e.to === from))) return doc;
  return { ...doc, edges: [...doc.edges, { id: uid(), from, to, label }] };
}

export function unlink(doc: BoardDoc, edgeId: string): BoardDoc {
  return { ...doc, edges: doc.edges.filter(e => e.id !== edgeId) };
}

/** Where to drop a new card so clips do not pile on top of each other. */
export function nextSlot(doc: BoardDoc, view: Viewport, screenW: number, screenH: number) {
  const cx = (screenW / 2 - view.x) / view.scale, cy = (screenH / 2 - view.y) / view.scale;
  const n = doc.nodes.length % 12;
  return { x: cx - 140 + (n % 4) * 40, y: cy - 100 + Math.floor(n / 4) * 40 };
}

export function fitView(doc: BoardDoc, w: number, h: number): Viewport {
  if (!doc.nodes.length) return { x: w / 2, y: h / 2, scale: 1 };
  const xs = doc.nodes.flatMap(n => [n.x, n.x + n.w]), ys = doc.nodes.flatMap(n => [n.y, n.y + 180]);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const scale = Math.min(1.4, Math.max(0.25, Math.min((w - 120) / (maxX - minX || 1), (h - 120) / (maxY - minY || 1))));
  return { scale, x: w / 2 - ((minX + maxX) / 2) * scale, y: h / 2 - ((minY + maxY) / 2) * scale };
}

export class History<T> {
  private past: T[] = [];
  private future: T[] = [];
  constructor(public present: T, private limit = 60) {}
  push(next: T) {
    if (next === this.present) return;
    this.past.push(this.present);
    if (this.past.length > this.limit) this.past.shift();
    this.present = next;
    this.future = [];
  }
  /** replace without recording (e.g. while a drag is in progress) */
  replace(next: T) {
    this.present = next;
  }
  undo() {
    const p = this.past.pop();
    if (p === undefined) return false;
    this.future.push(this.present);
    this.present = p;
    return true;
  }
  redo() {
    const f = this.future.pop();
    if (f === undefined) return false;
    this.past.push(this.present);
    this.present = f;
    return true;
  }
  get canUndo() {
    return this.past.length > 0;
  }
  get canRedo() {
    return this.future.length > 0;
  }
}

// ───────────── visual thinking (ideas from tldraw frames and AFFiNE's edgeless mode)

export const NOTE_COLORS = ['#f6e7a8', '#f4c6c0', '#cfe7c2', '#c6dcf2', '#e3d2f2'];

const CARD_H = 140;

/** Cards whose top-left corner lies inside a frame move with it. */
export function inFrame(doc: BoardDoc, frameId: string): string[] {
  const f = doc.nodes.find(n => n.id === frameId);
  if (!f || f.type !== 'frame') return [];
  const h = f.h ?? 320;
  return doc.nodes.filter(n => n.id !== f.id && n.type !== 'frame' && n.x >= f.x && n.x <= f.x + f.w && n.y >= f.y && n.y <= f.y + h).map(n => n.id);
}

/** Move several nodes by the same offset from their recorded start positions. */
export function moveGroup(doc: BoardDoc, starts: Record<string, { x: number; y: number }>, dx: number, dy: number): BoardDoc {
  return { ...doc, nodes: doc.nodes.map(n => (starts[n.id] ? { ...n, x: starts[n.id].x + dx, y: starts[n.id].y + dy } : n)) };
}

export function setEdgeLabel(doc: BoardDoc, edgeId: string, label: string): BoardDoc {
  return { ...doc, edges: doc.edges.map(e => (e.id === edgeId ? { ...e, label: label.trim() || undefined } : e)) };
}

/** A frame around the given cards (or an empty one at a point). */
export function frameAround(doc: BoardDoc, ids: string[], at: { x: number; y: number }, title = 'Theme'): BoardDoc {
  const ns = doc.nodes.filter(n => ids.includes(n.id));
  if (!ns.length) return addNode(doc, { type: 'frame', x: at.x, y: at.y, w: 520, h: 340, text: title, source: null });
  const x = Math.min(...ns.map(n => n.x)) - 30, y = Math.min(...ns.map(n => n.y)) - 50;
  const x2 = Math.max(...ns.map(n => n.x + n.w)) + 30, y2 = Math.max(...ns.map(n => n.y + CARD_H)) + 30;
  return addNode(doc, { type: 'frame', x, y, w: x2 - x, h: y2 - y, text: title, source: null });
}

export interface MapPaper {
  id: string;
  title: string;
}

/** Paper map: one node per paper that has clips on the board, each clip linked to its paper, and
 *  related papers linked to each other. Running it again only adds what is missing. */
export function paperMap(doc: BoardDoc, papers: MapPaper[], related: [string, string, string?][] = []): BoardDoc {
  const cited = new Set(doc.nodes.flatMap(n => (n.source?.kind === 'pdf' && n.source.paperId ? [n.source.paperId] : [])));
  for (const [a, b] of related) if (cited.has(a) || cited.has(b)) (cited.add(a), cited.add(b));
  const list = papers.filter(p => cited.has(p.id));
  let next = doc;
  const existing = new Map(doc.nodes.filter(n => n.type === 'paper' && n.paperId).map(n => [n.paperId!, n.id]));
  // place new paper nodes on a ring around the cards they gather
  const cx = doc.nodes.length ? doc.nodes.reduce((s, n) => s + n.x, 0) / doc.nodes.length : 0;
  const cy = doc.nodes.length ? doc.nodes.reduce((s, n) => s + n.y, 0) / doc.nodes.length : 0;
  const R = 420 + list.length * 30;
  list.forEach((p, i) => {
    if (existing.has(p.id)) return;
    const a = (i / Math.max(1, list.length)) * Math.PI * 2 - Math.PI / 2;
    const id = `paper-${p.id}`;
    next = addNode(next, { id, type: 'paper', paperId: p.id, x: Math.round(cx + Math.cos(a) * R), y: Math.round(cy + Math.sin(a) * R * 0.7), w: 240, text: p.title, source: null });
    existing.set(p.id, id);
  });
  for (const n of next.nodes) {
    if (n.source?.kind !== 'pdf' || !n.source.paperId) continue;
    const pid = existing.get(n.source.paperId);
    if (pid) next = link(next, pid, n.id);
  }
  for (const [a, b, why] of related) {
    const pa = existing.get(a), pb = existing.get(b);
    if (pa && pb) next = link(next, pa, pb, why ?? 'related');
  }
  return next;
}

// ───────────── content carried onto the board (drag and drop, hand pinch-carry)

export interface Clip {
  type: 'text' | 'figure' | 'note' | 'video' | 'ai';
  text: string;
  image?: string;
  source: Source;
}

export const CLIP_MIME = 'application/x-vision-clip';

export function parseClip(raw: string): Clip | null {
  try {
    const c = JSON.parse(raw);
    if (!c || typeof c.text !== 'string' || !['text', 'figure', 'note', 'video', 'ai'].includes(c.type)) return null;
    return { type: c.type, text: c.text.slice(0, 20000), image: typeof c.image === 'string' && c.image.startsWith('data:image/') ? c.image : undefined, source: c.source ?? null };
  } catch {
    return null;
  }
}

export function dropClip(doc: BoardDoc, c: Clip, at: { x: number; y: number }): BoardDoc {
  const w = c.type === 'figure' ? 300 : c.type === 'ai' ? 320 : c.type === 'note' ? 240 : 280;
  return addNode(doc, { type: c.type, text: c.text, image: c.image, source: c.source, x: Math.round(at.x - w / 2), y: Math.round(at.y - 30), w });
}
