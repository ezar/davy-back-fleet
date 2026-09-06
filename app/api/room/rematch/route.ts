import { getRoomStore, requireRoom } from '@/lib/gameStore';
import { errorResponse, jsonResponse } from '@/lib/apiResponse';
import { readJsonBody, requirePlayerId, requireRoomCode } from '@/lib/apiSchema';
import { RoomError, rematch, seatOf, viewRoomFor } from '@/lib/room';

export const dynamic = 'force-dynamic';

/**
 * POST /api/room/rematch - starts another game in the same room.
 *
 * Either player can ask for it; the other finds out by polling, because the
 * room drops back to the placement phase. If both ask at once they write the
 * same reset room, and if one has already placed by the time the other's
 * request lands, `rematch` throws `wrong-phase` and that client simply keeps
 * the state its polling is already bringing in.
 */
export async function POST(request: Request) {
  try {
    const body = await readJsonBody(request);
    const code = requireRoomCode(body.code);
    const playerId = requirePlayerId(body.playerId);

    const store = getRoomStore();
    const room = await requireRoom(store, code);
    if (!seatOf(room, playerId)) {
      throw new RoomError('not-a-player', 'No perteneces a esta sala');
    }

    const next = rematch(room);
    await store.writeRoom(code, next);

    return jsonResponse({ view: viewRoomFor(next, playerId) });
  } catch (error) {
    return errorResponse(error);
  }
}
