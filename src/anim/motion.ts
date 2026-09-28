/**
 * The shapes of the board's motion, as pure functions of progress.
 *
 * The handlers own *when* a body moves; these own *how*. Kept apart so the curves can be
 * tested without a tween loop or a canvas, and so the one rule every animation here obeys
 * is written down where it can be checked: **at k = 1 everything is back at rest.** Skip
 * and fast-forward call `finishAll()`, which jumps every tween to its end, and a curve that
 * ends anywhere but rest leaves a body leaning or squashed until the next sync.
 */

import type { Coord } from '../contract/ids.js';
import { easeInQuad, easeOutBack, easeOutQuad } from './tween.js';

const clamp01 = (k: number) => Math.min(1, Math.max(0, k));

// ------------------------------------------------------------------------ paths

/**
 * How long a walk of `segments` tiles takes, before the sequencer's pace multiplier.
 *
 * It used to be 120ms per tile, each tile its own tween with its own ease-out, so a body
 * braked to a stop on every tile it crossed. One tween now carries the whole path. A short
 * step is a touch slower than before, so it has room to ease in and out, and a long march
 * is capped, so crossing the board is not a wait.
 */
export function pathDurationMs(segments: number): number {
  return Math.min(600, 70 + 95 * Math.max(1, segments));
}

/**
 * Where a body is at progress `k` along a path, measured by distance.
 *
 * By distance rather than by segment index, so a diagonal takes longer than a straight
 * step and the speed through every interior tile is the same. `stride` runs 0..1 across
 * each segment, for the footfall hop. The last point is returned exactly at k = 1.
 */
export function alongPath(path: readonly Coord[], k: number): { pos: Coord; stride: number } {
  const last = path[path.length - 1]!;
  if (path.length < 2 || k >= 1) return { pos: { ...last }, stride: 0 };
  const lens: number[] = [];
  let total = 0;
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i]!, b = path[i + 1]!;
    const l = Math.hypot(b.x - a.x, b.y - a.y);
    lens.push(l);
    total += l;
  }
  if (total === 0) return { pos: { ...last }, stride: 0 };
  let d = clamp01(k) * total;
  for (let i = 0; i < lens.length; i++) {
    const l = lens[i]!;
    if (d <= l || i === lens.length - 1) {
      const a = path[i]!, b = path[i + 1]!;
      const u = l === 0 ? 1 : Math.min(1, d / l);
      return { pos: { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u }, stride: u };
    }
    d -= l;
  }
  return { pos: { ...last }, stride: 0 };
}

/** The footfall: a small hop per tile crossed, zero at each tile centre. */
export const STEP_HOP_PX = 5;

// ------------------------------------------------------------------------ strikes

/**
 * One frame of a melee swing: how far toward the target (in tiles), how high, how squashed.
 *
 * It used to be a symmetric `sin` there and back. Now it has three beats:
 *
 * 1. **Wind-up** (0-25%). Settle back a little and crouch, which tells the eye a blow is
 *    coming.
 * 2. **Strike** (25-45%). Accelerate out to the peak, stretched along the swing.
 * 3. **Recover** (45-100%). Ease home with a slight overshoot past rest, so the body lands
 *    with weight instead of sliding into place.
 *
 * The peak stays under half a tile, so the attacker never rounds into its victim's cell and
 * the depth sort holds.
 */
export const LUNGE_PEAK_TILES = 0.4;
const WINDUP_TILES = 0.08;

export function meleeSwing(k: number): { reach: number; lift: number; squash: number } {
  k = clamp01(k);
  if (k >= 1) return { reach: 0, lift: 0, squash: 0 };
  if (k < 0.25) {
    const u = easeOutQuad(k / 0.25);
    return { reach: -WINDUP_TILES * u, lift: 0, squash: 0.25 * u };
  }
  if (k < 0.45) {
    const u = (k - 0.25) / 0.2;
    return {
      reach: -WINDUP_TILES + (LUNGE_PEAK_TILES + WINDUP_TILES) * easeInQuad(u),
      lift: 6 * u,
      squash: 0.25 * (1 - u) - 0.12 * u,
    };
  }
  const u = (k - 0.45) / 0.55;
  return {
    reach: LUNGE_PEAK_TILES * (1 - easeOutBack(u)),
    lift: 6 * (1 - u),
    squash: -0.12 * (1 - u),
  };
}

/** The ranged kick: a short push away from the target, with the body taking the recoil. */
export function rangedKick(k: number): { reach: number; lift: number; squash: number } {
  if (k >= 1) return { reach: 0, lift: 0, squash: 0 };
  const s = Math.sin(clamp01(k) * Math.PI);
  return { reach: -0.12 * s, lift: 10 * s, squash: 0.15 * s };
}

// ------------------------------------------------------------------------ arrivals, exits

/** After a drop-in lands: a squash that springs back out. */
export function landingSquash(k: number): number {
  return k >= 1 ? 0 : 0.35 * (1 - easeOutQuad(clamp01(k)));
}

/**
 * A death: a brief stretch upward, as if struck, then a collapse as it sinks.
 *
 * The body is removed when the tween ends, so the curve does not have to come back to rest.
 * It ends flattened, which is how the last frame of a fall should look.
 */
export function deathSquash(k: number): number {
  k = clamp01(k);
  return k < 0.3 ? -0.15 * (k / 0.3) : -0.15 + 0.75 * easeInQuad((k - 0.3) / 0.7);
}

// ------------------------------------------------------------------------ drawing

/**
 * How squash becomes a scale: shorter and correspondingly wider, so the body keeps its mass.
 * Negative squash is a stretch. The same formula on both boards, so a flinch reads the same.
 */
export function squashScale(squash: number): { sx: number; sy: number } {
  const sy = 1 - squash * 0.35;
  return { sx: 1 / Math.max(0.2, sy), sy };
}

/**
 * A standing bitmap's breath: a slow rise and settle about the feet.
 *
 * `(1 - cos) / 2` rather than `abs(sin)`, so there is no corner at the bottom of the cycle.
 * `abs(sin)` makes a body look as if it taps the ground on every breath.
 */
export function idleBreath(idleMs: number, periodMs: number, amp = 0.012): { sx: number; sy: number } {
  const b = (1 - Math.cos((idleMs / periodMs) * Math.PI * 2)) / 2;
  return { sx: 1 - amp * 0.5 * b, sy: 1 + amp * b };
}
