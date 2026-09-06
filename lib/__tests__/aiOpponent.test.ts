import { describe, expect, it } from 'vitest';
import { type HuntStrategy, chooseAiShot, unresolvedHits } from '../aiOpponent';
import { TOTAL_SHIP_CELLS } from '../fleet';
import {
  BOARD_SIZE,
  allCells,
  cellKey,
  isFleetDestroyed,
  randomFleet,
  resolveShot,
} from '../gameLogic';
import { seededRng } from '../rng';
import type { Cell, ShotLog } from '../types';

const at = (row: number, col: number): Cell => ({ row, col });

describe('unresolvedHits', () => {
  it('ignores hits from ships already sunk', () => {
    const log: ShotLog = [
      { cell: at(0, 0), outcome: 'hit' },
      {
        cell: at(0, 1),
        outcome: 'sunk',
        sunkShipId: 'red-force',
        sunkCells: [at(0, 0), at(0, 1)],
      },
      { cell: at(5, 5), outcome: 'hit' },
    ];
    expect(unresolvedHits(log)).toEqual([at(5, 5)]);
  });

  it('is empty when there are only misses', () => {
    expect(unresolvedHits([{ cell: at(2, 2), outcome: 'miss' }])).toEqual([]);
  });
});

describe('hunting phase', () => {
  it('fires at an untried cell', () => {
    const log: ShotLog = [{ cell: at(0, 0), outcome: 'miss' }];
    const decision = chooseAiShot(log, seededRng(9));
    expect(decision.phase).toBe('hunt');
    expect(cellKey(decision.cell)).not.toBe(cellKey(at(0, 0)));
  });

  it('the parity strategy stays on the checkerboard', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const { cell } = chooseAiShot([], seededRng(seed), 'parity');
      expect((cell.row + cell.col) % 2).toBe(0);
    }
  });

  it('throws when the board is exhausted', () => {
    const log: ShotLog = [];
    for (let row = 0; row < BOARD_SIZE; row++) {
      for (let col = 0; col < BOARD_SIZE; col++) log.push({ cell: at(row, col), outcome: 'miss' });
    }
    expect(() => chooseAiShot(log, seededRng(1))).toThrow(/celdas disponibles/);
  });
});

describe('target phase', () => {
  it('after a hit it tries one of the 4 orthogonal cells', () => {
    const log: ShotLog = [{ cell: at(4, 4), outcome: 'hit' }];
    const decision = chooseAiShot(log, seededRng(5));
    expect(decision.phase).toBe('target');
    expect([cellKey(at(3, 4)), cellKey(at(5, 4)), cellKey(at(4, 3)), cellKey(at(4, 5))]).toContain(
      cellKey(decision.cell),
    );
  });

  it('in a corner it only considers neighbours inside the board', () => {
    const log: ShotLog = [{ cell: at(0, 0), outcome: 'hit' }];
    for (let seed = 1; seed <= 20; seed++) {
      const { cell } = chooseAiShot(log, seededRng(seed));
      expect([cellKey(at(1, 0)), cellKey(at(0, 1))]).toContain(cellKey(cell));
    }
  });

  it('with two aligned hits it extends only that direction', () => {
    const log: ShotLog = [
      { cell: at(4, 4), outcome: 'hit' },
      { cell: at(4, 5), outcome: 'hit' },
    ];
    for (let seed = 1; seed <= 20; seed++) {
      const { cell, phase } = chooseAiShot(log, seededRng(seed));
      expect(phase).toBe('target');
      expect([cellKey(at(4, 3)), cellKey(at(4, 6))]).toContain(cellKey(cell));
    }
  });

  it('when one end misses, it continues from the other', () => {
    const log: ShotLog = [
      { cell: at(4, 4), outcome: 'hit' },
      { cell: at(4, 5), outcome: 'hit' },
      { cell: at(4, 6), outcome: 'miss' },
    ];
    for (let seed = 1; seed <= 20; seed++) {
      expect(cellKey(chooseAiShot(log, seededRng(seed)).cell)).toBe(cellKey(at(4, 3)));
    }
  });

  it('extends vertically when the trail is vertical', () => {
    const log: ShotLog = [
      { cell: at(3, 2), outcome: 'hit' },
      { cell: at(4, 2), outcome: 'hit' },
    ];
    for (let seed = 1; seed <= 20; seed++) {
      const { cell } = chooseAiShot(log, seededRng(seed));
      expect([cellKey(at(2, 2)), cellKey(at(5, 2))]).toContain(cellKey(cell));
    }
  });

  it('goes back to hunting as soon as the chased ship sinks', () => {
    const log: ShotLog = [
      { cell: at(4, 4), outcome: 'hit' },
      {
        cell: at(4, 5),
        outcome: 'sunk',
        sunkShipId: 'red-force',
        sunkCells: [at(4, 4), at(4, 5)],
      },
    ];
    expect(chooseAiShot(log, seededRng(11)).phase).toBe('hunt');
  });

  it('picks an older trail back up when the recent one runs out of options', () => {
    // (0,0) hit and surrounded by water except for the old trail at (7,7).
    const log: ShotLog = [
      { cell: at(7, 7), outcome: 'hit' },
      { cell: at(0, 0), outcome: 'hit' },
      { cell: at(1, 0), outcome: 'miss' },
      { cell: at(0, 1), outcome: 'miss' },
    ];
    const { cell, phase } = chooseAiShot(log, seededRng(4));
    expect(phase).toBe('target');
    expect([cellKey(at(6, 7)), cellKey(at(8, 7)), cellKey(at(7, 6)), cellKey(at(7, 8))]).toContain(
      cellKey(cell),
    );
  });
});

