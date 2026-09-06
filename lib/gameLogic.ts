import { FLEET, TOTAL_SHIP_CELLS, getShip } from './fleet';
import { type Rng, defaultRng, pick } from './rng';
import type {
  Cell,
  FleetValidation,
  Orientation,
  Placement,
  ShipId,
  ShotLog,
  ShotResult,
} from './types';

/** Lado del tablero: 10×10 clásico. */
export const BOARD_SIZE = 10;

/**
 * Regla de colocación: `false` = los barcos no pueden tocarse, ni siquiera
 * en diagonal (variante clásica española). Cambiar a `true` permite
 * flotas apiñadas; el resto de la lógica y la IA funcionan igual.
 */
export const ALLOW_ADJACENT_SHIPS = false;

/** Etiquetas de columna: A..J. */
export const COLUMN_LABELS = Array.from({ length: BOARD_SIZE }, (_, i) =>
  String.fromCharCode(65 + i),
);

/** Etiquetas de fila: 1..10. */
export const ROW_LABELS = Array.from({ length: BOARD_SIZE }, (_, i) =>
  String(i + 1),
);

/** "C7" a partir de {row: 6, col: 2}. */
export function cellLabel(cell: Cell): string {
  return `${COLUMN_LABELS[cell.col] ?? '?'}${cell.row + 1}`;
}

/** Clave estable para usar celdas en Set/Map. */
export function cellKey(cell: Cell): string {
  return `${cell.row},${cell.col}`;
}

export function cellsEqual(a: Cell, b: Cell): boolean {
  return a.row === b.row && a.col === b.col;
}

export function isInsideBoard(cell: Cell): boolean {
  return (
    Number.isInteger(cell.row) &&
    Number.isInteger(cell.col) &&
    cell.row >= 0 &&
    cell.row < BOARD_SIZE &&
    cell.col >= 0 &&
    cell.col < BOARD_SIZE
  );
}

/** Todas las celdas del tablero, en orden de lectura. */
export function allCells(): Cell[] {
  const cells: Cell[] = [];
  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) cells.push({ row, col });
  }
  return cells;
}

/** Las 4 celdas en cruz alrededor de una celda, recortadas al tablero. */
export function crossNeighbours(cell: Cell): Cell[] {
  return [
    { row: cell.row - 1, col: cell.col },
    { row: cell.row + 1, col: cell.col },
    { row: cell.row, col: cell.col - 1 },
    { row: cell.row, col: cell.col + 1 },
  ].filter(isInsideBoard);
}

/** Celdas que ocupa un barco colocado. */
export function placementCells(placement: Placement): Cell[] {
  const ship = getShip(placement.shipId);
  const size = ship?.size ?? 0;
  return Array.from({ length: size }, (_, i) =>
    placement.orientation === 'horizontal'
      ? { row: placement.row, col: placement.col + i }
      : { row: placement.row + i, col: placement.col },
  );
}

/** Todas las celdas ocupadas por una flota. */
export function fleetCells(placements: readonly Placement[]): Cell[] {
  return placements.flatMap(placementCells);
}

function isPlacementInsideBoard(placement: Placement): boolean {
  const cells = placementCells(placement);
  return cells.length > 0 && cells.every(isInsideBoard);
}

/** Celdas que un barco bloquea para los demás (las suyas + su halo si no se permite adyacencia). */
function blockedCells(placement: Placement): Cell[] {
  const own = placementCells(placement);
  if (ALLOW_ADJACENT_SHIPS) return own;
  const blocked = new Map<string, Cell>();
  for (const cell of own) {
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const neighbour = { row: cell.row + dr, col: cell.col + dc };
        if (isInsideBoard(neighbour)) blocked.set(cellKey(neighbour), neighbour);
      }
    }
  }
  return [...blocked.values()];
}

/**
 * ¿Cabe `candidate` junto a los barcos ya colocados?
 * Comprueba límites, solape y (según la regla) adyacencia.
 */
export function canPlace(
  existing: readonly Placement[],
  candidate: Placement,
): boolean {
  if (!isPlacementInsideBoard(candidate)) return false;
  const taken = new Set<string>();
  for (const placement of existing) {
    if (placement.shipId === candidate.shipId) continue; // reubicar el mismo barco
    for (const cell of blockedCells(placement)) taken.add(cellKey(cell));
  }
  return placementCells(candidate).every((cell) => !taken.has(cellKey(cell)));
}

/**
 * Valida una flota completa: los 5 barcos, sin repetir, dentro del tablero,
 * sin solapes y respetando la regla de adyacencia.
 */
