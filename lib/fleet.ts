import type { ShipId } from './types';

/** Metadata for one ship of the fleet. */
export interface ShipDef {
  id: ShipId;
  /** Ship name, as shown when it is sunk. */
  name: string;
  /** Crew it belongs to. */
  crew: string;
  /** Cells it occupies. */
  size: number;
  /** Short line for the micro-celebration when it sinks. */
  tagline: string;
  /** Colour that identifies the ship on the board and in the fleet lists. */
  color: string;
  /** Short name for the board label: the full one does not fit. */
  short: string;
}

/**
 * The classic Battleship fleet (5-4-3-3-2) with a One Piece theme.
 * Ordered as they are placed by default: largest first.
 */
export const FLEET: readonly ShipDef[] = [
  {
    id: 'thousand-sunny',
    name: 'Thousand Sunny',
    crew: 'Sombrero de Paja',
    size: 5,
    tagline: '¡El león que surca los mares!',
    color: '#f2b134',
    short: 'Sunny',
  },
  {
    id: 'moby-dick',
    name: 'Moby Dick',
    crew: 'Barbablanca',
    size: 4,
    tagline: 'El buque del hombre más fuerte del mundo.',
    color: '#e8f2f8',
    short: 'Moby',
  },
  {
    id: 'going-merry',
    name: 'Going Merry',
    crew: 'Sombrero de Paja (original)',
    size: 3,
    tagline: 'Gracias por traernos hasta aquí.',
    color: '#c9d94f',
    short: 'Merry',
  },
  {
    id: 'oro-jackson',
    name: 'Oro Jackson',
    crew: 'Gol D. Roger',
    size: 3,
    tagline: 'El barco que llegó a Laugh Tale.',
    color: '#d8b45a',
    short: 'Oro',
  },
  {
    id: 'red-force',
    name: 'Red Force',
    crew: 'Shanks',
    size: 2,
    tagline: 'Rápido, rojo y temido en los cuatro mares.',
    color: '#e2542c',
    short: 'Red',
  },
] as const;

const BY_ID = new Map<ShipId, ShipDef>(FLEET.map((s) => [s.id, s]));

/** Returns a ship definition, or `undefined` if the id is unknown. */
export function getShip(id: ShipId): ShipDef | undefined {
  return BY_ID.get(id);
}

/** Total cells occupied by the whole fleet (17). */
export const TOTAL_SHIP_CELLS = FLEET.reduce((n, s) => n + s.size, 0);

/** Size of the smallest ship; the AI uses it for parity hunting. */
export const MIN_SHIP_SIZE = FLEET.reduce((n, s) => Math.min(n, s.size), Number.POSITIVE_INFINITY);
