import { cellKey, placementCells } from './gameLogic';
import type { Cell, Placement, ShipId, ShotLog } from './types';

/** Cómo se pinta una celda concreta del tablero. */
export interface CellState {
  /** Resultado del disparo recibido en esa celda, si lo hay. */
  shot?: 'miss' | 'hit' | 'sunk';
  /** Barco propio que ocupa la celda (solo en el tablero propio). */
  shipId?: ShipId;
}

/**
 * Estado de cada celda a partir del historial de disparos.
 * Las celdas de un barco hundido se marcan todas como `sunk`, no solo la última.
 */
export function buildCellStates(
  shots: ShotLog,
  placements?: Placement[] | null,
): Map<string, CellState> {
  const states = new Map<string, CellState>();

  const set = (cell: Cell, patch: CellState) => {
    const key = cellKey(cell);
    states.set(key, { ...states.get(key), ...patch });
  };

  for (const placement of placements ?? []) {
    for (const cell of placementCells(placement)) set(cell, { shipId: placement.shipId });
  }

  for (const shot of shots) {
    set(shot.cell, { shot: shot.outcome === 'sunk' ? 'sunk' : shot.outcome });
    for (const cell of shot.sunkCells ?? []) set(cell, { shot: 'sunk' });
  }

  return states;
}

/**
 * Reconstruye la posición de los barcos hundidos a partir de los disparos.
 * Sirve para dibujar el barco rival en el tablero en cuanto se hunde.
 */
export function sunkPlacements(shots: ShotLog): Placement[] {
  const placements: Placement[] = [];
  for (const shot of shots) {
    if (shot.outcome !== 'sunk' || !shot.sunkShipId || !shot.sunkCells?.length) continue;
    const cells = shot.sunkCells;
    const rows = cells.map((c) => c.row);
    const cols = cells.map((c) => c.col);
    placements.push({
      shipId: shot.sunkShipId,
      row: Math.min(...rows),
      col: Math.min(...cols),
      orientation: new Set(rows).size === 1 ? 'horizontal' : 'vertical',
    });
  }
  return placements;
}
