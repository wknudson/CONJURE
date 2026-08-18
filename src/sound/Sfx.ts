/**
 * WebAudio-synthesised cues. No asset files, no music.
 *
 * The detonation cue is the one that matters: a rising sweep, then a scheduled beat of
 * genuine silence, then a bass-heavy boom — the contrast the design doc builds its whole
 * audio identity around.
 */

export type Cue =
  | 'pip'
  | 'card'
  | 'rasp'
  | 'hit'
  | 'crash'
  | 'detonate'
  | 'shatter'
  | 'hiss'
  | 'wildfire'
  | 'death1'
  | 'death2'
  | 'win'
  | 'lose';

const MUTE_KEY = 'conjure.muted';

export class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private _muted: boolean;
  /** Multiplier applied to the current cue's frequencies. Reset on every play(). */
  private pitch = 1;
  /** Interval handle for the Last Stand heartbeat, or null when it is not running. */
  private heartbeat: number | null = null;

  constructor() {
    this._muted = localStorage.getItem(MUTE_KEY) === '1';
  }

  get muted(): boolean {
    return this._muted;
  }

  toggleMute(): boolean {
    this._muted = !this._muted;
    localStorage.setItem(MUTE_KEY, this._muted ? '1' : '0');
    return this._muted;
  }

  /** Must be called from a user gesture — browsers block audio otherwise. */
  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    try {
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.25;
      this.master.connect(this.ctx.destination);
    } catch {
      this.ctx = null;
    }
  }

  /**
   * `pitch` scales every frequency in the cue. Used by the cascade crescendo, where each
   * link in a rune chain rings a little higher than the last.
   */
  /**
   * A slow heartbeat under everything, for Last Stand.
   *
   * Scheduled rather than looped from a file: the whole sound layer is synthesised, and a
   * pulse is two oscillator thumps a moment apart, repeated.
   */
  setHeartbeat(on: boolean): void {
    if (on === (this.heartbeat !== null)) return;

    if (!on) {
      if (this.heartbeat !== null) window.clearInterval(this.heartbeat);
      this.heartbeat = null;
      return;
    }

    const beat = (): void => {
      if (this._muted || !this.ctx) return;
      const t = this.ctx.currentTime;
      this.pitch = 1;
      // Lub, then a softer dub a fifth of a second later.
      this.tone(t, 'sine', 82, 46, 0.16, 0.32);
      this.tone(t + 0.2, 'sine', 66, 38, 0.14, 0.2);
    };
    beat();
    this.heartbeat = window.setInterval(beat, 1150);
  }

  play(cue: Cue, opts: { pitch?: number } = {}): void {
    if (this._muted) return;
    this.unlock();
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master) return;

    this.pitch = opts.pitch ?? 1;
    const t = ctx.currentTime;

    switch (cue) {
      case 'pip':
        this.tone(t, 'sine', 520, 780, 0.09, 0.35);
        break;
      case 'card':
        this.noise(t, 0.09, 1600, 0.18);
        break;
      case 'rasp':
        // Named for the sound, not the event: it serves Marrow, hazards and Resonance
        // alike, and a cue named after one of them would misdescribe the other two.
        // Deliberately harsh: spending life should sound like it costs something.
        this.tone(t, 'sawtooth', 240, 90, 0.16, 0.3);
        this.noise(t, 0.14, 3200, 0.22);
        break;
      case 'shatter':
        // Brittle and bright: a high crack over a short, sharp noise burst.
        this.tone(t, 'square', 2400, 900, 0.06, 0.16);
        this.noise(t, 0.09, 6000, 0.3);
        this.noise(t + 0.03, 0.13, 3200, 0.18);
        break;
      case 'hiss':
        // Sustained and tuneless: steam is pressure escaping, not an impact.
        this.noise(t, 0.42, 5200, 0.16);
        this.noise(t + 0.06, 0.34, 2600, 0.1);
        break;
      case 'wildfire':
        // Bass-heavy roar: combustion rather than a bang.
        this.tone(t, 'sawtooth', 150, 55, 0.42, 0.26);
        this.noise(t, 0.4, 1100, 0.3);
        this.noise(t + 0.1, 0.3, 600, 0.22);
        break;
      case 'hit':
        this.noise(t, 0.07, 900, 0.35);
        this.tone(t, 'triangle', 180, 90, 0.09, 0.3);
        break;
      case 'crash':
        this.noise(t, 0.1, 700, 0.4);
        this.tone(t, 'square', 120, 55, 0.18, 0.4);
        break;
      case 'detonate': {
        // Rising hum...
        this.tone(t, 'sine', 220, 900, 0.3, 0.28);
        // ...then 90ms of nothing...
        const boom = t + 0.39;
        // ...then the boom.
        this.noise(boom, 0.4, 420, 0.5);
        this.tone(boom, 'sine', 70, 40, 0.6, 0.55);
        break;
      }
      case 'death1':
        this.noise(t, 0.12, 2600, 0.28);
        break;
      case 'death2':
        this.noise(t, 0.5, 500, 0.4);
        this.tone(t + 0.12, 'sine', 60, 35, 0.55, 0.45);
        break;
      case 'win':
        this.tone(t, 'triangle', 523, 523, 0.14, 0.3);
        this.tone(t + 0.13, 'triangle', 659, 659, 0.14, 0.3);
        this.tone(t + 0.26, 'triangle', 784, 784, 0.32, 0.32);
        break;
      case 'lose':
        this.tone(t, 'sine', 300, 300, 0.22, 0.3);
        this.tone(t + 0.2, 'sine', 190, 150, 0.55, 0.3);
        break;
    }
  }

  private tone(
    start: number,
    type: OscillatorType,
    freqFrom: number,
    freqTo: number,
    duration: number,
    gain: number,
  ): void {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master) return;

    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = type;
    // Pitch scaling lives here so every cue inherits it without touching call sites.
    osc.frequency.setValueAtTime(freqFrom * this.pitch, start);
    osc.frequency.exponentialRampToValueAtTime(
      Math.max(20, freqTo * this.pitch),
      start + duration,
    );
    env.gain.setValueAtTime(0.0001, start);
    env.gain.exponentialRampToValueAtTime(gain, start + 0.012);
    env.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(env).connect(master);
    osc.start(start);
    osc.stop(start + duration + 0.05);
  }

  private noise(start: number, duration: number, cutoff: number, gain: number): void {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master) return;

    const frames = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;

    const src = ctx.createBufferSource();
    src.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = cutoff;

    const env = ctx.createGain();
    env.gain.setValueAtTime(gain, start);
    env.gain.exponentialRampToValueAtTime(0.0001, start + duration);

    src.connect(filter).connect(env).connect(master);
    src.start(start);
    src.stop(start + duration + 0.02);
  }
}
