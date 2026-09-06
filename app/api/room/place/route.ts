import { getRoomStore, requireRoom } from '@/lib/gameStore';
import { errorResponse, jsonResponse } from '@/lib/apiResponse';
import { readJsonBody, requirePlacements, requirePlayerId, requireRoomCode } from '@/lib/apiSchema';
import { RoomError, applyPlacement, seatOf, viewRoomFor } from '@/lib/room';

export const dynamic = 'force-dynamic';

/** POST /api/room/place — confirma la flota de un jugador. */
export async function POST(request: Request) {
  try {
    const body = await readJsonBody(request);
    const code = requireRoomCode(body.code);
    const playerId = requirePlayerId(body.playerId);
    const placements = requirePlacements(body.placements);

    const store = getRoomStore();
    const room = await requireRoom(store, code);
    const seat = seatOf(room, playerId);
    if (!seat) throw new RoomError('not-a-player', 'No perteneces a esta sala');

    const updated = applyPlacement(room, seat, placements);
    // Cada jugador escribe solo su asiento: los dos pueden colocar a la vez.
    await store.writeSeat(code, seat, seat === 'host' ? updated.host : updated.guest!, updated.meta);

    return jsonResponse({ view: viewRoomFor(updated, playerId) });
  } catch (error) {
    return errorResponse(error);
  }
}
