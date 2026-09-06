import { getShip } from '@/lib/fleet';
import type { ShipId } from '@/lib/types';

/**
 * Silhouette of a ship, drawn in the ship's own colour.
 * The number of masts grows with size, so all five stay distinguishable
 * at a glance even in miniature.
 */
export function ShipSilhouette({ shipId, className }: { shipId: ShipId; className?: string }) {
  const ship = getShip(shipId);
  if (!ship) return null;

  const color = ship.color;
  const masts = ship.size >= 5 ? 3 : ship.size >= 3 ? 2 : 1;
  // Smaller ships have a shorter hull.
  const inset = ship.size >= 5 ? 3 : ship.size >= 3 ? 7 : 11;
  const spacing = (48 - inset * 2) / (masts + 1);

  return (
    <svg
      viewBox="0 0 48 30"
      className={className}
      fill="none"
      role="img"
      aria-label={`${ship.name}, ${ship.crew}`}
    >
      {Array.from({ length: masts }, (_, i) => {
        const x = inset + spacing * (i + 1);
        return (
          <g key={i}>
            <path
              d={`M${x} 20V${5 + i * 1.5}`}
              stroke={color}
              strokeWidth={1.3}
              strokeLinecap="round"
            />
            <path
              d={`M${x + 1} ${7 + i * 1.5}c5.4 2 7.8 4.6 7.8 4.6s-3.2 2.2-7.8 2.8z`}
              fill={color}
              opacity={0.75}
            />
          </g>
        );
      })}
      <path
        d={`M${inset} 20h${48 - inset * 2}l-${inset + 2} 7H${inset + 2}z`}
        fill={color}
        opacity={0.92}
      />
    </svg>
  );
}
