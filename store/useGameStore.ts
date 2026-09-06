'use client';

import { create } from 'zustand';
import { DEFAULT_HUNT_STRATEGY, type HuntStrategy, chooseAiShot } from '@/lib/aiOpponent';
import { isFleetDestroyed, randomFleet, resolveShot } from '@/lib/gameLogic';
import { DEFAULT_RULES, type RoomRules } from '@/lib/room';
import type { Cell, Placement, ShipId, ShotLog, ShotResult } from '@/lib/types';

export type SoloPhase = 'idle' | 'placing' | 'battle' | 'finished';

/** Pause between AI shots, so what happens can be read. */
const AI_DELAY_MS = 700;

/** Does the shooter fire again? A hit does, unless the rule is turned off. */
function keepsTurn(rules: RoomRules, outcome: ShotResult['outcome']): boolean {
  return rules.extraTurnOnHit && outcome !== 'miss';
}

interface SoloState {
  phase: SoloPhase;
  playerFleet: Placement[];
  aiFleet: Placement[];
  /** Shots you have fired at the AI board. */
  shotsAtAi: ShotLog;
  /** Shots the AI has fired at yours. */
  shotsAtPlayer: ShotLog;
  turn: 'player' | 'ai';
  /**
   * Fixed when the game starts. Reading the setting on every shot would let
   * the difficulty change halfway through a game already under way.
   */
  aiStrategy: HuntStrategy;
  /** House rules, frozen when the game starts for the same reason. */
  rules: RoomRules;
  winner: 'player' | 'ai' | null;
  aiThinking: boolean;
  lastSunkByPlayer: ShipId | null;
  lastSunkByAi: ShipId | null;

  /** Starts a new game in the placement phase. Client only. */
  newGame: (aiStrategy?: HuntStrategy, rules?: RoomRules) => void;
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

      const { cell } = chooseAiShot(current.shotsAtPlayer, undefined, current.aiStrategy);
      const result = resolveShot(current.playerFleet, current.shotsAtPlayer, cell);
      const shotsAtPlayer: ShotLog = [...current.shotsAtPlayer, result];
      const defeated = isFleetDestroyed(shotsAtPlayer);

      set({
        shotsAtPlayer,
        lastSunkByAi: result.sunkShipId ?? current.lastSunkByAi,
        winner: defeated ? 'ai' : null,
        phase: defeated ? 'finished' : 'battle',
        turn: keepsTurn(current.rules, result.outcome) ? 'ai' : 'player',
        aiThinking: false,
      });

      if (!defeated && keepsTurn(current.rules, result.outcome)) runAiTurn();
    }, AI_DELAY_MS);
  }

  return {
    phase: 'idle',
    playerFleet: [],
    aiFleet: [],
    shotsAtAi: [],
    shotsAtPlayer: [],
    turn: 'player',
    aiStrategy: DEFAULT_HUNT_STRATEGY,
    rules: DEFAULT_RULES,
    winner: null,
    aiThinking: false,
    lastSunkByPlayer: null,
    lastSunkByAi: null,

    newGame: (aiStrategy = DEFAULT_HUNT_STRATEGY, rules = DEFAULT_RULES) =>
      set({
        phase: 'placing',
        aiStrategy,
        rules,
        playerFleet: randomFleet(undefined, rules.allowAdjacent),
        aiFleet: randomFleet(undefined, rules.allowAdjacent),
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
        turn: keepsTurn(state.rules, result.outcome) ? 'player' : 'ai',
      });

      if (!defeated && !keepsTurn(state.rules, result.outcome)) runAiTurn();
    },
  };
});
