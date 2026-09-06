import { getRoomStore, requireRoom } from '@/lib/gameStore';
import { errorResponse, jsonResponse } from '@/lib/apiResponse';
import { readJsonBody, requireCell, requirePlayerId, requireRoomCode } from '@/lib/apiSchema';
import { RoomError, applyShot, otherSeat, seatOf, viewRoomFor } from '@/lib/room';

export const dynamic = 'force-dynamic';

/** POST /api/room/shoot — dispara a una celda del tablero rival. */
export async function POST(request: Request) {
  try {
    const body = await readJsonBody(request);
    const code = requireRoomCode(body.code);
    const playerId = requirePlayerId(body.playerId);
    const cell = requireCell(body.cell);

    const store = getRoomStore();
    const room = await requireRoom(store, code);
    const seat = seatOf(room, playerId);
    if (!seat) throw new RoomError('not-a-player', 'No perteneces a esta sala');

    const { room: updated, result } = applyShot(room, seat, cell);
    // El disparo solo modifica el tablero del rival, y el turno lo serializa.
    const defenderSeat = otherSeat(seat);
    const defender = defenderSeat === 'host' ? updated.host : updated.guest!;
    await store.writeSeat(code, defenderSeat, defender, updated.meta);

    return jsonResponse({ view: viewRoomFor(updated, playerId), result });
  } catch (error) {
    return errorResponse(error);
  }
}
