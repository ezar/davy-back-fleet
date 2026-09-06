'use client';

import { create } from 'zustand';
import { chooseAiShot } from '@/lib/aiOpponent';
import { isFleetDestroyed, randomFleet, resolveShot } from '@/lib/gameLogic';
import type { Cell, Placement, ShipId, ShotLog } from '@/lib/types';

export type SoloPhase = 'idle' | 'placing' | 'battle' | 'finished';

/** Pause between AI shots, so what happens can be read. */
const AI_DELAY_MS = 700;

interface SoloState {
  phase: SoloPhase;
  playerFleet: Placement[];
  aiFleet: Placement[];
  /** Shots you have fired at the AI board. */
  shotsAtAi: ShotLog;
  /** Shots the AI has fired at yours. */
  shotsAtPlayer: ShotLog;
  turn: 'player' | 'ai';
  winner: 'player' | 'ai' | null;
  aiThinking: boolean;
  lastSunkByPlayer: ShipId | null;
  lastSunkByAi: ShipId | null;

  /** Starts a new game in the placement phase. Client only. */
  newGame: () => void;
  setPlayerFleet: (placements: Placement[]) => void;
  startBattle: () => void;
  shoot: (cell: Cell) => void;
}

export const useGameStore = create<SoloState>((set, get) => {
  /**
   * The AI turn: it fires and, on a hit, chains another shot just as the
   * player does. It stops on a miss or on winning.
   */
  function runAiTurn() {
    const state = get();
    if (state.phase !== 'battle' || state.turn !== 'ai') return;

    set({ aiThinking: true });
    setTimeout(() => {
      const current = get();
      if (current.phase !== 'battle' || current.turn !== 'ai') {
        set({ aiThinking: false });
        return;
      }

      const { cell } = chooseAiShot(current.shotsAtPlayer);
      const result = resolveShot(current.playerFleet, current.shotsAtPlayer, cell);
      const shotsAtPlayer: ShotLog = [...current.shotsAtPlayer, result];
      const defeated = isFleetDestroyed(shotsAtPlayer);

      set({
        shotsAtPlayer,
        lastSunkByAi: result.sunkShipId ?? current.lastSunkByAi,
        winner: defeated ? 'ai' : null,
        phase: defeated ? 'finished' : 'battle',
        turn: result.outcome === 'miss' ? 'player' : 'ai',
        aiThinking: false,
      });

      if (!defeated && result.outcome !== 'miss') runAiTurn();
    }, AI_DELAY_MS);
  }

  return {
    phase: 'idle',
    playerFleet: [],
    aiFleet: [],
    shotsAtAi: [],
    shotsAtPlayer: [],
    turn: 'player',
    winner: null,
    aiThinking: false,
    lastSunkByPlayer: null,
    lastSunkByAi: null,

    newGame: () =>
      set({
        phase: 'placing',
        playerFleet: randomFleet(),
        aiFleet: randomFleet(),
        shotsAtAi: [],
        shotsAtPlayer: [],
        turn: 'player',
        winner: null,
        aiThinking: false,
        lastSunkByPlayer: null,
        lastSunkByAi: null,
      }),

    setPlayerFleet: (placements) => set({ playerFleet: placements }),

    startBattle: () => {
      if (get().playerFleet.length === 0) return;
      set({ phase: 'battle', turn: 'player' });
    },

    shoot: (cell) => {
      const state = get();
      if (state.phase !== 'battle' || state.turn !== 'player' || state.aiThinking) return;

      const result = resolveShot(state.aiFleet, state.shotsAtAi, cell);
      const shotsAtAi: ShotLog = [...state.shotsAtAi, result];
      const defeated = isFleetDestroyed(shotsAtAi);

      set({
        shotsAtAi,
        lastSunkByPlayer: result.sunkShipId ?? state.lastSunkByPlayer,
        winner: defeated ? 'player' : null,
        phase: defeated ? 'finished' : 'battle',
        // A hit earns another go, as in the board game.
        turn: result.outcome === 'miss' ? 'ai' : 'player',
      });

      if (!defeated && result.outcome === 'miss') runAiTurn();
    },
  };
});
