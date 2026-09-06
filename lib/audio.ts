'use client';

/**
 * Sonido sintetizado con la Web Audio API.
 *
 * Nada de ficheros: los cañonazos, las salpicaduras y las explosiones se
 * generan aquí. Así no hay descargas, ni licencias, ni un segundo de espera
 * la primera vez que disparas.
 *
 * El navegador no deja sonar nada hasta que el usuario interactúa, así que el
 * contexto se crea perezosamente en el primer disparo.
 */

export type Sfx = 'cannon' | 'splash' | 'explosion' | 'sink' | 'victory' | 'defeat';

let context: AudioContext | null = null;
let master: GainNode | null = null;
let ambient: { source: AudioBufferSourceNode; gain: GainNode; lfo: OscillatorNode } | null = null;
let noiseBuffer: AudioBuffer | null = null;

/** Volumen general: alto suena a juguete roto, bajo no se oye en un móvil. */
const MASTER_GAIN = 0.5;

function ensureContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (context) {
    // Safari suspende el contexto al volver de segundo plano.
    if (context.state === 'suspended') void context.resume();
    return context;
  }
  const Ctor = window.AudioContext ?? (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  context = new Ctor();
  master = context.createGain();
  master.gain.value = MASTER_GAIN;
  master.connect(context.destination);
  return context;
}

/** Ruido blanco reutilizable: es la base de casi todo lo que suena aquí. */
function getNoise(ctx: AudioContext): AudioBuffer {
  if (noiseBuffer) return noiseBuffer;
  const length = ctx.sampleRate * 2;
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  noiseBuffer = buffer;
  return buffer;
}

/** Golpe de ruido filtrado: el ladrillo con el que se construyen los impactos. */
function burst(
  ctx: AudioContext,
  destination: AudioNode,
  options: {
    duration: number;
    type: BiquadFilterType;
    from: number;
    to: number;
    gain: number;
    q?: number;
    delay?: number;
  },
) {
  const at = ctx.currentTime + (options.delay ?? 0);
  const source = ctx.createBufferSource();
  source.buffer = getNoise(ctx);

  const filter = ctx.createBiquadFilter();
  filter.type = options.type;
  filter.frequency.setValueAtTime(options.from, at);
  filter.frequency.exponentialRampToValueAtTime(Math.max(options.to, 20), at + options.duration);
  if (options.q !== undefined) filter.Q.value = options.q;

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(options.gain, at);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + options.duration);

  source.connect(filter).connect(gain).connect(destination);
  source.start(at);
  source.stop(at + options.duration + 0.05);
}

/** Barrido tonal: el "cuerpo" grave de un cañonazo o el lamento de un barco al hundirse. */
function sweep(
  ctx: AudioContext,
  destination: AudioNode,
  options: {
    type: OscillatorType;
    from: number;
    to: number;
    duration: number;
    gain: number;
    delay?: number;
  },
) {
  const at = ctx.currentTime + (options.delay ?? 0);
  const osc = ctx.createOscillator();
  osc.type = options.type;
  osc.frequency.setValueAtTime(options.from, at);
  osc.frequency.exponentialRampToValueAtTime(Math.max(options.to, 20), at + options.duration);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(options.gain, at + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + options.duration);

  osc.connect(gain).connect(destination);
  osc.start(at);
  osc.stop(at + options.duration + 0.05);
}

/** Nota corta y limpia, para las fanfarrias. */
function note(
  ctx: AudioContext,
  destination: AudioNode,
  frequency: number,
  delay: number,
  duration = 0.42,
  gain = 0.16,
) {
  const at = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  osc.type = 'triangle';
  osc.frequency.value = frequency;

  const envelope = ctx.createGain();
  envelope.gain.setValueAtTime(0.0001, at);
  envelope.gain.exponentialRampToValueAtTime(gain, at + 0.03);
  envelope.gain.exponentialRampToValueAtTime(0.0001, at + duration);

  osc.connect(envelope).connect(destination);
  osc.start(at);
  osc.stop(at + duration + 0.05);
}

