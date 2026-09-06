import { FLEET, MIN_SHIP_SIZE } from './fleet';
import {
  BOARD_SIZE,
  cellKey,
  cellsEqual,
  crossNeighbours,
  isInsideBoard,
  sunkShipIds,
  untriedCells,
} from './gameLogic';
import { type Rng, defaultRng, pick } from './rng';
import type { Cell, ShotLog } from './types';

/**
 * Hunting-phase strategy:
 * - `random`: a random shot among the untried cells (the spec's v1).
 * - `parity`: still random, but restricted to a checkerboard. Since the
 *   smallest ship covers 2 cells, no ship can hide between the squares.
 * - `density`: shoots wherever the ships still afloat could fit in most
 *   ways. Subsumes parity (a checkerboard falls out of the counting) and
 *   also steers away from corners and from water already ruled out.
 *
 * Measured over 400 seeded games: random 61 shots, parity 53, density 45.
 */
export type HuntStrategy = 'random' | 'parity' | 'density';

export const DEFAULT_HUNT_STRATEGY: HuntStrategy = 'random';

export type AiPhase = 'hunt' | 'target';

/** What the AI is doing and why: handy for the UI and for debugging. */
export interface AiDecision {
  cell: Cell;
  phase: AiPhase;
}

/**
 * Hits that do not belong to any sunk ship yet, i.e. the trail of the ship
 * the AI is currently chasing.
 */
export function unresolvedHits(log: ShotLog): Cell[] {
  const resolved = new Set<string>();
  for (const shot of log) {
    for (const cell of shot.sunkCells ?? []) resolved.add(cellKey(cell));
  }
  return log
    .filter((shot) => shot.outcome !== 'miss' && !resolved.has(cellKey(shot.cell)))
    .map((shot) => shot.cell);
}

/**
 * Length of the contiguous run of unresolved hits through `anchor` along one
 * direction, plus the two cells that would extend it.
 */
function runExtensions(
  anchor: Cell,
  hits: Set<string>,
  step: { row: number; col: number },
): { length: number; ends: Cell[] } {
  const ends: Cell[] = [];
  let length = 1;
  for (const sign of [1, -1]) {
    let cursor = {
      row: anchor.row + step.row * sign,
      col: anchor.col + step.col * sign,
    };
    while (isInsideBoard(cursor) && hits.has(cellKey(cursor))) {
      length++;
      cursor = { row: cursor.row + step.row * sign, col: cursor.col + step.col * sign };
    }
    if (isInsideBoard(cursor)) ends.push(cursor);
  }
  return { length, ends };
}

/**
 * Target-phase candidates around the latest unresolved hit.
 * With two hits already aligned it only extends that direction; with a
 * single hit it tries the 4 orthogonal cells.
 */
function targetCandidates(log: ShotLog, tried: Set<string>): Cell[] {
  const hits = unresolvedHits(log);
  if (hits.length === 0) return [];

  const hitKeys = new Set(hits.map(cellKey));
  // Newest hit backwards: chase the freshest trail first.
  for (let i = hits.length - 1; i >= 0; i--) {
    const anchor = hits[i];
    const horizontal = runExtensions(anchor, hitKeys, { row: 0, col: 1 });
    const vertical = runExtensions(anchor, hitKeys, { row: 1, col: 0 });

    const aligned = [
      ...(horizontal.length > 1 ? horizontal.ends : []),
      ...(vertical.length > 1 ? vertical.ends : []),
    ].filter((cell) => !tried.has(cellKey(cell)));
    if (aligned.length > 0) return aligned;

    if (horizontal.length === 1 && vertical.length === 1) {
      const cross = crossNeighbours(anchor).filter((cell) => !tried.has(cellKey(cell)));
      if (cross.length > 0) return cross;
    }
  }
  return [];
}

/** Sizes of the ships still afloat, according to the log. */
function afloatSizes(log: ShotLog): number[] {
  const sunk = new Set(sunkShipIds(log));
  return FLEET.filter((ship) => !sunk.has(ship.id)).map((ship) => ship.size);
}

