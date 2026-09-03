/**
 * WebAudio-synthesised cues. No asset files, no music.
 *
 * The detonation cue is the one that matters: a rising sweep, then a scheduled beat of
 * genuine silence, then a bass-heavy boom — the contrast the design doc builds its whole
 * audio identity around.
 */

export type Cue =
  | 'bone'
  | 'chime'
  | 'card'
  | 'rasp'
  | 'shock'
  | 'gear_lock'
  | 'cable_snap'
  | 'vault_lock'
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

/** A running ambience. Ids are distinct so several can play at once. */
export type LoopId = 'last_stand' | 'tether_strain';

/** The figure an ambience repeats. */
export type LoopTrack = 'heartbeat' | 'winch_grind';

/**
 * How often each figure repeats.
 *
 * The winch repeats sooner than its own sound lasts, so the tail of one grind overlaps
 * the head of the next and the strain reads as continuous rather than as a pulse.
 */
const LOOP_PERIOD_MS: Record<LoopTrack, number> = {
  heartbeat: 1150,
  winch_grind: 620,
};

const MUTE_KEY = 'conjure.muted';

export class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private _muted: boolean;
  /** Multiplier applied to the current cue's frequencies. Reset on every play(). */
  private pitch = 1;
  /**
   * Every ambience currently running, by id.
   *
   * A registry rather than a field per loop, because the loops are deliberately not
   * exclusive: a player dying while holding the tether should hear the heartbeat under
   * the winch, and the two together are the point. Keyed by id rather than by track so
   * the same sound could in principle be run twice for different reasons.
   */
  private activeLoops = new Map<LoopId, number>();

  constructor() {
    // Guarded like `readSpeed` in CombatScreen and for the same reason: with storage
    // blocked, `getItem` throws, and this runs as a field initialiser while the combat
    // screen is being constructed — so an unguarded read here was a blank page at the
    // start of every fight in a locked-down browser. The preference is not worth that.
    try {
      this._muted = localStorage.getItem(MUTE_KEY) === '1';
    } catch {
      this._muted = false;
    }
  }

  get muted(): boolean {
    return this._muted;
  }

  toggleMute(): boolean {
    this._muted = !this._muted;
    try {
      localStorage.setItem(MUTE_KEY, this._muted ? '1' : '0');
    } catch {
      // Storage disabled or full. The toggle still works for this session.
    }
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
   * Starts an ambience, or does nothing if that id is already running.
   *
   * Scheduled repeats of a synthesised figure rather than a looped buffer: the whole
   * sound layer is synthesised and there are no asset files to loop. Re-starting an id
   * that is already live is a deliberate no-op — the alternative is a second interval
   * nobody holds a handle to, which is how a sound ends up unstoppable.
   *
   * Safe to call before the audio context exists. The ticks check for it and fall silent
   * until `unlock` has run, so a loop started during a muted or un-gestured session
   * simply produces nothing and can still be stopped normally.
   */
  startLoop(id: LoopId, track: LoopTrack): void {
    if (this.activeLoops.has(id)) return;

    const tick = (): void => {
      if (this._muted || !this.ctx) return;
      // Reset per tick: `pitch` is shared with `play`, and a cue that scaled it would
      // otherwise leave every later beat of the ambience detuned.
      this.pitch = 1;
      this.runLoopTrack(track, this.ctx.currentTime);
    };

    tick();
    this.activeLoops.set(id, window.setInterval(tick, LOOP_PERIOD_MS[track]));
  }

  stopLoop(id: LoopId): void {
    const handle = this.activeLoops.get(id);
    if (handle === undefined) return;
    window.clearInterval(handle);
    this.activeLoops.delete(id);
  }

  /**
   * Silences every ambience.
   *
   * Called on the way out of combat. Loops are the one part of this class that outlives
   * the thing that started them — a one-shot is over by the time a screen tears down,
   * an interval is not — so leaving a screen has to sweep them explicitly or a heartbeat
   * follows the player into the overworld.
   */
  stopAllLoops(): void {
    for (const id of [...this.activeLoops.keys()]) this.stopLoop(id);
  }

  /** True while that ambience is running. Exposed for tests and for the mute toggle. */
  isLooping(id: LoopId): boolean {
    return this.activeLoops.has(id);
  }

  /** Last Stand's heartbeat, in the terms the HUD already speaks. */
  setHeartbeat(on: boolean): void {
    if (on) this.startLoop('last_stand', 'heartbeat');
    else this.stopLoop('last_stand');
  }

  /** One repetition of an ambience, scheduled from `t`. */
  private runLoopTrack(track: LoopTrack, t: number): void {
    switch (track) {
      case 'heartbeat':
        // Lub, then a softer dub a fifth of a second later.
        this.tone(t, 'sine', 82, 46, 0.16, 0.32);
        this.tone(t + 0.2, 'sine', 66, 38, 0.14, 0.2);
        break;

      case 'winch_grind':
        // A cable under load. Two detuned saws beat against each other to give the
        // wavering an engine has, with grinding underneath and a scrape over the top.
        //
        // Quiet on purpose: this plays under combat for rounds at a time, and an
        // ambience that competes with the hits is one the player turns the game off to
        // escape. It is meant to be noticed and then felt rather than heard.
        this.tone(t, 'sawtooth', 62, 54, 0.72, 0.1);
        this.tone(t, 'sawtooth', 67, 59, 0.72, 0.07);
        this.noise(t, 0.6, 900, 0.07);
        this.noise(t + 0.34, 0.16, 5200, 0.045);
        break;
    }
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
      case 'bone':
        this.tone(t, 'sine', 520, 780, 0.09, 0.35);
        break;
      case 'chime':
        // A reward, not an accrual: two rising notes where 'bone' has one, so a reaction
        // refund is audibly better news than the Bone that arrives every turn anyway.
        this.tone(t, 'sine', 660, 990, 0.10, 0.30);
        this.tone(t + 0.07, 'sine', 990, 1320, 0.16, 0.22);
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
      case 'shock':
        // A crack, not a boom: a very short high square burst over filtered noise, with
        // a second snap a hair later so it reads as a discharge rather than a hit.
        this.tone(t, 'square', 3200, 1400, 0.04, 0.18);
        this.noise(t, 0.05, 7000, 0.26);
        this.tone(t + 0.045, 'square', 2100, 700, 0.05, 0.13);
        break;
      case 'gear_lock':
        // A winch taking up one notch: a low mechanical thunk with a metallic scrape
        // over it, and no ring afterwards. Machinery, not magic.
        this.tone(t, 'square', 150, 70, 0.09, 0.34);
        this.noise(t, 0.06, 1400, 0.3);
        this.noise(t + 0.05, 0.1, 3400, 0.14);
        break;
      case 'cable_snap':
        // Steel letting go. A hard crack with no warning, then the two severed ends
        // whipping — a bright shard-scatter over a low recoil thump.
        this.tone(t, 'square', 2600, 320, 0.05, 0.4);
        this.noise(t, 0.07, 7800, 0.42);
        this.tone(t + 0.02, 'sawtooth', 900, 110, 0.22, 0.26);
        this.noise(t + 0.06, 0.3, 2200, 0.2);
        this.tone(t + 0.05, 'sine', 90, 44, 0.36, 0.3);
        break;
      case 'vault_lock':
        // The opposite sound: nothing breaks, something closes. A heavy travel, a
        // seated clunk, and a low ring of settled metal underneath.
        this.noise(t, 0.14, 700, 0.24);
        this.tone(t + 0.12, 'square', 120, 58, 0.16, 0.42);
        this.noise(t + 0.12, 0.1, 1600, 0.3);
        this.tone(t + 0.2, 'sine', 74, 62, 0.7, 0.26);
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
