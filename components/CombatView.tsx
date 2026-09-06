'use client';

import type { ReactNode } from 'react';
import { FLEET } from '@/lib/fleet';
import { cellLabel } from '@/lib/gameLogic';
import type { Cell, Placement, ShotLog } from '@/lib/types';
import { Board } from './Board';
import { EnemyFleetChips, OwnFleetStatus, afloatCount } from './FleetStatus';

interface CombatViewProps {
  opponentName: string;
  yourTurn: boolean;
  /** Texto que se muestra cuando no es tu turno. */
  waitingLabel: string;
  /** Disparos que has hecho tú al tablero rival. */
  enemyShots: ShotLog;
  /** Disparos que has recibido en el tuyo. */
  ownShots: ShotLog;
  ownPlacements: Placement[] | null;
  onShoot: (cell: Cell) => void;
  shootDisabled: boolean;
}

export function CombatView({
  opponentName,
  yourTurn,
  waitingLabel,
  enemyShots,
  ownShots,
  ownPlacements,
  onShoot,
  shootDisabled,
}: CombatViewProps) {
  return (
    <div className="space-y-3">
      <TurnBanner yourTurn={yourTurn} waitingLabel={waitingLabel} />
      <LastMove opponentName={opponentName} ownShots={ownShots} />

      <section className="space-y-2">
        <SectionHeader
          title={`Flota de ${opponentName}`}
          accent
          afloat={afloatCount(enemyShots)}
        />
        <Board variant="enemy" shots={enemyShots} onCellClick={onShoot} disabled={shootDisabled} />
        <EnemyFleetChips shots={enemyShots} />
      </section>

      <div className="h-px bg-gradient-to-r from-transparent via-foam/14 to-transparent" />

      <section className="space-y-2">
        <SectionHeader title="Tu flota" afloat={afloatCount(ownShots)} />
        <div className="flex items-start gap-3">
          <div className="w-[11.5rem] shrink-0">
            <Board variant="own" shots={ownShots} placements={ownPlacements} compact />
          </div>
          <OwnFleetStatus shots={ownShots} placements={ownPlacements} />
        </div>
      </section>
    </div>
  );
}

function SectionHeader({
  title,
  afloat,
  accent = false,
}: {
  title: string;
  afloat: number;
  accent?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <h2
        className={[
          'truncate text-[0.62rem] font-bold uppercase tracking-[0.22em]',
          accent ? 'text-gold/85' : 'text-foam/45',
        ].join(' ')}
      >
        {title}
      </h2>
      <span className="shrink-0 text-xs font-bold text-foam/50">
        {afloat} / {FLEET.length} a flote
      </span>
    </div>
  );
}

function TurnBanner({ yourTurn, waitingLabel }: { yourTurn: boolean; waitingLabel: string }) {
  if (!yourTurn) {
    return (
      <p
        aria-live="polite"
        className="flex h-[46px] items-center justify-center rounded-xl border border-foam/10 bg-hull/50 text-sm text-foam/60"
      >
        {waitingLabel}
      </p>
    );
  }

  return (
    <p
      aria-live="polite"
      className="flex h-[46px] items-center justify-center gap-2.5 rounded-xl border border-gold/55 bg-gold/12 shadow-glow"
    >
      <svg
        viewBox="0 0 24 24"
        className="h-[18px] w-[18px]"
        fill="none"
        stroke="#f2b134"
        strokeWidth={1.7}
        strokeLinecap="round"
        aria-hidden
      >
        <circle cx="12" cy="12" r="8" />
        <circle cx="12" cy="12" r="2.6" fill="#f2b134" stroke="none" />
        <path d="M12 1.5v3.2M12 19.3v3.2M22.5 12h-3.2M4.7 12H1.5" />
      </svg>
      <span className="font-display text-[0.95rem] font-black tracking-[0.14em] text-gold">
        TU TURNO · DISPARA
      </span>
    </p>
  );
}

/**
 * Qué hizo el rival en su último disparo. En una partida por turnos a
 * distancia puedes volver al juego minutos después: sin esto no hay forma
 * de saber qué pasó mientras no mirabas.
 */
function LastMove({ opponentName, ownShots }: { opponentName: string; ownShots: ShotLog }) {
  const last = ownShots[ownShots.length - 1];
  if (!last) return null;

  const outcome =
    last.outcome === 'miss' ? 'agua' : last.outcome === 'hit' ? '¡tocado!' : '¡hundido!';

  return (
    <p className="flex items-center justify-center gap-2 text-xs text-foam/45">
      <span
        aria-hidden
        className={[
          'h-1.5 w-1.5 rounded-full',
          last.outcome === 'miss' ? 'bg-foam/35' : 'bg-ember',
        ].join(' ')}
      />
      {capitalize(opponentName)} disparó a{' '}
      <span className="font-mono text-foam/70">{cellLabel(last.cell)}</span> · {outcome}
    </p>
  );
}

/** "la IA" abre frase en la línea de última jugada, y ahí va con mayúscula. */
function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Cabecera común de las pantallas de partida. */
export function GameHeader({ right }: { right?: ReactNode }) {
  return (
    <header className="flex h-9 items-center justify-between gap-3">
      <a href="/" className="flex items-center gap-1.5 text-sm font-medium text-foam/55 hover:text-foam">
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
          <path d="M15 5l-7 7 7 7" />
        </svg>
        Inicio
      </a>
      {right}
    </header>
  );
}
