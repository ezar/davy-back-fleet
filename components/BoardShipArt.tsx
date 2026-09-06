import { getShip } from '@/lib/fleet';
import type { ShipId } from '@/lib/types';

/**
 * The ship drawn inside its footprint on the board.
 *
 * Seen FROM ABOVE, not side-on: that is how ships read on a board, and it is
 * the only view that works equally well horizontally and vertically. Side-on,
 * a ship rotated 90 degrees reads as a splinter with flags.
 *
 * The `viewBox` is generated with the exact ratio of the cells it occupies
 * (N:1), so the hull is drawn to size instead of being stretched to fit.
 */

/** Canvas height. Width is `size * UNIT`, hence the N:1 ratio. */
const UNIT = 100;
/** Centreline and half-beam. */
const AXIS = 50;
const BEAM = 27;

type Figurehead = 'lion' | 'whale' | 'sheep' | 'crown' | 'skull';

const FIGUREHEADS: Record<ShipId, Figurehead> = {
  'thousand-sunny': 'lion',
  'moby-dick': 'whale',
  'going-merry': 'sheep',
  'oro-jackson': 'crown',
  'red-force': 'skull',
};

export function BoardShipArt({
  shipId,
  vertical,
  sunk,
  /** In the combat thumbnail the fine detail only muddies things. */
  simplified = false,
}: {
  shipId: ShipId;
  vertical: boolean;
  sunk: boolean;
  simplified?: boolean;
}) {
  const ship = getShip(shipId);
  if (!ship) return null;

  const width = ship.size * UNIT;
  const color = sunk ? '#8c1f1f' : ship.color;
  const bow = width - 12;
  const stern = 12;
  const masts = ship.size >= 5 ? 3 : ship.size >= 3 ? 2 : 1;
  const clipId = `hull-${shipId}${vertical ? '-v' : ''}${sunk ? '-s' : ''}`;

  // Hull seen from above: pointed bow to the right, rounded stern.
  // Full body almost to the bow with a short taper: if the taper starts
  // amidships the ship reads as a canoe rather than a galleon.
  const hullPath = `M${stern} ${AXIS - BEAM * 0.8}
    C${width * 0.12} ${AXIS - BEAM}, ${width * 0.52} ${AXIS - BEAM}, ${width * 0.72} ${AXIS - BEAM * 0.88}
    C${width * 0.88} ${AXIS - BEAM * 0.62}, ${bow - 5} ${AXIS - 7}, ${bow} ${AXIS}
    C${bow - 5} ${AXIS + 7}, ${width * 0.88} ${AXIS + BEAM * 0.62}, ${width * 0.72} ${AXIS + BEAM * 0.88}
    C${width * 0.52} ${AXIS + BEAM}, ${width * 0.12} ${AXIS + BEAM}, ${stern} ${AXIS + BEAM * 0.8}
    Q${stern - 7} ${AXIS}, ${stern} ${AXIS - BEAM * 0.8} Z`;

  return (
    <svg
      viewBox={vertical ? `0 0 ${UNIT} ${width}` : `0 0 ${width} ${UNIT}`}
      preserveAspectRatio="xMidYMid meet"
      className="absolute inset-0 h-full w-full overflow-visible"
      aria-hidden
    >
      {/* rotate(90) sends (x,y) to (-y,x); the translate brings it back into frame. */}
      <g transform={vertical ? `translate(${UNIT},0) rotate(90)` : undefined}>
        <defs>
          <clipPath id={clipId}>
            <path d={hullPath} />
          </clipPath>
        </defs>

        {/* Bowsprit, reaching out beyond the stem. */}
        <path
          d={`M${bow - 2} ${AXIS} H${width - 3}`}
          stroke={color}
          strokeWidth={3}
          strokeLinecap="round"
          opacity={0.9}
        />

        <path d={hullPath} fill={color} opacity={sunk ? 0.6 : 0.95} />

        {/* Sunken deck, so the hull has a gunwale instead of being a blob. */}
        <g clipPath={`url(#${clipId})`}>
          <path
            d={hullPath}
            fill="#08192a"
            opacity={sunk ? 0.55 : 0.72}
            transform={`translate(${width / 2} ${AXIS}) scale(0.9 0.68) translate(${-width / 2} ${-AXIS})`}
          />
          {!simplified &&
            // Deck planking.
            Array.from({ length: ship.size * 5 }, (_, i) => {
              const x = stern + ((width - stern * 2) * i) / (ship.size * 5);
              return (
                <path
                  key={i}
                  d={`M${x} ${AXIS - BEAM} V${AXIS + BEAM}`}
                  stroke={color}
                  strokeWidth={0.8}
                  opacity={0.28}
                />
              );
            })}
        </g>

        {Array.from({ length: masts }, (_, i) => {
          const x = (width * (i + 1)) / (masts + 1);
          const yard = BEAM + 11;
          return (
            <g key={i}>
              {!simplified && (
                // Rigging: from the masthead to bow and stern.
                <g opacity={0.3} stroke={color} strokeWidth={1.1}>
                  <path d={`M${x} ${AXIS} L${bow} ${AXIS - 3}`} />
                  <path d={`M${x} ${AXIS} L${stern + 4} ${AXIS + 3}`} />
                </g>
              )}
              {/* Square sail seen from above: it crosses the beam. */}
              <ellipse
                cx={x + 6}
                cy={AXIS}
                rx={12}
                ry={yard - 3}
                fill={color}
                opacity={sunk ? 0.25 : 0.52}
              />
              <path
                d={`M${x} ${AXIS - yard} V${AXIS + yard}`}
                stroke={color}
                strokeWidth={3.4}
                strokeLinecap="round"
                opacity={0.95}
              />
              <circle cx={x} cy={AXIS} r={4.5} fill={color} />
            </g>
          );
        })}

        {!simplified && <Figure kind={FIGUREHEADS[shipId]} x={bow - 16} color={color} />}
      </g>
    </svg>
  );
}

