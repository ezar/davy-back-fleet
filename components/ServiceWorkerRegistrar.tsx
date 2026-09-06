'use client';

import { useEffect } from 'react';

/** Registra el service worker para que el juego sea instalable. */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Sin service worker el juego funciona igual, solo pierde la instalación offline.
    });
  }, []);

  return null;
}