export function playSfx(name: Sfx): void {
  const ctx = ensureContext();
  if (!ctx || !master) return;

  switch (name) {
    case 'cannon':
      // Chasquido de pólvora encima de un golpe grave.
      burst(ctx, master, { duration: 0.28, type: 'lowpass', from: 2200, to: 200, gain: 0.5 });
      sweep(ctx, master, { type: 'sine', from: 140, to: 45, duration: 0.3, gain: 0.4 });
      break;

    case 'splash':
      // Agua: agudo que se abre y cae, sin cuerpo grave.
      burst(ctx, master, { duration: 0.42, type: 'bandpass', from: 700, to: 3400, gain: 0.42, q: 1.1 });
      burst(ctx, master, { duration: 0.22, type: 'highpass', from: 1800, to: 5200, gain: 0.2, delay: 0.05 });
      sweep(ctx, master, { type: 'sine', from: 420, to: 160, duration: 0.16, gain: 0.1 });
      break;

    case 'explosion':
      burst(ctx, master, { duration: 0.6, type: 'lowpass', from: 1800, to: 120, gain: 0.62 });
      sweep(ctx, master, { type: 'sawtooth', from: 120, to: 38, duration: 0.5, gain: 0.34 });
      break;

    case 'sink':
      // Explosión grande, y detrás el casco quejándose mientras se va al fondo.
      burst(ctx, master, { duration: 0.85, type: 'lowpass', from: 2400, to: 90, gain: 0.7 });
      sweep(ctx, master, { type: 'sawtooth', from: 150, to: 30, duration: 0.75, gain: 0.4 });
      sweep(ctx, master, { type: 'triangle', from: 200, to: 52, duration: 1.5, gain: 0.2, delay: 0.35 });
      burst(ctx, master, { duration: 1.1, type: 'bandpass', from: 500, to: 180, gain: 0.22, q: 3, delay: 0.5 });
      break;

    case 'victory': {
      // Do - Mi - Sol - Do, hacia arriba.
      const notes = [523.25, 659.25, 783.99, 1046.5];
      notes.forEach((frequency, i) => note(ctx, master!, frequency, i * 0.13, 0.5));
      break;
    }

    case 'defeat': {
      // La misma idea, en menor y cayendo.
      const notes = [392, 349.23, 311.13, 233.08];
      notes.forEach((frequency, i) => note(ctx, master!, frequency, i * 0.18, 0.75, 0.13));
      break;
    }
  }
}

/**
 * Oleaje de fondo: ruido grave cuyo filtro sube y baja despacio.
 * Suena a mar sin llegar a ser una melodía que canse.
 */
export function startAmbient(): void {
  const ctx = ensureContext();
  if (!ctx || !master || ambient) return;

  const source = ctx.createBufferSource();
  source.buffer = getNoise(ctx);
  source.loop = true;

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 420;
  filter.Q.value = 0.7;

  // El vaivén: un oscilador lentísimo moviendo la frecuencia de corte.
  const lfo = ctx.createOscillator();
  lfo.type = 'sine';
  lfo.frequency.value = 0.12;
  const lfoGain = ctx.createGain();
  lfoGain.gain.value = 260;
  lfo.connect(lfoGain).connect(filter.frequency);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, ctx.currentTime);
  gain.gain.linearRampToValueAtTime(0.075, ctx.currentTime + 2.5);

  source.connect(filter).connect(gain).connect(master);
  source.start();
  lfo.start();
  ambient = { source, gain, lfo };
}

export function stopAmbient(): void {
  if (!ambient || !context) return;
  const { source, gain, lfo } = ambient;
  ambient = null;
  gain.gain.cancelScheduledValues(context.currentTime);
  gain.gain.setValueAtTime(gain.gain.value, context.currentTime);
  gain.gain.linearRampToValueAtTime(0.0001, context.currentTime + 0.5);
  setTimeout(() => {
    try {
      source.stop();
      lfo.stop();
    } catch {
      // Ya estaba parado: no hay nada que hacer.
    }
  }, 600);
}

/** Silencia o devuelve el sonido sin destruir el contexto. */
export function setMasterMuted(muted: boolean): void {
  const ctx = ensureContext();
  if (!ctx || !master) return;
  master.gain.cancelScheduledValues(ctx.currentTime);
  master.gain.setTargetAtTime(muted ? 0 : MASTER_GAIN, ctx.currentTime, 0.05);
}

/**
 * Prepara el audio dentro de un gesto del usuario. Los navegadores exigen
 * que el contexto nazca de una interacción, así que esto se llama al primer clic.
 */
export function unlockAudio(): void {
  ensureContext();
}
