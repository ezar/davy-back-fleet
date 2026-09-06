/** Types shared between the client, the AI and the API routes. */

export type Orientation = 'horizontal' | 'vertical';

export type ShipId = 'thousand-sunny' | 'moby-dick' | 'going-merry' | 'oro-jackson' | 'red-force';

/** A board cell in zero-based coordinates. */
export interface Cell {
  /** Row 0..9 (shown as 1..10). */
  row: number;
  /** Column 0..9 (shown as A..J). */
  col: number;
}

/** A ship on the board: anchor (top-left cell) plus orientation. */
export interface Placement {
  shipId: ShipId;
  row: number;
  col: number;
  orientation: Orientation;
}

export type ShotOutcome = 'miss' | 'hit' | 'sunk';

/** The result of a shot, as seen by whoever fired it. */
export interface ShotResult {
  cell: Cell;
  outcome: ShotOutcome;
  /** Only present when `outcome === 'sunk'`. */
  sunkShipId?: ShipId;
  /**
   * Cells of the sunk ship. Revealed only once it goes down, never before:
   * the opponent can already deduce them, and the AI needs them.
   */
  sunkCells?: Cell[];
}

/** Shots fired at one board, in chronological order. */
export type ShotLog = ShotResult[];

/** Why a fleet layout is not valid. */
export type FleetInvalidReason =
  'wrong-ship-count' | 'duplicate-ship' | 'unknown-ship' | 'out-of-bounds' | 'overlap' | 'adjacent';

export type FleetValidation =
  { ok: true } | { ok: false; reason: FleetInvalidReason; shipId?: ShipId };
