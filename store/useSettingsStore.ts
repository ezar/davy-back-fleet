'use client';

import { create } from 'zustand';
import { DEFAULT_HUNT_STRATEGY, type HuntStrategy } from '@/lib/aiOpponent';
import { DEFAULT_RULES, type RoomRules, normalizeRules } from '@/lib/room';

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
const RULES_KEY = 'dbf:rules';

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

function readStoredRules(): RoomRules {
  try {
    const raw = localStorage.getItem(RULES_KEY);
    return raw ? normalizeRules(JSON.parse(raw)) : DEFAULT_RULES;
  } catch {
    // Unparsable or unreadable: the standard rules, never a half-read set.
    return DEFAULT_RULES;
  }
}

interface SettingsState {
  view: BoardView;
  /**
   * How the AI hunts while it has no trail to follow. Read when a game
   * starts, not on every shot: changing it mid-game would be unfair.
   */
  aiStrategy: HuntStrategy;
  /**
   * The player's preferred house rules: used for a solo game and offered as
   * the default when creating a room. A room freezes its own copy, so
   * changing this never alters a game already in progress.
   */
  rules: RoomRules;
  /** Reads the stored preferences. Called from an effect, never during render. */
  hydrate: () => void;
  setView: (view: BoardView) => void;
  setAiStrategy: (strategy: HuntStrategy) => void;
  setRule: <K extends keyof RoomRules>(rule: K, value: RoomRules[K]) => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  view: 'tilted',
  aiStrategy: DEFAULT_HUNT_STRATEGY,
  rules: DEFAULT_RULES,

  hydrate: () =>
    set({ view: readStoredView(), aiStrategy: readStoredStrategy(), rules: readStoredRules() }),

  setView: (view) => {
    set({ view });
    store(VIEW_KEY, view);
  },

  setAiStrategy: (strategy) => {
    set({ aiStrategy: strategy });
    store(AI_KEY, strategy);
  },

  setRule: (rule, value) =>
    set((state) => {
      const rules = { ...state.rules, [rule]: value };
      store(RULES_KEY, JSON.stringify(rules));
      return { rules };
    }),
}));

function store(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Private mode: the preference lasts as long as the tab.
  }
}
