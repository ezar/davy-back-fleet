import { Redis } from '@upstash/redis';
import {
  type Room,
  type RoomMeta,
  type RoomPlayer,
  RoomError,
  type Seat,
  generateRoomCode,
} from './room';

/**
 * Room persistence on Upstash Redis.
 *
 * Each room is a hash with three fields: `meta`, `host` and `guest`. Storing
 * one field per player avoids the classic read-modify-write race between the
 * two devices: each writes only its own, and firing (which touches `meta`)
 * is already serialised by the turn.
 */

/** Rooms expire 6 hours after the last move. */
const ROOM_TTL_SECONDS = 6 * 60 * 60;

const keyFor = (code: string) => `dbf:room:${code}`;

/** A hash field can come back as an object (Upstash deserialises) or as text. */
function parseField<T>(value: unknown): T | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as T;
    } catch {
      return null;
    }
  }
  return value as T;
}

export interface RoomStore {
  /** Claims a free code and stores the room. */
  create(room: Room): Promise<boolean>;
  read(code: string): Promise<Room | null>;
  /** Stores a seat only if it was empty. Returns false if someone was there. */
  claimSeat(code: string, seat: Seat, player: RoomPlayer, meta: RoomMeta): Promise<boolean>;
  /** Overwrites a seat (and optionally the meta) that is already yours. */
  writeSeat(code: string, seat: Seat, player: RoomPlayer, meta: RoomMeta): Promise<void>;
  /** Checks that the store answers. Throws if it does not. */
  ping(): Promise<void>;
}

/** Upstash Redis implementation (production and Vercel previews). */
class RedisRoomStore implements RoomStore {
  constructor(private readonly redis: Redis) {}

  async ping(): Promise<void> {
    await this.redis.ping();
  }

  async create(room: Room): Promise<boolean> {
    const key = keyFor(room.meta.code);
    const claimed = await this.redis.hsetnx(key, 'meta', room.meta as unknown as object);
    if (!claimed) return false;
    await this.redis.hset(key, { host: room.host as unknown as object });
    await this.redis.expire(key, ROOM_TTL_SECONDS);
    return true;
  }

  async read(code: string): Promise<Room | null> {
    const raw = await this.redis.hgetall<Record<string, unknown>>(keyFor(code));
    if (!raw) return null;
    const meta = parseField<RoomMeta>(raw.meta);
    const host = parseField<RoomPlayer>(raw.host);
    if (!meta || !host) return null;
    return { meta, host, guest: parseField<RoomPlayer>(raw.guest) };
  }

  async claimSeat(code: string, seat: Seat, player: RoomPlayer, meta: RoomMeta): Promise<boolean> {
    const key = keyFor(code);
    const claimed = await this.redis.hsetnx(key, seat, player as unknown as object);
    if (!claimed) return false;
    await this.redis.hset(key, { meta: meta as unknown as object });
    await this.redis.expire(key, ROOM_TTL_SECONDS);
    return true;
  }

  async writeSeat(code: string, seat: Seat, player: RoomPlayer, meta: RoomMeta): Promise<void> {
    const key = keyFor(code);
    await this.redis.hset(key, {
      [seat]: player as unknown as object,
      meta: meta as unknown as object,
    });
    await this.redis.expire(key, ROOM_TTL_SECONDS);
  }
}

/**
 * In development Next instantiates modules per route, so a module-level `Map`
 * would be duplicated and every endpoint would see different rooms. Hanging it
 * off `globalThis` keeps a single copy for all routes.
 */
function memoryRooms(): Map<string, Room> {
  const globals = globalThis as typeof globalThis & { __dbfRooms?: Map<string, Room> };
  globals.__dbfRooms ??= new Map<string, Room>();
  return globals.__dbfRooms;
}

/**
 * In-memory fallback for local development without Upstash credentials.
 * It does not survive across serverless invocations: never use it in production.
 */
class MemoryRoomStore implements RoomStore {
  private readonly rooms = memoryRooms();

  async ping(): Promise<void> {
    /* Always available: it lives in this process. */
  }

  async create(room: Room): Promise<boolean> {
    if (this.rooms.has(room.meta.code)) return false;
    this.rooms.set(room.meta.code, room);
    return true;
  }

  async read(code: string): Promise<Room | null> {
    const room = this.rooms.get(code);
    return room ? structuredClone(room) : null;
  }

  async claimSeat(code: string, seat: Seat, player: RoomPlayer, meta: RoomMeta) {
    const room = this.rooms.get(code);
    if (!room) return false;
    if (seat === 'guest' && room.guest) return false;
    this.rooms.set(code, { ...room, meta, [seat]: player } as Room);
    return true;
  }

  async writeSeat(code: string, seat: Seat, player: RoomPlayer, meta: RoomMeta) {
    const room = this.rooms.get(code);
    if (!room) return;
    this.rooms.set(code, { ...room, meta, [seat]: player } as Room);
  }
}

/**
 * Accepts both the Vercel Marketplace Upstash names (`KV_REST_API_*`) and
 * Upstash's own (`UPSTASH_REDIS_REST_*`).
 */
function readCredentials(): { url: string; token: string } | null {
  const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? { url, token } : null;
}

let store: RoomStore | null = null;

export function getRoomStore(): RoomStore {
  if (store) return store;
  const credentials = readCredentials();
  if (credentials) {
    store = new RedisRoomStore(
      new Redis({
        ...credentials,
        // One retry and little more: if Redis is down, a fast error beats a
        // function hanging until Vercel cuts it off.
        retry: { retries: 1, backoff: () => 250 },
      }),
    );
  } else {
    if (process.env.NODE_ENV === 'production') {
      // A typed error: the client gets a 503 with a message that makes sense,
      // instead of a generic 500 that says nothing about what is missing.
      throw new RoomError(
        'multiplayer-unavailable',
        'Este despliegue no tiene Redis configurado, así que el multijugador está apagado. El modo contra la IA sí funciona.',
      );
    }
    console.warn(
      '[davy-back-fleet] Sin credenciales de Upstash: usando salas en memoria (solo desarrollo).',
    );
    store = new MemoryRoomStore();
  }
  return store;
}

/** The player's secret identifier. */
export function newPlayerId(): string {
  return crypto.randomUUID();
}

/** Finds a free room code. */
export async function reserveRoomCode(
  store: RoomStore,
  build: (code: string) => Room,
): Promise<Room> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const room = build(generateRoomCode());
    if (await store.create(room)) return room;
  }
  throw new RoomError('invalid-request', 'No se ha podido crear la sala, inténtalo de nuevo');
}

/** Reads a room, or throws the "does not exist" error. */
export async function requireRoom(store: RoomStore, code: string): Promise<Room> {
  const room = await store.read(code);
  if (!room) throw new RoomError('room-not-found', 'Esa sala no existe o ha caducado');
  return room;
}
