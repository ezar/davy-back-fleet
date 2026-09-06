'use client';

/**
 * Nudges for a turn-based game played over minutes, not seconds.
 *
 * Everything here degrades to nothing: a browser without notifications, a
 * phone without a vibration motor or a player who said no all end up doing
 * less, never breaking.
 */

/** Does this browser have the Notification API at all? */
export function notificationsSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function notificationPermission(): NotificationPermission | 'unsupported' {
  return notificationsSupported() ? Notification.permission : 'unsupported';
}

/**
 * Asks for permission. Must be called from a user gesture: Safari refuses
 * outright otherwise, and Chrome holds it against the site.
 */
export async function requestNotificationPermission(): Promise<
  NotificationPermission | 'unsupported'
> {
  if (!notificationsSupported()) return 'unsupported';
  if (Notification.permission !== 'default') return Notification.permission;
  try {
    return await Notification.requestPermission();
  } catch {
    return 'denied';
  }
}

/**
 * Shows one notification, replacing any earlier one.
 *
 * Android Chrome refuses `new Notification()` and demands the service
 * worker's `showNotification`, so the worker goes first and the constructor
 * is only the desktop fallback.
 */
export async function notify(title: string, body: string): Promise<void> {
  if (notificationPermission() !== 'granted') return;
  const options: NotificationOptions = {
    body,
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    // One notification per game, replaced rather than stacked.
    tag: 'dbf-turn',
  };
  try {
    const registration = await navigator.serviceWorker?.getRegistration();
    if (registration) {
      await registration.showNotification(title, options);
      return;
    }
  } catch {
    // No worker, or it refused: fall through to the plain constructor.
  }
  try {
    new Notification(title, options);
  } catch {
    // Some browsers only allow the service-worker route. Nothing else to try.
  }
}

/** A short buzz. Silently does nothing where it is not supported (iOS). */
export function vibrate(pattern: number | number[]): void {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // Some browsers throw when the page has never been interacted with.
  }
}
