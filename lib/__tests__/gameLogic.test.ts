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

/** Flota válida de referencia, separada y dentro del tablero. */
const VALID_FLEET: Placement[] = [
  { shipId: 'thousand-sunny', row: 0, col: 0, orientation: 'horizontal' },
  { shipId: 'moby-dick', row: 2, col: 0, orientation: 'horizontal' },
  { shipId: 'going-merry', row: 4, col: 0, orientation: 'horizontal' },
  { shipId: 'oro-jackson', row: 6, col: 0, orientation: 'horizontal' },
  { shipId: 'red-force', row: 8, col: 0, orientation: 'horizontal' },
];

describe('etiquetas de celda', () => {
  it('usa columna A-J y fila 1-10', () => {
    expect(cellLabel({ row: 0, col: 0 })).toBe('A1');
    expect(cellLabel({ row: 6, col: 2 })).toBe('C7');
    expect(cellLabel({ row: 9, col: 9 })).toBe('J10');
  });
});

describe('placementCells', () => {
  it('extiende horizontalmente desde el ancla', () => {
    expect(placementCells({ shipId: 'red-force', row: 3, col: 4, orientation: 'horizontal' }))
      .toEqual([
        { row: 3, col: 4 },
        { row: 3, col: 5 },
      ]);
  });

  it('extiende verticalmente desde el ancla', () => {
    expect(placementCells({ shipId: 'going-merry', row: 1, col: 1, orientation: 'vertical' }))
      .toEqual([
        { row: 1, col: 1 },
        { row: 2, col: 1 },
        { row: 3, col: 1 },
      ]);
  });

  it('el Thousand Sunny ocupa 5 casillas', () => {
    expect(
      placementCells({ shipId: 'thousand-sunny', row: 0, col: 0, orientation: 'horizontal' }),
    ).toHaveLength(5);
  });
});

describe('validateFleet', () => {
  it('acepta una flota correcta', () => {
    expect(validateFleet(VALID_FLEET)).toEqual({ ok: true });
  });

  it('rechaza una flota incompleta', () => {
    expect(validateFleet(VALID_FLEET.slice(1))).toMatchObject({
      ok: false,
      reason: 'wrong-ship-count',
    });
  });

  it('rechaza barcos duplicados', () => {
    const fleet = [...VALID_FLEET.slice(0, 4), { ...VALID_FLEET[0], row: 8 }];
    expect(validateFleet(fleet)).toMatchObject({ ok: false, reason: 'duplicate-ship' });
  });

  it('rechaza un barco que se sale del tablero', () => {
    const fleet = [...VALID_FLEET];
    fleet[0] = { shipId: 'thousand-sunny', row: 0, col: 6, orientation: 'horizontal' };
    expect(validateFleet(fleet)).toMatchObject({ ok: false, reason: 'out-of-bounds' });
  });

  it('rechaza solapes', () => {
    const fleet = [...VALID_FLEET];
    fleet[1] = { shipId: 'moby-dick', row: 0, col: 2, orientation: 'horizontal' };
    expect(validateFleet(fleet)).toMatchObject({ ok: false, reason: 'overlap' });
  });

  it.runIf(!ALLOW_ADJACENT_SHIPS)('rechaza barcos que se tocan en diagonal', () => {
    const fleet = [...VALID_FLEET];
    fleet[1] = { shipId: 'moby-dick', row: 1, col: 5, orientation: 'horizontal' };
    expect(validateFleet(fleet)).toMatchObject({ ok: false, reason: 'adjacent' });
  });

  it.runIf(!ALLOW_ADJACENT_SHIPS)('rechaza barcos pegados de costado', () => {
    const fleet = [...VALID_FLEET];
    fleet[1] = { shipId: 'moby-dick', row: 1, col: 0, orientation: 'horizontal' };
    expect(validateFleet(fleet)).toMatchObject({ ok: false, reason: 'adjacent' });
  });
});

describe('canPlace', () => {
  it('permite mover un barco sobre su propia posición anterior', () => {
    const moved: Placement = { shipId: 'moby-dick', row: 2, col: 1, orientation: 'horizontal' };
    expect(canPlace(VALID_FLEET, moved)).toBe(true);
  });

  it('rechaza salirse del tablero', () => {
    expect(
      canPlace([], { shipId: 'thousand-sunny', row: 0, col: 7, orientation: 'horizontal' }),
    ).toBe(false);
  });
});

