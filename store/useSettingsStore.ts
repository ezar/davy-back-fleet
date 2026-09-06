'use client';

import { create } from 'zustand';
import { DEFAULT_HUNT_STRATEGY, type HuntStrategy } from '@/lib/aiOpponent';

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
const AI_KEY = 'dbf:ai';

function readStoredView(): BoardView {
  try {
    // 2.5D by default: it only falls back to flat if the player chose it.
    return localStorage.getItem(VIEW_KEY) === 'flat' ? 'flat' : 'tilted';
  } catch {
    return 'tilted';
  }
}

function readStoredStrategy(): HuntStrategy {
  try {
    // Anything unrecognised falls back to the default, never to the hard one.
    return localStorage.getItem(AI_KEY) === 'density' ? 'density' : DEFAULT_HUNT_STRATEGY;
  } catch {
    return DEFAULT_HUNT_STRATEGY;
  }
}

interface SettingsState {
  view: BoardView;
  /**
   * How the AI hunts while it has no trail to follow. Read when a game
   * starts, not on every shot: changing it mid-game would be unfair.
   */
  aiStrategy: HuntStrategy;
  /** Reads the stored preferences. Called from an effect, never during render. */
  hydrate: () => void;
  setView: (view: BoardView) => void;
  setAiStrategy: (strategy: HuntStrategy) => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  view: 'tilted',
  aiStrategy: DEFAULT_HUNT_STRATEGY,

  hydrate: () => set({ view: readStoredView(), aiStrategy: readStoredStrategy() }),

  setView: (view) => {
    set({ view });
    store(VIEW_KEY, view);
  },

  setAiStrategy: (strategy) => {
    set({ aiStrategy: strategy });
    store(AI_KEY, strategy);
  },
}));

function store(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Private mode: the preference lasts as long as the tab.
  }
}
