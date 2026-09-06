import { getRoomStore } from '@/lib/gameStore';
import { jsonResponse } from '@/lib/apiResponse';
import { RoomError } from '@/lib/room';

export const dynamic = 'force-dynamic';

type MultiplayerStatus = 'ready' | 'not-configured' | 'unreachable';

/** Tope de espera del diagnóstico: si Redis no contesta, esto sí. */
const PING_TIMEOUT_MS = 3000;

function timeout(ms: number): Promise<never> {
  return new Promise((_, reject) =>
    setTimeout(() => reject(new Error(`El almacén no ha respondido en ${ms} ms`)), ms),
  );
}

/**
 * GET /api/health — ¿está el despliegue en condiciones de jugar?
 *
 * Sin esto, el primer síntoma de un Redis mal configurado es un error al
 * crear sala, ya con alguien esperando al otro lado. Aquí se ve antes.
 *
 * No devuelve credenciales ni URLs: solo si el almacén responde y cuánto tarda.
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
    // El modo contra la IA es todo cliente: funciona pase lo que pase aquí.
    solo: 'ready',
    multiplayer,
    detail,
    roundTripMs: Date.now() - startedAt,
  });
}
