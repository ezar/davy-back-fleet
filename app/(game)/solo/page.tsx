'use client';

import { useEffect } from 'react';
import { CombatView, GameHeader } from '@/components/CombatView';
import { PlacementEditor } from '@/components/PlacementEditor';
import { ResultScreen } from '@/components/ResultScreen';
import { SunkBanner } from '@/components/SunkBanner';
import { FLEET } from '@/lib/fleet';
import { useAudioStore } from '@/store/useAudioStore';
import { useGameStore } from '@/store/useGameStore';

const OPPONENT = 'la IA';

export default function SoloPage() {
  const unlockAudio = useAudioStore((state) => state.unlock);
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

  // The fleet is rolled on the client: doing it on the server would break hydration.
  useEffect(() => {
    if (phase === 'idle') newGame();
  }, [phase, newGame]);

  if (phase === 'idle') {
    return <main className="p-6 text-center text-foam/60">Preparando los mares…</main>;
  }

  const missing = FLEET.length - playerFleet.length;

  return (
    <main className="mx-auto w-full max-w-md space-y-5 px-4 py-5">
      <GameHeader
        right={
          <button
            type="button"
            onClick={newGame}
            className="text-xs font-semibold text-foam/50 hover:text-foam"
          >
            Nueva partida
          </button>
        }
      />

      {phase === 'placing' && (
        <section className="space-y-4">
          <div>
            <h1 className="font-display text-[1.6rem] font-black tracking-[0.03em]">
              Coloca tu flota
            </h1>
            <p className="mt-1 text-xs text-foam/50">
              Contra la IA. Quien acierta repite turno, así que el primer impacto vale doble.
            </p>
          </div>
          <PlacementEditor placements={playerFleet} onChange={setPlayerFleet} />
          <button
            type="button"
            onClick={() => {
              unlockAudio();
              startBattle();
            }}
            disabled={missing > 0}
            className="h-[54px] w-full rounded-xl bg-gold font-display text-base font-black tracking-[0.07em] text-abyss shadow-plank transition hover:brightness-110 disabled:cursor-not-allowed disabled:bg-foam/10 disabled:text-foam/40"
          >
            {missing === 0 ? '¡A LA BATALLA!' : `FALTAN ${missing} BARCOS`}
          </button>
        </section>
      )}

      {phase === 'battle' && (
        <CombatView
          opponentName={OPPONENT}
          yourTurn={turn === 'player' && !aiThinking}
          waitingLabel="La IA está apuntando…"
          enemyShots={shotsAtAi}
          ownShots={shotsAtPlayer}
          ownPlacements={playerFleet}
          onShoot={shoot}
          shootDisabled={turn !== 'player' || aiThinking}
        />
      )}

      {phase === 'finished' && (
        <ResultScreen
          outcome={winner === 'player' ? 'won' : 'lost'}
          opponentName={OPPONENT}
          yourShots={shotsAtAi}
          incomingShots={shotsAtPlayer}
          onRestart={newGame}
        />
      )}

      <SunkBanner shipId={lastSunkByPlayer} />
      <SunkBanner shipId={lastSunkByAi} byOpponent />
    </main>
  );
}
