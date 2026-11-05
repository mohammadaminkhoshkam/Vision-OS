// First-run onboarding through one real piece of research, not a tour of buttons: each item is
// ticked off by actually doing it, so it doubles as a map of the core flow.
export interface OnboardingFacts {
  openedPaper: boolean;
  boardCards: number;
  boardCardsAtStart: number;
  focusSessions: number;
  spaces: number;
  tutorialDone: boolean;
}

export interface CheckItem {
  id: 'read' | 'clip' | 'focus' | 'space' | 'hands';
  label: string;
  hint: string;
  done: boolean;
}

export function checklist(f: OnboardingFacts): CheckItem[] {
  return [
    { id: 'read', label: 'Open a paper', hint: 'From the library or «Continue reading»', done: f.openedPaper },
    { id: 'clip', label: 'Put a quote on the knowledge board', hint: 'Drag a highlight or selection onto the board', done: f.boardCards > f.boardCardsAtStart },
    { id: 'focus', label: 'Run a focus session', hint: 'The garden quiets down while it runs', done: f.focusSessions > 0 },
    { id: 'space', label: 'Save your research space', hint: '«Spaces» in the title bar brings it all back later', done: f.spaces > 0 },
    { id: 'hands', label: 'Practise hand control (optional)', hint: 'Two minutes with the camera', done: f.tutorialDone },
  ];
}

export const progress = (items: CheckItem[]) => items.filter(i => i.done).length / items.length;
