import { describe, expect, it } from 'vitest';
import { activePane, clampRatio, effectiveSide, slotOf, upsertWorkspace, type SavedWorkspace, type SlotInput } from './layout';

const s = (over: Partial<SlotInput> = {}): SlotInput => ({ screen: 'reader', side: null, playing: false, pipDismissed: false, ...over });

describe('slots', () => {
  it('puts the screen in main and the chosen companion beside it', () => {
    const st = s({ side: 'board' });
    expect([slotOf('reader', st), slotOf('board', st), slotOf('cinema', st)]).toEqual(['main', 'side', 'hidden']);
  });
  it('never shows a pane twice and has no side outside the pane screens', () => {
    expect(effectiveSide('board', 'board')).toBeNull();
    expect(effectiveSide('home', 'board')).toBeNull();
    expect(slotOf('board', s({ screen: 'home', side: 'board' }))).toBe('hidden');
  });
  it('floats a playing video when you leave it, unless dismissed or in the focus studio', () => {
    expect(slotOf('cinema', s({ screen: 'home', playing: true }))).toBe('pip');
    expect(slotOf('cinema', s({ screen: 'reader', side: 'board', playing: true }))).toBe('pip');
    expect(slotOf('cinema', s({ screen: 'home', playing: true, pipDismissed: true }))).toBe('hidden');
    expect(slotOf('cinema', s({ screen: 'focus', playing: true }))).toBe('hidden');
    expect(slotOf('cinema', s({ screen: 'home', playing: false }))).toBe('hidden');
    // beside the reader it is a side pane, not a floating one
    expect(slotOf('cinema', s({ side: 'cinema', playing: true }))).toBe('side');
  });
});

describe('activePane', () => {
  it('follows the last touched visible pane, else main', () => {
    const st = s({ side: 'board' });
    expect(activePane(st, 'board')).toBe('board');
    expect(activePane(st, null)).toBe('reader');
    expect(activePane(st, 'cinema')).toBe('reader');
  });
  it('lets a floating video take controls only when no pane is on screen', () => {
    expect(activePane(s({ screen: 'home', playing: true }), null)).toBe('cinema');
    expect(activePane(s({ screen: 'home' }), null)).toBeNull();
    expect(activePane(s({ screen: 'reader', playing: true }), null)).toBe('reader');
  });
});

describe('workspaces', () => {
  const w = (id: string, name: string): SavedWorkspace => ({ id, name, main: 'reader', side: 'board', ratio: 0.6, created: 0 });
  it('replaces by id or by name and keeps the newest first', () => {
    let list = upsertWorkspace([], w('a', 'Thesis'));
    list = upsertWorkspace(list, w('b', 'Lectures'));
    list = upsertWorkspace(list, w('c', ' thesis '));
    expect(list.map(x => x.id)).toEqual(['c', 'b']);
  });
  it('clamps the split ratio', () => {
    expect([clampRatio(0.1), clampRatio(0.9), clampRatio(0.5), clampRatio(NaN)]).toEqual([0.3, 0.75, 0.5, 0.58]);
  });
});