export function validateFleet(placements: readonly Placement[]): FleetValidation {
  if (placements.length !== FLEET.length) {
    return { ok: false, reason: 'wrong-ship-count' };
  }

  const seen = new Set<ShipId>();
  for (const placement of placements) {
    if (!getShip(placement.shipId)) {
      return { ok: false, reason: 'unknown-ship', shipId: placement.shipId };
    }
    if (seen.has(placement.shipId)) {
      return { ok: false, reason: 'duplicate-ship', shipId: placement.shipId };
    }
    seen.add(placement.shipId);
    if (!isPlacementInsideBoard(placement)) {
      return { ok: false, reason: 'out-of-bounds', shipId: placement.shipId };
    }
  }

  const occupied = new Map<string, ShipId>();
  for (const placement of placements) {
    for (const cell of placementCells(placement)) {
      const key = cellKey(cell);
      if (occupied.has(key)) {
        return { ok: false, reason: 'overlap', shipId: placement.shipId };
      }
      occupied.set(key, placement.shipId);
    }
  }

  if (!ALLOW_ADJACENT_SHIPS) {
    for (const placement of placements) {
      for (const cell of blockedCells(placement)) {
        const owner = occupied.get(cellKey(cell));
        if (owner && owner !== placement.shipId) {
          return { ok: false, reason: 'adjacent', shipId: placement.shipId };
        }
      }
    }
  }

  return { ok: true };
}

/** Todas las posiciones en las que cabe un barco de tamaño `size`. */
function candidatePlacements(shipId: ShipId, size: number): Placement[] {
  const candidates: Placement[] = [];
  const orientations: Orientation[] = ['horizontal', 'vertical'];
  for (const orientation of orientations) {
    const maxRow = orientation === 'vertical' ? BOARD_SIZE - size : BOARD_SIZE - 1;
    const maxCol = orientation === 'horizontal' ? BOARD_SIZE - size : BOARD_SIZE - 1;
    for (let row = 0; row <= maxRow; row++) {
      for (let col = 0; col <= maxCol; col++) {
        candidates.push({ shipId, row, col, orientation });
      }
    }
  }
  return candidates;
}

/**
 * Genera una flota aleatoria válida. Coloca de mayor a menor eligiendo entre
 * las posiciones legales que quedan; si un barco se queda sin hueco, reinicia
 * la flota entera y vuelve a intentarlo.
 */
export function randomFleet(rng: Rng = defaultRng): Placement[] {
  const MAX_ATTEMPTS = 100;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const placements: Placement[] = [];
    let failed = false;
    for (const ship of FLEET) {
      const legal = candidatePlacements(ship.id, ship.size).filter((candidate) =>
        canPlace(placements, candidate),
      );
      if (legal.length === 0) {
        failed = true;
        break;
      }
      placements.push(pick(rng, legal));
    }
    if (!failed) return placements;
  }
  // Inalcanzable con la flota 5-4-3-3-2 en 10×10, pero no fallamos en silencio.
  throw new Error('No se ha podido generar una flota aleatoria válida');
}

/** Reubica un solo barco al azar, dejando el resto de la flota intacto. */
export function randomPlacementFor(
  shipId: ShipId,
  others: readonly Placement[],
  rng: Rng = defaultRng,
): Placement | null {
  const ship = getShip(shipId);
  if (!ship) return null;
  const legal = candidatePlacements(shipId, ship.size).filter((candidate) =>
    canPlace(others, candidate),
  );
  return legal.length > 0 ? pick(rng, legal) : null;
}

/** ¿Ya se ha disparado a esa celda? */
export function hasShotAt(log: ShotLog, cell: Cell): boolean {
  return log.some((shot) => cellsEqual(shot.cell, cell));
}

/** Celdas todavía disponibles para disparar. */
export function untriedCells(log: ShotLog): Cell[] {
  const tried = new Set(log.map((shot) => cellKey(shot.cell)));
  return allCells().filter((cell) => !tried.has(cellKey(cell)));
}

/**
 * Resuelve un disparo contra una flota.
 * Lanza si la celda está fuera del tablero o ya se había disparado:
 * ambas cosas son errores de quien llama, no jugadas válidas.
 */
export function resolveShot(
  placements: readonly Placement[],
  log: ShotLog,
  cell: Cell,
): ShotResult {
  if (!isInsideBoard(cell)) {
    throw new Error(`Celda fuera del tablero: ${JSON.stringify(cell)}`);
  }
  if (hasShotAt(log, cell)) {
    throw new Error(`Celda ya disparada: ${cellLabel(cell)}`);
  }

  const target = placements.find((placement) =>
    placementCells(placement).some((shipCell) => cellsEqual(shipCell, cell)),
  );
  if (!target) return { cell, outcome: 'miss' };

  const hits = new Set(
    log.filter((shot) => shot.outcome !== 'miss').map((shot) => cellKey(shot.cell)),
  );
  hits.add(cellKey(cell));

  const cells = placementCells(target);
  const sunk = cells.every((shipCell) => hits.has(cellKey(shipCell)));
  return sunk
    ? { cell, outcome: 'sunk', sunkShipId: target.shipId, sunkCells: cells }
    : { cell, outcome: 'hit' };
}

/** Ids de los barcos ya hundidos, según el historial. */
export function sunkShipIds(log: ShotLog): ShipId[] {
  return log
    .filter((shot) => shot.outcome === 'sunk' && shot.sunkShipId)
    .map((shot) => shot.sunkShipId as ShipId);
}

/** ¿Está hundida toda la flota? */
export function isFleetDestroyed(log: ShotLog): boolean {
  return sunkShipIds(log).length === FLEET.length;
}

/** Casillas tocadas sobre el total de la flota: para la barra de progreso. */
export function damageReport(log: ShotLog): { hits: number; total: number } {
  return {
    hits: log.filter((shot) => shot.outcome !== 'miss').length,
    total: TOTAL_SHIP_CELLS,
  };
}
