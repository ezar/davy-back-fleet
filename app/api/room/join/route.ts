import { getRoomStore, newPlayerId, requireRoom } from '@/lib/gameStore';
import { errorResponse, jsonResponse } from '@/lib/apiResponse';
import { readJsonBody, requireRoomCode } from '@/lib/apiSchema';
import { RoomError, joinRoom, sanitizeName, viewRoomFor } from '@/lib/room';

export const dynamic = 'force-dynamic';

/** POST /api/room/join - joins an existing room as the second player. */
export async function POST(request: Request) {
  try {
    const body = await readJsonBody(request);
    const code = requireRoomCode(body.code);
    const name = sanitizeName(body.name, 'Grumete');
    const playerId = newPlayerId();

    const store = getRoomStore();
    const room = await requireRoom(store, code);
    const joined = joinRoom(room, name, playerId);

    // `hsetnx` decides who gets in when two people use the code at once.
    const claimed = await store.claimSeat(code, 'guest', joined.guest!, joined.meta);
    if (!claimed) throw new RoomError('room-full', 'La sala ya tiene dos jugadores');

    return jsonResponse({
      code,
      playerId,
      view: viewRoomFor(joined, playerId),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
