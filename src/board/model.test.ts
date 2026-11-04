import { describe, expect, it } from 'vitest';
import { addNode, fitView, History, link, moveNode, removeNode, type BoardDoc } from './model';

const empty: BoardDoc = { nodes: [], edges: [] };
const card = (id: string, x = 0) => ({ id, type: 'note' as const, x, y: 0, w: 260, text: id, source: null });

describe('board model', () => {
  it('links once, never to itself, and removing a node drops its edges', () => {
    let d = addNode(addNode(empty, card('a')), card('b'));
    d = link(d, 'a', 'b');
    d = link(d, 'b', 'a');
    d = link(d, 'a', 'a');
    expect(d.edges).toHaveLength(1);
    d = removeNode(d, 'a');
    expect(d.nodes.map(n => n.id)).toEqual(['b']);
    expect(d.edges).toHaveLength(0);
  });

  it('keeps the clip source with the card', () => {
    const d = addNode(empty, { ...card('c'), type: 'text', source: { kind: 'pdf', docId: 'm-1', title: 'RIS', page: 7, rect: [0.1, 0.2, 0.3, 0.05] } });
    expect(d.nodes[0].source).toMatchObject({ kind: 'pdf', page: 7 });
  });

  it('undo/redo walks the history and a new edit clears redo', () => {
    const h = new History<BoardDoc>(empty);
    h.push(addNode(h.present, card('a')));
    h.push(moveNode(h.present, 'a', 100, 50));
    expect(h.undo()).toBe(true);
    expect(h.present.nodes[0].x).toBe(0);
    expect(h.redo()).toBe(true);
    expect(h.present.nodes[0].x).toBe(100);
    h.undo();
    h.push(addNode(h.present, card('b')));
    expect(h.canRedo).toBe(false);
    h.undo();
    h.undo();
    expect(h.present.nodes).toHaveLength(0);
    expect(h.undo()).toBe(false);
  });

  it('fits all cards in view', () => {
    const d = addNode(addNode(empty, card('a', 0)), card('b', 2000));
    const v = fitView(d, 1000, 800);
    expect(v.scale).toBeLessThan(1);
    expect(0 * v.scale + v.x).toBeGreaterThanOrEqual(0);
    expect((2000 + 260) * v.scale + v.x).toBeLessThanOrEqual(1000);
  });
});

import { dropClip, frameAround, inFrame, moveGroup, paperMap, parseClip, setEdgeLabel } from './model';

describe('frames, labels and the paper map', () => {
  const base = (): import('./model').BoardDoc => ({
    nodes: [
      { id: 'a', type: 'text', x: 100, y: 100, w: 200, text: 'A', source: { kind: 'pdf', docId: 'm-p1', paperId: 'p1', title: 'P1', page: 2 }, created: '' },
      { id: 'b', type: 'note', x: 400, y: 120, w: 200, text: 'B', source: null, created: '' },
      { id: 'c', type: 'text', x: 2000, y: 2000, w: 200, text: 'C', source: { kind: 'pdf', docId: 'm-p2', paperId: 'p2', title: 'P2', page: 5 }, created: '' },
    ],
    edges: [],
  });
  it('frames gather cards and move them together', () => {
    const d = frameAround(base(), ['a', 'b'], { x: 0, y: 0 }, 'Steering');
    const f = d.nodes.find(n => n.type === 'frame')!;
    expect(f.text).toBe('Steering');
    expect(inFrame(d, f.id).sort()).toEqual(['a', 'b']);
    const starts = Object.fromEntries([f.id, 'a', 'b'].map(id => [id, d.nodes.find(n => n.id === id)!]));
    const moved = moveGroup(d, starts, 10, -5);
    expect(moved.nodes.find(n => n.id === 'a')).toMatchObject({ x: 110, y: 95 });
    expect(moved.nodes.find(n => n.id === 'c')).toMatchObject({ x: 2000, y: 2000 });
  });
  it('labels edges and clears empty labels', () => {
    const d = { ...base(), edges: [{ id: 'e', from: 'a', to: 'b' }] };
    expect(setEdgeLabel(d, 'e', ' supports ').edges[0].label).toBe('supports');
    expect(setEdgeLabel(d, 'e', '  ').edges[0].label).toBeUndefined();
  });
  it('maps papers once, links clips to them and related papers to each other', () => {
    const papers = [{ id: 'p1', title: 'One' }, { id: 'p2', title: 'Two' }, { id: 'p3', title: 'Unused' }];
    const once = paperMap(base(), papers, [['p1', 'p2', 'shared terms']]);
    const paperNodes = once.nodes.filter(n => n.type === 'paper');
    expect(paperNodes.map(n => n.paperId).sort()).toEqual(['p1', 'p2']);
    expect(once.edges.some(e => e.from === 'paper-p1' && e.to === 'a')).toBe(true);
    expect(once.edges.find(e => e.from === 'paper-p1' && e.to === 'paper-p2')?.label).toBe('shared terms');
    const twice = paperMap(once, papers, [['p1', 'p2']]);
    expect(twice.nodes.length).toBe(once.nodes.length);
    expect(twice.edges.length).toBe(once.edges.length);
  });
  it('accepts only well-formed clips', () => {
    expect(parseClip('nope')).toBeNull();
    expect(parseClip(JSON.stringify({ type: 'script', text: 'x' }))).toBeNull();
    const c = parseClip(JSON.stringify({ type: 'figure', text: 'fig', image: 'javascript:alert(1)', source: null }))!;
    expect(c.image).toBeUndefined();
    const d = dropClip({ nodes: [], edges: [] }, { type: 'text', text: 'q', source: null }, { x: 500, y: 300 });
    expect(d.nodes[0]).toMatchObject({ type: 'text', x: 360, y: 270 });
  });
});
