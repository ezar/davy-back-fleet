'use client';

import { create } from 'zustand';

/**
 * `tilted` (the default): board tilted in perspective, with the ships lifted
 * above the water.
 * `flat`: seen from straight above, like the board game.
 *
 * Combat only: placement is always flat, because dragging ships across a
 * tilted plane is worse to use.
 */
export type BoardView = 'flat' | 'tilted';

const VIEW_KEY = 'dbf:view';

function readStoredView(): BoardView {
  try {
    // 2.5D by default: it only falls back to flat if the player chose it.
    return localStorage.getItem(VIEW_KEY) === 'flat' ? 'flat' : 'tilted';
  } catch {
    return 'tilted';
  }
}

interface SettingsState {
  view: BoardView;
  /** Reads the stored preference. Called from an effect, never during render. */
  hydrate: () => void;
  setView: (view: BoardView) => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  view: 'tilted',

  hydrate: () => set({ view: readStoredView() }),

  setView: (view) => {
    set({ view });
    try {
      localStorage.setItem(VIEW_KEY, view);
    } catch {
      // Private mode: the preference lasts as long as the tab.
    }
  },
}));
