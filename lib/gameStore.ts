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
 * Persistencia de salas sobre Upstash Redis.
 *
 * Cada sala es un hash con tres campos: `meta`, `host` y `guest`. Guardar un
 * campo por jugador evita el clásico lee-modifica-escribe entre los dos
 * dispositivos: cada uno solo escribe lo suyo, y el disparo (que toca `meta`)
 * ya está serializado por el turno.
 */

/** Las salas caducan a las 6 horas de la última jugada. */
const ROOM_TTL_SECONDS = 6 * 60 * 60;

const keyFor = (code: string) => `dbf:room:${code}`;

/** Un campo del hash puede volver como objeto (Upstash deserializa) o como texto. */
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
  /** Reserva un código libre y guarda la sala. */
  create(room: Room): Promise<boolean>;
  read(code: string): Promise<Room | null>;
  /** Guarda un asiento solo si estaba vacío. Devuelve false si ya había alguien. */
  claimSeat(code: string, seat: Seat, player: RoomPlayer, meta: RoomMeta): Promise<boolean>;
  /** Sobrescribe un asiento (y opcionalmente la meta) que ya es tuyo. */
  writeSeat(code: string, seat: Seat, player: RoomPlayer, meta: RoomMeta): Promise<void>;
}

/** Implementación sobre Upstash Redis (producción y previews de Vercel). */
class RedisRoomStore implements RoomStore {
  constructor(private readonly redis: Redis) {}

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

  async claimSeat(
    code: string,
    seat: Seat,
    player: RoomPlayer,
    meta: RoomMeta,
  ): Promise<boolean> {
    const key = keyFor(code);
    const claimed = await this.redis.hsetnx(key, seat, player as unknown as object);
    if (!claimed) return false;
    await this.redis.hset(key, { meta: meta as unknown as object });
    await this.redis.expire(key, ROOM_TTL_SECONDS);
    return true;
  }

  async writeSeat(
    code: string,
    seat: Seat,
    player: RoomPlayer,
    meta: RoomMeta,
  ): Promise<void> {
    const key = keyFor(code);
    await this.redis.hset(key, {
      [seat]: player as unknown as object,
      meta: meta as unknown as object,
    });
    await this.redis.expire(key, ROOM_TTL_SECONDS);
  }
}

/**
 * Respaldo en memoria para desarrollo local sin credenciales de Upstash.
 * No sobrevive entre invocaciones serverless: nunca debe usarse en producción.
 */
class MemoryRoomStore implements RoomStore {
  private readonly rooms = new Map<string, Room>();

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
 * Acepta tanto los nombres de la integración Upstash de Vercel Marketplace
 * (`KV_REST_API_*`) como los nativos de Upstash (`UPSTASH_REDIS_REST_*`).
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
    store = new RedisRoomStore(new Redis(credentials));
  } else {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'Faltan las credenciales de Upstash (KV_REST_API_URL / KV_REST_API_TOKEN)',
      );
    }
    console.warn(
      '[davy-back-fleet] Sin credenciales de Upstash: usando salas en memoria (solo desarrollo).',
    );
    store = new MemoryRoomStore();
  }
  return store;
}

/** ¿Hay multijugador disponible en este despliegue? */
export function isMultiplayerConfigured(): boolean {
  return readCredentials() !== null || process.env.NODE_ENV !== 'production';
}

/** Identificador secreto de jugador. */
export function newPlayerId(): string {
  return crypto.randomUUID();
}

/** Busca un código de sala libre. */
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

/** Lee una sala o lanza el error de "no existe". */
export async function requireRoom(store: RoomStore, code: string): Promise<Room> {
  const room = await store.read(code);
  if (!room) throw new RoomError('room-not-found', 'Esa sala no existe o ha caducado');
  return room;
}
