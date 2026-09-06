'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ApiError,
  fetchRoomState,
  loadSession,
  placeFleetRequest,
  shootRequest,
} from '@/lib/roomClient';
import type { RoomView } from '@/lib/room';
import type { Cell, Placement, ShipId } from '@/lib/types';
import { sunkShipIds } from '@/lib/gameLogic';

/** Cadencia de sincronización, tal y como fija la spec. */
const POLL_MS = 1000;
/** Con la pestaña en segundo plano se relaja el ritmo para no gastar invocaciones. */
const POLL_MS_HIDDEN = 5000;

export interface UseRoomResult {
  view: RoomView | null;
  error: string | null;
  /** Barco recién hundido por ti / por el rival, para las micro-celebraciones. */
  sunkByYou: ShipId | null;
  sunkByOpponent: ShipId | null;
  placeFleet: (placements: Placement[]) => Promise<void>;
  shoot: (cell: Cell) => Promise<void>;
  busy: boolean;
}

/**
 * Mantiene sincronizada una sala por polling HTTP.
 * El identificador del jugador sale de `localStorage`, así que un refresco
 * no expulsa a nadie de la partida.
 */
export function useRoom(code: string): UseRoomResult {
  const [view, setView] = useState<RoomView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sunkByYou, setSunkByYou] = useState<ShipId | null>(null);
  const [sunkByOpponent, setSunkByOpponent] = useState<ShipId | null>(null);

  const playerIdRef = useRef<string | null>(null);
  const stopped = useRef(false);

  /** Detecta los hundimientos nuevos comparando con el estado anterior. */
  const applyView = useCallback((next: RoomView) => {
    setView((previous) => {
      const previousMine = previous ? sunkShipIds(previous.opponent.outgoingShots).length : 0;
      const nextMine = sunkShipIds(next.opponent.outgoingShots);
      if (nextMine.length > previousMine) setSunkByYou(nextMine[nextMine.length - 1]);

      const previousTheirs = previous ? sunkShipIds(previous.you.incomingShots).length : 0;
      const nextTheirs = sunkShipIds(next.you.incomingShots);
      if (nextTheirs.length > previousTheirs) setSunkByOpponent(nextTheirs[nextTheirs.length - 1]);

      return next;
    });
    setError(null);
  }, []);

  useEffect(() => {
    const playerId = loadSession(code);
    if (!playerId) {
      setError('No tienes una sesión en esta sala. Vuelve al inicio y únete con el código.');
      return;
    }
    playerIdRef.current = playerId;
    stopped.current = false;

    let timer: ReturnType<typeof setTimeout>;

    const tick = async () => {
      if (stopped.current) return;
      try {
        const { view: next } = await fetchRoomState(code, playerId);
        applyView(next);
      } catch (cause) {
        // Un fallo de red puntual no debe echar al jugador: se reintenta.
        if (cause instanceof ApiError && cause.code === 'room-not-found') {
          setError('Esa sala ya no existe. Puede que haya caducado.');
          stopped.current = true;
          return;
        }
        if (cause instanceof ApiError && cause.code === 'not-a-player') {
          setError('Tu sitio en esta sala ya no es válido.');
          stopped.current = true;
          return;
        }
      }
      if (!stopped.current) {
        timer = setTimeout(tick, document.hidden ? POLL_MS_HIDDEN : POLL_MS);
      }
    };

    void tick();
    return () => {
      stopped.current = true;
      clearTimeout(timer);
    };
  }, [code, applyView]);

  const runAction = useCallback(
    async (action: (playerId: string) => Promise<{ view: RoomView }>) => {
      const playerId = playerIdRef.current;
      if (!playerId || busy) return;
      setBusy(true);
      try {
        const { view: next } = await action(playerId);
        applyView(next);
      } catch (cause) {
        setError(cause instanceof ApiError ? cause.message : 'Algo ha ido mal');
      } finally {
        setBusy(false);
      }
    },
    [applyView, busy],
  );

  const placeFleet = useCallback(
    (placements: Placement[]) => runAction((playerId) => placeFleetRequest(code, playerId, placements)),
    [code, runAction],
  );

  const shoot = useCallback(
    (cell: Cell) => runAction((playerId) => shootRequest(code, playerId, cell)),
    [code, runAction],
  );

  return { view, error, sunkByYou, sunkByOpponent, placeFleet, shoot, busy };
}
