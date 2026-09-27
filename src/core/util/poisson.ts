/**
 * Poisson-disk sampling: points scattered so that none is closer to another than a set
 * distance, and no stretch is left conspicuously bare.
 *
 * What the placement scripts have been approximating with an even stride along a row-major
 * sweep (`scripts/place-dressing.ts` `place`), which is legal and looks it: props line up down
 * the grid. Blue noise is the pattern a hand makes when it spaces things out by eye -- no two
 * tufts touching, no rows -- and it is the pattern a ground-clutter layer needs to read as
 * growth rather than as wallpaper.
 *
 * Robert Bridson's algorithm ("Fast Poisson disk sampling in arbitrary dimensions", 2007),
 * with the background grid and the annulus candidates Kevin Chapelier's
 * `fast-2d-poisson-disk-sampling` (MIT, https://github.com/kchapelier/fast-2d-poisson-disk-sampling)
 * uses. Seeded from this repo's PRNG for the same reason `noise.ts` is: an area laid out by it
 * must lay out the same way on every run.
 */

import { makeRng, nextFloat, type RngState } from './rng.js';

export interface PoissonOptions {
  /** How many candidates each active point tries before it is retired. Bridson's 30. */
  readonly tries?: number;
  /**
   * Whether a candidate may stand here at all -- walkable ground, clear of a doorway, inside
   * the right paint. A rejected candidate is simply not placed, so a mask carves the pattern
   * rather than distorting it.
   */
  readonly accept?: (x: number, z: number) => boolean;
  /** Where to start. Defaults to a seeded point in the rectangle. */
  readonly start?: { readonly x: number; readonly z: number };
}

/**
 * Points in `[minX, maxX) x [minZ, maxZ)`, every pair at least `spacing` apart.
 *
 * Deterministic for a given seed and inputs. With no `accept` mask the rectangle is filled: no
 * point of it is further than `2 * spacing` from a sample. With a mask, the unmasked parts are
 * filled only if they can be reached from the start by steps of up to `2 * spacing` -- an island
 * of legal ground further than that from every other is left empty rather than guessed at.
 */
export function poissonDisk(
  minX: number,
  minZ: number,
  maxX: number,
  maxZ: number,
  spacing: number,
  seed: number | RngState,
  { tries = 30, accept, start }: PoissonOptions = {},
): { x: number; z: number }[] {
  const rng = typeof seed === 'number' ? makeRng(seed) : seed;
  const width = maxX - minX;
  const depth = maxZ - minZ;
  if (width <= 0 || depth <= 0 || spacing <= 0) return [];

  // A background grid one sample wide: a cell of side r/sqrt(2) can hold at most one point, so
  // a candidate need only be checked against the 5x5 cells around its own.
  const cell = spacing / Math.SQRT2;
  const cols = Math.ceil(width / cell);
  const rows = Math.ceil(depth / cell);
  const grid = new Int32Array(cols * rows).fill(-1);
  const out: { x: number; z: number }[] = [];
  const active: number[] = [];
  const r2 = spacing * spacing;

  const inside = (x: number, z: number): boolean => x >= minX && x < maxX && z >= minZ && z < maxZ;
  const fits = (x: number, z: number): boolean => {
    const cx = Math.floor((x - minX) / cell);
    const cz = Math.floor((z - minZ) / cell);
    for (let gz = Math.max(0, cz - 2); gz <= Math.min(rows - 1, cz + 2); gz++) {
      for (let gx = Math.max(0, cx - 2); gx <= Math.min(cols - 1, cx + 2); gx++) {
        const k = grid[gz * cols + gx]!;
        if (k < 0) continue;
        const o = out[k]!;
        const dx = o.x - x;
        const dz = o.z - z;
        if (dx * dx + dz * dz < r2) return false;
      }
    }
    return true;
  };
  const place = (x: number, z: number): void => {
    const k = out.length;
    out.push({ x, z });
    active.push(k);
    grid[Math.floor((z - minZ) / cell) * cols + Math.floor((x - minX) / cell)] = k;
  };

  // The first point: the caller's, or the first seeded point the mask allows.
  if (start && inside(start.x, start.z) && (!accept || accept(start.x, start.z))) {
    place(start.x, start.z);
  } else {
    for (let n = 0; n < tries * 10 && out.length === 0; n++) {
      const x = minX + nextFloat(rng) * width;
      const z = minZ + nextFloat(rng) * depth;
      if (!accept || accept(x, z)) place(x, z);
    }
  }

  while (active.length > 0) {
    // A random active point, so the pattern grows from everywhere at once instead of
    // crystallising outward from the start in rings.
    const ai = Math.floor(nextFloat(rng) * active.length);
    const from = out[active[ai]!]!;
    let placed = false;
    for (let n = 0; n < tries; n++) {
      // Uniform over the annulus [r, 2r] by area, not by radius, so candidates do not bunch
      // at the inner edge.
      const a = nextFloat(rng) * Math.PI * 2;
      const d = spacing * Math.sqrt(1 + nextFloat(rng) * 3);
      const x = from.x + Math.cos(a) * d;
      const z = from.z + Math.sin(a) * d;
      if (!inside(x, z) || !fits(x, z)) continue;
      if (accept && !accept(x, z)) continue;
      place(x, z);
      placed = true;
      break;
    }
    if (!placed) {
      // Retired: nothing more fits around it. Swap-remove, order does not matter.
      active[ai] = active[active.length - 1]!;
      active.pop();
    }
  }
  return out;
}
