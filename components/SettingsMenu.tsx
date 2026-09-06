'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { useAudioStore } from '@/store/useAudioStore';
import { type BoardView, useSettingsStore } from '@/store/useSettingsStore';

/** Ajustes de la partida: vista del tablero y sonido. */
export function SettingsMenu() {
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);

  const view = useSettingsStore((state) => state.view);
  const setView = useSettingsStore((state) => state.setView);
  const hydrateView = useSettingsStore((state) => state.hydrate);

  const muted = useAudioStore((state) => state.muted);
  const toggleMuted = useAudioStore((state) => state.toggleMuted);
  const hydrateAudio = useAudioStore((state) => state.hydrate);
  const unlock = useAudioStore((state) => state.unlock);

  // Las preferencias viven en localStorage: solo existen en el cliente.
  useEffect(() => {
    hydrateView();
    hydrateAudio();
  }, [hydrateView, hydrateAudio]);

  // Cerrar al tocar fuera.
  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (!container.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [open]);

  return (
    <div ref={container} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-label="Ajustes"
        className="flex h-9 w-9 items-center justify-center rounded-lg border border-foam/12 text-foam/55 transition hover:border-foam/30 hover:text-foam"
      >
        <svg
          viewBox="0 0 24 24"
          className="h-[18px] w-[18px]"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.6}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <circle cx="12" cy="12" r="3.2" />
          <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.03 1.56V21a2 2 0 1 1-4 0v-.11a1.7 1.7 0 0 0-1.11-1.56 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.56-1.03H3a2 2 0 1 1 0-4h.11a1.7 1.7 0 0 0 1.56-1.11 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34H9a1.7 1.7 0 0 0 1-1.56V3a2 2 0 1 1 4 0v.11a1.7 1.7 0 0 0 1.03 1.56 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87V9a1.7 1.7 0 0 0 1.56 1H21a2 2 0 1 1 0 4h-.11a1.7 1.7 0 0 0-1.49 1z" />
        </svg>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.14 }}
            className="absolute right-0 top-11 z-50 w-60 rounded-xl border border-foam/12 bg-hull/95 p-3 shadow-plank backdrop-blur"
          >
            <fieldset className="mb-3">
              <legend className="mb-1.5 text-[0.6rem] font-bold uppercase tracking-[0.2em] text-foam/45">
                Vista del tablero
              </legend>
              <div className="flex gap-1.5">
                <ViewOption current={view} value="flat" label="Plano" onSelect={setView} />
                <ViewOption current={view} value="tilted" label="2.5D" onSelect={setView} />
              </div>
              <p className="mt-1.5 text-[0.65rem] leading-relaxed text-foam/40">
                {view === 'tilted'
                  ? 'Tablero en perspectiva y barcos levantados sobre el agua. Solo en combate.'
                  : 'Vista cenital, como el juego de mesa.'}
              </p>
            </fieldset>

            <div className="flex items-center justify-between border-t border-foam/8 pt-2.5">
              <span className="text-xs font-bold text-foam/70">Sonido</span>
              <button
                type="button"
                onClick={() => {
                  unlock();
                  toggleMuted();
                }}
                role="switch"
                aria-checked={!muted}
                className={[
                  'relative h-6 w-11 rounded-full transition',
                  muted ? 'bg-foam/15' : 'bg-gold',
                ].join(' ')}
              >
                <span
                  aria-hidden
                  className={[
                    'absolute top-1 h-4 w-4 rounded-full bg-abyss transition-all',
                    muted ? 'left-1' : 'left-6',
                  ].join(' ')}
                />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ViewOption({
  current,
  value,
  label,
  onSelect,
}: {
  current: BoardView;
  value: BoardView;
  label: string;
  onSelect: (view: BoardView) => void;
}) {
  const active = current === value;
  return (
    <button
      type="button"
      onClick={() => onSelect(value)}
      aria-pressed={active}
      className={[
        'flex-1 rounded-lg border px-2 py-2 text-xs font-bold transition',
        active
          ? 'border-gold bg-gold/15 text-gold'
          : 'border-foam/12 text-foam/60 hover:border-foam/30',
      ].join(' ')}
    >
      {label}
    </button>
  );
}
