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
