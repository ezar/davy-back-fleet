/** Fuente de aleatoriedad inyectable: devuelve un número en [0, 1). */
export type Rng = () => number;

/** RNG por defecto. */
export const defaultRng: Rng = Math.random;

/**
 * PRNG mulberry32: determinista a partir de una semilla.
 * Se usa en los tests y permite reproducir una partida concreta.
 */
export function seededRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Entero en [0, max). */
export function randomInt(rng: Rng, max: number): number {
  return Math.floor(rng() * max);
}

/** Elemento aleatorio de un array no vacío. */
export function pick<T>(rng: Rng, items: readonly T[]): T {
  return items[randomInt(rng, items.length)];
}
