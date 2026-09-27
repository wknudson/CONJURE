/**
 * The light pool's hand-over: which fires get a real light, and that none of them ever flashes.
 *
 * The count itself cannot drift by construction -- the pool is built once per area and a light
 * leaving a fire is turned down, never removed -- so what is asked here is the arithmetic that
 * decides the shares, walked along real areas' fires the way a player walks past them.
 */

import { describe, expect, it } from 'vitest';
import { poolShares, type FirePoint } from '../district/lightPool.js';
import { AREAS } from '../district/areas/index.js';
import { allDressing } from '../district/footprints.js';

/** The fires an area will build: its lamps, then its braziers and vents. */
const firesOf = (id: string): FirePoint[] => {
  const area = AREAS.find((a) => a.id === id)!;
  return [
    ...(area.props.lamps ?? []),
    ...allDressing(area).filter((d) => d.kind === 'brazier' || d.kind === 'embervent'),
  ].map((f) => ({ x: f.x, z: f.z }));
};

describe('light pool', () => {
  it('gives every fire a whole light when there are no more fires than lights', () => {
    const fires = [
      { x: 0, z: 0 },
      { x: 30, z: 4 },
      { x: -8, z: 12 },
    ];
    const out = new Float32Array(fires.length);
    poolShares(fires, 100, 100, 10, 6, out);
    expect([...out]).toEqual([1, 1, 1]);
  });

  it('lights no more fires than it has lights, and the nearest of them', () => {
    const fires = firesOf('ashfall_ward');
    expect(fires.length, 'Ashfall burns more than a pool of ten').toBeGreaterThan(10);
    const out = new Float32Array(fires.length);
    poolShares(fires, 0, 26, 10, 6, out);
    const lit = [...out].map((s, i) => ({ s, i })).filter(({ s }) => s > 0);
    expect(lit.length).toBeLessThanOrEqual(10);
    const d = (i: number): number => Math.hypot(fires[i]!.x, fires[i]!.z - 26);
    const furthestLit = Math.max(...lit.map(({ i }) => d(i)));
    for (let i = 0; i < fires.length; i++) {
      if (out[i] === 0) expect(d(i), 'a dark fire nearer than a lit one').toBeGreaterThanOrEqual(furthestLit - 1e-6);
    }
  });

  it('never flashes: walking the length of a street moves every share a little at a time', () => {
    // Walked in quarter-unit steps -- a frame at walking pace is a tenth of a unit -- across
    // the areas that burn the most. A fire that dropped out of the pool at a visible strength
    // would show as a jump here.
    for (const id of ['ashfall_ward', 'cinderworks', 'lamprow', 'highcourt', 'caldera']) {
      const fires = firesOf(id);
      if (fires.length === 0) continue;
      const area = AREAS.find((a) => a.id === id)!;
      const prev = new Float32Array(fires.length);
      const now = new Float32Array(fires.length);
      for (const z of [-20, 0, 20]) {
        poolShares(fires, -area.halfX, z, 10, 6, prev);
        for (let x = -area.halfX; x <= area.halfX; x += 0.25) {
          poolShares(fires, x, z, 10, 6, now);
          for (let i = 0; i < fires.length; i++) {
            expect(Math.abs(now[i]! - prev[i]!), `${id}: fire ${i} jumped at ${x},${z}`).toBeLessThan(0.1);
          }
          prev.set(now);
        }
      }
    }
  });
});
