'use client';

import { useEffect, useRef } from 'react';
import { notify, vibrate } from '@/lib/notifications';
import type { RoomView } from '@/lib/room';

/** What the tab says while you are away and it is your move. */
const CALLING_TITLE = '¡Te toca! · Davy Back Fleet';

/**
 * The one thing worth interrupting the player for, as a value that only
 * changes when something actually happened.
 *
 * Polling hands us a fresh object every second even when nothing moved, so
 * comparing views is useless; comparing this string is not. It stays put
 * while you chain hits (still your turn) and flips when the turn crosses
 * over, which is exactly when a nudge is welcome.
 */
function cueFor(view: RoomView): string {
  switch (view.phase) {
    case 'waiting':
      return 'alone';
    case 'placing':
      return view.opponent.present ? 'rival-joined' : 'alone';
    case 'battle':
      // The round is in there so a rematch counts as a fresh call to arms.
      return view.yourTurn ? `your-turn:${view.round}` : 'their-turn';
    case 'finished':
      return 'over';
  }
}

const MESSAGES: Record<string, { title: string; body: string }> = {
  'rival-joined': { title: 'Tu rival ha llegado', body: 'Coloca tu flota y empieza el combate.' },
  'your-turn': { title: 'Te toca disparar', body: 'Tu rival ya ha movido. La sala te espera.' },
  over: { title: 'Partida terminada', body: 'Ve a ver cómo ha acabado.' },
};

function messageFor(cue: string) {
  return MESSAGES[cue.split(':')[0]] ?? null;
}

/**
 * Nudges the player when the room needs them: the tab title while they are
 * on another tab, plus a buzz and a notification if they asked for those.
 *
 * A remote game runs over minutes. Without this the only way to know the
 * opponent has moved is to keep coming back to look.
 */
export function useTurnAlert(view: RoomView | null, alertsEnabled: boolean): void {
  const previousCue = useRef<string | null>(null);
  const baseTitle = useRef<string>('');
  const cue = view ? cueFor(view) : null;
  const calling = cue?.startsWith('your-turn') === true || cue === 'rival-joined';

  // Fire on the change, never on arrival: opening a room where it is already
  // your turn is not news, you are looking right at it.
  useEffect(() => {
    if (!cue) return;
    const previous = previousCue.current;
    previousCue.current = cue;
    if (previous === null || previous === cue) return;

    const message = messageFor(cue);
    if (!message) return;
    // Only when they are not looking: on screen the banner and the sound
    // have already said it, and a buzz in the hand would just be noise.
    if (!document.hidden) return;

    vibrate([120, 60, 120]);
    if (alertsEnabled) void notify(message.title, message.body);
  }, [cue, alertsEnabled]);

  // The tab title is the nudge that needs no permission and works everywhere.
  useEffect(() => {
    if (!baseTitle.current) baseTitle.current = document.title;
    const paint = () => {
      document.title = calling && document.hidden ? CALLING_TITLE : baseTitle.current;
    };
    paint();
    document.addEventListener('visibilitychange', paint);
    return () => {
      document.removeEventListener('visibilitychange', paint);
      document.title = baseTitle.current;
    };
  }, [calling]);
}
