'use client';

import { motion } from 'framer-motion';
import { getShip } from '@/lib/fleet';
import { COLUMN_LABELS, ROW_LABELS, cellKey, placementCells } from '@/lib/gameLogic';
import { type CellState, buildCellStates, sunkPlacements } from '@/lib/boardView';
import type { Cell, Placement, ShotLog } from '@/lib/types';

export interface BoardProps {
  /**
   * `own`: tu tablero, con tu flota a la vista.
   * `enemy`: el del rival, donde solo se ve lo que ya has disparado.
   */
  variant: 'own' | 'enemy';
  shots: ShotLog;
  placements?: Placement[] | null;
  onCellClick?: (cell: Cell) => void;
  disabled?: boolean;
  /** Celdas resaltadas mientras se coloca un barco. */
  preview?: Cell[];
  previewValid?: boolean;
  /** Barco que se está colocando ahora mismo, para atenuarlo en la capa de flota. */
  dimShipId?: string | null;
}

const CELL_BASE =
  'board-cell bg-sea/45 ring-1 ring-inset ring-white/5 hover:ring-gold/40';

export function Board({
  variant,
  shots,
  placements,
  onCellClick,
  disabled = false,
  preview = [],
  previewValid = true,
  dimShipId = null,
}: BoardProps) {
  const states = buildCellStates(shots, variant === 'own' ? placements : null);
  const previewKeys = new Set(preview.map(cellKey));
  // En el tablero rival solo se dibujan los barcos que ya has hundido.
  const visibleShips =
    variant === 'own' ? (placements ?? []) : sunkPlacements(shots);

  return (
    <div className="board-grid select-none">
      <span aria-hidden style={{ gridRow: 1, gridColumn: 1 }} />
      {COLUMN_LABELS.map((label, col) => (
        <span
          key={label}
          style={{ gridRow: 1, gridColumn: col + 2 }}
          className="text-center text-[0.6rem] font-semibold uppercase tracking-wide text-foam/45"
        >
          {label}
        </span>
      ))}

      {ROW_LABELS.map((rowLabel, row) => (
        <Row
          key={rowLabel}
          row={row}
          rowLabel={rowLabel}
          states={states}
          previewKeys={previewKeys}
          previewValid={previewValid}
          disabled={disabled}
          onCellClick={onCellClick}
          variant={variant}
        />
      ))}

      {visibleShips.map((placement) => (
        <ShipOverlay
          key={placement.shipId}
          placement={placement}
          sunk={isSunk(placement, states)}
          dimmed={dimShipId === placement.shipId}
        />
      ))}
    </div>
  );
}

function isSunk(placement: Placement, states: Map<string, CellState>): boolean {
  return placementCells(placement).every(
    (cell) => states.get(cellKey(cell))?.shot === 'sunk',
  );
}

interface RowProps extends Pick<BoardProps, 'variant' | 'disabled' | 'onCellClick'> {
  row: number;
  rowLabel: string;
  states: ReturnType<typeof buildCellStates>;
  previewKeys: Set<string>;
  previewValid: boolean;
}

function Row({
  row,
  rowLabel,
  states,
  previewKeys,
  previewValid,
  disabled,
  onCellClick,
  variant,
}: RowProps) {
  return (
    <>
      <span
        style={{ gridRow: row + 2, gridColumn: 1 }}
        className="flex items-center justify-center text-[0.6rem] font-semibold text-foam/45"
      >
        {rowLabel}
      </span>
      {COLUMN_LABELS.map((_, col) => {
        const cell = { row, col };
        const key = cellKey(cell);
        const state = states.get(key);
        const previewed = previewKeys.has(key);

        const className = [
          CELL_BASE,
          previewed
            ? previewValid
              ? 'bg-gold/60 ring-gold'
              : 'bg-ember/60 ring-ember'
            : '',
          !previewed && state?.shipId && variant === 'own' ? 'bg-deck' : '',
        ].join(' ');
        const label = `${COLUMN_LABELS[col]}${row + 1}${describeState(state?.shot)}`;
        // Posición explícita: los barcos también son elementos de la rejilla y,
        // sin esto, desplazarían a las casillas auto-colocadas.
        const position = { gridRow: row + 2, gridColumn: col + 2 };

        // Sin `onCellClick` la casilla no es un control: un <button disabled>
        // no despacha eventos de puntero y rompería el arrastre al colocar.
        if (!onCellClick) {
          return (
            <div
              key={key}
              data-cell={`${row},${col}`}
              aria-label={label}
              style={position}
              className={className}
            >
              <Marker outcome={state?.shot} />
            </div>
          );
        }

        return (
          <button
            key={key}
            type="button"
            data-cell={`${row},${col}`}
            disabled={disabled || state?.shot !== undefined}
            onClick={() => onCellClick(cell)}
            aria-label={label}
            style={position}
            className={`${className} ${disabled ? 'cursor-default' : 'cursor-crosshair'}`}
          >
            <Marker outcome={state?.shot} />
          </button>
        );
      })}
    </>
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
        className="absolute inset-0 z-20 m-auto h-1.5 w-1.5 rounded-full bg-foam/60"
      />
    );
  }
  return (
    <motion.span
      initial={{ scale: 0.3, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className={[
        'absolute inset-0 z-20 flex items-center justify-center rounded-[3px] text-[0.65rem] font-black',
        outcome === 'sunk' ? 'bg-blood/85 text-jolly' : 'bg-ember/80 text-abyss',
      ].join(' ')}
    >
      ✕
    </motion.span>
  );
}

/** Dibuja un barco como una pieza continua sobre la rejilla, no celda a celda. */
function ShipOverlay({
  placement,
  sunk,
  dimmed,
}: {
  placement: Placement;
  sunk: boolean;
  dimmed: boolean;
}) {
  const ship = getShip(placement.shipId);
  if (!ship) return null;
  const horizontal = placement.orientation === 'horizontal';

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: dimmed ? 0.35 : 1, scale: 1 }}
      style={{
        // +2: la primera fila y columna de la rejilla son las etiquetas.
        gridColumn: `${placement.col + 2} / span ${horizontal ? ship.size : 1}`,
        gridRow: `${placement.row + 2} / span ${horizontal ? 1 : ship.size}`,
      }}
      className={[
        'pointer-events-none z-10 flex items-center justify-center overflow-hidden rounded-md',
        'border shadow-plank',
        sunk
          ? 'border-blood/70 bg-blood/45'
          : 'border-gold/45 bg-gradient-to-br from-deck to-hull',
      ].join(' ')}
      title={`${ship.name} — ${ship.crew}`}
    >
      {/* Hundido, las marcas de impacto tapan el rótulo: mejor no competir con ellas. */}
      {!sunk && (
        <span
          className={[
            'truncate px-1 text-[0.5rem] font-bold uppercase tracking-wider text-gold/80',
            horizontal ? '' : '[writing-mode:vertical-rl]',
          ].join(' ')}
        >
          {ship.name}
        </span>
      )}
    </motion.div>
  );
}
