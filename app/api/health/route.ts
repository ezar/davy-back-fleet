import { getRoomStore } from '@/lib/gameStore';
import { jsonResponse } from '@/lib/apiResponse';
import { RoomError } from '@/lib/room';

export const dynamic = 'force-dynamic';

type MultiplayerStatus = 'ready' | 'not-configured' | 'unreachable';

/** Diagnostic timeout: if Redis does not answer, this still does. */
const PING_TIMEOUT_MS = 3000;

function timeout(ms: number): Promise<never> {
  return new Promise((_, reject) =>
    setTimeout(() => reject(new Error(`El almacén no ha respondido en ${ms} ms`)), ms),
  );
}

/**
 * GET /api/health - is this deployment fit to play?
 *
 * Without it, the first symptom of a misconfigured Redis is an error when
 * creating a room, with someone already waiting on the other side.
 *
 * Returns no credentials or URLs: only whether the store answers, and how fast.
 */
export async function GET() {
  const startedAt = Date.now();
  let multiplayer: MultiplayerStatus = 'ready';
  let detail: string | undefined;

  try {
    await Promise.race([getRoomStore().ping(), timeout(PING_TIMEOUT_MS)]);
  } catch (error) {
    if (error instanceof RoomError && error.code === 'multiplayer-unavailable') {
      multiplayer = 'not-configured';
      detail = 'Falta la integración de Upstash: añádela en Vercel y vuelve a desplegar.';
    } else {
      multiplayer = 'unreachable';
      detail = 'Hay credenciales de Redis, pero el almacén no responde.';
      console.error('[davy-back-fleet] Redis no responde', error);
    }
  }

  return jsonResponse({
    // Solo mode is all client-side: it works whatever happens here.
    solo: 'ready',
    multiplayer,
    detail,
    roundTripMs: Date.now() - startedAt,
  });
}
