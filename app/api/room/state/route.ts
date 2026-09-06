import { getRoomStore, requireRoom } from '@/lib/gameStore';
import { errorResponse, jsonResponse } from '@/lib/apiResponse';
import { requirePlayerId, requireRoomCode } from '@/lib/apiSchema';
import { viewRoomFor } from '@/lib/room';

export const dynamic = 'force-dynamic';

/** GET /api/room/state?code=...&playerId=... - the polling endpoint (1s). */
export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const code = requireRoomCode(params.get('code'));
    const playerId = requirePlayerId(params.get('playerId'));

    const room = await requireRoom(getRoomStore(), code);
    return jsonResponse({ view: viewRoomFor(room, playerId) });
  } catch (error) {
    return errorResponse(error);
  }
}