/**
 * For every untried cell, how many ways the ships still afloat could sit on
 * top of it. A placement counts only if it avoids every cell already ruled
 * out: water, and the cells of ships already sunk.
 *
 * This is the classic probability-density heuristic. It beats a checkerboard
 * because it also knows that a corner is a poor guess and that a strip of
 * water three cells wide can no longer hold the four-cell ship.
 */
function densityCandidates(log: ShotLog, tried: Set<string>, available: Cell[]): Cell[] {
  const sunkCells = new Set<string>();
  for (const shot of log) {
    for (const cell of shot.sunkCells ?? []) sunkCells.add(cellKey(cell));
  }
  // A cell is usable by a hypothetical ship unless it is known water or
  // known wreck. Untried cells and unresolved hits both stay usable.
  const unusable = new Set<string>(sunkCells);
  for (const shot of log) {
    if (shot.outcome === 'miss') unusable.add(cellKey(shot.cell));
  }

  const score = new Map<string, number>();
  for (const size of afloatSizes(log)) {
    for (let row = 0; row < BOARD_SIZE; row++) {
      for (let col = 0; col < BOARD_SIZE; col++) {
        for (const horizontal of [true, false]) {
          const cells: Cell[] = [];
          for (let i = 0; i < size; i++) {
            cells.push(horizontal ? { row, col: col + i } : { row: row + i, col });
          }
          if (!cells.every((cell) => isInsideBoard(cell) && !unusable.has(cellKey(cell)))) {
            continue;
          }
          for (const cell of cells) {
            const key = cellKey(cell);
            if (!tried.has(key)) score.set(key, (score.get(key) ?? 0) + 1);
          }
        }
      }
    }
  }

  let best = 0;
  const bestCells: Cell[] = [];
  for (const cell of available) {
    const value = score.get(cellKey(cell)) ?? 0;
    if (value > best) {
      best = value;
      bestCells.length = 0;
    }
    if (value === best) bestCells.push(cell);
  }
  // Everything scored zero only if no ship fits anywhere, which cannot
  // happen while one is afloat; falling back keeps the AI from stalling.
  return best > 0 ? bestCells : available;
}

/** Hunting cells for the strategy, falling back to any free cell. */
function huntCandidates(
  log: ShotLog,
  tried: Set<string>,
  available: Cell[],
  strategy: HuntStrategy,
): Cell[] {
  if (strategy === 'density') return densityCandidates(log, tried, available);
  if (strategy === 'parity') {
    const parity = available.filter((cell) => (cell.row + cell.col) % MIN_SHIP_SIZE === 0);
    if (parity.length > 0) return parity;
  }
  return available;
}

/**
 * Picks the AI's next shot from its own shot log.
 *
 * A pure function: it keeps no state between turns, it derives it from the
 * log. Target phase while hits are unsunk, hunting phase otherwise.
 */
export function chooseAiShot(
  log: ShotLog,
  rng: Rng = defaultRng,
  strategy: HuntStrategy = DEFAULT_HUNT_STRATEGY,
): AiDecision {
  const available = untriedCells(log);
  if (available.length === 0) {
    throw new Error('La IA no tiene celdas disponibles a las que disparar');
  }
  const tried = new Set(log.map((shot) => cellKey(shot.cell)));

  const targets = targetCandidates(log, tried);
  if (targets.length > 0) return { cell: pick(rng, targets), phase: 'target' };

  return { cell: pick(rng, huntCandidates(log, tried, available, strategy)), phase: 'hunt' };
}

/** Places the AI fleet. Re-exported so solo mode has a single entry point. */
export { randomFleet as randomAiFleet } from './gameLogic';

/** Is `cell` in the log? Small helper for the solo-mode UI. */
export function aiHasShotAt(log: ShotLog, cell: Cell): boolean {
  return log.some((shot) => cellsEqual(shot.cell, cell));
}
