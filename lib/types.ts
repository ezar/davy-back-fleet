/** Tipos compartidos entre cliente, IA y rutas API. */

export type Orientation = 'horizontal' | 'vertical';

export type ShipId =
  | 'thousand-sunny'
  | 'moby-dick'
  | 'going-merry'
  | 'oro-jackson'
  | 'red-force';

/** Celda del tablero en coordenadas 0-indexadas. */
export interface Cell {
  /** Fila 0..9 (se muestra como 1..10). */
  row: number;
  /** Columna 0..9 (se muestra como A..J). */
  col: number;
}

/** Un barco colocado en el tablero: ancla (celda superior-izquierda) + orientación. */
export interface Placement {
  shipId: ShipId;
  row: number;
  col: number;
  orientation: Orientation;
}

export type ShotOutcome = 'miss' | 'hit' | 'sunk';

/** Resultado de un disparo, tal y como lo ve quien dispara. */
export interface ShotResult {
  cell: Cell;
  outcome: ShotOutcome;
  /** Solo presente si `outcome === 'sunk'`. */
  sunkShipId?: ShipId;
  /**
   * Celdas del barco hundido. Se revelan solo al hundirlo, nunca antes:
   * es información que el rival ya puede deducir y la necesita la IA.
   */
  sunkCells?: Cell[];
}

/** Historial de disparos contra un tablero, en orden cronológico. */
export type ShotLog = ShotResult[];

/** Motivo por el que una flota no es válida. */
export type FleetInvalidReason =
  | 'wrong-ship-count'
  | 'duplicate-ship'
  | 'unknown-ship'
  | 'out-of-bounds'
  | 'overlap'
  | 'adjacent';

export type FleetValidation =
  | { ok: true }
  | { ok: false; reason: FleetInvalidReason; shipId?: ShipId };
