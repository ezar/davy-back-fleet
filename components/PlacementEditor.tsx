'use client';

import { useCallback, useMemo, useState } from 'react';
import { FLEET, getShip } from '@/lib/fleet';
import {
  canPlace,
  cellKey,
  placementCells,
  randomFleet,
  randomPlacementFor,
} from '@/lib/gameLogic';
import type { Cell, Orientation, Placement, ShipId } from '@/lib/types';
import { Board } from './Board';

interface PlacementEditorProps {
  placements: Placement[];
  onChange: (placements: Placement[]) => void;
  disabled?: boolean;
}

/** Barco que el jugador tiene "en la mano", arrastrando o esperando destino. */
interface Held {
  shipId: ShipId;
  orientation: Orientation;
  /** Casilla del barco por la que se ha agarrado, para que siga al dedo con naturalidad. */
  grabOffset: number;
  /** Posición previa, a la que se vuelve si se suelta en un sitio inválido. */
  origin: Placement | null;
  dragging: boolean;
  /** Celda donde empezó el gesto: si se suelta ahí mismo, es un toque y el barco rota. */
  downCell?: Cell;
}

/** Ancla resultante de soltar el barco sobre `cell` habiéndolo agarrado por `grabOffset`. */
function anchorFor(cell: Cell, held: Held): Placement {
  return held.orientation === 'horizontal'
    ? { shipId: held.shipId, row: cell.row, col: cell.col - held.grabOffset, orientation: held.orientation }
    : { shipId: held.shipId, row: cell.row - held.grabOffset, col: cell.col, orientation: held.orientation };
}

function cellFromPointer(x: number, y: number): Cell | null {
  const element = document.elementFromPoint(x, y);
  const target = element?.closest<HTMLElement>('[data-cell]');
  if (!target?.dataset.cell) return null;
  const [row, col] = target.dataset.cell.split(',').map(Number);
  return { row, col };
}

export function PlacementEditor({ placements, onChange, disabled = false }: PlacementEditorProps) {
  const [held, setHeld] = useState<Held | null>(null);
  const [hover, setHover] = useState<Cell | null>(null);

  const placedIds = useMemo(() => new Set(placements.map((p) => p.shipId)), [placements]);
  const pending = FLEET.filter((ship) => !placedIds.has(ship.id));

  /** Vista previa del barco en la mano sobre la celda apuntada. */
  const previewPlacement = held && hover ? anchorFor(hover, held) : null;
  const previewValid = previewPlacement ? canPlace(placements, previewPlacement) : true;
  const preview = previewPlacement ? placementCells(previewPlacement) : [];

  const drop = useCallback(
    (cell: Cell | null) => {
      if (!held) return;
      const rest = placements.filter((p) => p.shipId !== held.shipId);
      const settle = (placement: Placement | null) => {
        if (placement) onChange([...rest, placement]);
        else if (held.origin) onChange([...rest, held.origin]);
        setHeld(null);
        setHover(null);
      };

      // Soltar sobre la misma casilla en la que se pulsó no es un movimiento:
      // es un toque, y un toque gira el barco.
      const tapped = cell && held.downCell && cellKey(cell) === cellKey(held.downCell);
      if (tapped && held.origin) {
        const flipped: Held = {
          ...held,
          orientation: held.orientation === 'horizontal' ? 'vertical' : 'horizontal',
        };
        const options = [
          anchorFor(cell, flipped),
          anchorFor(cell, { ...flipped, grabOffset: 0 }),
        ];
        settle(options.find((option) => canPlace(rest, option)) ?? null);
        return;
      }

      const target = cell ? anchorFor(cell, held) : null;
      settle(target && canPlace(rest, target) ? target : null);
    },
    [held, onChange, placements],
  );

  const handlePointerDown = (event: React.PointerEvent) => {
    if (disabled) return;
    const cell = cellFromPointer(event.clientX, event.clientY);
    if (!cell) return;

    // ¿Hay un barco bajo el dedo? Se levanta y se arrastra.
    const existing = placements.find((placement) =>
      placementCells(placement).some((c) => cellKey(c) === cellKey(cell)),
    );
    if (existing) {
      const offset = placementCells(existing).findIndex((c) => cellKey(c) === cellKey(cell));
      event.currentTarget.setPointerCapture(event.pointerId);
      setHeld({
        shipId: existing.shipId,
        orientation: existing.orientation,
        grabOffset: Math.max(offset, 0),
        origin: existing,
        dragging: true,
        downCell: cell,
      });
      setHover(cell);
      onChange(placements.filter((p) => p.shipId !== existing.shipId));
      return;
    }

    // Si no, se coloca el barco que estuviera seleccionado en el muelle.
    if (held && !held.dragging) {
      setHover(cell);
      drop(cell);
    }
  };

  const handlePointerMove = (event: React.PointerEvent) => {
    if (!held?.dragging) return;
    const cell = cellFromPointer(event.clientX, event.clientY);
    if (cell) setHover(cell);
  };

  const handlePointerUp = (event: React.PointerEvent) => {
    if (!held?.dragging) return;
    drop(cellFromPointer(event.clientX, event.clientY));
  };

  /** Rota el barco en la mano, o el último colocado si no hay ninguno. */
  const rotate = () => {
    if (held) {
      setHeld({
        ...held,
        orientation: held.orientation === 'horizontal' ? 'vertical' : 'horizontal',
      });
      return;
    }
  };

  return (
    <div className="space-y-4">
      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={() => drop(null)}
        className="touch-none"
      >
        <PlacementBoard placements={placements} preview={preview} previewValid={previewValid} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => onChange(randomFleet())}
          disabled={disabled}
          className="rounded-lg bg-gold px-3 py-2 text-sm font-bold text-abyss shadow-plank transition hover:brightness-110 disabled:opacity-40"
        >
          Colocación aleatoria
        </button>
        <button
          type="button"
          onClick={() => onChange([])}
          disabled={disabled || placements.length === 0}
          className="rounded-lg border border-foam/20 px-3 py-2 text-sm font-semibold text-foam/80 transition hover:border-foam/40 disabled:opacity-40"
        >
          Vaciar
        </button>
        {held && (
          <button
            type="button"
            onClick={rotate}
            className="rounded-lg border border-gold/60 px-3 py-2 text-sm font-semibold text-gold"
          >
            Rotar ({held.orientation === 'horizontal' ? 'horizontal' : 'vertical'})
          </button>
        )}
      </div>

      <Dock
        pending={pending.map((ship) => ship.id)}
        heldId={held?.shipId ?? null}
        disabled={disabled}
        onSelect={(shipId) =>
          setHeld({ shipId, orientation: 'horizontal', grabOffset: 0, origin: null, dragging: false })
        }
        onAutoPlace={(shipId) => {
          const placement = randomPlacementFor(shipId, placements);
          if (placement) onChange([...placements, placement]);
        }}
      />

      <p className="text-xs leading-relaxed text-foam/50">
        Arrastra un barco para moverlo y tócalo sin arrastrar para girarlo. Los barcos no pueden
        tocarse entre sí, ni siquiera en diagonal.
      </p>
    </div>
  );
}

