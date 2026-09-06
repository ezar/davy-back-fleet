import { MIN_SHIP_SIZE } from './fleet';
import {
  cellKey,
  cellsEqual,
  crossNeighbours,
  isInsideBoard,
  untriedCells,
} from './gameLogic';
import { type Rng, defaultRng, pick } from './rng';
import type { Cell, ShotLog } from './types';

/**
 * Estrategia de la fase de caza:
 * - `random`: disparo aleatorio entre las celdas no probadas (v1 de la spec).
 * - `parity`: aleatorio pero restringido a un patrón de damero. Como el barco
 *   más pequeño ocupa 2 casillas, sigue encontrando toda la flota y necesita
 *   la mitad de disparos. Reservado para el futuro modo "difícil".
 */
export type HuntStrategy = 'random' | 'parity';

export const DEFAULT_HUNT_STRATEGY: HuntStrategy = 'random';

export type AiPhase = 'hunt' | 'target';

/** Qué está haciendo la IA y por qué: útil para la UI y para depurar. */
export interface AiDecision {
  cell: Cell;
  phase: AiPhase;
}

/**
 * Impactos que todavía no pertenecen a ningún barco hundido, es decir,
 * el rastro del barco que la IA está persiguiendo ahora mismo.
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
 * Longitud del tramo contiguo de impactos sin resolver que pasa por `anchor`
 * en una dirección, junto con las dos celdas que lo extienden.
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
 * Candidatos en fase objetivo alrededor del último impacto sin resolver.
 * Si ya hay dos impactos alineados, solo extiende esa dirección;
 * si solo hay uno, prueba las 4 celdas en cruz.
 */
function targetCandidates(log: ShotLog, tried: Set<string>): Cell[] {
  const hits = unresolvedHits(log);
  if (hits.length === 0) return [];

  const hitKeys = new Set(hits.map(cellKey));
  // Del impacto más reciente hacia atrás: perseguimos el rastro más fresco.
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

/** Celdas de caza según la estrategia, con repliegue a cualquier celda libre. */
function huntCandidates(available: Cell[], strategy: HuntStrategy): Cell[] {
  if (strategy === 'parity') {
    const parity = available.filter((cell) => (cell.row + cell.col) % MIN_SHIP_SIZE === 0);
    if (parity.length > 0) return parity;
  }
  return available;
}

/**
 * Elige el siguiente disparo de la IA a partir del historial de sus disparos.
 *
 * Es una función pura: no guarda estado entre turnos, lo deriva del log.
 * Fase objetivo si hay impactos sin hundir, fase caza en caso contrario.
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

/** Coloca la flota de la IA. Reexportado para que el modo solitario tenga una sola puerta de entrada. */
export { randomFleet as randomAiFleet } from './gameLogic';

/** ¿Está `cell` en el log? Pequeño ayudante para la UI del modo solitario. */
export function aiHasShotAt(log: ShotLog, cell: Cell): boolean {
  return log.some((shot) => cellsEqual(shot.cell, cell));
}
