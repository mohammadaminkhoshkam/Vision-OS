// Spatial Knowledge Board data model (SR-02/03). Pure reducers + an undo history.

export type NodeType = 'text' | 'figure' | 'note' | 'video' | 'ai';

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
