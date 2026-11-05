// Which pane a component renders in. Hooks that grab global input (vision handlers, radial menu,
// keyboard, voice/command controls) read this so that only the right pane responds. Components
// outside the workspace get the default: visible and active.
import { createContext, useContext } from 'react';
import type { PaneId, Slot } from './layout';

export interface PaneInfo {
  id: PaneId | null;
  slot: Slot;
  /** on screen as main or side pane: may react to gestures over it */
  visible: boolean;
  /** owns keyboard shortcuts, the radial menu and voice/command controls */
  active: boolean;
}

export const PaneContext = createContext<PaneInfo>({ id: null, slot: 'main', visible: true, active: true });
export const usePane = () => useContext(PaneContext);
