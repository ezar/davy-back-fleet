'use client';

import { useCallback, useMemo, useState } from 'react';
import { FLEET } from '@/lib/fleet';
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
  /** House rule: may the ships touch? Comes from the room, or from settings in solo. */
  allowAdjacent?: boolean;
}

/** The ship the player is holding, dragging or waiting to drop. */
interface Held {
  shipId: ShipId;
  orientation: Orientation;
  /** Cell of the ship it was grabbed by, so it follows the finger naturally. */
  grabOffset: number;
  /** Previous position, returned to if it is dropped somewhere invalid. */
  origin: Placement | null;
  dragging: boolean;
  /** Cell where the gesture started: dropped on the same one, it is a tap and the ship rotates. */
  downCell?: Cell;
}

/** Anchor for dropping the ship on `cell` having grabbed it by `grabOffset`. */
function anchorFor(cell: Cell, held: Held): Placement {
  return held.orientation === 'horizontal'
    ? {
        shipId: held.shipId,
        row: cell.row,
        col: cell.col - held.grabOffset,
        orientation: held.orientation,
      }
    : {
        shipId: held.shipId,
        row: cell.row - held.grabOffset,
        col: cell.col,
        orientation: held.orientation,
      };
}

function cellFromPointer(x: number, y: number): Cell | null {
  const element = document.elementFromPoint(x, y);
  const target = element?.closest<HTMLElement>('[data-cell]');
  if (!target?.dataset.cell) return null;
  const [row, col] = target.dataset.cell.split(',').map(Number);
  return { row, col };
}

export function PlacementEditor({
  placements,
  onChange,
  disabled = false,
  allowAdjacent = false,
}: PlacementEditorProps) {
  const [held, setHeld] = useState<Held | null>(null);
  const [hover, setHover] = useState<Cell | null>(null);

  const placedIds = useMemo(() => new Set(placements.map((p) => p.shipId)), [placements]);

  /** Preview of the held ship over the cell being pointed at. */
  const previewPlacement = held && hover ? anchorFor(hover, held) : null;
  const previewValid = previewPlacement
    ? canPlace(placements, previewPlacement, allowAdjacent)
    : true;

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

      // Releasing on the same cell it was pressed on is not a move:
      // it is a tap, and a tap rotates the ship.
      const tapped = cell && held.downCell && cellKey(cell) === cellKey(held.downCell);
      if (tapped && held.origin) {
        const flipped: Held = {
          ...held,
          orientation: held.orientation === 'horizontal' ? 'vertical' : 'horizontal',
        };
        const options = [anchorFor(cell, flipped), anchorFor(cell, { ...flipped, grabOffset: 0 })];
        settle(options.find((option) => canPlace(rest, option, allowAdjacent)) ?? null);
        return;
      }

      const target = cell ? anchorFor(cell, held) : null;
      settle(target && canPlace(rest, target, allowAdjacent) ? target : null);
    },
    [held, onChange, placements, allowAdjacent],
  );

  const handlePointerDown = (event: React.PointerEvent) => {
    if (disabled) return;
    const cell = cellFromPointer(event.clientX, event.clientY);
    if (!cell) return;

    // Is there a ship under the finger? Pick it up and drag it.
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

    // If not, drop whichever ship was selected in the list.
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

  const rotateHeld = () => {
    if (!held) return;
    setHeld({
      ...held,
      orientation: held.orientation === 'horizontal' ? 'vertical' : 'horizontal',
    });
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
        <Board
          variant="own"
          shots={[]}
          placements={placements}
          previewPlacement={previewPlacement}
          previewValid={previewValid}
        />
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onChange(randomFleet(undefined, allowAdjacent))}
          disabled={disabled}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gold px-3 py-3 text-sm font-bold text-abyss shadow-plank transition hover:brightness-110 disabled:opacity-40"
        >
          <svg
            viewBox="0 0 24 24"
            className="h-[17px] w-[17px]"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M20 5v5h-5M4 19v-5h5" />
            <path d="M19.5 9A8 8 0 0 0 5.6 6.6M4.5 15a8 8 0 0 0 13.9 2.4" />
          </svg>
          Colocación aleatoria
        </button>
        {held ? (
          <button
            type="button"
            onClick={rotateHeld}
            className="rounded-xl border border-gold/60 px-4 py-3 text-sm font-bold text-gold"
          >
            Rotar
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onChange([])}
            disabled={disabled || placements.length === 0}
            className="rounded-xl border border-foam/20 px-4 py-3 text-sm font-bold text-foam/80 transition hover:border-foam/40 disabled:opacity-40"
          >
            Vaciar
          </button>
        )}
      </div>

      <FleetChecklist
        placedIds={placedIds}
        heldId={held?.shipId ?? null}
        disabled={disabled}
        onSelect={(shipId) =>
          setHeld({
            shipId,
            orientation: 'horizontal',
            grabOffset: 0,
            origin: null,
            dragging: false,
          })
        }
        onAutoPlace={(shipId) => {
          const placement = randomPlacementFor(shipId, placements, undefined, allowAdjacent);
          if (placement) onChange([...placements, placement]);
        }}
      />

      <p className="text-xs leading-relaxed text-foam/45">
        Arrastra un barco para moverlo y tócalo sin arrastrar para girarlo. No pueden tocarse entre
        sí, ni en diagonal.
      </p>
    </div>
  );
}

/**
 * The whole fleet with its status. It replaces the dock: one glance shows
 * what is left to place, and pending ships are selected to drop them.
 */
function FleetChecklist({
  placedIds,
  heldId,
  disabled,
  onSelect,
  onAutoPlace,
}: {
  placedIds: Set<ShipId>;
  heldId: ShipId | null;
  disabled: boolean;
  onSelect: (shipId: ShipId) => void;
  onAutoPlace: (shipId: ShipId) => void;
}) {
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between">
        <h3 className="text-[0.62rem] font-bold uppercase tracking-[0.22em] text-foam/45">
          Tu flota
        </h3>
        <span className="text-xs font-bold text-gold">
          {placedIds.size} de {FLEET.length} colocados
        </span>
      </div>
      <ul className="flex flex-col">
        {FLEET.map((ship) => {
          const placed = placedIds.has(ship.id);
          const selected = heldId === ship.id;
          return (
            <li key={ship.id}>
              <button
                type="button"
                disabled={disabled || placed}
                onClick={() => onSelect(ship.id)}
                onDoubleClick={() => onAutoPlace(ship.id)}
                className={[
                  'flex h-8 w-full items-center gap-2.5 rounded-md px-1 text-xs transition',
                  selected ? 'bg-gold/15' : '',
                  placed ? 'cursor-default' : 'cursor-pointer hover:bg-foam/5',
                ].join(' ')}
              >
                <span
                  aria-hidden
                  className="h-2 w-2 shrink-0 rounded-[2px]"
                  style={{ background: ship.color }}
                />
                <span
                  className={[
                    'flex-1 truncate text-left font-bold',
                    placed ? 'text-foam/80' : 'text-gold',
                  ].join(' ')}
                >
                  {ship.name}
                </span>
                <span className="text-[0.65rem] font-bold text-foam/50">{ship.size}</span>
                <span
                  className={[
                    'w-[4.5rem] text-right text-[0.6rem] font-bold uppercase tracking-[0.12em]',
                    placed ? 'text-foam/35' : 'text-gold',
                  ].join(' ')}
                >
                  {placed ? 'Colocado' : 'Colócalo'}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
