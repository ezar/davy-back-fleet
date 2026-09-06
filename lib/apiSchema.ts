import { BOARD_SIZE } from './gameLogic';
import { RoomError, isValidRoomCode, normalizeRoomCode } from './room';
import type { Cell, Orientation, Placement, ShipId } from './types';

/**
 * Validación de todo lo que llega del cliente. Las rutas API son públicas:
 * nada de lo que entra aquí se considera de fiar.
 */

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new RoomError('invalid-request', 'El cuerpo de la petición no es válido');
  }
  return value as Record<string, unknown>;
}

export async function readJsonBody(request: Request): Promise<Record<string, unknown>> {
  try {
    return asRecord(await request.json());
  } catch (error) {
    if (error instanceof RoomError) throw error;
    throw new RoomError('invalid-request', 'El cuerpo de la petición no es JSON válido');
  }
}

export function requireRoomCode(raw: unknown): string {
  if (typeof raw !== 'string' || !isValidRoomCode(raw)) {
    throw new RoomError('invalid-request', 'Código de sala no válido');
  }
  return normalizeRoomCode(raw);
}

export function requirePlayerId(raw: unknown): string {
  if (typeof raw !== 'string' || raw.length < 8 || raw.length > 100) {
    throw new RoomError('invalid-request', 'Identificador de jugador no válido');
  }
  return raw;
}

export function requireCell(raw: unknown): Cell {
  const cell = asRecord(raw);
  const row = cell.row;
  const col = cell.col;
  if (
    typeof row !== 'number' ||
    typeof col !== 'number' ||
    !Number.isInteger(row) ||
    !Number.isInteger(col) ||
    row < 0 ||
    col < 0 ||
    row >= BOARD_SIZE ||
    col >= BOARD_SIZE
  ) {
    throw new RoomError('invalid-cell', 'Esa celda no existe');
  }
  return { row, col };
}

const ORIENTATIONS: Orientation[] = ['horizontal', 'vertical'];

/**
 * Convierte la flota recibida en `Placement[]` bien tipado.
 * Las reglas del juego (solape, adyacencia, barcos completos) las comprueba
 * después `validateFleet`; aquí solo se garantiza la forma.
 */
export function requirePlacements(raw: unknown): Placement[] {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > 10) {
    throw new RoomError('invalid-fleet', 'La flota recibida no es válida');
  }
  return raw.map((entry) => {
    const placement = asRecord(entry);
    const { shipId, row, col, orientation } = placement;
    if (
      typeof shipId !== 'string' ||
      typeof orientation !== 'string' ||
      !ORIENTATIONS.includes(orientation as Orientation)
    ) {
      throw new RoomError('invalid-fleet', 'La flota recibida no es válida');
    }
    const cell = requireCell({ row, col });
    return {
      shipId: shipId as ShipId,
      row: cell.row,
      col: cell.col,
      orientation: orientation as Orientation,
    };
  });
}