describe('full game simulation', () => {
  /** Plays a whole AI game against a random fleet. */
  function playGame(seed: number, strategy: HuntStrategy) {
    const rng = seededRng(seed);
    const fleet = randomFleet(rng);
    let log: ShotLog = [];
    let guard = 0;
    while (!isFleetDestroyed(log)) {
      if (++guard > BOARD_SIZE * BOARD_SIZE) throw new Error('la IA no termina la partida');
      const { cell } = chooseAiShot(log, rng, strategy);
      log = [...log, resolveShot(fleet, log, cell)];
    }
    return log;
  }

  it('always sinks the fleet without repeating a cell (200 games)', () => {
    let total = 0;
    for (let seed = 1; seed <= 200; seed++) {
      const log = playGame(seed, 'random');
      expect(new Set(log.map((s) => cellKey(s.cell))).size).toBe(log.length);
      expect(log.filter((s) => s.outcome !== 'miss')).toHaveLength(TOTAL_SHIP_CELLS);
      total += log.length;
    }
    // With random hunting the average is around 61 shots: an approachable rival.
    const average = total / 200;
    expect(average).toBeGreaterThan(50);
    expect(average).toBeLessThan(75);
  });

  it('parity wins considerably sooner than random hunting', () => {
    expect(averageShots('parity')).toBeLessThan(averageShots('random') - 5);
  });

  it('density is the hardest of the three', () => {
    // The numbers the settings screen quotes: around 61 shots on normal and
    // around 45 on hard. If this drifts, the copy is lying to the player.
    expect(averageShots('density')).toBeLessThan(averageShots('parity'));
    expect(averageShots('density')).toBeLessThan(50);
    expect(averageShots('random')).toBeGreaterThan(55);
  });

  it('density also finishes every game without repeating a cell', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const log = playGame(seed, 'density');
      expect(new Set(log.map((s) => cellKey(s.cell))).size).toBe(log.length);
      expect(log.filter((s) => s.outcome !== 'miss')).toHaveLength(TOTAL_SHIP_CELLS);
    }
  });

  function averageShots(strategy: HuntStrategy): number {
    let total = 0;
    for (let seed = 1; seed <= 100; seed++) total += playGame(seed, strategy).length;
    return total / 100;
  }
});

describe('density hunting', () => {
  /** Marks every cell as water except the ones listed. */
  function waterEverywhereBut(spared: Cell[]): ShotLog {
    const keep = new Set(spared.map(cellKey));
    return allCells()
      .filter((cell) => !keep.has(cellKey(cell)))
      .map((cell) => ({ cell, outcome: 'miss' as const }));
  }

  it('ignores a gap too small for any ship still afloat', () => {
    // Two free cells left: a lone one, and a pair. The smallest ship afloat
    // takes two cells, so only the pair can hold anything.
    const lone: Cell = { row: 0, col: 0 };
    const pair: Cell[] = [
      { row: 5, col: 5 },
      { row: 5, col: 6 },
    ];
    const log = waterEverywhereBut([lone, ...pair]);
    for (let seed = 1; seed <= 20; seed++) {
      const { cell, phase } = chooseAiShot(log, seededRng(seed), 'density');
      expect(phase).toBe('hunt');
      expect(cellKey(cell)).not.toBe(cellKey(lone));
    }
  });

  it('opens in the middle, where most ships fit', () => {
    // On an empty board the edges hold fewer placements than the centre.
    for (let seed = 1; seed <= 20; seed++) {
      const { cell } = chooseAiShot([], seededRng(seed), 'density');
      expect(cell.row).toBeGreaterThan(1);
      expect(cell.row).toBeLessThan(BOARD_SIZE - 2);
      expect(cell.col).toBeGreaterThan(1);
      expect(cell.col).toBeLessThan(BOARD_SIZE - 2);
    }
  });
});
