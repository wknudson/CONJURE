/**
 * Seeded 2-D simplex noise, for laying ground and scatter out by *field* rather than by dice.
 *
 * The placement scripts have been faking this with a sum of sines (`scripts/enrich-ground.ts`),
 * which reads as low-frequency waves because it is one: the stripes line up across a whole map.
 * Simplex has no preferred direction and no visible lattice, so a band of wet ground or a drift
 * of leaves can follow it without looking ruled.
 *
 * Stefan Gustavson's algorithm ("Simplex noise demystified", 2005), in the shape Jonas Wagner's
 * `simplex-noise` (MIT, https://github.com/jwagner/simplex-noise.js) gives it: a permutation
 * table shuffled from a seed, twelve gradient directions, three corner contributions. Written
 * out here rather than taken as a dependency because it is forty lines and it has to be
 * seeded from this repo's own PRNG -- a map laid out by it must come out the same on every
 * machine, for ever, or an area file regenerated next year moves.
 */

import { makeRng, nextInt } from './rng.js';

const F2 = 0.5 * (Math.sqrt(3) - 1);
const G2 = (3 - Math.sqrt(3)) / 6;

/** The twelve edge midpoints of a cube, flattened to the plane: Gustavson's gradient set. */
const GRAD_X = [1, -1, 1, -1, 1, -1, 1, -1, 0, 0, 0, 0];
const GRAD_Y = [1, 1, -1, -1, 0, 0, 0, 0, 1, -1, 1, -1];

/** A noise field: a smooth value in [-1, 1] for any point, the same every time it is asked. */
export type Noise2D = (x: number, y: number) => number;

/**
 * A simplex field seeded from `seed`.
 *
 * Two fields from the same seed agree everywhere; two from different seeds are unrelated. Salt
 * the seed with `hashText(areaId + ':' + purpose)` so one area's puddles and its leaf litter do
 * not follow the same contour.
 */
export function makeNoise2D(seed: number): Noise2D {
  const rng = makeRng(seed);
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) {
    const j = nextInt(rng, i + 1);
    const t = p[i]!;
    p[i] = p[j]!;
    p[j] = t;
  }
  // Doubled so `perm[i + perm[j]]` never needs a wrap.
  const perm = new Uint8Array(512);
  const gx = new Float64Array(512);
  const gy = new Float64Array(512);
  for (let i = 0; i < 512; i++) {
    perm[i] = p[i & 255]!;
    gx[i] = GRAD_X[perm[i]! % 12]!;
    gy[i] = GRAD_Y[perm[i]! % 12]!;
  }

  return (x: number, y: number): number => {
    // Skew into the simplex lattice and find which of the cell's two triangles the point is in.
    const s = (x + y) * F2;
    const i = Math.floor(x + s);
    const j = Math.floor(y + s);
    const t = (i + j) * G2;
    const x0 = x - (i - t);
    const y0 = y - (j - t);
    const i1 = x0 > y0 ? 1 : 0;
    const j1 = x0 > y0 ? 0 : 1;
    const x1 = x0 - i1 + G2;
    const y1 = y0 - j1 + G2;
    const x2 = x0 - 1 + 2 * G2;
    const y2 = y0 - 1 + 2 * G2;
    const ii = i & 255;
    const jj = j & 255;

    let n = 0;
    let t0 = 0.5 - x0 * x0 - y0 * y0;
    if (t0 > 0) {
      const g = ii + perm[jj]!;
      t0 *= t0;
      n += t0 * t0 * (gx[g]! * x0 + gy[g]! * y0);
    }
    let t1 = 0.5 - x1 * x1 - y1 * y1;
    if (t1 > 0) {
      const g = ii + i1 + perm[jj + j1]!;
      t1 *= t1;
      n += t1 * t1 * (gx[g]! * x1 + gy[g]! * y1);
    }
    let t2 = 0.5 - x2 * x2 - y2 * y2;
    if (t2 > 0) {
      const g = ii + 1 + perm[jj + 1]!;
      t2 *= t2;
      n += t2 * t2 * (gx[g]! * x2 + gy[g]! * y2);
    }
    // Scaled so the field spans [-1, 1].
    return 70 * n;
  };
}

/**
 * Several octaves of one field summed, each finer and fainter than the last, normalised back
 * into [-1, 1].
 *
 * One octave is a gentle swell; ground wants the swell and some ragged edge on it, which is what
 * the finer octaves add. `scale` is the size of the largest feature in the caller's units -- a
 * patch of mud about three tiles across is `fractal2D(n, x, z, { scale: 12 })`.
 */
export function fractal2D(
  noise: Noise2D,
  x: number,
  y: number,
  { scale = 1, octaves = 3, lacunarity = 2, gain = 0.5 }: { scale?: number; octaves?: number; lacunarity?: number; gain?: number } = {},
): number {
  let sum = 0;
  let amp = 1;
  let norm = 0;
  let freq = 1 / scale;
  for (let o = 0; o < octaves; o++) {
    sum += amp * noise(x * freq, y * freq);
    norm += amp;
    amp *= gain;
    freq *= lacunarity;
  }
  return sum / norm;
}
