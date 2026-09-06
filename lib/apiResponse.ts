import { NextResponse } from 'next/server';
import { RoomError, type RoomErrorCode } from './room';

const STATUS_BY_CODE: Record<RoomErrorCode, number> = {
  'room-not-found': 404,
  'room-full': 409,
  'not-a-player': 403,
  'not-your-turn': 409,
  'wrong-phase': 409,
  'cell-already-shot': 409,
  'invalid-cell': 400,
  'invalid-fleet': 400,
  'invalid-request': 400,
  'multiplayer-unavailable': 503,
};

/** Maps a rule error to a JSON response; anything else to a 500 without leaking details. */
export function errorResponse(error: unknown): NextResponse {
  if (error instanceof RoomError) {
    return NextResponse.json(
      { error: error.code, message: error.message },
      { status: STATUS_BY_CODE[error.code] },
    );
  }
  console.error('[davy-back-fleet] error inesperado', error);
  return NextResponse.json(
    { error: 'server-error', message: 'Algo ha ido mal en el barco' },
    { status: 500 },
  );
}

/** A successful response, always uncached: polling needs fresh data. */
export function jsonResponse(data: unknown): NextResponse {
  return NextResponse.json(data, {
    headers: { 'Cache-Control': 'no-store, max-age=0' },
  });
}
