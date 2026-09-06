import { describe, expect, it } from 'vitest';
import { FLEET, TOTAL_SHIP_CELLS } from '../fleet';
import {
  ALLOW_ADJACENT_SHIPS,
  BOARD_SIZE,
  canPlace,
  cellLabel,
  hasShotAt,
  isFleetDestroyed,
  placementCells,
  randomFleet,
  randomPlacementFor,
  resolveShot,
  untriedCells,
  validateFleet,
} from '../gameLogic';
import { seededRng } from '../rng';
import type { Placement, ShotLog } from '../types';

/** Reference valid fleet, spaced out and inside the board. */
const VALID_FLEET: Placement[] = [
  { shipId: 'thousand-sunny', row: 0, col: 0, orientation: 'horizontal' },
  { shipId: 'moby-dick', row: 2, col: 0, orientation: 'horizontal' },
  { shipId: 'going-merry', row: 4, col: 0, orientation: 'horizontal' },
  { shipId: 'oro-jackson', row: 6, col: 0, orientation: 'horizontal' },
  { shipId: 'red-force', row: 8, col: 0, orientation: 'horizontal' },
];

describe('cell labels', () => {
  it('uses column A-J and row 1-10', () => {
    expect(cellLabel({ row: 0, col: 0 })).toBe('A1');
    expect(cellLabel({ row: 6, col: 2 })).toBe('C7');
    expect(cellLabel({ row: 9, col: 9 })).toBe('J10');
  });
});

describe('placementCells', () => {
  it('extends horizontally from the anchor', () => {
    expect(
      placementCells({ shipId: 'red-force', row: 3, col: 4, orientation: 'horizontal' }),
    ).toEqual([
      { row: 3, col: 4 },
      { row: 3, col: 5 },
    ]);
  });

  it('extends vertically from the anchor', () => {
    expect(
      placementCells({ shipId: 'going-merry', row: 1, col: 1, orientation: 'vertical' }),
    ).toEqual([
      { row: 1, col: 1 },
      { row: 2, col: 1 },
      { row: 3, col: 1 },
    ]);
  });

  it('the Thousand Sunny covers 5 cells', () => {
    expect(
      placementCells({ shipId: 'thousand-sunny', row: 0, col: 0, orientation: 'horizontal' }),
    ).toHaveLength(5);
  });
});

describe('validateFleet', () => {
  it('accepts a valid fleet', () => {
    expect(validateFleet(VALID_FLEET)).toEqual({ ok: true });
  });

  it('rejects an incomplete fleet', () => {
    expect(validateFleet(VALID_FLEET.slice(1))).toMatchObject({
      ok: false,
      reason: 'wrong-ship-count',
    });
  });

  it('rejects duplicate ships', () => {
    const fleet = [...VALID_FLEET.slice(0, 4), { ...VALID_FLEET[0], row: 8 }];
    expect(validateFleet(fleet)).toMatchObject({ ok: false, reason: 'duplicate-ship' });
  });

  it('rejects a ship that runs off the board', () => {
    const fleet = [...VALID_FLEET];
    fleet[0] = { shipId: 'thousand-sunny', row: 0, col: 6, orientation: 'horizontal' };
    expect(validateFleet(fleet)).toMatchObject({ ok: false, reason: 'out-of-bounds' });
  });

  it('rejects overlaps', () => {
    const fleet = [...VALID_FLEET];
    fleet[1] = { shipId: 'moby-dick', row: 0, col: 2, orientation: 'horizontal' };
    expect(validateFleet(fleet)).toMatchObject({ ok: false, reason: 'overlap' });
  });

  it.runIf(!ALLOW_ADJACENT_SHIPS)('rejects ships touching diagonally', () => {
    const fleet = [...VALID_FLEET];
    fleet[1] = { shipId: 'moby-dick', row: 1, col: 5, orientation: 'horizontal' };
    expect(validateFleet(fleet)).toMatchObject({ ok: false, reason: 'adjacent' });
  });

  it.runIf(!ALLOW_ADJACENT_SHIPS)('rejects ships touching side by side', () => {
    const fleet = [...VALID_FLEET];
    fleet[1] = { shipId: 'moby-dick', row: 1, col: 0, orientation: 'horizontal' };
    expect(validateFleet(fleet)).toMatchObject({ ok: false, reason: 'adjacent' });
  });
});

describe('canPlace', () => {
  it('allows moving a ship onto its own previous position', () => {
    const moved: Placement = { shipId: 'moby-dick', row: 2, col: 1, orientation: 'horizontal' };
    expect(canPlace(VALID_FLEET, moved)).toBe(true);
  });

  it('rejects going off the board', () => {
    expect(
      canPlace([], { shipId: 'thousand-sunny', row: 0, col: 7, orientation: 'horizontal' }),
    ).toBe(false);
  });
});

