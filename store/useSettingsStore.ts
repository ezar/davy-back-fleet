'use client';

import { create } from 'zustand';

/**
 * `flat`: el tablero visto desde arriba, como el juego de mesa.
 * `tilted`: el mismo tablero inclinado en perspectiva, con los barcos
 * levantados sobre el agua. Solo afecta al combate: la colocación sigue
 * siendo plana, porque arrastrar barcos sobre un plano inclinado es peor.
 */
export type BoardView = 'flat' | 'tilted';

const VIEW_KEY = 'dbf:view';

function readStoredView(): BoardView {
  try {
    return localStorage.getItem(VIEW_KEY) === 'tilted' ? 'tilted' : 'flat';
  } catch {
    return 'flat';
  }
}

interface SettingsState {
  view: BoardView;
  /** Lee la preferencia guardada. Se llama desde un efecto, nunca en el render. */
  hydrate: () => void;
  setView: (view: BoardView) => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  view: 'flat',

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
