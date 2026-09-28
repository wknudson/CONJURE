/**
 * The vignettes: what they are made of, and how a stamp turns them.
 *
 * Where a stamped vignette may stand is the district test's business -- `allDressing` expands it
 * and every prop rule asks it -- so this is only the composition itself.
 */

import { describe, expect, it } from 'vitest';
import { VIGNETTES, VIGNETTE_IDS, expandVignette } from '../district/vignettes.js';
import { DRESSING, isDressingId } from '../district/dressing.js';

describe('the vignettes', () => {
  it('are made of props that exist, and are small enough to be one scene', () => {
    for (const id of VIGNETTE_IDS) {
      const v = VIGNETTES[id];
      expect(v.pieces.length, id).toBeGreaterThanOrEqual(3);
      for (const p of v.pieces) {
        expect(isDressingId(p.kind), `${id}: ${p.kind}`).toBe(true);
        expect(Math.hypot(p.dx, p.dz), `${id}: ${p.kind} is off in another scene`).toBeLessThan(4);
      }
    }
  });

  it('keep their colliding pieces apart, so a scene is not a wall', () => {
    for (const id of VIGNETTE_IDS) {
      const solid = VIGNETTES[id].pieces.filter((p) => DRESSING[p.kind].collides);
      for (let i = 0; i < solid.length; i++) {
        for (let j = i + 1; j < solid.length; j++) {
          const a = solid[i]!;
          const b = solid[j]!;
          expect(Math.hypot(a.dx - b.dx, a.dz - b.dz), `${id}: ${a.kind} and ${b.kind} overlap`).toBeGreaterThan(1.2);
        }
      }
    }
  });

  it('stamp where they are told, turned as a whole, and never give a billboard a yaw', () => {
    const flat = expandVignette({ id: 'broken_cart', x: 10, z: 20 });
    expect(flat[0]).toMatchObject({ kind: 'cart', x: 10, z: 20 });
    const turned = expandVignette({ id: 'broken_cart', x: 10, z: 20, yaw: Math.PI / 2 });
    // A quarter turn carries the sacks from the east of the cart to its north.
    const sacks = turned.find((p) => p.kind === 'sacks')!;
    expect(sacks.x).toBeCloseTo(10 + 0.9, 5);
    expect(sacks.z).toBeCloseTo(20 - 1.8, 5);
    for (const id of VIGNETTE_IDS) {
      for (const p of expandVignette({ id, x: 0, z: 0, yaw: 1 })) {
        if (DRESSING[p.kind].form === 'billboard') expect(p.yaw, `${id}: ${p.kind}`).toBeUndefined();
      }
    }
  });
});
