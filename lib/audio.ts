'use client';

/**
 * Sound synthesised with the Web Audio API.
 *
 * No files at all: the cannon fire, the splashes and the explosions are
 * generated here. So there is nothing to download, no licensing, and no
 * wait the first time you fire.
 *
 * Browsers refuse to play anything until the user interacts, so the context
 * is created lazily on the first shot.
 */

export type Sfx = 'cannon' | 'splash' | 'explosion' | 'sink' | 'victory' | 'defeat';

let context: AudioContext | null = null;
let master: GainNode | null = null;
let ambient: { source: AudioBufferSourceNode; gain: GainNode; lfo: OscillatorNode } | null = null;
let noiseBuffer: AudioBuffer | null = null;

/** Overall volume: loud sounds like a broken toy, quiet is lost on a phone. */
const MASTER_GAIN = 0.5;

function ensureContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (context) {
    // Safari suspends the context when coming back from the background.
    if (context.state === 'suspended') void context.resume();
    return context;
  }
  const Ctor =
    window.AudioContext ??
    (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  context = new Ctor();
  master = context.createGain();
  master.gain.value = MASTER_GAIN;
  master.connect(context.destination);
  return context;
}

/** Reusable white noise: the basis of almost everything that sounds here. */
function getNoise(ctx: AudioContext): AudioBuffer {
  if (noiseBuffer) return noiseBuffer;
  const length = ctx.sampleRate * 2;
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  noiseBuffer = buffer;
  return buffer;
}

/** Filtered noise burst: the brick every impact is built from. */
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

/** Tonal sweep: the low body of a cannon shot, or a hull groaning as it sinks. */
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

/** A short clean note, for the fanfares. */
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
      // Powder crack over a low thump.
      burst(ctx, master, { duration: 0.28, type: 'lowpass', from: 2200, to: 200, gain: 0.5 });
      sweep(ctx, master, { type: 'sine', from: 140, to: 45, duration: 0.3, gain: 0.4 });
      break;

    case 'splash':
      // Water: a high sound that opens and falls, with no low body.
      burst(ctx, master, {
        duration: 0.42,
        type: 'bandpass',
        from: 700,
        to: 3400,
        gain: 0.42,
        q: 1.1,
      });
      burst(ctx, master, {
        duration: 0.22,
        type: 'highpass',
        from: 1800,
        to: 5200,
        gain: 0.2,
        delay: 0.05,
      });
      sweep(ctx, master, { type: 'sine', from: 420, to: 160, duration: 0.16, gain: 0.1 });
      break;

    case 'explosion':
      burst(ctx, master, { duration: 0.6, type: 'lowpass', from: 1800, to: 120, gain: 0.62 });
      sweep(ctx, master, { type: 'sawtooth', from: 120, to: 38, duration: 0.5, gain: 0.34 });
      break;

    case 'sink':
      // A big blast, and behind it the hull complaining on its way down.
      burst(ctx, master, { duration: 0.85, type: 'lowpass', from: 2400, to: 90, gain: 0.7 });
      sweep(ctx, master, { type: 'sawtooth', from: 150, to: 30, duration: 0.75, gain: 0.4 });
      sweep(ctx, master, {
        type: 'triangle',
        from: 200,
        to: 52,
        duration: 1.5,
        gain: 0.2,
        delay: 0.35,
      });
      burst(ctx, master, {
        duration: 1.1,
        type: 'bandpass',
        from: 500,
        to: 180,
        gain: 0.22,
        q: 3,
        delay: 0.5,
      });
      break;

    case 'victory': {
      // C - E - G - C, going up.
      const notes = [523.25, 659.25, 783.99, 1046.5];
      notes.forEach((frequency, i) => note(ctx, master!, frequency, i * 0.13, 0.5));
      break;
    }

    case 'defeat': {
      // The same idea, minor and falling.
      const notes = [392, 349.23, 311.13, 233.08];
      notes.forEach((frequency, i) => note(ctx, master!, frequency, i * 0.18, 0.75, 0.13));
      break;
    }
  }
}

/**
 * Background swell: low noise whose filter rises and falls slowly.
 * It reads as the sea without becoming a tune that wears thin.
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

  // The sway: a very slow oscillator moving the cutoff frequency.
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
      // It had already stopped: nothing to do.
    }
  }, 600);
}

/** Mutes or unmutes without tearing down the context. */
export function setMasterMuted(muted: boolean): void {
  const ctx = ensureContext();
  if (!ctx || !master) return;
  master.gain.cancelScheduledValues(ctx.currentTime);
  master.gain.setTargetAtTime(muted ? 0 : MASTER_GAIN, ctx.currentTime, 0.05);
}

/**
 * Prepares audio from within a user gesture. Browsers require the context to
 * be born from an interaction, so this is called on the first click.
 */
export function unlockAudio(): void {
  ensureContext();
}
