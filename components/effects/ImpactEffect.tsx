'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { useMemo } from 'react';
import type { ShotOutcome } from '@/lib/types';

/** Cuánto tarda el proyectil en llegar. El impacto y su sonido esperan a esto. */
export const FLIGHT_MS = 360;

interface ImpactEffectProps {
  outcome: ShotOutcome;
  /** De dónde viene el disparo: tú disparas desde abajo, el rival desde arriba. */
  from: 'bottom' | 'top';
  /** Cambia con cada disparo nuevo, para que la animación vuelva a empezar. */
  shotKey: number;
}

/** Ángulos y distancias fijos por disparo: si se recalculan, la animación tiembla. */
function useParticles(count: number, seed: number) {
  return useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        // Reparto en abanico con una pizca de desorden reproducible.
        const jitter = Math.sin((seed + i) * 12.9898) * 43758.5453;
        const noise = jitter - Math.floor(jitter);
        const angle = (i / count) * Math.PI * 2 + noise * 0.7;
        const distance = 26 + noise * 34;
        return {
          x: Math.cos(angle) * distance,
          y: Math.sin(angle) * distance,
          delay: noise * 0.05,
          size: 2 + noise * 3,
        };
      }),
    [count, seed],
  );
}

export function ImpactEffect({ outcome, from, shotKey }: ImpactEffectProps) {
  const reduced = useReducedMotion();
  const sunk = outcome === 'sunk';
  const water = outcome === 'miss';
  const particles = useParticles(water ? 8 : sunk ? 16 : 11, shotKey);
  const flight = FLIGHT_MS / 1000;

  if (reduced) {
    // Sin movimiento: un destello y ya. La información llega igual.
    return (
      <motion.span
        key={shotKey}
        initial={{ opacity: 0.9 }}
        animate={{ opacity: 0 }}
        transition={{ duration: 0.5 }}
        className="pointer-events-none absolute inset-0 z-40 rounded-[3px]"
        style={{ background: water ? '#e8f2f8' : '#f2b134' }}
      />
    );
  }

  return (
    <span key={shotKey} className="pointer-events-none absolute inset-0 z-40">
      {/* El proyectil, cayendo sobre la casilla. */}
      <motion.span
        initial={{ y: from === 'bottom' ? 260 : -260, opacity: 0, scale: 0.6 }}
        animate={{ y: 0, opacity: [0, 1, 1], scale: 1 }}
        transition={{ duration: flight, ease: 'easeIn' }}
        className="absolute inset-0 m-auto h-1.5 w-1.5 rounded-full bg-gold shadow-[0_0_10px_4px_rgba(242,177,52,0.8)]"
      />

      {/* Fogonazo del impacto. */}
      <motion.span
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: sunk ? 3.4 : water ? 1.9 : 2.6, opacity: [0, 1, 0] }}
        transition={{ delay: flight, duration: sunk ? 0.75 : 0.55, ease: 'easeOut' }}
        className="absolute inset-0 m-auto rounded-full"
        style={{
          background: water
            ? 'radial-gradient(circle, rgba(232,242,248,0.95) 0%, rgba(27,79,114,0.55) 45%, rgba(27,79,114,0) 70%)'
            : 'radial-gradient(circle, rgba(255,240,190,1) 0%, rgba(242,177,52,0.95) 30%, rgba(226,84,44,0.75) 55%, rgba(140,31,31,0) 75%)',
        }}
      />

      {/* Onda expansiva: solo cuando cae un barco entero. */}
      {sunk && (
        <motion.span
          initial={{ scale: 0.2, opacity: 0.85 }}
          animate={{ scale: 5, opacity: 0 }}
          transition={{ delay: flight, duration: 0.9, ease: 'easeOut' }}
          className="absolute inset-0 m-auto rounded-full border-2 border-ember/70"
        />
      )}

      {/* Metralla: gotas de agua o ascuas, según lo que haya pasado. */}
      {particles.map((particle, i) => (
        <motion.span
          key={i}
          initial={{ x: 0, y: 0, opacity: 0, scale: 1 }}
          animate={{ x: particle.x, y: particle.y, opacity: [0, 1, 0], scale: 0.3 }}
          transition={{
            delay: flight + particle.delay,
            duration: water ? 0.6 : 0.75,
            ease: 'easeOut',
          }}
          className="absolute inset-0 m-auto rounded-full"
          style={{
            width: particle.size,
            height: particle.size,
            background: water ? '#e8f2f8' : i % 3 === 0 ? '#f2b134' : '#e2542c',
          }}
        />
      ))}

      {/* Humo, para que el fuego deje rastro. */}
      {!water && (
        <motion.span
          initial={{ scale: 0.4, opacity: 0 }}
          animate={{ scale: sunk ? 2.8 : 2, opacity: [0, 0.5, 0], y: -14 }}
          transition={{ delay: flight + 0.1, duration: 1.1, ease: 'easeOut' }}
          className="absolute inset-0 m-auto rounded-full bg-[radial-gradient(circle,rgba(60,60,70,0.8)_0%,rgba(40,40,50,0)_70%)]"
        />
      )}
    </span>
  );
}
