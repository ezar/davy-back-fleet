import {
  hasShotAt,
  isFleetDestroyed,
  isInsideBoard,
  resolveShot,
  validateFleet,
} from './gameLogic';
import { type Rng, defaultRng, randomInt } from './rng';
import type { Cell, Placement, ShotLog, ShotResult } from './types';

/** Los dos asientos de una sala: quien la crea y quien se une. */
export type Seat = 'host' | 'guest';

/**
 * Fase de la partida. No se persiste: se deriva del estado de los jugadores,
 * así dos dispositivos que escriben a la vez nunca dejan la sala a medias.
 */
export type RoomPhase = 'waiting' | 'placing' | 'battle' | 'finished';

export interface RoomPlayer {
  /** Token secreto del jugador; nunca se envía al rival. */
  id: string;
  name: string;
  /** Flota propia. Privada: jamás sale en la vista del rival. */
  placements: Placement[] | null;
  /** Disparos que ha recibido este jugador, en orden. */
  shotsReceived: ShotLog;
  joinedAt: number;
}

export interface RoomMeta {
  code: string;
  createdAt: number;
  updatedAt: number;
  /** A quién le toca disparar. Solo lo escribe `applyShot`, ya serializado por turnos. */
  turn: Seat;
}

export interface Room {
  meta: RoomMeta;
  host: RoomPlayer;
  guest: RoomPlayer | null;
}

/** Vista de la sala desde la perspectiva de un jugador, ya censurada. */
export interface RoomView {
  code: string;
  phase: RoomPhase;
  seat: Seat;
  updatedAt: number;
  yourTurn: boolean;
  you: {
    name: string;
    ready: boolean;
    /** Tu propia flota. */
    placements: Placement[] | null;
    /** Disparos que te ha hecho el rival. */
    incomingShots: ShotLog;
  };
  opponent: {
    name: string | null;
    present: boolean;
    ready: boolean;
    /** Disparos que tú le has hecho, con los hundimientos ya revelados. */
    outgoingShots: ShotLog;
  };
  outcome: 'won' | 'lost' | null;
}

export type RoomErrorCode =
  | 'room-not-found'
  | 'room-full'
  | 'not-a-player'
  | 'wrong-phase'
  | 'not-your-turn'
  | 'cell-already-shot'
  | 'invalid-cell'
  | 'invalid-fleet'
  | 'invalid-request';

/** Error de reglas de sala, con código traducible a HTTP. */
export class RoomError extends Error {
  constructor(
    readonly code: RoomErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'RoomError';
  }
}

export const ROOM_CODE_LENGTH = 5;

/** Alfabeto sin caracteres que se confunden al dictar el código (I, O, 0, 1). */
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateRoomCode(rng: Rng = defaultRng): string {
  let code = '';
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
    code += CODE_ALPHABET[randomInt(rng, CODE_ALPHABET.length)];
  }
  return code;
}

/** Normaliza lo que teclea el jugador: mayúsculas y sin espacios. */
export function normalizeRoomCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, '');
}

export function isValidRoomCode(raw: string): boolean {
  const code = normalizeRoomCode(raw);
  return (
    code.length === ROOM_CODE_LENGTH &&
    [...code].every((char) => CODE_ALPHABET.includes(char))
  );
}

/** Nombre saneado: sin caracteres de control, recortado y con tope de longitud. */
export function sanitizeName(raw: unknown, fallback: string): string {
  if (typeof raw !== 'string') return fallback;
  const clean = raw.replace(/[\u0000-\u001F\u007F]/g, '').trim().slice(0, 20);
  return clean.length > 0 ? clean : fallback;
}

export function isReady(player: RoomPlayer | null): player is RoomPlayer {
  return player !== null && player.placements !== null;
}

/** ¿Ha perdido este jugador toda su flota? */
function isDefeated(player: RoomPlayer | null): boolean {
  return player !== null && isFleetDestroyed(player.shotsReceived);
}

/** Asiento derrotado, si lo hay. El ganador es el otro. */
export function loser(room: Room): Seat | null {
  if (isDefeated(room.host)) return 'host';
  if (isDefeated(room.guest)) return 'guest';
  return null;
}

/** Fase derivada del estado actual de la sala. */
export function roomPhase(room: Room): RoomPhase {
  if (!room.guest) return 'waiting';
  if (loser(room)) return 'finished';
  if (!isReady(room.host) || !isReady(room.guest)) return 'placing';
  return 'battle';
}

export const otherSeat = (seat: Seat): Seat => (seat === 'host' ? 'guest' : 'host');

export function seatOf(room: Room, playerId: string): Seat | null {
  if (room.host.id === playerId) return 'host';
  if (room.guest?.id === playerId) return 'guest';
  return null;
}

