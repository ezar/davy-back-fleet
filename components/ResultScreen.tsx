'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { useEffect } from 'react';
import { FLEET, getShip } from '@/lib/fleet';
import { sunkShipIds } from '@/lib/gameLogic';
import type { ShotLog } from '@/lib/types';
import { useAudioStore } from '@/store/useAudioStore';
import { afloatCount } from './FleetStatus';

interface ResultScreenProps {
  outcome: 'won' | 'lost';
  opponentName: string;
  /** Shots you fired: the shot count and accuracy come from here. */
  yourShots: ShotLog;
  /** Shots taken: how many of your ships are still afloat comes from here. */
  incomingShots: ShotLog;
  /** When given, an immediate rematch is offered (solo mode). */
  onRestart?: () => void;
}

export function ResultScreen({
  outcome,
  opponentName,
  yourShots,
  incomingShots,
  onRestart,
}: ResultScreenProps) {
  const won = outcome === 'won';
  const play = useAudioStore((state) => state.play);

  // Fanfare exactly once, as the screen appears.
  useEffect(() => {
    play(won ? 'victory' : 'defeat');
  }, [won, play]);

  const hits = yourShots.filter((shot) => shot.outcome !== 'miss').length;
  const accuracy = yourShots.length > 0 ? Math.round((hits / yourShots.length) * 100) : 0;
  const afloat = afloatCount(incomingShots);
  // On a win the ships you sank are listed; on a loss, the ones you lost.
  const casualties = sunkShipIds(won ? yourShots : incomingShots);

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="flex flex-col items-center gap-4 pt-4">
        {won ? <CrownEmblem /> : <WreckEmblem />}
        <div className="flex flex-col items-center gap-1.5">
          <span
            className={[
              'text-[0.62rem] font-bold uppercase tracking-[0.36em]',
              won ? 'text-gold/85' : 'text-foam/50',
            ].join(' ')}
          >
            {won ? 'Victoria' : 'Derrota'}
          </span>
          <h1
            className={[
              'text-balance text-center font-display text-[2rem] font-black leading-[1.08]',
              won ? 'text-gold' : 'text-jolly',
            ].join(' ')}
          >
            {won ? '¡REY DE LOS PIRATAS!' : 'TU FLOTA DESCANSA EN EL FONDO'}
          </h1>
          <p className="mt-1 max-w-[18rem] text-center text-sm leading-relaxed text-foam/60">
            {won
              ? `Has enviado al fondo la flota entera de ${opponentName}.`
              : `${opponentName} ha hundido tus cinco barcos. La revancha se sirve fría.`}
          </p>
        </div>
      </div>

      <div className="flex gap-2">
        <Stat value={String(yourShots.length)} label="Disparos" />
        <Stat value={`${accuracy}%`} label="Precisión" />
        <Stat value={`${afloat}/${FLEET.length}`} label="A flote" />
      </div>

      <section className="rounded-2xl border border-foam/10 bg-hull/55 px-4 pb-1 pt-3">
        <h2 className="mb-1 text-[0.62rem] font-bold uppercase tracking-[0.2em] text-foam/45">
          {won ? `Flota hundida de ${opponentName}` : 'Tu flota hundida'}
        </h2>
        <ul className="flex flex-col">
          {casualties.map((shipId) => {
            const ship = getShip(shipId);
            if (!ship) return null;
            return (
              <li
                key={shipId}
                className="flex items-center gap-2.5 border-b border-foam/6 py-2 text-[0.8rem] last:border-0"
              >
                <svg
                  viewBox="0 0 24 24"
                  className="h-[15px] w-[15px] shrink-0"
                  fill="none"
                  stroke="#8c1f1f"
                  strokeWidth={2}
                  strokeLinecap="round"
                  aria-hidden
                >
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
                <span className="flex-1 truncate font-bold text-foam/85">{ship.name}</span>
                <span className="shrink-0 text-[0.65rem] text-foam/45">{ship.crew}</span>
              </li>
            );
          })}
        </ul>
      </section>

      <div className="flex flex-col gap-2.5">
        {onRestart && (
          <button
            type="button"
            onClick={onRestart}
            className="h-[54px] rounded-xl bg-gold font-display text-base font-black tracking-[0.07em] text-abyss shadow-plank transition hover:brightness-110"
          >
            OTRA PARTIDA
          </button>
        )}
        <Link
          href="/"
          className="flex h-12 items-center justify-center rounded-xl border border-foam/16 text-sm font-bold text-foam/70 transition hover:border-foam/35"
        >
          Volver al inicio
        </Link>
      </div>
    </motion.section>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-1 flex-col items-center gap-0.5 rounded-xl border border-foam/10 bg-hull/55 px-1.5 py-3">
      <span className="font-display text-xl font-black leading-none">{value}</span>
      <span className="text-[0.58rem] font-bold uppercase tracking-[0.14em] text-foam/45">
        {label}
      </span>
    </div>
  );
}

function CrownEmblem() {
  return (
    <svg viewBox="0 0 96 96" className="h-24 w-24" fill="none" aria-hidden>
      <circle cx="48" cy="48" r="45" stroke="#f2b134" strokeWidth={1.4} opacity={0.45} />
      <circle cx="48" cy="48" r="36" stroke="#f2b134" strokeWidth={1} opacity={0.25} />
      <path d="M29 57l-4.5-25 13 9.5L48 24l10.5 17.5 13-9.5L67 57z" fill="#f2b134" />
      <path d="M29 61h38v6.5H29z" fill="#f2b134" opacity={0.72} />
    </svg>
  );
}

function WreckEmblem() {
  return (
    <svg viewBox="0 0 96 96" className="h-24 w-24" fill="none" aria-hidden>
      <circle cx="48" cy="48" r="45" stroke="#8c1f1f" strokeWidth={1.4} opacity={0.6} />
      <g transform="rotate(-22 48 52)">
        <path d="M25 55h46l-7 10H32z" fill="#8c1f1f" />
        <path d="M48 55V25" stroke="#8c1f1f" strokeWidth={2.4} strokeLinecap="round" />
        <path d="M50 29c10 4 14.5 8.5 14.5 8.5S58 42 50 43z" fill="#8c1f1f" opacity={0.8} />
      </g>
      <path
        d="M13 67c6.5-4.5 11 4.5 17.5 0s11 4.5 17.5 0 11 4.5 17.5 0 11 4.5 17.5 0"
        stroke="#e8f2f8"
        strokeWidth={2}
        opacity={0.32}
        strokeLinecap="round"
      />
      <path
        d="M13 78c6.5-4.5 11 4.5 17.5 0s11 4.5 17.5 0 11 4.5 17.5 0 11 4.5 17.5 0"
        stroke="#e8f2f8"
        strokeWidth={2}
        opacity={0.17}
        strokeLinecap="round"
      />
    </svg>
  );
}