describe('randomFleet', () => {
  it('genera flotas válidas de forma reproducible', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const fleet = randomFleet(seededRng(seed));
      expect(validateFleet(fleet)).toEqual({ ok: true });
      expect(fleet).toHaveLength(FLEET.length);
    }
  });

  it('la misma semilla produce la misma flota', () => {
    expect(randomFleet(seededRng(42))).toEqual(randomFleet(seededRng(42)));
  });

  it('semillas distintas producen flotas distintas', () => {
    expect(randomFleet(seededRng(1))).not.toEqual(randomFleet(seededRng(2)));
  });

  it('ocupa exactamente 17 casillas', () => {
    const cells = randomFleet(seededRng(7)).flatMap(placementCells);
    expect(new Set(cells.map((c) => `${c.row},${c.col}`)).size).toBe(TOTAL_SHIP_CELLS);
  });
});

describe('randomPlacementFor', () => {
  it('reubica un barco respetando al resto de la flota', () => {
    const others = VALID_FLEET.filter((p) => p.shipId !== 'red-force');
    const placement = randomPlacementFor('red-force', others, seededRng(3));
    expect(placement).not.toBeNull();
    expect(validateFleet([...others, placement!])).toEqual({ ok: true });
  });

  it('devuelve null si no queda hueco', () => {
    // Tablero sintético: filas pares cubiertas de lado a lado. Las impares
    // quedan libres pero pegadas a un barco, así que la regla de adyacencia
    // no deja sitio para el Red Force.
    const blocker: Placement[] = [];
    for (let row = 0; row < BOARD_SIZE; row += 2) {
      blocker.push({ shipId: 'thousand-sunny', row, col: 0, orientation: 'horizontal' });
      blocker.push({ shipId: 'thousand-sunny', row, col: 5, orientation: 'horizontal' });
    }
    expect(randomPlacementFor('red-force', blocker, seededRng(1))).toBeNull();
  });
});

describe('resolveShot', () => {
  it('agua cuando no hay barco', () => {
    expect(resolveShot(VALID_FLEET, [], { row: 9, col: 9 })).toEqual({
      cell: { row: 9, col: 9 },
      outcome: 'miss',
    });
  });

  it('tocado en la primera casilla de un barco', () => {
    expect(resolveShot(VALID_FLEET, [], { row: 8, col: 0 })).toEqual({
      cell: { row: 8, col: 0 },
      outcome: 'hit',
    });
  });

  it('hundido al completar el barco, con nombre y casillas', () => {
    const log: ShotLog = [resolveShot(VALID_FLEET, [], { row: 8, col: 0 })];
    const final = resolveShot(VALID_FLEET, log, { row: 8, col: 1 });
    expect(final.outcome).toBe('sunk');
    expect(final.sunkShipId).toBe('red-force');
    expect(final.sunkCells).toEqual([
      { row: 8, col: 0 },
      { row: 8, col: 1 },
    ]);
  });

  it('no marca hundido mientras quede una casilla', () => {
    let log: ShotLog = [];
    for (const col of [0, 1, 2, 3]) {
      const shot = resolveShot(VALID_FLEET, log, { row: 0, col });
      expect(shot.outcome).toBe('hit');
      log = [...log, shot];
    }
    expect(resolveShot(VALID_FLEET, log, { row: 0, col: 4 }).outcome).toBe('sunk');
  });

  it('lanza si se repite celda', () => {
    const log: ShotLog = [resolveShot(VALID_FLEET, [], { row: 9, col: 9 })];
    expect(() => resolveShot(VALID_FLEET, log, { row: 9, col: 9 })).toThrow(/ya disparada/);
  });

  it('lanza si la celda está fuera del tablero', () => {
    expect(() => resolveShot(VALID_FLEET, [], { row: 10, col: 0 })).toThrow(/fuera del tablero/);
    expect(() => resolveShot(VALID_FLEET, [], { row: -1, col: 0 })).toThrow(/fuera del tablero/);
  });
});

describe('fin de partida', () => {
  it('la flota cae exactamente al hundir los 5 barcos', () => {
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

  it('los fallos no cuentan para la victoria', () => {
    const log: ShotLog = [resolveShot(VALID_FLEET, [], { row: 9, col: 9 })];
    expect(isFleetDestroyed(log)).toBe(false);
    expect(hasShotAt(log, { row: 9, col: 9 })).toBe(true);
    expect(untriedCells(log)).toHaveLength(BOARD_SIZE * BOARD_SIZE - 1);
  });
});
