import { getShip } from '@/lib/fleet';
import type { ShipId } from '@/lib/types';

/**
 * Silueta del barco dibujada dentro de su huella en el tablero.
 *
 * El `viewBox` se genera con la proporción exacta de las casillas que ocupa
 * (N:1), así que el casco se estira a lo largo sin deformarse. Para los
 * verticales se gira el dibujo dentro del propio SVG, que sale más limpio que
 * pelearse con transformaciones CSS encima de las de Framer Motion.
 */
export function BoardShipArt({
  shipId,
  vertical,
  sunk,
}: {
  shipId: ShipId;
  vertical: boolean;
  sunk: boolean;
}) {
  const ship = getShip(shipId);
  if (!ship) return null;

  const unit = 24;
  const long = ship.size * unit;
  const color = sunk ? '#8c1f1f' : ship.color;
  const masts = ship.size >= 5 ? 3 : ship.size >= 3 ? 2 : 1;

  return (
    <svg
      viewBox={vertical ? `0 0 ${unit} ${long}` : `0 0 ${long} ${unit}`}
      preserveAspectRatio="none"
      className="absolute inset-0 h-full w-full"
      aria-hidden
    >
      {/* rotate(90) manda (x,y) a (-y,x); el translate lo devuelve al encuadre. */}
      <g transform={vertical ? `translate(${unit},0) rotate(90)` : undefined}>
        {Array.from({ length: masts }, (_, i) => {
          const x = (long * (i + 1)) / (masts + 1);
          return (
            <g key={i}>
              <path
                d={`M${x} 14V${4 + i}`}
                stroke={color}
                strokeWidth={1.4}
                strokeLinecap="round"
                opacity={0.85}
              />
              <path
                d={`M${x + 1} ${6 + i} L${x + 8} ${10.5 + i} L${x + 1} ${13.5} Z`}
                fill={color}
                opacity={0.55}
              />
            </g>
          );
        })}
        {/* Casco, con la proa a la derecha. */}
        <path d={`M2 14H${long - 2}l-4 7H6Z`} fill={color} opacity={sunk ? 0.7 : 0.95} />
        <path
          d={`M2 14H${long - 2}`}
          stroke={color}
          strokeWidth={1.6}
          strokeLinecap="round"
          opacity={0.9}
        />
      </g>
    </svg>
  );
}
