'use client';

import { FLEET } from '@/lib/fleet';
import { placementCells, sunkShipIds, cellKey } from '@/lib/gameLogic';
import type { Placement, ShotLog } from '@/lib/types';

/** Barcos que siguen a flote, de los cinco. */
export function afloatCount(shots: ShotLog): number {
  return FLEET.length - sunkShipIds(shots).length;
}

/**
 * Flota rival: una fila de fichas. No se sabe dónde está cada barco,
 * solo si sigue a flote, así que la ficha es toda la información que hay.
 */
export function EnemyFleetChips({ shots }: { shots: ShotLog }) {
  const sunk = new Set(sunkShipIds(shots));

  return (
    <ul className="flex flex-wrap gap-1.5">
      {FLEET.map((ship) => {
        const down = sunk.has(ship.id);
        return (
          <li
            key={ship.id}
            className={[
              'flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-[0.65rem] font-bold',
              down
                ? 'border-blood/60 bg-blood/30 text-foam/45 line-through'
                : 'border-foam/12 bg-hull/60 text-foam',
            ].join(' ')}
          >
            {!down && (
              <span
                aria-hidden
                className="h-1.5 w-1.5 rounded-full"
                style={{ background: ship.color }}
              />
            )}
            {ship.name}
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Flota propia: como sí sabes dónde está cada barco, se muestra el daño
 * casilla a casilla. Cada cuadrito es una casilla, en rojo si está tocada.
 */
export function OwnFleetStatus({
  shots,
  placements,
}: {
  shots: ShotLog;
  placements: Placement[] | null;
}) {
  const struck = new Set(shots.filter((s) => s.outcome !== 'miss').map((s) => cellKey(s.cell)));
  const sunk = new Set(sunkShipIds(shots));
  const byId = new Map((placements ?? []).map((p) => [p.shipId, p]));

  return (
    <ul className="flex flex-1 flex-col gap-1.5">
      {FLEET.map((ship) => {
        const down = sunk.has(ship.id);
        const placement = byId.get(ship.id);
        return (
          <li
            key={ship.id}
            className="flex items-center justify-between gap-2 whitespace-nowrap text-[0.65rem]"
          >
            <span className={down ? 'font-bold text-foam/40 line-through' : 'font-bold'}>
              {ship.name}
            </span>
            {down ? (
              <span className="text-[0.58rem] font-bold uppercase tracking-[0.1em] text-blood">
                Hundido
              </span>
            ) : (
              <span className="flex gap-[2px]">
                {(placement ? placementCells(placement) : Array.from({ length: ship.size })).map(
                  (cell, index) => (
                    <span
                      key={index}
                      aria-hidden
                      className="h-1.5 w-1.5 rounded-[1px]"
                      style={{
                        background:
                          cell && struck.has(cellKey(cell as { row: number; col: number }))
                            ? '#e2542c'
                            : ship.color,
                      }}
                    />
                  ),
                )}
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
