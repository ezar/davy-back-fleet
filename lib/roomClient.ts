'use client';

import type { RoomRules, RoomView } from './room';
import type { Cell, Placement, ShotResult } from './types';

/** HTTP client for the room routes. Everything that talks to the server goes through here. */

export class ApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ApiError(
      typeof payload.error === 'string' ? payload.error : 'server-error',
      typeof payload.message === 'string'
        ? payload.message
        : 'No se ha podido contactar con el barco',
    );
  }
  return payload as T;
}

const post = <T>(url: string, body: unknown) =>
  request<T>(url, { method: 'POST', body: JSON.stringify(body) });

export interface JoinResponse {
  code: string;
  playerId: string;
  view: RoomView;
}

export const createRoomRequest = (name: string, rules: RoomRules) =>
  post<JoinResponse>('/api/room/create', { name, rules });

export const joinRoomRequest = (code: string, name: string) =>
  post<JoinResponse>('/api/room/join', { code, name });

export const fetchRoomState = (code: string, playerId: string) =>
  request<{ view: RoomView }>(
    `/api/room/state?code=${encodeURIComponent(code)}&playerId=${encodeURIComponent(playerId)}`,
  );

export const placeFleetRequest = (code: string, playerId: string, placements: Placement[]) =>
  post<{ view: RoomView }>('/api/room/place', { code, playerId, placements });

export const shootRequest = (code: string, playerId: string, cell: Cell) =>
  post<{ view: RoomView; result: ShotResult }>('/api/room/shoot', { code, playerId, cell });

export const rematchRequest = (code: string, playerId: string) =>
  post<{ view: RoomView }>('/api/room/rematch', { code, playerId });

/** The player's session in a room, stored so it survives a reload. */
const sessionKey = (code: string) => `dbf:session:${code}`;
const NAME_KEY = 'dbf:name';

export function saveSession(code: string, playerId: string): void {
  try {
    localStorage.setItem(sessionKey(code), playerId);
  } catch {
    // Private mode or full storage: the game goes on, only a reload loses it.
  }
}

export function loadSession(code: string): string | null {
  try {
    return localStorage.getItem(sessionKey(code));
  } catch {
    return null;
  }
}

export function clearSession(code: string): void {
  try {
    localStorage.removeItem(sessionKey(code));
  } catch {
    /* nothing to do */
  }
}

export function saveName(name: string): void {
  try {
    localStorage.setItem(NAME_KEY, name);
  } catch {
    /* nothing to do */
  }
}

export function loadName(): string {
  try {
    return localStorage.getItem(NAME_KEY) ?? '';
  } catch {
    return '';
  }
}
