'use client';

import { type ReactNode, useCallback, useEffect, useState } from 'react';
import { FLEET } from '@/lib/fleet';
import { cellLabel } from '@/lib/gameLogic';
import type { Cell, Placement, ShotLog, ShotOutcome } from '@/lib/types';
import { useAudioStore } from '@/store/useAudioStore';
import { SettingsMenu } from './SettingsMenu';
import { useSettingsStore } from '@/store/useSettingsStore';
import { Board } from './Board';
import { EnemyFleetChips, OwnFleetStatus, afloatCount } from './FleetStatus';

interface CombatViewProps {
  opponentName: string;
  yourTurn: boolean;
  /** Text shown while it is not your turn. */
  waitingLabel: string;
  /** Shots you have fired at the enemy board. */
  enemyShots: ShotLog;
  /** Shots you have taken on your own. */
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
  const [shake, setShake] = useState<'' | 'shake-hit' | 'shake-sunk'>('');
  const unlock = useAudioStore((state) => state.unlock);
  const tilted = useSettingsStore((state) => state.view) === 'tilted';

  const handleImpact = useCallback((outcome: ShotOutcome) => {
    if (outcome === 'miss') return;
    setShake(outcome === 'sunk' ? 'shake-sunk' : 'shake-hit');
  }, []);

  // The animation class has to be released before it can be applied again.
  useEffect(() => {
    if (!shake) return;
    const timer = setTimeout(() => setShake(''), 560);
    return () => clearTimeout(timer);
  }, [shake]);

  return (
    <div className={`space-y-3 ${shake}`}>
      <TurnBanner yourTurn={yourTurn} waitingLabel={waitingLabel} />
      <LastMove opponentName={opponentName} ownShots={ownShots} />

      <section className="space-y-2">
        <SectionHeader title={`Flota de ${opponentName}`} accent afloat={afloatCount(enemyShots)} />
        <Board
          variant="enemy"
          shots={enemyShots}
          onCellClick={(cell) => {
            // First user gesture: the moment the browser lets audio come to life.
            unlock();
            onShoot(cell);
          }}
          disabled={shootDisabled}
          onImpact={handleImpact}
          tilted={tilted}
        />
        <EnemyFleetChips shots={enemyShots} />
      </section>

      <div className="h-px bg-gradient-to-r from-transparent via-foam/14 to-transparent" />

      <section className="space-y-2">
        <SectionHeader title="Tu flota" afloat={afloatCount(ownShots)} />
        {/* Full width, like the enemy board: squeezed into a thumbnail the
            fleet was an unreadable smudge, and your own ships breaking up is
            half of what there is to watch. */}
        <Board
          variant="own"
          shots={ownShots}
          placements={ownPlacements}
          compact
          onImpact={handleImpact}
          tilted={tilted}
        />
        <OwnFleetStatus shots={ownShots} placements={ownPlacements} />
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
 * What the opponent did on their last shot. In a remote turn-based game you
 * can come back minutes later: without this there is no way to know what
 * happened while you were not looking.
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

/** "la IA" opens the last-move sentence, so it needs a capital there. */
function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Shared header for the in-game screens. */
export function GameHeader({ right }: { right?: ReactNode }) {
  return (
    <header className="flex h-9 items-center justify-between gap-3">
      <a
        href="/"
        className="flex items-center gap-1.5 text-sm font-medium text-foam/55 hover:text-foam"
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
          <path d="M15 5l-7 7 7 7" />
        </svg>
        Inicio
      </a>
      <span className="flex items-center gap-2">
        {right}
        <SettingsMenu />
      </span>
    </header>
  );
}
