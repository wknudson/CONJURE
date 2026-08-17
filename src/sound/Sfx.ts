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
  | 'spark'
  | 'hit'
  | 'crash'
  | 'detonate'
  | 'death1'
  | 'death2'
  | 'win'
  | 'lose';

const MUTE_KEY = 'conjure.muted';

export class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private _muted: boolean;

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

  play(cue: Cue): void {
    if (this._muted) return;
    this.unlock();
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master) return;

    const t = ctx.currentTime;

    switch (cue) {
      case 'pip':
        this.tone(t, 'sine', 520, 780, 0.09, 0.35);
        break;
      case 'card':
        this.noise(t, 0.09, 1600, 0.18);
        break;
      case 'spark':
        // Deliberately harsh: spending life should sound like it costs something.
        this.tone(t, 'sawtooth', 240, 90, 0.16, 0.3);
        this.noise(t, 0.14, 3200, 0.22);
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
    osc.frequency.setValueAtTime(freqFrom, start);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqTo), start + duration);
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
