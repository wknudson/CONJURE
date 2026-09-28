/**
 * The small motions that make a body on the street look carried by its own legs.
 *
 * `Walker` owns the frames, the facing and the walk bob, and it is locked down by
 * `districtWalk.test.ts`, so none of this lives inside it. These are applied by whoever
 * owns the walker, after `step`:
 *
 * - `Momentum`: speed that ramps up and bleeds off, instead of switching on and off.
 * - `restBreath`: the rise and settle of a body standing still.
 * - `Lean`: a tilt into the direction of travel, as it appears on screen.
 */

/**
 * A speed that eases toward what it is asked for.
 *
 * Framerate-independent: the ease is `1 - exp(-dt / tau)`, so two half-frames land where one
 * whole frame would. Speeding up is gentler than slowing down, because a body that coasts on
 * after it meant to stop overshoots where it was going.
 */
export class Momentum {
  speed = 0;

  constructor(
    private readonly accelTau = 0.15,
    private readonly brakeTau = 0.07,
  ) {}

  approach(target: number, dt: number): number {
    if (dt <= 0) return this.speed;
    const tau = target > this.speed ? this.accelTau : this.brakeTau;
    this.speed += (target - this.speed) * (1 - Math.exp(-dt / tau));
    if (target === 0 && this.speed < 0.02) this.speed = 0;
    return this.speed;
  }

  /** Dead stop, for a body that has been told to stand exactly where it is. */
  stop(): void {
    this.speed = 0;
  }
}

/**
 * How high a standing body has risen on its breath, in world units.
 *
 * `(1 - cos) / 2` rather than `abs(sin)`. `abs(sin)` has a hard corner at the bottom, which
 * reads as the body tapping the ground on every breath; this one settles and lifts again.
 * Never negative, so nothing sinks into the pavement.
 */
export function restBreath(t: number, rate: number, amp: number, phase = 0): number {
  return amp * (1 - Math.cos(t * rate + phase)) * 0.5;
}

/** Radians of lean per world unit a second of sideways speed on screen, and the most it takes. */
export const LEAN_PER_SPEED = 0.011;
export const LEAN_MAX = 0.075;
const LEAN_TAU = 0.12;

/**
 * A tilt into the direction of travel, as it appears on screen.
 *
 * Only sideways travel on screen leans the body. Walking straight at the camera or away from
 * it has nothing to lean into that the eye could see. The billboard's local geometry stands
 * on its feet (y 0..1), so `rotation.z` pivots at the ground, and it composes with the Y
 * rotation that `faceCamera` sets. Mirroring is a scale, applied before rotation, so a
 * mirrored profile leans the same way as an unmirrored one.
 */
export class Lean {
  angle = 0;

  /** `mx`, `mz`: this frame's movement. Returns the angle it put on the sprite. */
  update(sprite: { rotation: { z: number } }, mx: number, mz: number, dt: number, cameraYaw: number): number {
    if (dt > 0) {
      const screenRight = (mx * Math.cos(cameraYaw) - mz * Math.sin(cameraYaw)) / dt;
      const target = Math.max(-LEAN_MAX, Math.min(LEAN_MAX, -screenRight * LEAN_PER_SPEED));
      this.angle += (target - this.angle) * (1 - Math.exp(-dt / LEAN_TAU));
      if (Math.abs(this.angle) < 1e-4) this.angle = 0;
    }
    sprite.rotation.z = this.angle;
    return this.angle;
  }
}
