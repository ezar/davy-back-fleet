'use client';

import { motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { BoardShipArt } from './BoardShipArt';
import { FLIGHT_MS, ImpactEffect } from './effects/ImpactEffect';
import { getShip } from '@/lib/fleet';
import { COLUMN_LABELS, ROW_LABELS, cellKey, placementCells } from '@/lib/gameLogic';
import { type CellState, buildCellStates, sunkPlacements } from '@/lib/boardView';
import type { Cell, Placement, ShipId, ShotLog, ShotOutcome, ShotResult } from '@/lib/types';
import { useAudioStore } from '@/store/useAudioStore';

export interface BoardProps {
  /**
   * `own`: your board, with your fleet on show.
   * `enemy`: theirs, where only what you have already shot at is visible.
   */
  variant: 'own' | 'enemy';
  shots: ShotLog;
  placements?: Placement[] | null;
  onCellClick?: (cell: Cell) => void;
  disabled?: boolean;
  /** Ship being placed, drawn as one block over the grid. */
  previewPlacement?: Placement | null;
  previewValid?: boolean;
  /** Reduced version, without headers: for your own board during combat. */
  compact?: boolean;
  /** Fires when a shot lands, so the screen can shake. */
  onImpact?: (outcome: ShotOutcome) => void;
  /** 2.5D view: tilted board with the ships lifted above the water. */
  tilted?: boolean;
}

/**
 * Detects the shot that has just landed and announces it exactly once.
 *
 * With polling the log arrives as a fresh array every second even when
 * nothing changed, so the signal is that it grew. It fires nothing on the
 * first render: otherwise reloading mid-game would replay every past
 * explosion at once.
 */
function useLatestShot(shots: ShotLog): { shot: ShotResult; key: number } | null {
  const [latest, setLatest] = useState<{ shot: ShotResult; key: number } | null>(null);
  const seen = useRef<number | null>(null);

  useEffect(() => {
    if (seen.current === null) {
      seen.current = shots.length;
      return;
    }
    if (shots.length > seen.current) {
      seen.current = shots.length;
      setLatest({ shot: shots[shots.length - 1], key: shots.length });
    } else if (shots.length < seen.current) {
      // New game: the log has been emptied.
      seen.current = shots.length;
      setLatest(null);
    }
  }, [shots]);

  return latest;
}

export function Board({
  variant,
  shots,
  placements,
  onCellClick,
  disabled = false,
  previewPlacement = null,
  previewValid = true,
  compact = false,
  onImpact,
  tilted = false,
}: BoardProps) {
  const states = buildCellStates(shots, variant === 'own' ? placements : null);
  // On the enemy board only the ships you have already sunk are drawn.
  const visibleShips = variant === 'own' ? (placements ?? []) : sunkPlacements(shots);
  // Without headers the grid starts at 1; with them, at 2.
  const offset = compact ? 1 : 2;

  const latest = useLatestShot(shots);
  const play = useAudioStore((state) => state.play);

  // Cannon on the way out, blast on arrival: the sound tracks the shell.
  useEffect(() => {
    if (!latest) return;
    play('cannon');
    const impact = setTimeout(() => {
      const { outcome } = latest.shot;
      play(outcome === 'miss' ? 'splash' : outcome === 'sunk' ? 'sink' : 'explosion');
      onImpact?.(outcome);
    }, FLIGHT_MS);
    return () => clearTimeout(impact);
    // `onImpact` gets a new identity on every parent render and would
    // reschedule the impact; only the shot itself should restart it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latest, play]);

  return (
    <div className={tilted ? 'board-stage' : undefined}>
      <div className={compact ? 'board-grid board-grid--compact' : 'board-grid'}>
        {!compact && (
          <>
            <span aria-hidden style={{ gridRow: 1, gridColumn: 1 }} />
            {COLUMN_LABELS.map((label, col) => (
              <span
                key={label}
                style={{ gridRow: 1, gridColumn: col + 2 }}
                className="billboard text-center text-[0.58rem] font-bold uppercase tracking-wide text-foam/40"
              >
                {label}
              </span>
            ))}
            {ROW_LABELS.map((label, row) => (
              <span
                key={label}
                style={{ gridRow: row + 2, gridColumn: 1 }}
                className="billboard flex items-center justify-center text-[0.58rem] font-bold text-foam/40"
              >
                {label}
              </span>
            ))}
          </>
        )}

        {ROW_LABELS.map((_, row) =>
          COLUMN_LABELS.map((__, col) => (
            <BoardCell
              key={`${row},${col}`}
              row={row}
              col={col}
              offset={offset}
              state={states.get(cellKey({ row, col }))}
              variant={variant}
              disabled={disabled}
              onCellClick={onCellClick}
            />
          )),
        )}

        {visibleShips.map((placement) => (
          <ShipOverlay
            key={placement.shipId}
            placement={placement}
            offset={offset}
            compact={compact}
            sunk={isSunk(placement, states)}
            tilted={tilted}
          />
        ))}

        {previewPlacement && (
          <PreviewOverlay placement={previewPlacement} offset={offset} valid={previewValid} />
        )}

        {latest && (
          <span
            className="billboard-impact pointer-events-none relative z-40"
            style={{
              gridRow: latest.shot.cell.row + offset,
              gridColumn: latest.shot.cell.col + offset,
            }}
          >
            <ImpactEffect
              outcome={latest.shot.outcome}
              from={variant === 'enemy' ? 'bottom' : 'top'}
              shotKey={latest.key}
            />
          </span>
        )}
      </div>
    </div>
  );
}

function isSunk(placement: Placement, states: Map<string, CellState>): boolean {
  return placementCells(placement).every((cell) => states.get(cellKey(cell))?.shot === 'sunk');
}

interface BoardCellProps {
  row: number;
  col: number;
  offset: number;
  state?: CellState;
  variant: 'own' | 'enemy';
  disabled: boolean;
  onCellClick?: (cell: Cell) => void;
}

function BoardCell({ row, col, offset, state, variant, disabled, onCellClick }: BoardCellProps) {
  const className = [
    'board-cell shadow-[inset_0_0_0_1px_rgba(232,242,248,0.05)]',
    state?.shipId && variant === 'own' ? 'bg-deck' : 'bg-sea/45',
  ].join(' ');
  const label = `${COLUMN_LABELS[col]}${row + 1}${describeState(state?.shot)}`;
  // Explicit position: ships are grid items too and, without this, they
  // would displace the auto-placed cells. The z-index on a cell that has
  // been shot lifts it above the ship layer: the marker lives inside the
  // cell, so without it the ship would cover it.
  const position = {
    gridRow: row + offset,
    gridColumn: col + offset,
    zIndex: state?.shot ? 20 : undefined,
  };
  const marker = <Marker outcome={state?.shot} />;

  // Without `onCellClick` the cell is not a control: a disabled <button>
  // dispatches no pointer events and would break dragging during placement.
  if (!onCellClick) {
    return (
      <div data-cell={`${row},${col}`} aria-label={label} style={position} className={className}>
        {marker}
      </div>
    );
  }

  return (
    <button
      type="button"
      data-cell={`${row},${col}`}
      disabled={disabled || state?.shot !== undefined}
      onClick={() => onCellClick({ row, col })}
      aria-label={label}
      style={position}
      className={`${className} ${disabled ? 'cursor-default' : 'cursor-crosshair hover:bg-sea/70'}`}
    >
      {marker}
    </button>
  );
}

function describeState(shot: 'miss' | 'hit' | 'sunk' | undefined): string {
  if (shot === 'miss') return ', agua';
  if (shot === 'hit') return ', tocado';
  if (shot === 'sunk') return ', hundido';
  return '';
}

function Marker({ outcome }: { outcome?: 'miss' | 'hit' | 'sunk' }) {
  if (!outcome) return null;
  if (outcome === 'miss') {
    return (
      <motion.span
        initial={{ scale: 0.2, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="absolute inset-0 z-20 m-auto h-1.5 w-1.5 rounded-full bg-foam/50"
      />
    );
  }
  return (
    <motion.span
      initial={{ scale: 0.3, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className={[
        'absolute inset-0 z-20 flex items-center justify-center rounded-[3px]',
        outcome === 'sunk' ? 'bg-blood/90' : 'bg-ember/85',
      ].join(' ')}
    >
      <svg
        viewBox="0 0 12 12"
        className="h-[45%] w-[45%]"
        fill="none"
        stroke="#04101d"
        strokeWidth={2.4}
        strokeLinecap="round"
        aria-hidden
      >
        <path d="M3 3l6 6M9 3l-6 6" />
      </svg>
    </motion.span>
  );
}

/** Draws a ship as one continuous piece over the grid, not cell by cell. */
function ShipOverlay({
  placement,
  offset,
  compact,
  sunk,
  tilted,
}: {
  placement: Placement;
  offset: number;
  compact: boolean;
  sunk: boolean;
  tilted: boolean;
}) {
  const ship = getShip(placement.shipId);
  if (!ship) return null;
  const horizontal = placement.orientation === 'horizontal';

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{
        opacity: 1,
        scale: 1,
        // Lifting them off the plane is what creates the sense of volume.
        z: tilted ? (sunk ? 2 : 10) : 0,
      }}
      style={{
        gridColumn: `${placement.col + offset} / span ${horizontal ? ship.size : 1}`,
        gridRow: `${placement.row + offset} / span ${horizontal ? 1 : ship.size}`,
        boxShadow: sunk ? undefined : `inset 0 0 0 1px ${ship.color}8c, 0 2px 0 rgba(0,0,0,0.4)`,
      }}
      className={[
        // Sunk goes above the impact markers (z-20): the wreck is the
        // information, and the red cells would otherwise hide it.
        'pointer-events-none relative flex items-center justify-center',
        sunk ? 'z-30' : 'z-10 overflow-hidden',
        compact ? 'rounded-[3px]' : 'rounded-md',
        sunk ? '' : 'bg-gradient-to-br from-[#16405d] to-hull',
      ].join(' ')}
      title={`${ship.name} — ${ship.crew}`}
    >
      {sunk ? (
        <Wreck
          shipId={placement.shipId}
          size={ship.size}
          horizontal={horizontal}
          compact={compact}
        />
      ) : (
        <>
          <BoardShipArt
            shipId={placement.shipId}
            vertical={!horizontal}
            sunk={false}
            simplified={compact}
          />
          {/* The colour stripe identifies the ship even when it is tiny. */}
          <span
            aria-hidden
            className={
              horizontal ? 'absolute inset-y-0 left-0 w-[3px]' : 'absolute inset-x-0 top-0 h-[3px]'
            }
            style={{ background: ship.color }}
          />
        </>
      )}
    </motion.div>
  );
}

/**
 * The sunk ship, broken in two at the middle.
 *
 * Each half clips the same drawing with `clip-path` and pivots on the break
 * point, so the two pieces start flush and open up like a splitting hull.
 * Rotating the element rotates its clip too, which is exactly what keeps
 * each half a proper half-bow and half-stern.
 */
function Wreck({
  shipId,
  size,
  horizontal,
  compact,
}: {
  shipId: ShipId;
  size: number;
  horizontal: boolean;
  compact: boolean;
}) {
  // The pivot is the break point, so the free end swings in proportion to
  // the length: at a fixed angle a five-cell ship would throw its halves
  // clean off the board. The longer the ship, the smaller the angle.
  const tilt = 34 / size + 6;
  const halves = horizontal
    ? [
        { clip: 'inset(0 50% 0 0)', origin: '100% 50%', rotate: -tilt, x: -3 },
        { clip: 'inset(0 0 0 50%)', origin: '0% 50%', rotate: tilt * 1.15, x: 3 },
      ]
    : [
        { clip: 'inset(0 0 50% 0)', origin: '50% 100%', rotate: tilt, x: -3 },
        { clip: 'inset(50% 0 0 0)', origin: '50% 0%', rotate: -tilt * 1.15, x: 3 },
      ];

  return (
    <>
      {halves.map((half, i) => (
        <motion.span
          key={i}
          initial={{ rotate: 0, x: 0, y: 0, opacity: 1 }}
          animate={{ rotate: half.rotate, x: half.x, y: 4, opacity: 0.82 }}
          transition={{ type: 'spring', stiffness: 70, damping: 11, delay: i * 0.06 }}
          style={{ clipPath: half.clip, transformOrigin: half.origin }}
          className="absolute inset-0"
        >
          <BoardShipArt shipId={shipId} vertical={!horizontal} sunk simplified={compact} />
        </motion.span>
      ))}
    </>
  );
}

/** Translucent block showing where the ship in hand would land. */
function PreviewOverlay({
  placement,
  offset,
  valid,
}: {
  placement: Placement;
  offset: number;
  valid: boolean;
}) {
  const ship = getShip(placement.shipId);
  if (!ship) return null;
  const horizontal = placement.orientation === 'horizontal';

  return (
    <div
      style={{
        gridColumn: `${placement.col + offset} / span ${horizontal ? ship.size : 1}`,
        gridRow: `${placement.row + offset} / span ${horizontal ? 1 : ship.size}`,
      }}
      className={[
        'pointer-events-none z-30 flex items-center justify-center rounded-md border-2 border-dashed',
        valid
          ? 'border-gold bg-gold/50 shadow-[0_0_18px_rgba(242,177,52,0.55)]'
          : 'border-ember bg-ember/50',
      ].join(' ')}
    >
      <span
        className={[
          'truncate px-1 text-[0.52rem] font-bold uppercase tracking-[0.14em] text-abyss',
          horizontal ? '' : '[writing-mode:vertical-rl]',
        ].join(' ')}
      >
        {ship.short}
      </span>
    </div>
  );
}
