'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { Board } from '@/components/Board';
import { FleetStatus } from '@/components/FleetStatus';
import { PlacementEditor } from '@/components/PlacementEditor';
import { SunkBanner } from '@/components/SunkBanner';
import { FLEET } from '@/lib/fleet';
import { useGameStore } from '@/store/useGameStore';

export default function SoloPage() {
  const {
    phase,
    playerFleet,
    shotsAtAi,
    shotsAtPlayer,
    turn,
    winner,
    aiThinking,
    lastSunkByPlayer,
    lastSunkByAi,
    newGame,
    setPlayerFleet,
    startBattle,
    shoot,
  } = useGameStore();

  // La flota se sortea en el cliente: hacerlo en el servidor rompería la hidratación.
  useEffect(() => {
    if (phase === 'idle') newGame();
  }, [phase, newGame]);

  if (phase === 'idle') {
    return <main className="p-6 text-center text-foam/60">Preparando los mares…</main>;
  }

  return (
    <main className="mx-auto w-full max-w-md space-y-6 px-4 py-6">
      <header className="flex items-center justify-between gap-3">
        <Link href="/" className="text-xs font-semibold text-foam/50 hover:text-foam">
          ← Inicio
        </Link>
        <h1 className="font-display text-lg font-black">
          Contra la <span className="text-gold">IA</span>
        </h1>
        <button
          type="button"
          onClick={newGame}
          className="text-xs font-semibold text-foam/50 hover:text-foam"
        >
          Nueva partida
        </button>
      </header>

      {phase === 'placing' && (
        <section className="space-y-4">
          <h2 className="font-display text-xl font-black">Coloca tu flota</h2>
          <PlacementEditor placements={playerFleet} onChange={setPlayerFleet} />
          <button
            type="button"
            onClick={startBattle}
            disabled={playerFleet.length !== FLEET.length}
            className="w-full rounded-xl bg-gold px-4 py-3 font-display font-black text-abyss shadow-plank transition hover:brightness-110 disabled:opacity-40"
          >
            {playerFleet.length === FLEET.length
              ? '¡A la batalla!'
              : `Faltan ${FLEET.length - playerFleet.length} barcos`}
          </button>
        </section>
      )}

      {(phase === 'battle' || phase === 'finished') && (
        <>
          <StatusBar phase={phase} turn={turn} winner={winner} aiThinking={aiThinking} />

          <section className="space-y-2">
            <h2 className="text-xs font-bold uppercase tracking-widest text-gold/80">
              Flota enemiga
            </h2>
            <Board
              variant="enemy"
              shots={shotsAtAi}
              onCellClick={shoot}
              disabled={phase === 'finished' || turn !== 'player' || aiThinking}
            />
            <FleetStatus shots={shotsAtAi} title="Barcos de la IA" />
          </section>

          <section className="space-y-2">
            <h2 className="text-xs font-bold uppercase tracking-widest text-foam/50">Tu flota</h2>
            <Board variant="own" shots={shotsAtPlayer} placements={playerFleet} />
            <FleetStatus shots={shotsAtPlayer} title="Tus barcos" />
          </section>

          {phase === 'finished' && (
            <button
              type="button"
              onClick={newGame}
              className="w-full rounded-xl bg-gold px-4 py-3 font-display font-black text-abyss shadow-plank"
            >
              Otra partida
            </button>
          )}
        </>
      )}

      <SunkBanner shipId={lastSunkByPlayer} />
      <SunkBanner shipId={lastSunkByAi} byOpponent />
    </main>
  );
}

function StatusBar({
  phase,
  turn,
  winner,
  aiThinking,
}: {
  phase: string;
  turn: 'player' | 'ai';
  winner: 'player' | 'ai' | null;
  aiThinking: boolean;
}) {
  if (phase === 'finished') {
    return (
      <p
        className={[
          'rounded-xl border px-4 py-3 text-center font-display text-lg font-black',
          winner === 'player'
            ? 'border-gold/60 bg-gold/15 text-gold'
            : 'border-blood/60 bg-blood/25 text-jolly',
        ].join(' ')}
      >
        {winner === 'player' ? '¡Rey de los piratas!' : 'Tu flota descansa en el fondo'}
      </p>
    );
  }

  return (
    <p
      aria-live="polite"
      className="rounded-xl border border-foam/10 bg-hull/50 px-4 py-2 text-center text-sm"
    >
      {turn === 'player' && !aiThinking ? (
        <span className="font-bold text-gold">Tu turno: dispara</span>
      ) : (
        <span className="text-foam/60">La IA está apuntando…</span>
      )}
    </p>
  );
}
