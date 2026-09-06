'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Board } from '@/components/Board';
import { FleetStatus } from '@/components/FleetStatus';
import { PlacementEditor } from '@/components/PlacementEditor';
import { SunkBanner } from '@/components/SunkBanner';
import { useRoom } from '@/hooks/useRoom';
import { FLEET } from '@/lib/fleet';
import { randomFleet } from '@/lib/gameLogic';
import { normalizeRoomCode } from '@/lib/room';
import type { Placement } from '@/lib/types';

export default function RoomPage({ params }: { params: { code: string } }) {
  const code = normalizeRoomCode(params.code);
  const { view, error, sunkByYou, sunkByOpponent, placeFleet, shoot, busy } = useRoom(code);
  const [draft, setDraft] = useState<Placement[]>([]);

  // Se sortea una flota de partida en el cliente para no romper la hidratación.
  useEffect(() => {
    if (draft.length === 0 && view && !view.you.ready) setDraft(randomFleet());
    // Solo al entrar en fase de colocación: después manda el jugador.
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

  return (
    <main className="mx-auto w-full max-w-md space-y-6 px-4 py-6">
      <header className="flex items-center justify-between gap-3">
        <Link href="/" className="text-xs font-semibold text-foam/50 hover:text-foam">
          ← Inicio
        </Link>
        <RoomCode code={code} />
      </header>

      {view.phase === 'waiting' && <WaitingForRival code={code} />}

      {(view.phase === 'waiting' || view.phase === 'placing') && !view.you.ready && (
        <section className="space-y-4">
          <h2 className="font-display text-xl font-black">Coloca tu flota</h2>
          <PlacementEditor placements={draft} onChange={setDraft} disabled={busy} />
          <button
            type="button"
            onClick={() => placeFleet(draft)}
            disabled={draft.length !== FLEET.length || busy}
            className="w-full rounded-xl bg-gold px-4 py-3 font-display font-black text-abyss shadow-plank transition hover:brightness-110 disabled:opacity-40"
          >
            {draft.length === FLEET.length
              ? 'Confirmar flota'
              : `Faltan ${FLEET.length - draft.length} barcos`}
          </button>
        </section>
      )}

      {view.phase === 'placing' && view.you.ready && (
        <p className="rounded-xl border border-foam/10 bg-hull/50 px-4 py-6 text-center text-sm text-foam/70">
          Flota lista. Esperando a que {view.opponent.name ?? 'tu rival'} coloque la suya…
        </p>
      )}

      {(view.phase === 'battle' || view.phase === 'finished') && (
        <>
          <TurnBar
            phase={view.phase}
            yourTurn={view.yourTurn}
            outcome={view.outcome}
            opponentName={view.opponent.name}
          />

          <section className="space-y-2">
            <h2 className="text-xs font-bold uppercase tracking-widest text-gold/80">
              Flota de {view.opponent.name ?? 'tu rival'}
            </h2>
            <Board
              variant="enemy"
              shots={view.opponent.outgoingShots}
              onCellClick={shoot}
              disabled={!view.yourTurn || busy || view.phase === 'finished'}
            />
            <FleetStatus shots={view.opponent.outgoingShots} title="Barcos enemigos" />
          </section>

          <section className="space-y-2">
            <h2 className="text-xs font-bold uppercase tracking-widest text-foam/50">Tu flota</h2>
            <Board variant="own" shots={view.you.incomingShots} placements={view.you.placements} />
            <FleetStatus shots={view.you.incomingShots} title="Tus barcos" />
          </section>
        </>
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
      // El usuario ha cancelado el diálogo de compartir: no hay nada que hacer.
    }
  };

  return (
    <button
      type="button"
      onClick={share}
      className="rounded-lg border border-gold/50 px-3 py-1.5 font-mono text-sm tracking-[0.25em] text-gold transition hover:bg-gold/10"
    >
      {copied ? '¡Copiado!' : code}
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

function TurnBar({
  phase,
  yourTurn,
  outcome,
  opponentName,
}: {
  phase: string;
  yourTurn: boolean;
  outcome: 'won' | 'lost' | null;
  opponentName: string | null;
}) {
  if (phase === 'finished') {
    return (
      <p
        className={[
          'rounded-xl border px-4 py-3 text-center font-display text-lg font-black',
          outcome === 'won'
            ? 'border-gold/60 bg-gold/15 text-gold'
            : 'border-blood/60 bg-blood/25 text-jolly',
        ].join(' ')}
      >
        {outcome === 'won' ? '¡Rey de los piratas!' : 'Tu flota descansa en el fondo'}
      </p>
    );
  }

  return (
    <p
      aria-live="polite"
      className="rounded-xl border border-foam/10 bg-hull/50 px-4 py-2 text-center text-sm"
    >
      {yourTurn ? (
        <span className="font-bold text-gold">Tu turno: dispara</span>
      ) : (
        <span className="text-foam/60">Turno de {opponentName ?? 'tu rival'}…</span>
      )}
    </p>
  );
}
