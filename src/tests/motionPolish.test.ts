import { describe, expect, it } from 'vitest';
import {
  LUNGE_PEAK_TILES,
  alongPath,
  deathSquash,
  idleBreath,
  landingSquash,
  meleeSwing,
  pathDurationMs,
  rangedKick,
  squashScale,
} from '../anim/motion.js';
import { LEAN_MAX, Lean, Momentum, restBreath } from '../district/gait.js';

const ks = (n = 200) => Array.from({ length: n + 1 }, (_, i) => i / n);

describe('motion curves come back to rest', () => {
  // `finishAll()` jumps every tween to k = 1. A curve that ends anywhere but rest leaves a
  // body leaning or squashed until the next sync, which is the bug this rule prevents.
  it('the melee swing, the ranged kick and the landing all end exactly at rest', () => {
    expect(meleeSwing(1)).toEqual({ reach: 0, lift: 0, squash: 0 });
    expect(rangedKick(1)).toEqual({ reach: 0, lift: 0, squash: 0 });
    expect(landingSquash(1)).toBe(0);
    const start = meleeSwing(0);
    expect(Math.abs(start.reach) + start.lift + start.squash, 'and it starts from rest too').toBe(0);
  });

  it('a path ends exactly on its last tile', () => {
    const path = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 1 }];
    expect(alongPath(path, 1).pos).toEqual({ x: 2, y: 1 });
    expect(alongPath(path, 0).pos).toEqual({ x: 0, y: 0 });
  });
});

describe('the melee swing', () => {
  it('winds up away from the target before it strikes', () => {
    expect(meleeSwing(0.2).reach).toBeLessThan(0);
    expect(meleeSwing(0.2).squash).toBeGreaterThan(0);
  });

  it('never reaches half a tile, so the depth sort holds', () => {
    const peak = Math.max(...ks().map((k) => meleeSwing(k).reach));
    expect(peak).toBeCloseTo(LUNGE_PEAK_TILES, 2);
    expect(peak).toBeLessThan(0.45);
  });

  it('overshoots home a little, and only a little', () => {
    const recover = ks().filter((k) => k > 0.45).map((k) => meleeSwing(k).reach);
    const least = Math.min(...recover);
    expect(least).toBeLessThan(0);
    expect(least).toBeGreaterThan(-0.06);
  });

  it('is continuous across its beats', () => {
    for (const edge of [0.25, 0.45]) {
      const a = meleeSwing(edge - 1e-6), b = meleeSwing(edge + 1e-6);
      expect(Math.abs(a.reach - b.reach)).toBeLessThan(1e-3);
      expect(Math.abs(a.squash - b.squash)).toBeLessThan(1e-3);
    }
  });
});

describe('a walk along a path', () => {
  const path = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }];

  it('moves forward monotonically at an even speed through interior tiles', () => {
    let last = -1;
    for (const k of ks()) {
      const x = alongPath(path, k).pos.x;
      expect(x).toBeGreaterThanOrEqual(last);
      last = x;
    }
    // Measured by distance, so a third of the way is the first tile, not a third of the list.
    expect(alongPath(path, 1 / 3).pos.x).toBeCloseTo(1, 6);
    expect(alongPath(path, 0.5).pos.x).toBeCloseTo(1.5, 6);
  });

  it('puts a footfall on every tile centre', () => {
    for (const k of [1 / 3, 2 / 3]) {
      const s = alongPath(path, k).stride;
      expect(Math.min(s, 1 - s)).toBeLessThan(1e-6);
    }
  });

  it('is never slower than a single step and never longer than 600ms', () => {
    expect(pathDurationMs(1)).toBeGreaterThanOrEqual(120);
    expect(pathDurationMs(20)).toBe(600);
  });
});

describe('squash and breath scale about the feet and keep the mass', () => {
  it('a squash is shorter and wider, and a stretch the reverse', () => {
    const s = squashScale(0.6);
    expect(s.sy).toBeLessThan(1);
    expect(s.sx).toBeGreaterThan(1);
    expect(s.sx * s.sy).toBeCloseTo(1, 9);
    const st = squashScale(deathSquash(0.3));
    expect(st.sy).toBeGreaterThan(1);
  });

  it('no squash is no scale', () => {
    expect(squashScale(0)).toEqual({ sx: 1, sy: 1 });
  });

  it('an idle breath never dips below the rest height, and has no corner at the bottom', () => {
    for (const ms of ks().map((k) => k * 5000)) expect(idleBreath(ms, 2400).sy).toBeGreaterThanOrEqual(1);
    // Smooth at the trough: the height either side of it is second-order small.
    const near = idleBreath(24, 2400).sy - 1;
    expect(near).toBeLessThan(1e-4);
    for (const t of ks().map((k) => k * 10)) expect(restBreath(t, 2.8, 0.035)).toBeGreaterThanOrEqual(0);
    expect(restBreath(0.01, 2.8, 0.035)).toBeLessThan(1e-5);
  });
});

describe('street gait', () => {
  it('momentum ramps rather than switching, and is framerate-independent', () => {
    const a = new Momentum(), b = new Momentum();
    a.approach(6, 0.1);
    b.approach(6, 0.05);
    b.approach(6, 0.05);
    expect(a.speed).toBeGreaterThan(0);
    expect(a.speed).toBeLessThan(6);
    expect(a.speed).toBeCloseTo(b.speed, 9);
  });

  it('momentum comes to a real stop, and stop() is immediate', () => {
    const m = new Momentum();
    for (let i = 0; i < 60; i++) m.approach(6, 1 / 60);
    for (let i = 0; i < 60; i++) m.approach(0, 1 / 60);
    expect(m.speed).toBe(0);
    m.approach(6, 0.5);
    m.stop();
    expect(m.speed).toBe(0);
  });

  it('leans into sideways travel on screen, within bounds, and not into travel toward the camera', () => {
    const sprite = { rotation: { z: 0 } };
    const lean = new Lean();
    for (let i = 0; i < 120; i++) lean.update(sprite, 6 / 60, 0, 1 / 60, 0); // right, on screen
    expect(sprite.rotation.z).toBeLessThan(0);
    expect(Math.abs(sprite.rotation.z)).toBeLessThanOrEqual(LEAN_MAX);

    const toward = new Lean();
    const s2 = { rotation: { z: 0 } };
    for (let i = 0; i < 120; i++) toward.update(s2, 0, 6 / 60, 1 / 60, 0);
    expect(Math.abs(s2.rotation.z)).toBeLessThan(1e-9);
  });

  it('settles upright once the body stops', () => {
    const sprite = { rotation: { z: 0 } };
    const lean = new Lean();
    for (let i = 0; i < 60; i++) lean.update(sprite, 6 / 60, 0, 1 / 60, 0);
    for (let i = 0; i < 120; i++) lean.update(sprite, 0, 0, 1 / 60, 0);
    expect(sprite.rotation.z).toBe(0);
  });
});
