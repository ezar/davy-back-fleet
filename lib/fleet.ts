import type { ShipId } from './types';

/** Metadatos de un barco de la flota. */
export interface ShipDef {
  id: ShipId;
  /** Nombre del barco, tal y como se muestra al hundirlo. */
  name: string;
  /** Tripulación a la que pertenece. */
  crew: string;
  /** Casillas que ocupa. */
  size: number;
  /** Frase corta para la micro-celebración al hundirlo. */
  tagline: string;
  /** Color con el que se identifica el barco en el tablero y en las listas. */
  color: string;
  /** Nombre corto, para el rótulo sobre el tablero: el completo no cabe. */
  short: string;
}

/**
 * Flota clásica de Hundir la Flota (5-4-3-3-2) con temática One Piece.
 * El orden es el de colocación por defecto: de mayor a menor.
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

/** Devuelve la definición de un barco, o `undefined` si el id no existe. */
export function getShip(id: ShipId): ShipDef | undefined {
  return BY_ID.get(id);
}

/** Número total de casillas ocupadas por la flota completa (17). */
export const TOTAL_SHIP_CELLS = FLEET.reduce((n, s) => n + s.size, 0);

/** Tamaño del barco más pequeño; lo usa la IA para la caza por paridad. */
export const MIN_SHIP_SIZE = FLEET.reduce(
  (n, s) => Math.min(n, s.size),
  Number.POSITIVE_INFINITY,
);