/** Tablero de colocación: cada casilla lleva `data-cell` para el arrastre. */
function PlacementBoard({
  placements,
  preview,
  previewValid,
}: {
  placements: Placement[];
  preview: Cell[];
  previewValid: boolean;
}) {
  return (
    <Board
      variant="own"
      shots={[]}
      placements={placements}
      preview={preview}
      previewValid={previewValid}
    />
  );
}

/** Muelle con los barcos que aún no están en el tablero. */
function Dock({
  pending,
  heldId,
  disabled,
  onSelect,
  onAutoPlace,
}: {
  pending: ShipId[];
  heldId: ShipId | null;
  disabled: boolean;
  onSelect: (shipId: ShipId) => void;
  onAutoPlace: (shipId: ShipId) => void;
}) {
  if (pending.length === 0) {
    return (
      <p className="rounded-lg border border-gold/30 bg-gold/10 px-3 py-2 text-sm text-gold">
        Flota completa. ¡Lista para zarpar!
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <h3 className="text-xs font-bold uppercase tracking-widest text-foam/50">En el muelle</h3>
      <ul className="flex flex-wrap gap-2">
        {pending.map((shipId) => {
          const ship = getShip(shipId);
          if (!ship) return null;
          return (
            <li key={shipId}>
              <button
                type="button"
                disabled={disabled}
                onClick={() => onSelect(shipId)}
                onDoubleClick={() => onAutoPlace(shipId)}
                className={[
                  'rounded-lg border px-3 py-2 text-left transition',
                  heldId === shipId
                    ? 'border-gold bg-gold/20 shadow-glow'
                    : 'border-foam/15 bg-hull/60 hover:border-gold/50',
                ].join(' ')}
              >
                {/* SVG local y diminuto: next/image no aporta nada aquí. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={ship.art} alt="" width={120} height={96} className="mb-1 h-6 w-auto" />
                <span className="block text-sm font-bold">{ship.name}</span>
                <span className="block text-[0.65rem] uppercase tracking-wide text-foam/50">
                  {ship.size} casillas · {ship.crew}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
