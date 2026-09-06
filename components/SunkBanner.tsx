'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { getShip } from '@/lib/fleet';
import { ShipSilhouette } from './ShipSilhouette';
import type { ShipId } from '@/lib/types';

/**
 * Micro-celebración al hundir un barco: nombre, tripulación y frase.
 * Se muestra unos segundos y desaparece sola.
 */
export function SunkBanner({
  shipId,
  byOpponent = false,
}: {
  shipId: ShipId | null;
  byOpponent?: boolean;
}) {
  const [visible, setVisible] = useState<ShipId | null>(null);

  useEffect(() => {
    if (!shipId) return;
    setVisible(shipId);
    const timer = setTimeout(() => setVisible(null), 3200);
    return () => clearTimeout(timer);
  }, [shipId]);

  const ship = visible ? getShip(visible) : null;

  return (
    <AnimatePresence>
      {ship && (
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -16, scale: 0.95 }}
          transition={{ type: 'spring', stiffness: 320, damping: 24 }}
          className="pointer-events-none fixed inset-x-3 bottom-6 z-50 mx-auto max-w-sm"
          role="status"
        >
          <div
            className={[
              'rounded-xl border px-4 py-3 text-center shadow-glow backdrop-blur',
              byOpponent
                ? 'border-blood/60 bg-blood/40'
                : 'border-gold/60 bg-abyss/90',
            ].join(' ')}
          >
            <p className="text-[0.65rem] font-bold uppercase tracking-[0.2em] text-gold">
              {byOpponent ? 'Has perdido un barco' : '¡Hundido!'}
            </p>
            <ShipSilhouette shipId={ship.id} className="mx-auto h-12 w-auto opacity-90" />
            <p className="mt-1 font-display text-lg font-black">{ship.name}</p>
            <p className="text-xs text-foam/70">{ship.crew}</p>
            <p className="mt-1 text-xs italic text-foam/50">{ship.tagline}</p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
