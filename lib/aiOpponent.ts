import { MIN_SHIP_SIZE } from './fleet';
import { cellKey, cellsEqual, crossNeighbours, isInsideBoard, untriedCells } from './gameLogic';
import { type Rng, defaultRng, pick } from './rng';
import type { Cell, ShotLog } from './types';

/**
 * Hunting-phase strategy:
 * - `random`: a random shot among the untried cells (the spec's v1).
 * - `parity`: still random, but restricted to a checkerboard. Since the
 *   smallest ship covers 2 cells it still finds the whole fleet, in half
 *   the shots. Kept for the future "hard" mode.
 */
export type HuntStrategy = 'random' | 'parity';

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

/** Hunting cells for the strategy, falling back to any free cell. */
function huntCandidates(available: Cell[], strategy: HuntStrategy): Cell[] {
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

  return { cell: pick(rng, huntCandidates(available, strategy)), phase: 'hunt' };
}

/** Places the AI fleet. Re-exported so solo mode has a single entry point. */
export { randomFleet as randomAiFleet } from './gameLogic';

/** Is `cell` in the log? Small helper for the solo-mode UI. */
export function aiHasShotAt(log: ShotLog, cell: Cell): boolean {
  return log.some((shot) => cellsEqual(shot.cell, cell));
}
