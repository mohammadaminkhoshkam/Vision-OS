import { describe, expect, it } from 'vitest';
import { checklist, progress } from './checklist';

describe('onboarding checklist', () => {
  const none = { openedPaper: false, boardCards: 3, boardCardsAtStart: 3, focusSessions: 0, spaces: 0, tutorialDone: false };
  it('ticks items from real activity only', () => {
    expect(progress(checklist(none))).toBe(0);
    const some = checklist({ ...none, openedPaper: true, boardCards: 4 });
    expect(some.filter(i => i.done).map(i => i.id)).toEqual(['read', 'clip']);
    expect(progress(checklist({ openedPaper: true, boardCards: 5, boardCardsAtStart: 0, focusSessions: 1, spaces: 1, tutorialDone: true }))).toBe(1);
  });
});
