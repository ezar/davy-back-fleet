import { cellKey, placementCells } from './gameLogic';
import type { Cell, Placement, ShipId, ShotLog } from './types';

/** How a given board cell should be painted. */
export interface CellState {
  /** Outcome of the shot this cell took, if any. */
  shot?: 'miss' | 'hit' | 'sunk';
  /** Own ship occupying the cell (own board only). */
  shipId?: ShipId;
}

/**
 * Per-cell state derived from the shot log.
 * Every cell of a sunk ship is marked `sunk`, not just the final one.
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
 * Rebuilds the position of sunk ships from the shot log.
 * Lets the enemy ship be drawn on the board the moment it goes down.
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
