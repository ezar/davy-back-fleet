import { getRoomStore, newPlayerId, reserveRoomCode } from '@/lib/gameStore';
import { errorResponse, jsonResponse } from '@/lib/apiResponse';
import { readJsonBody } from '@/lib/apiSchema';
import { createRoom, normalizeRules, sanitizeName, viewRoomFor } from '@/lib/room';

export const dynamic = 'force-dynamic';

/** POST /api/room/create - creates a room and returns its code. */
export async function POST(request: Request) {
  try {
    const body = await readJsonBody(request);
    const name = sanitizeName(body.name, 'Capitán');
    const rules = normalizeRules(body.rules);
    const playerId = newPlayerId();

    const room = await reserveRoomCode(getRoomStore(), (code) =>
      createRoom(code, name, playerId, Date.now(), rules),
    );

    return jsonResponse({
      code: room.meta.code,
      playerId,
      view: viewRoomFor(room, playerId),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
