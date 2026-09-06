import { getShip } from '@/lib/fleet';
import type { ShipId } from '@/lib/types';

/**
 * Dibujo del barco dentro de su huella en el tablero.
 *
 * Vista CENITAL, no de perfil: es como se ven los barcos en un tablero, y es
 * lo único que funciona igual de bien en horizontal y en vertical. De perfil,
 * un barco girado 90° se lee como una astilla con banderas.
 *
 * El `viewBox` se genera con la proporción exacta de las casillas que ocupa
 * (N:1), así que el casco se dibuja a su medida y no hay que deformarlo.
 */

/** Alto del lienzo. El ancho es `size * UNIT`, de ahí la proporción N:1. */
const UNIT = 100;
/** Eje de crujía y media manga. */
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
  /** En la miniatura del combate el detalle fino solo ensucia. */
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

  // Casco visto desde arriba: proa en punta a la derecha, popa redondeada.
  // Cuerpo lleno casi hasta proa y afinamiento corto: si el afinamiento
  // empieza en el centro el barco se lee como una piragua, no como un galeón.
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
      {/* rotate(90) manda (x,y) a (-y,x); el translate lo devuelve al encuadre. */}
      <g transform={vertical ? `translate(${UNIT},0) rotate(90)` : undefined}>
        <defs>
          <clipPath id={clipId}>
            <path d={hullPath} />
          </clipPath>
        </defs>

        {/* Bauprés, asomando por delante de la roda. */}
        <path
          d={`M${bow - 2} ${AXIS} H${width - 3}`}
          stroke={color}
          strokeWidth={3}
          strokeLinecap="round"
          opacity={0.9}
        />

        <path d={hullPath} fill={color} opacity={sunk ? 0.6 : 0.95} />

        {/* Cubierta hundida, para que el casco tenga borda y no sea una mancha. */}
        <g clipPath={`url(#${clipId})`}>
          <path
            d={hullPath}
            fill="#08192a"
            opacity={sunk ? 0.55 : 0.72}
            transform={`translate(${width / 2} ${AXIS}) scale(0.9 0.68) translate(${-width / 2} ${-AXIS})`}
          />
          {!simplified &&
            // Tablazón de cubierta.
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
                // Jarcia: del tope del palo a proa y a popa.
                <g opacity={0.3} stroke={color} strokeWidth={1.1}>
                  <path d={`M${x} ${AXIS} L${bow} ${AXIS - 3}`} />
                  <path d={`M${x} ${AXIS} L${stern + 4} ${AXIS + 3}`} />
                </g>
              )}
              {/* Vela cuadra vista desde arriba: cruza la manga. */}
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

/** Mascarón de proa: lo que distingue de un vistazo a cada barco. */
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
