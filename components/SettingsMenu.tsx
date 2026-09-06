'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { RuleSwitches, Switch } from './RuleSwitches';
import { notificationPermission, requestNotificationPermission } from '@/lib/notifications';
import type { HuntStrategy } from '@/lib/aiOpponent';

/**
 * The three difficulty levels, easiest first. The shot counts are the
 * measured averages over 400 seeded games, and a test guards them: what this
 * menu promises has to stay true.
 */
const LEVELS: { strategy: HuntStrategy; label: string; hint: string }[] = [
  {
    strategy: 'random',
    label: 'Normal',
    hint: 'Dispara al azar mientras busca. Te hunde la flota en unos 61 disparos.',
  },
  {
    strategy: 'parity',
    label: 'Media',
    hint: 'Busca en damero: como el barco más pequeño ocupa dos casillas, ninguno puede esconderse entre los huecos. Unos 53 disparos.',
  },
  {
    strategy: 'density',
    label: 'Difícil',
    hint: 'Apunta donde más quepan los barcos que te quedan, y descarta el agua que ya conoce. Unos 45 disparos.',
  },
];
import { useAudioStore } from '@/store/useAudioStore';
import { type BoardView, useSettingsStore } from '@/store/useSettingsStore';

/** In-game settings: board view, AI difficulty and sound. */
export function SettingsMenu({
  /** Difficulty only exists against the AI, so it is hidden in a room. */
  solo = false,
}: {
  solo?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);

  const view = useSettingsStore((state) => state.view);
  const setView = useSettingsStore((state) => state.setView);
  const aiStrategy = useSettingsStore((state) => state.aiStrategy);
  const setAiStrategy = useSettingsStore((state) => state.setAiStrategy);
  const hydrateView = useSettingsStore((state) => state.hydrate);
  const turnAlerts = useSettingsStore((state) => state.turnAlerts);
  const setTurnAlerts = useSettingsStore((state) => state.setTurnAlerts);
  const [alertNote, setAlertNote] = useState<string | null>(null);

  const muted = useAudioStore((state) => state.muted);
  const toggleMuted = useAudioStore((state) => state.toggleMuted);
  const hydrateAudio = useAudioStore((state) => state.hydrate);
  const unlock = useAudioStore((state) => state.unlock);

  // Preferences live in localStorage: they only exist on the client.
  useEffect(() => {
    hydrateView();
    hydrateAudio();
  }, [hydrateView, hydrateAudio]);

  /**
   * Turning it on asks for permission right here, inside the tap: browsers
   * refuse the request from anywhere else. If it is refused, the switch goes
   * back to off rather than pretending it worked.
   */
  const toggleAlerts = async (enabled: boolean) => {
    setAlertNote(null);
    if (!enabled) {
      setTurnAlerts(false);
      return;
    }
    const permission = await requestNotificationPermission();
    if (permission === 'granted') {
      setTurnAlerts(true);
      return;
    }
    setTurnAlerts(false);
    setAlertNote(
      permission === 'unsupported'
        ? 'Este navegador no admite notificaciones.'
        : 'Has bloqueado las notificaciones para esta página. Puedes permitirlas desde los ajustes del navegador.',
    );
  };

  // Reflects a permission revoked from the browser's own settings.
  useEffect(() => {
    if (turnAlerts && notificationPermission() !== 'granted') setTurnAlerts(false);
  }, [turnAlerts, setTurnAlerts]);

  // Close on an outside tap.
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

            {solo && (
              // The rule goes on the wrapper, not the fieldset: a <legend>
              // sits on the fieldset's own border and cuts it in half.
              <div className="mb-3 border-t border-foam/8 pt-2.5">
                <fieldset>
                  <legend className="mb-1.5 text-[0.6rem] font-bold uppercase tracking-[0.2em] text-foam/45">
                    Dificultad
                  </legend>
                  <div className="flex gap-1.5">
                    {LEVELS.map((level) => (
                      <Choice
                        key={level.strategy}
                        active={aiStrategy === level.strategy}
                        label={level.label}
                        onSelect={() => setAiStrategy(level.strategy)}
                      />
                    ))}
                  </div>
                  <p className="mt-1.5 text-[0.65rem] leading-relaxed text-foam/40">
                    {LEVELS.find((level) => level.strategy === aiStrategy)?.hint}
                  </p>
                  <p className="mt-1 text-[0.65rem] leading-relaxed text-foam/30">
                    Se aplica a la siguiente partida.
                  </p>
                </fieldset>
              </div>
            )}

            {solo && (
              <div className="mb-3 border-t border-foam/8 pt-2.5">
                <p className="mb-2 text-[0.6rem] font-bold uppercase tracking-[0.2em] text-foam/45">
                  Reglas
                </p>
                <RuleSwitches />
                <p className="mt-2 text-[0.65rem] leading-relaxed text-foam/30">
                  Se aplican a la siguiente partida.
                </p>
              </div>
            )}

            {!solo && (
              <div className="mb-3 border-t border-foam/8 pt-2.5">
                <div className="flex items-start justify-between gap-3">
                  <span className="min-w-0">
                    <span className="block text-xs font-bold text-foam/75">Avisarme del turno</span>
                    <span className="block text-[0.65rem] leading-relaxed text-foam/40">
                      Notificación del navegador cuando tu rival mueva.
                    </span>
                  </span>
                  <Switch
                    checked={turnAlerts}
                    label="Avisarme del turno"
                    onChange={(enabled) => void toggleAlerts(enabled)}
                  />
                </div>
                {alertNote && (
                  <p className="mt-1.5 text-[0.65rem] leading-relaxed text-ember/80">{alertNote}</p>
                )}
                <p className="mt-1.5 text-[0.65rem] leading-relaxed text-foam/30">
                  El título de la pestaña avisa igualmente, sin pedir permiso.
                </p>
              </div>
            )}

            <div className="flex items-center justify-between border-t border-foam/8 pt-2.5">
              <span className="text-xs font-bold text-foam/70">Sonido</span>
              <Switch
                checked={!muted}
                label="Sonido"
                onChange={() => {
                  unlock();
                  toggleMuted();
                }}
              />
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
  return <Choice active={current === value} label={label} onSelect={() => onSelect(value)} />;
}

/** One of a row of mutually exclusive chips. */
function Choice({
  active,
  label,
  onSelect,
}: {
  active: boolean;
  label: string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
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
