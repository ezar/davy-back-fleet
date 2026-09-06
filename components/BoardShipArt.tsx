'use client';

import { useId } from 'react';
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
/** Centreline. */
const AXIS = 50;
/**
 * Half-beam amidships. The hull fills most of the cell on purpose: drawn
 * narrow it reads as a pencil, and the deck has no room for anything.
 */
const BEAM = 39;

/* Bare timber, so the colour that identifies the ship is the rail and the
   trim, not the whole ship. Cream canvas on dark water is what makes the
   thing read as a sailing ship at a glance. */
const DECK = '#5b3d22';
/** Raised decks catch the light; the open waist between them sits in shadow. */
const DECK_RAISED = '#7d5732';
const DECK_SHADE = '#2b1b0c';
const PLANK = '#c09562';
const SAIL = '#f5edda';
const RIG = '#160d05';

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
}: {
  shipId: ShipId;
  vertical: boolean;
  sunk: boolean;
}) {
  const ship = getShip(shipId);
  // Unique per instance: the wreck draws the same ship twice, and two
  // identical `id`s would make both halves clip against the first one.
  const uid = useId().replace(/:/g, '');

  if (!ship) return null;

  const width = ship.size * UNIT;
  const trim = sunk ? '#8f2a1c' : ship.color;
  const deck = sunk ? '#2a1a10' : DECK;
  const stern = 7;
  const bow = width - 4;
  /* The same bow taper on every ship, so a two-cell sloop and a five-cell
     galleon look like the same shipwright built them. */
  const taper = Math.min(80, width * 0.36);
  const taperStart = bow - taper;
  const shoulder = stern + (taperStart - stern) * 0.3;
  const transom = BEAM * 0.66;
  const masts = ship.size >= 4 ? 3 : ship.size >= 3 ? 2 : 1;
  const gunPorts = Math.max(2, Math.round((taperStart - shoulder) / 26));

  // Hull from above: squared-off transom, full parallel midbody, and the
  // taper kept short so the bow is a stem and not a canoe point.
  const hullPath = [
    `M${stern} ${AXIS - transom}`,
    `C${stern + 14} ${AXIS - BEAM}, ${shoulder - 18} ${AXIS - BEAM}, ${shoulder} ${AXIS - BEAM}`,
    `L${taperStart} ${AXIS - BEAM * 0.95}`,
    `C${taperStart + taper * 0.42} ${AXIS - BEAM * 0.78}, ${bow - 9} ${AXIS - 11}, ${bow} ${AXIS}`,
    `C${bow - 9} ${AXIS + 11}, ${taperStart + taper * 0.42} ${AXIS + BEAM * 0.78}, ${taperStart} ${AXIS + BEAM * 0.95}`,
    `L${shoulder} ${AXIS + BEAM}`,
    `C${shoulder - 18} ${AXIS + BEAM}, ${stern + 14} ${AXIS + BEAM}, ${stern} ${AXIS + transom}`,
    `Q${stern - 6} ${AXIS}, ${stern} ${AXIS - transom}`,
    'Z',
  ].join(' ');

  // The deck is the same hull shrunk: the gap left around it is the rail,
  // and the rail is the only place the ship's colour shows in full.
  const deckPath = hullPath;
  const deckTransform = `translate(${width / 2} ${AXIS}) scale(0.955 0.76) translate(${-width / 2} ${-AXIS})`;

  const mastXs = Array.from(
    { length: masts },
    (_, i) => shoulder + ((taperStart - shoulder) * (i + 0.5)) / masts,
  );

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
          <clipPath id={`deck-${uid}`}>
            <path d={deckPath} transform={deckTransform} />
          </clipPath>
          {/* Light from the port bow: the gradient is what stops the hull
              from reading as a flat sticker. */}
          <linearGradient id={`sheen-${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ffffff" stopOpacity={0.32} />
            <stop offset="45%" stopColor="#ffffff" stopOpacity={0} />
            <stop offset="100%" stopColor="#000000" stopOpacity={0.35} />
          </linearGradient>
        </defs>

        {!sunk && <Wake bow={bow} beam={BEAM} />}

        {/* The hull sits on its own shadow, so it floats above the water. */}
        <path d={hullPath} fill="#020a12" opacity={0.45} transform="translate(0 4)" />

        {/* Bowsprit and jib, reaching out beyond the stem. */}
        <path
          d={`M${bow - 4} ${AXIS} H${width - 1}`}
          stroke={RIG}
          strokeWidth={4}
          strokeLinecap="round"
        />
        <path
          d={`M${bow - 2} ${AXIS - 9} L${width - 2} ${AXIS} L${bow - 2} ${AXIS + 9} Z`}
          fill={SAIL}
          opacity={sunk ? 0.2 : 0.8}
        />

        <path d={hullPath} fill={trim} />
        <path d={deckPath} transform={deckTransform} fill={deck} />

        <g clipPath={`url(#deck-${uid})`}>
          {
            // Deck planking runs fore and aft, the way a deck is actually laid.
            Array.from({ length: 7 }, (_, i) => {
              const y = AXIS + (i - 3) * (BEAM * 0.2);
              return (
                <path
                  key={i}
                  d={`M${stern} ${y} H${bow}`}
                  stroke={PLANK}
                  strokeWidth={1}
                  opacity={0.3}
                />
              );
            })
          }

          {/* Quarterdeck aft and forecastle forward: the two raised decks
              are what separate a galleon from a rowing boat. */}
          {[
            { from: stern - 8, to: shoulder * 0.78 },
            { from: taperStart - 10, to: bow + 8 },
          ].map((castle, i) => (
            <g key={i}>
              <path
                d={`M${castle.from} ${AXIS - BEAM} H${castle.to} V${AXIS + BEAM} H${castle.from} Z`}
                fill={sunk ? DECK_SHADE : DECK_RAISED}
              />
              <path
                d={`M${i === 0 ? castle.to : castle.from} ${AXIS - BEAM} V${AXIS + BEAM}`}
                stroke={DECK_SHADE}
                strokeWidth={3}
              />
            </g>
          ))}

          {
            // Cargo hatches down the centreline.
            mastXs.map((x, i) => (
              <rect
                key={i}
                x={x + 11}
                y={AXIS - 7}
                width={13}
                height={14}
                rx={2}
                fill={DECK_SHADE}
                opacity={0.9}
              />
            ))
          }

          <path d={deckPath} transform={deckTransform} fill={`url(#sheen-${uid})`} />
        </g>

        {/* Gun ports along the rail: the detail that says warship. They sit on
            the rail itself, which the deck clip would have cut away. */}
        {Array.from({ length: gunPorts }, (_, i) => {
          const x = shoulder + ((taperStart - shoulder) * (i + 0.5)) / gunPorts;
          return (
            <g key={i} fill={DECK_SHADE} opacity={0.85}>
              <rect x={x - 2.2} y={AXIS - BEAM * 0.9} width={4.4} height={5.5} rx={1} />
              <rect x={x - 2.2} y={AXIS + BEAM * 0.9 - 5.5} width={4.4} height={5.5} rx={1} />
            </g>
          );
        })}

        {/* Standing rigging: bowsprit to mastheads, then masthead to masthead. */}
        <g stroke={RIG} strokeWidth={1.3} opacity={0.55} fill="none">
          <path d={`M${width - 2} ${AXIS} L${mastXs[mastXs.length - 1]} ${AXIS}`} />
          <path d={`M${mastXs[0]} ${AXIS} L${stern + 3} ${AXIS}`} />
        </g>

        {mastXs.map((x, i) => {
          const half = BEAM + 8 - i * 2;
          // Seen from above a square sail is nearly edge-on. Drawn to scale it
          // is a scratch, so the belly is exaggerated until it reads as canvas.
          const belly = 30 - i * 3;
          return (
            <g key={i}>
              <path
                d={`M${x} ${AXIS - half} Q${x + belly} ${AXIS}, ${x} ${AXIS + half} Q${x + belly * 0.3} ${AXIS}, ${x} ${AXIS - half} Z`}
                fill={SAIL}
                opacity={sunk ? 0.22 : 0.95}
              />
              {/* Shadow in the fold, so the sail has a windward and a lee side. */}
              <path
                d={`M${x} ${AXIS - half} Q${x + belly * 0.3} ${AXIS}, ${x} ${AXIS + half}`}
                fill="none"
                stroke="#0a1420"
                strokeWidth={2}
                opacity={sunk ? 0.2 : 0.3}
              />
              <path
                d={`M${x} ${AXIS - half} Q${x + belly} ${AXIS}, ${x} ${AXIS + half}`}
                fill="none"
                stroke={trim}
                strokeWidth={1.8}
                opacity={sunk ? 0.4 : 0.9}
              />
              {/* Yard across the beam, and the mast where the two cross. */}
              <path
                d={`M${x} ${AXIS - half} V${AXIS + half}`}
                stroke={RIG}
                strokeWidth={2.8}
                strokeLinecap="round"
              />
              <circle cx={x} cy={AXIS} r={4.6} fill={RIG} />
              <circle cx={x} cy={AXIS} r={2} fill={trim} />
            </g>
          );
        })}

        <Figure kind={FIGUREHEADS[shipId]} x={bow - 13} color={trim} dim={sunk} />
      </g>
    </svg>
  );
}

/** Foam pushed aside by the stem: the ship is under way, not parked. */
function Wake({ bow, beam }: { bow: number; beam: number }) {
  return (
    <g fill="none" stroke={SAIL} strokeLinecap="round" opacity={0.28}>
      <path d={`M${bow - 4} ${AXIS - 4} q16 -6 26 -${beam * 0.7}`} strokeWidth={3} />
      <path d={`M${bow - 4} ${AXIS + 4} q16 6 26 ${beam * 0.7}`} strokeWidth={3} />
    </g>
  );
}

/** Figurehead: what tells the ships apart at a glance. */
function Figure({
  kind,
  x,
  color,
  dim,
}: {
  kind: Figurehead;
  x: number;
  color: string;
  dim: boolean;
}) {
  const opacity = dim ? 0.45 : 1;

  switch (kind) {
    case 'lion':
      return (
        <g fill={color} opacity={opacity}>
          {Array.from({ length: 10 }, (_, i) => {
            const angle = (i / 10) * Math.PI * 2;
            return (
              <path
                key={i}
                d={`M${x} ${AXIS} l${Math.cos(angle) * 13} ${Math.sin(angle) * 13}`}
                stroke={color}
                strokeWidth={3}
                strokeLinecap="round"
              />
            );
          })}
          <circle cx={x} cy={AXIS} r={8} fill={RIG} />
          <circle cx={x} cy={AXIS} r={5.5} />
        </g>
      );
    case 'whale':
      return (
        <g fill={color} opacity={opacity}>
          <ellipse cx={x} cy={AXIS} rx={11} ry={8} />
          <path
            d={`M${x - 9} ${AXIS - 11} q10 11 0 22`}
            stroke={color}
            strokeWidth={3}
            fill="none"
            strokeLinecap="round"
          />
          <circle cx={x + 4} cy={AXIS} r={2.2} fill={RIG} />
        </g>
      );
    case 'sheep':
      return (
        <g fill={color} opacity={opacity}>
          <circle cx={x - 5} cy={AXIS - 7} r={5} />
          <circle cx={x - 5} cy={AXIS + 7} r={5} />
          <circle cx={x - 9} cy={AXIS} r={5} />
          <circle cx={x + 1} cy={AXIS} r={7.5} />
          <circle cx={x + 4} cy={AXIS - 3} r={1.6} fill={RIG} />
          <circle cx={x + 4} cy={AXIS + 3} r={1.6} fill={RIG} />
        </g>
      );
    case 'crown':
      return (
        <g opacity={opacity}>
          <path
            fill={color}
            d={`M${x - 9} ${AXIS - 11} l10 5 -1 -11 9 8 9 -8 -1 11 10 -5 -4 11 -31 0 z`}
            transform={`rotate(90 ${x} ${AXIS}) translate(0 -4)`}
          />
        </g>
      );
    case 'skull':
      return (
        <g fill={color} opacity={opacity}>
          <circle cx={x} cy={AXIS} r={9} />
          <path
            d={`M${x - 9} ${AXIS - 9} l18 18 M${x - 9} ${AXIS + 9} l18 -18`}
            stroke={color}
            strokeWidth={2.6}
            strokeLinecap="round"
          />
          <circle cx={x + 3} cy={AXIS - 3.4} r={2.4} fill={RIG} />
          <circle cx={x + 3} cy={AXIS + 3.4} r={2.4} fill={RIG} />
        </g>
      );
  }
}
