'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { CombatView, GameHeader } from '@/components/CombatView';
import { PlacementEditor } from '@/components/PlacementEditor';
import { ResultScreen } from '@/components/ResultScreen';
import { SunkBanner } from '@/components/SunkBanner';
import { useRoom } from '@/hooks/useRoom';
import { FLEET } from '@/lib/fleet';
import { randomFleet } from '@/lib/gameLogic';
import { normalizeRoomCode } from '@/lib/room';
import { useAudioStore } from '@/store/useAudioStore';
import type { Placement } from '@/lib/types';

export default function RoomPage({ params }: { params: { code: string } }) {
  const code = normalizeRoomCode(params.code);
  const { view, error, sunkByYou, sunkByOpponent, placeFleet, shoot, busy } = useRoom(code);
  const [draft, setDraft] = useState<Placement[]>([]);
  const unlockAudio = useAudioStore((state) => state.unlock);

  // A starting fleet is rolled on the client so hydration is not broken, and
  // under the room's rules: the host may have allowed touching ships.
  useEffect(() => {
    if (draft.length === 0 && view && !view.you.ready) {
      setDraft(randomFleet(undefined, view.rules.allowAdjacent));
    }
    // Only when entering the placement phase: after that the player is in charge.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view?.you.ready]);

  if (error) {
    return (
      <main className="mx-auto max-w-md space-y-4 px-5 py-16 text-center">
        <p className="rounded-xl border border-ember/50 bg-ember/15 px-4 py-3 text-sm text-ember">
          {error}
        </p>
        <Link href="/" className="inline-block text-sm font-semibold text-gold">
          Volver al inicio
        </Link>
      </main>
    );
  }

  if (!view) {
    return <main className="p-10 text-center text-foam/60">Conectando con la sala…</main>;
  }

  const opponentName = view.opponent.name ?? 'tu rival';
  const missing = FLEET.length - draft.length;

  return (
    <main className="mx-auto w-full max-w-md space-y-5 px-4 py-5">
      <GameHeader right={<RoomCode code={code} />} />

      {view.phase === 'waiting' && <WaitingForRival code={code} />}

      {(view.phase === 'waiting' || view.phase === 'placing') && !view.you.ready && (
        <section className="space-y-4">
          <div>
            <h1 className="font-display text-[1.6rem] font-black tracking-[0.03em]">
              Coloca tu flota
            </h1>
            <p className="mt-1 text-xs text-foam/50">
              Solo tú ves este tablero.{' '}
              {view.rules.extraTurnOnHit
                ? 'Quien acierta repite turno.'
                : 'El turno alterna en cada disparo.'}
              {view.rules.allowAdjacent && ' Los barcos pueden tocarse.'}
            </p>
          </div>
          <PlacementEditor
            placements={draft}
            onChange={setDraft}
            disabled={busy}
            allowAdjacent={view.rules.allowAdjacent}
          />
          <button
            type="button"
            onClick={() => {
              unlockAudio();
              void placeFleet(draft);
            }}
            disabled={missing > 0 || busy}
            className="h-[54px] w-full rounded-xl bg-gold font-display text-base font-black tracking-[0.07em] text-abyss shadow-plank transition hover:brightness-110 disabled:cursor-not-allowed disabled:bg-foam/10 disabled:text-foam/40"
          >
            {missing === 0 ? 'CONFIRMAR FLOTA' : `FALTAN ${missing} BARCOS`}
          </button>
        </section>
      )}

      {view.phase === 'placing' && view.you.ready && (
        <p className="rounded-xl border border-foam/10 bg-hull/50 px-4 py-8 text-center text-sm text-foam/70">
          Flota lista. Esperando a que {opponentName} coloque la suya…
        </p>
      )}

      {view.phase === 'battle' && (
        <CombatView
          opponentName={opponentName}
          yourTurn={view.yourTurn}
          waitingLabel={`Turno de ${opponentName}…`}
          enemyShots={view.opponent.outgoingShots}
          ownShots={view.you.incomingShots}
          ownPlacements={view.you.placements}
          onShoot={shoot}
          shootDisabled={!view.yourTurn || busy}
        />
      )}

      {view.phase === 'finished' && view.outcome && (
        <ResultScreen
          outcome={view.outcome}
          opponentName={opponentName}
          yourShots={view.opponent.outgoingShots}
          incomingShots={view.you.incomingShots}
        />
      )}

      <SunkBanner shipId={sunkByYou} />
      <SunkBanner shipId={sunkByOpponent} byOpponent />
    </main>
  );
}

function RoomCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  const share = async () => {
    const url = `${window.location.origin}/?code=${code}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Davy Back Fleet', text: `Únete a mi sala: ${code}`, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // The user dismissed the share sheet: nothing to do.
    }
  };

  return (
    <button
      type="button"
      onClick={share}
      className="flex items-center gap-2 rounded-lg border border-gold/45 px-3 py-1.5 font-mono text-sm tracking-[0.24em] text-gold transition hover:bg-gold/10"
    >
      {copied ? '¡Copiado!' : code}
      <svg
        viewBox="0 0 24 24"
        className="h-[14px] w-[14px] shrink-0"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.7}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M9 9h11v11H9z" />
        <path d="M15 5H4v11" />
      </svg>
    </button>
  );
}

function WaitingForRival({ code }: { code: string }) {
  return (
    <section className="rounded-xl border border-gold/30 bg-gold/10 px-4 py-4 text-center">
      <p className="font-display text-lg font-black text-gold">Esperando rival</p>
      <p className="mt-1 text-sm text-foam/70">
        Comparte el código <span className="font-mono tracking-widest">{code}</span> y ve colocando
        tu flota mientras tanto.
      </p>
    </section>
  );
}
