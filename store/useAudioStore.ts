'use client';

import { create } from 'zustand';
import {
  type Sfx,
  playSfx,
  setMasterMuted,
  startAmbient,
  stopAmbient,
  unlockAudio,
} from '@/lib/audio';

const MUTE_KEY = 'dbf:muted';

function readStoredMute(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
}

function storeMute(muted: boolean): void {
  try {
    localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
  } catch {
    // Modo privado: la preferencia dura lo que la pestaña.
  }
}

interface AudioState {
  muted: boolean;
  /** El audio no existe hasta que el usuario toca algo: lo exige el navegador. */
  unlocked: boolean;
  /** Lee la preferencia guardada. Se llama desde un efecto, nunca en el render. */
  hydrate: () => void;
  toggleMuted: () => void;
  /** Arranca el audio dentro de un gesto del usuario. */
  unlock: () => void;
  play: (sfx: Sfx) => void;
}

export const useAudioStore = create<AudioState>((set, get) => ({
  muted: false,
  unlocked: false,

  hydrate: () => set({ muted: readStoredMute() }),

  toggleMuted: () => {
    const muted = !get().muted;
    set({ muted });
    storeMute(muted);
    setMasterMuted(muted);
    if (muted) stopAmbient();
    else if (get().unlocked) startAmbient();
  },

  unlock: () => {
    if (get().unlocked) return;
    unlockAudio();
    setMasterMuted(get().muted);
    if (!get().muted) startAmbient();
    set({ unlocked: true });
  },

  play: (sfx) => {
    const { muted, unlocked } = get();
    if (muted || !unlocked) return;
    playSfx(sfx);
  },
}));
