'use client';

import { useEffect } from 'react';

/** Registers the service worker so the game is installable. */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Without a service worker the game works the same, it just loses offline install.
    });
  }, []);

  return null;
}
