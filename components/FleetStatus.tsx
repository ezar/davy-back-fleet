'use client';

import { FLEET } from '@/lib/fleet';
import { sunkShipIds } from '@/lib/gameLogic';
import type { ShotLog } from '@/lib/types';

/**
 * Estado de una flota: qué barcos siguen a flote y cuáles se han hundido.
 * Recibe los disparos recibidos por esa flota.
 */
export function FleetStatus({ shots, title }: { shots: ShotLog; title: string }) {
  const sunk = new Set(sunkShipIds(shots));

  return (
    <section className="space-y-2">
      <h3 className="text-xs font-bold uppercase tracking-widest text-foam/50">
        {title} · {FLEET.length - sunk.size}/{FLEET.length} a flote
      </h3>
      <ul className="grid grid-cols-1 gap-1 sm:grid-cols-2">
        {FLEET.map((ship) => {
          const down = sunk.has(ship.id);
          return (
            <li
              key={ship.id}
              className={[
                'flex items-center justify-between gap-2 rounded-md border px-2 py-1.5 text-xs transition',
                down
                  ? 'border-blood/50 bg-blood/20 text-foam/45 line-through'
                  : 'border-foam/10 bg-hull/50 text-foam/90',
              ].join(' ')}
            >
              <span className="truncate font-semibold">{ship.name}</span>
              <span className="shrink-0 font-mono text-[0.65rem] text-foam/50">
                {down ? 'hundido' : '■'.repeat(ship.size)}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
