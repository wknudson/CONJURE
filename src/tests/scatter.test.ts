/**
 * The two layout fields: simplex noise and Poisson-disk scatter.
 *
 * Both exist to lay an area out the same way every time it is laid out, so the properties
 * that matter are determinism first and shape second -- a field that drifted between runs
 * would move an area's ground under a save, and one that bunched or striped would look like
 * the sweep it replaces.
 */

import { describe, expect, it } from 'vitest';
import { fractal2D, makeNoise2D } from '../core/util/noise.js';
import { poissonDisk } from '../core/util/poisson.js';

describe('simplex noise', () => {
  it('gives the same field for the same seed, and a different one for another', () => {
    const a = makeNoise2D(1234);
    const b = makeNoise2D(1234);
    const c = makeNoise2D(99);
    let differs = 0;
    for (let i = 0; i < 200; i++) {
      const x = i * 0.37 - 30;
      const y = i * 0.73 - 50;
      expect(a(x, y)).toBe(b(x, y));
      if (Math.abs(a(x, y) - c(x, y)) > 1e-6) differs++;
    }
    expect(differs, 'another seed is another field').toBeGreaterThan(180);
  });

  it('stays in [-1, 1], uses most of that range, and has no preferred sign', () => {
    const n = makeNoise2D(7);
    let lo = 0;
    let hi = 0;
    let sum = 0;
    const N = 20000;
    for (let i = 0; i < N; i++) {
      const v = n((i % 141) * 0.311, Math.floor(i / 141) * 0.293);
      expect(Math.abs(v)).toBeLessThanOrEqual(1);
      lo = Math.min(lo, v);
      hi = Math.max(hi, v);
      sum += v;
    }
    expect(hi).toBeGreaterThan(0.7);
    expect(lo).toBeLessThan(-0.7);
    expect(Math.abs(sum / N)).toBeLessThan(0.05);
  });

  it('is smooth: a small step moves the value a little, and a smaller step less', () => {
    // Lipschitz rather than a fixed tolerance: the field's steepest slope is a few units per
    // unit, so a hundredth of a step moves it by at most a tenth -- and a thousandth by a
    // tenth of that, which is what distinguishes a continuous field from a jittery one.
    const n = makeNoise2D(42);
    for (let i = 0; i < 500; i++) {
      const x = (i % 25) * 1.7;
      const y = Math.floor(i / 25) * 1.3;
      expect(Math.abs(n(x + 0.01, y) - n(x, y))).toBeLessThan(0.1);
      expect(Math.abs(n(x + 0.001, y) - n(x, y))).toBeLessThan(0.01);
    }
  });

  it('sums octaves back into [-1, 1], with features at the size it is asked for', () => {
    const n = makeNoise2D(5);
    for (let i = 0; i < 2000; i++) {
      const v = fractal2D(n, i * 0.9, i * 0.4, { scale: 12, octaves: 4 });
      expect(Math.abs(v)).toBeLessThanOrEqual(1);
    }
    // At scale 12 a single octave's features are about 12 across: two points a tenth of that
    // apart are close, and two a whole feature apart are not, on average.
    const one = { scale: 12, octaves: 1 };
    let near = 0;
    let far = 0;
    for (let i = 0; i < 400; i++) {
      const x = i * 3.1;
      const y = i * 1.9;
      near += Math.abs(fractal2D(n, x + 1.2, y, one) - fractal2D(n, x, y, one));
      far += Math.abs(fractal2D(n, x + 12, y, one) - fractal2D(n, x, y, one));
    }
    expect(near * 2.5).toBeLessThan(far);
  });
});

describe('poisson-disk scatter', () => {
  it('keeps every pair at least the spacing apart, inside the rectangle', () => {
    const pts = poissonDisk(-20, -10, 30, 25, 2.2, 314);
    expect(pts.length).toBeGreaterThan(50);
    for (const p of pts) {
      expect(p.x).toBeGreaterThanOrEqual(-20);
      expect(p.x).toBeLessThan(30);
      expect(p.z).toBeGreaterThanOrEqual(-10);
      expect(p.z).toBeLessThan(25);
    }
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        const d = Math.hypot(pts[i]!.x - pts[j]!.x, pts[i]!.z - pts[j]!.z);
        expect(d).toBeGreaterThanOrEqual(2.2 - 1e-9);
      }
    }
  });

  it('comes out the same for the same seed', () => {
    expect(poissonDisk(0, 0, 40, 40, 3, 8)).toEqual(poissonDisk(0, 0, 40, 40, 3, 8));
    expect(poissonDisk(0, 0, 40, 40, 3, 8)).not.toEqual(poissonDisk(0, 0, 40, 40, 3, 9));
  });

  it('leaves no stretch of the rectangle bare', () => {
    // Bridson's guarantee: once the active list empties, every point of the domain is within
    // twice the spacing of a sample, or a candidate there would have fitted.
    const s = 2;
    const pts = poissonDisk(0, 0, 36, 28, s, 77);
    for (let x = 0.5; x < 36; x += 1.5) {
      for (let z = 0.5; z < 28; z += 1.5) {
        const nearest = Math.min(...pts.map((p) => Math.hypot(p.x - x, p.z - z)));
        expect(nearest, `bare at ${x},${z}`).toBeLessThan(2 * s + 1e-9);
      }
    }
  });

  it('honours a mask without placing anything it refuses', () => {
    // A ring road: nothing inside the square in the middle.
    const accept = (x: number, z: number): boolean => !(x > 10 && x < 30 && z > 10 && z < 30);
    const pts = poissonDisk(0, 0, 40, 40, 2, 3, { accept });
    expect(pts.length).toBeGreaterThan(80);
    for (const p of pts) expect(accept(p.x, p.z), `${p.x},${p.z}`).toBe(true);
  });

  it('starts where it is told to, when that ground is allowed', () => {
    const pts = poissonDisk(0, 0, 20, 20, 2, 1, { start: { x: 5, z: 6 } });
    expect(pts[0]).toEqual({ x: 5, z: 6 });
  });
});