/** Figurehead: what tells the ships apart at a glance. */
function Figure({ kind, x, color }: { kind: Figurehead; x: number; color: string }) {
  switch (kind) {
    case 'lion':
      return (
        <g fill={color}>
          <circle cx={x} cy={AXIS} r={6} />
          {Array.from({ length: 8 }, (_, i) => {
            const angle = (i / 8) * Math.PI * 2;
            return (
              <path
                key={i}
                d={`M${x + Math.cos(angle) * 6} ${AXIS + Math.sin(angle) * 6}
                    l${Math.cos(angle) * 4} ${Math.sin(angle) * 4}`}
                stroke={color}
                strokeWidth={2.2}
                strokeLinecap="round"
              />
            );
          })}
        </g>
      );
    case 'whale':
      return (
        <g fill={color}>
          <ellipse cx={x} cy={AXIS} rx={9} ry={6} />
          <path
            d={`M${x + 7} ${AXIS - 7} q5 7 0 14`}
            stroke={color}
            strokeWidth={2.2}
            fill="none"
            strokeLinecap="round"
          />
        </g>
      );
    case 'sheep':
      return (
        <g fill={color}>
          <circle cx={x} cy={AXIS} r={6} />
          <circle cx={x - 5} cy={AXIS - 5} r={3.5} />
          <circle cx={x - 5} cy={AXIS + 5} r={3.5} />
        </g>
      );
    case 'crown':
      return (
        <path
          fill={color}
          d={`M${x - 6} ${AXIS - 8} l7 4 -1 -8 6 6 6 -6 -1 8 7 -4 -3 8 -18 0 z`}
          transform={`rotate(90 ${x} ${AXIS})`}
        />
      );
    case 'skull':
      return (
        <g fill={color}>
          <circle cx={x} cy={AXIS} r={6.5} />
          <circle cx={x + 2} cy={AXIS - 2.5} r={1.8} fill="#04101d" />
          <circle cx={x + 2} cy={AXIS + 2.5} r={1.8} fill="#04101d" />
        </g>
      );
  }
}
