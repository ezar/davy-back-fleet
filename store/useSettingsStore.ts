'use client';

import { create } from 'zustand';

/**
 * `tilted` (por defecto): tablero inclinado en perspectiva, con los barcos
 * levantados sobre el agua.
 * `flat`: visto desde arriba, como el juego de mesa.
 *
 * Solo afecta al combate: la colocación es siempre plana, porque arrastrar
 * barcos sobre un plano inclinado es peor de usar.
 */
export type BoardView = 'flat' | 'tilted';

const VIEW_KEY = 'dbf:view';

function readStoredView(): BoardView {
  try {
    // Por defecto 2.5D: solo se cae a plano si el jugador lo eligió.
    return localStorage.getItem(VIEW_KEY) === 'flat' ? 'flat' : 'tilted';
  } catch {
    return 'tilted';
  }
}

interface SettingsState {
  view: BoardView;
  /** Lee la preferencia guardada. Se llama desde un efecto, nunca en el render. */
  hydrate: () => void;
  setView: (view: BoardView) => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  view: 'tilted',

  hydrate: () => set({ view: readStoredView() }),

  setView: (view) => {
    set({ view });
    try {
      localStorage.setItem(VIEW_KEY, view);
    } catch {
      // Modo privado: la preferencia dura lo que la pestaña.
    }
  },
}));