function playerAt(room: Room, seat: Seat): RoomPlayer | null {
  return seat === 'host' ? room.host : room.guest;
}

export function createRoom(
  code: string,
  hostName: string,
  hostId: string,
  now = Date.now(),
): Room {
  return {
    meta: { code, createdAt: now, updatedAt: now, turn: 'host' },
    host: { id: hostId, name: hostName, placements: null, shotsReceived: [], joinedAt: now },
    guest: null,
  };
}

/** Añade al segundo jugador. Falla si la sala ya está llena. */
export function joinRoom(
  room: Room,
  guestName: string,
  guestId: string,
  now = Date.now(),
): Room {
  if (room.guest) throw new RoomError('room-full', 'La sala ya tiene dos jugadores');
  return {
    meta: { ...room.meta, updatedAt: now },
    host: room.host,
    guest: {
      id: guestId,
      name: guestName,
      placements: null,
      shotsReceived: [],
      joinedAt: now,
    },
  };
}

/** Confirma la flota de un jugador. Se puede recolocar mientras no empiece el combate. */
export function applyPlacement(
  room: Room,
  seat: Seat,
  placements: Placement[],
  now = Date.now(),
): Room {
  const phase = roomPhase(room);
  if (phase !== 'placing' && phase !== 'waiting') {
    throw new RoomError('wrong-phase', 'Ya no se puede recolocar la flota');
  }
  const validation = validateFleet(placements);
  if (!validation.ok) {
    throw new RoomError('invalid-fleet', `Flota inválida: ${validation.reason}`);
  }
  const player = playerAt(room, seat);
  if (!player) throw new RoomError('not-a-player', 'Ese asiento está vacío');

  const updated: RoomPlayer = { ...player, placements };
  return {
    meta: { ...room.meta, updatedAt: now },
    host: seat === 'host' ? updated : room.host,
    guest: seat === 'guest' ? updated : room.guest,
  };
}

/** Resuelve un disparo del asiento `seat` contra el tablero rival. */
export function applyShot(
  room: Room,
  seat: Seat,
  cell: Cell,
  now = Date.now(),
): { room: Room; result: ShotResult } {
  if (roomPhase(room) !== 'battle') {
    throw new RoomError('wrong-phase', 'La partida no está en fase de combate');
  }
  if (room.meta.turn !== seat) {
    throw new RoomError('not-your-turn', 'No es tu turno');
  }
  if (!isInsideBoard(cell)) {
    throw new RoomError('invalid-cell', 'Esa celda no existe');
  }

  const defenderSeat = otherSeat(seat);
  const defender = playerAt(room, defenderSeat);
  if (!defender?.placements) {
    throw new RoomError('wrong-phase', 'El rival aún no ha colocado su flota');
  }
  if (hasShotAt(defender.shotsReceived, cell)) {
    throw new RoomError('cell-already-shot', 'Ya has disparado a esa celda');
  }

  const result = resolveShot(defender.placements, defender.shotsReceived, cell);
  const updated: RoomPlayer = {
    ...defender,
    shotsReceived: [...defender.shotsReceived, result],
  };

  // Quien acierta repite turno, como en el juego de mesa clásico.
  const keepsTurn = result.outcome !== 'miss';
  const next: Room = {
    meta: { ...room.meta, updatedAt: now, turn: keepsTurn ? seat : defenderSeat },
    host: defenderSeat === 'host' ? updated : room.host,
    guest: defenderSeat === 'guest' ? updated : room.guest,
  };
  return { room: next, result };
}

/**
 * Proyecta la sala para un jugador concreto.
 * Nunca incluye la flota del rival: solo los disparos que ya conoce.
 */
export function viewRoomFor(room: Room, playerId: string): RoomView {
  const seat = seatOf(room, playerId);
  if (!seat) throw new RoomError('not-a-player', 'No perteneces a esta sala');

  const you = playerAt(room, seat) as RoomPlayer;
  const opponent = playerAt(room, otherSeat(seat));
  const phase = roomPhase(room);
  const defeated = loser(room);

  return {
    code: room.meta.code,
    phase,
    seat,
    updatedAt: room.meta.updatedAt,
    yourTurn: phase === 'battle' && room.meta.turn === seat,
    you: {
      name: you.name,
      ready: isReady(you),
      placements: you.placements,
      incomingShots: you.shotsReceived,
    },
    opponent: {
      name: opponent?.name ?? null,
      present: opponent !== null,
      ready: isReady(opponent),
      outgoingShots: opponent?.shotsReceived ?? [],
    },
    outcome: defeated === null ? null : defeated === seat ? 'lost' : 'won',
  };
}
