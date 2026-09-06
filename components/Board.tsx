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
   * `own`: tu tablero, con tu flota a la vista.
   * `enemy`: el del rival, donde solo se ve lo que ya has disparado.
   */
  variant: 'own' | 'enemy';
  shots: ShotLog;
  placements?: Placement[] | null;
  onCellClick?: (cell: Cell) => void;
  disabled?: boolean;
  /** Barco que se está colocando, dibujado como bloque sobre la rejilla. */
  previewPlacement?: Placement | null;
  previewValid?: boolean;
  /** Versión reducida, sin cabeceras: para el tablero propio durante el combate. */
  compact?: boolean;
  /** Avisa cuando un disparo impacta, para sacudir la pantalla. */
  onImpact?: (outcome: ShotOutcome) => void;
  /** Vista 2.5D: tablero inclinado y barcos levantados sobre el agua. */
  tilted?: boolean;
}

/**
 * Detecta el disparo recién llegado y lo anuncia una sola vez.
 *
 * Con polling, el historial llega como un array nuevo cada segundo aunque no
 * haya cambiado nada, así que la señal es que crezca. En el primer render no
 * dispara nada: si no, al recargar la página en mitad de una partida saldrían
 * de golpe todas las explosiones anteriores.
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
      // Partida nueva: el historial se ha vaciado.
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
  // En el tablero rival solo se dibujan los barcos que ya has hundido.
  const visibleShips = variant === 'own' ? (placements ?? []) : sunkPlacements(shots);
  // Sin cabeceras la rejilla empieza en 1; con ellas, en 2.
  const offset = compact ? 1 : 2;

  const latest = useLatestShot(shots);
  const play = useAudioStore((state) => state.play);

  // Cañonazo al salir y estallido al llegar: el sonido acompaña al proyectil.
  useEffect(() => {
    if (!latest) return;
    play('cannon');
    const impact = setTimeout(() => {
      const { outcome } = latest.shot;
      play(outcome === 'miss' ? 'splash' : outcome === 'sunk' ? 'sink' : 'explosion');
      onImpact?.(outcome);
    }, FLIGHT_MS);
    return () => clearTimeout(impact);
    // `onImpact` cambia de identidad en cada render del padre y volvería a
    // programar el impacto; el disparo es lo único que debe reiniciarlo.
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
  // Posición explícita: los barcos también son elementos de la rejilla y,
  // sin esto, desplazarían a las casillas auto-colocadas. El z-index de una
  // casilla disparada la sube por encima de la capa de barcos: el marcador
  // vive dentro de la casilla, así que sin esto el barco lo taparía.
  const position = {
    gridRow: row + offset,
    gridColumn: col + offset,
    zIndex: state?.shot ? 20 : undefined,
  };
  const marker = <Marker outcome={state?.shot} />;

  // Sin `onCellClick` la casilla no es un control: un <button disabled>
  // no despacha eventos de puntero y rompería el arrastre al colocar.
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

/** Dibuja un barco como una pieza continua sobre la rejilla, no celda a celda. */
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
        // Levantarlos sobre el plano es lo que da la sensación de volumen.
        z: tilted ? (sunk ? 2 : 10) : 0,
      }}
      style={{
        gridColumn: `${placement.col + offset} / span ${horizontal ? ship.size : 1}`,
        gridRow: `${placement.row + offset} / span ${horizontal ? 1 : ship.size}`,
        boxShadow: sunk ? undefined : `inset 0 0 0 1px ${ship.color}8c, 0 2px 0 rgba(0,0,0,0.4)`,
      }}
      className={[
        // Hundido sube por encima de las marcas de impacto (z-20): el pecio es
        // la información, y si no quedaría tapado por las casillas rojas.
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
          {/* La franja de color identifica el barco aunque quede diminuto. */}
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
 * El barco hundido, partido en dos por la mitad.
 *
 * Cada mitad recorta el mismo dibujo con `clip-path` y gira sobre el punto de
 * ruptura, así que las dos piezas encajan al empezar y se abren como un casco
 * que se parte. Al girar el elemento gira también su recorte, que es justo lo
 * que hace que la mitad siga siendo media proa y media popa.
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
  // El giro es sobre el punto de ruptura, así que el extremo libre se desplaza
  // en proporción a la eslora: con un ángulo fijo, un barco de cinco casillas
  // lanzaría sus mitades fuera del tablero. Cuanto más largo, menos ángulo.
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

/** Bloque translúcido que muestra dónde caería el barco que llevas en la mano. */
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