describe('randomFleet', () => {
  it('generates valid fleets reproducibly', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const fleet = randomFleet(seededRng(seed));
      expect(validateFleet(fleet)).toEqual({ ok: true });
      expect(fleet).toHaveLength(FLEET.length);
    }
  });

  it('the same seed produces the same fleet', () => {
    expect(randomFleet(seededRng(42))).toEqual(randomFleet(seededRng(42)));
  });

  it('different seeds produce different fleets', () => {
    expect(randomFleet(seededRng(1))).not.toEqual(randomFleet(seededRng(2)));
  });

  it('covers exactly 17 cells', () => {
    const cells = randomFleet(seededRng(7)).flatMap(placementCells);
    expect(new Set(cells.map((c) => `${c.row},${c.col}`)).size).toBe(TOTAL_SHIP_CELLS);
  });
});

describe('randomPlacementFor', () => {
  it('re-places a ship respecting the rest of the fleet', () => {
    const others = VALID_FLEET.filter((p) => p.shipId !== 'red-force');
    const placement = randomPlacementFor('red-force', others, seededRng(3));
    expect(placement).not.toBeNull();
    expect(validateFleet([...others, placement!])).toEqual({ ok: true });
  });

  it('returns null when there is no room left', () => {
    // Synthetic board: even rows covered end to end. The odd ones are free
    // but flush against a ship, so the adjacency rule leaves no room for the
    // Red Force.
    const blocker: Placement[] = [];
    for (let row = 0; row < BOARD_SIZE; row += 2) {
      blocker.push({ shipId: 'thousand-sunny', row, col: 0, orientation: 'horizontal' });
      blocker.push({ shipId: 'thousand-sunny', row, col: 5, orientation: 'horizontal' });
    }
    expect(randomPlacementFor('red-force', blocker, seededRng(1))).toBeNull();
  });
});

describe('resolveShot', () => {
  it('water when there is no ship', () => {
    expect(resolveShot(VALID_FLEET, [], { row: 9, col: 9 })).toEqual({
      cell: { row: 9, col: 9 },
      outcome: 'miss',
    });
  });

  it('hit on the first cell of a ship', () => {
    expect(resolveShot(VALID_FLEET, [], { row: 8, col: 0 })).toEqual({
      cell: { row: 8, col: 0 },
      outcome: 'hit',
    });
  });

  it('sunk once the ship is completed, with name and cells', () => {
    const log: ShotLog = [resolveShot(VALID_FLEET, [], { row: 8, col: 0 })];
    const final = resolveShot(VALID_FLEET, log, { row: 8, col: 1 });
    expect(final.outcome).toBe('sunk');
    expect(final.sunkShipId).toBe('red-force');
    expect(final.sunkCells).toEqual([
      { row: 8, col: 0 },
      { row: 8, col: 1 },
    ]);
  });

  it('does not mark sunk while one cell remains', () => {
    let log: ShotLog = [];
    for (const col of [0, 1, 2, 3]) {
      const shot = resolveShot(VALID_FLEET, log, { row: 0, col });
      expect(shot.outcome).toBe('hit');
      log = [...log, shot];
    }
    expect(resolveShot(VALID_FLEET, log, { row: 0, col: 4 }).outcome).toBe('sunk');
  });

  it('throws when a cell is repeated', () => {
    const log: ShotLog = [resolveShot(VALID_FLEET, [], { row: 9, col: 9 })];
    expect(() => resolveShot(VALID_FLEET, log, { row: 9, col: 9 })).toThrow(/ya disparada/);
  });

  it('throws when the cell is off the board', () => {
    expect(() => resolveShot(VALID_FLEET, [], { row: 10, col: 0 })).toThrow(/fuera del tablero/);
    expect(() => resolveShot(VALID_FLEET, [], { row: -1, col: 0 })).toThrow(/fuera del tablero/);
  });
});

describe('end of game', () => {
  it('the fleet falls exactly when the 5 ships are sunk', () => {
    let log: ShotLog = [];
    for (const placement of VALID_FLEET) {
      for (const cell of placementCells(placement)) {
        expect(isFleetDestroyed(log)).toBe(false);
        log = [...log, resolveShot(VALID_FLEET, log, cell)];
      }
    }
    expect(isFleetDestroyed(log)).toBe(true);
    expect(log).toHaveLength(TOTAL_SHIP_CELLS);
  });

  it('misses do not count towards victory', () => {
    const log: ShotLog = [resolveShot(VALID_FLEET, [], { row: 9, col: 9 })];
    expect(isFleetDestroyed(log)).toBe(false);
    expect(hasShotAt(log, { row: 9, col: 9 })).toBe(true);
    expect(untriedCells(log)).toHaveLength(BOARD_SIZE * BOARD_SIZE - 1);
  });
});
