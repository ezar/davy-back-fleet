import {
  hasShotAt,
  isFleetDestroyed,
  isInsideBoard,
  resolveShot,
  validateFleet,
} from './gameLogic';
import { type Rng, defaultRng, randomInt } from './rng';
import type { Cell, Placement, ShotLog, ShotResult } from './types';

/** The two seats in a room: whoever creates it and whoever joins. */
export type Seat = 'host' | 'guest';

/**
 * The house rules of a room, chosen when it is created and fixed for its
 * whole life: both players have to be playing the same game.
 */
export interface RoomRules {
  /** A hit earns another shot. Off, the turn always alternates. */
  extraTurnOnHit: boolean;
  /** Ships may touch, even diagonally. */
  allowAdjacent: boolean;
}

export const DEFAULT_RULES: RoomRules = {
  extraTurnOnHit: true,
  allowAdjacent: false,
};

/**
 * Rules from untrusted input, or from a room stored before rules existed.
 * Anything missing or malformed falls back to the default, so an old room
 * keeps playing exactly as it did.
 */
export function normalizeRules(raw: unknown): RoomRules {
  if (typeof raw !== 'object' || raw === null) return DEFAULT_RULES;
  const value = raw as Partial<Record<keyof RoomRules, unknown>>;
  return {
    extraTurnOnHit:
      typeof value.extraTurnOnHit === 'boolean'
        ? value.extraTurnOnHit
        : DEFAULT_RULES.extraTurnOnHit,
    allowAdjacent:
      typeof value.allowAdjacent === 'boolean' ? value.allowAdjacent : DEFAULT_RULES.allowAdjacent,
  };
}

/**
 * Game phase. Never persisted: it is derived from the players' state, so two
 * devices writing at once can never leave the room half-updated.
 */
export type RoomPhase = 'waiting' | 'placing' | 'battle' | 'finished';

export interface RoomPlayer {
  /** The player's secret token; never sent to the opponent. */
  id: string;
  name: string;
  /** Own fleet. Private: it never appears in the opponent's view. */
  placements: Placement[] | null;
  /** Shots this player has taken, in order. */
  shotsReceived: ShotLog;
  joinedAt: number;
}

export interface RoomMeta {
  code: string;
  createdAt: number;
  updatedAt: number;
  /** Whose turn it is to fire. Only `applyShot` writes it, and turns serialise it. */
  turn: Seat;
  /** Chosen when the room is created. Optional: rooms stored before it existed. */
  rules?: RoomRules;
  /** Games played in this room. Optional: rooms stored before rematches existed. */
  round?: number;
}

export interface Room {
  meta: RoomMeta;
  host: RoomPlayer;
  guest: RoomPlayer | null;
}

/** The rules actually in force, filling in for rooms stored before they existed. */
export function rulesOf(room: Room): RoomRules {
  return normalizeRules(room.meta.rules);
}

/** Which game of the room this is. The first one is 1. */
export function roundOf(room: Room): number {
  const round = room.meta.round;
  return typeof round === 'number' && round >= 1 ? Math.floor(round) : 1;
}

/** The room as one player sees it, already redacted. */
export interface RoomView {
  code: string;
  phase: RoomPhase;
  seat: Seat;
  /** The house rules, so both clients place and read the board the same way. */
  rules: RoomRules;
  /** Bumped by a rematch, so a client can tell a new game from the old one. */
  round: number;
  updatedAt: number;
  yourTurn: boolean;
  you: {
    name: string;
    ready: boolean;
    /** Your own fleet. */
    placements: Placement[] | null;
    /** Shots the opponent has fired at you. */
    incomingShots: ShotLog;
  };
  opponent: {
    name: string | null;
    present: boolean;
    ready: boolean;
    /** Shots you have fired at them, with sinkings already revealed. */
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
  | 'invalid-request'
  | 'multiplayer-unavailable';

/** A room rule violation, with a code that maps to an HTTP status. */
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

/** Alphabet without characters that are confused when read aloud (I, O, 0, 1). */
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateRoomCode(rng: Rng = defaultRng): string {
  let code = '';
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
    code += CODE_ALPHABET[randomInt(rng, CODE_ALPHABET.length)];
  }
  return code;
}

/** Normalises what the player types: upper case, no spaces. */
export function normalizeRoomCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, '');
}

export function isValidRoomCode(raw: string): boolean {
  const code = normalizeRoomCode(raw);
  return (
    code.length === ROOM_CODE_LENGTH && [...code].every((char) => CODE_ALPHABET.includes(char))
  );
}

/** Sanitised name: no control characters, trimmed and length-capped. */
export function sanitizeName(raw: unknown, fallback: string): string {
  if (typeof raw !== 'string') return fallback;
  const clean = raw
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .trim()
    .slice(0, 20);
  return clean.length > 0 ? clean : fallback;
}

export function isReady(player: RoomPlayer | null): player is RoomPlayer {
  return player !== null && player.placements !== null;
}

/** Has this player lost their whole fleet? */
function isDefeated(player: RoomPlayer | null): boolean {
  return player !== null && isFleetDestroyed(player.shotsReceived);
}

/** The defeated seat, if any. The winner is the other one. */
export function loser(room: Room): Seat | null {
  if (isDefeated(room.host)) return 'host';
  if (isDefeated(room.guest)) return 'guest';
  return null;
}

/** Phase derived from the room's current state. */
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
  rules: RoomRules = DEFAULT_RULES,
): Room {
  return {
    meta: { code, createdAt: now, updatedAt: now, turn: 'host', rules, round: 1 },
    host: { id: hostId, name: hostName, placements: null, shotsReceived: [], joinedAt: now },
    guest: null,
  };
}

/** Adds the second player. Fails if the room is already full. */
export function joinRoom(room: Room, guestName: string, guestId: string, now = Date.now()): Room {
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

/** Confirms a player's fleet. It can be rearranged until the battle starts. */
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
  const validation = validateFleet(placements, rulesOf(room).allowAdjacent);
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

/**
 * Starts another game in the same room, keeping the players, their names and
 * the house rules. Whoever lost fires first.
 *
 * Only from `finished`, which is what makes it safe to rewrite both seats at
 * once: nobody is playing. It also stops a stale client from wiping a
 * rematch already under way, because by then the room is back in `placing`
 * and this throws.
 */
export function rematch(room: Room, now = Date.now()): Room {
  if (roomPhase(room) !== 'finished') {
    throw new RoomError('wrong-phase', 'Todavía no ha terminado la partida');
  }
  const beaten = loser(room) ?? 'host';
  const reset = (player: RoomPlayer): RoomPlayer => ({
    ...player,
    placements: null,
    shotsReceived: [],
  });
  return {
    meta: { ...room.meta, updatedAt: now, turn: beaten, round: roundOf(room) + 1 },
    host: reset(room.host),
    guest: room.guest ? reset(room.guest) : null,
  };
}

/** Resolves a shot from `seat` against the opponent's board. */
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

  // A hit earns another turn, unless the room turned that rule off.
  const keepsTurn = rulesOf(room).extraTurnOnHit && result.outcome !== 'miss';
  const next: Room = {
    meta: { ...room.meta, updatedAt: now, turn: keepsTurn ? seat : defenderSeat },
    host: defenderSeat === 'host' ? updated : room.host,
    guest: defenderSeat === 'guest' ? updated : room.guest,
  };
  return { room: next, result };
}

/**
 * Projects the room for one specific player.
 * Never includes the opponent's fleet: only the shots they already know about.
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
    rules: rulesOf(room),
    round: roundOf(room),
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
