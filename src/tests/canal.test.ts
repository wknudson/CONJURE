/**
 * A canal with a far bank.
 *
 * Five areas have a canal, and until the area passes every one of them ran along the north edge:
 * `waterRows` counted rows from the top and the ground plane started below them. Growing a canal
 * ward evenly on every side would have turned all its new north rows into more canal, so the
 * canal can now be a band with ground above it -- `waterRow0` -- and a bridge is simply a
 * walkable tile in the band. These pin the arithmetic on a map drawn for the purpose, and hold
 * every real banded canal to the rules the renderer assumes: water or bridge the whole way
 * across, and every bridge landing on both banks.
 */

import { describe, expect, it } from 'vitest';
import {
  defineArea,
  groundRow0Of,
  groundRowsOf,
  inCanal,
  waterRow0Of,
  waterRowsOf,
  type AreaDef,
  type TileDef,
} from '../district/map.js';
import { AREAS } from '../district/areas/index.js';

const LEGEND: Record<string, TileDef> = {
  '.': { tex: 'cobble', safe: false, walk: true },
  '=': { tex: 'planks', safe: false, walk: true },
  W: { tex: 'water', safe: false, walk: false },
};

const yard = (grid: string[], waterRows: number, waterRow0?: number): AreaDef =>
  defineArea({
    id: 'canal_yard',
    name: 'Canal yard',
    grid,
    legend: LEGEND,
    spawn: { x: 0, z: 0 },
    exits: [],
    safety: 'none',
    props: { waterRows, ...(waterRow0 !== undefined ? { waterRow0 } : {}) },
  });

describe('the canal', () => {
  it('along the north edge, as it always was: the ground starts below it', () => {
    const a = yard(['WWWW', 'WWWW', '....', '....'], 2);
    expect(waterRow0Of(a)).toBe(0);
    expect(groundRow0Of(a)).toBe(2);
    expect(groundRowsOf(a)).toBe(2);
    expect([0, 1, 2, 3].map((r) => inCanal(a, r))).toEqual([true, true, false, false]);
  });

  it('as a band with a far bank: the ground covers the whole map and the canal is the middle', () => {
    const a = yard(['....', 'WW=W', 'WW=W', '....', '....'], 2, 1);
    expect(waterRow0Of(a)).toBe(1);
    expect(groundRow0Of(a)).toBe(0);
    expect(groundRowsOf(a)).toBe(5);
    expect([0, 1, 2, 3, 4].map((r) => inCanal(a, r))).toEqual([false, true, true, false, false]);
  });

  it('has no band where there is no water, whatever the band says', () => {
    const a = yard(['....', '....'], 0, 1);
    expect(waterRow0Of(a)).toBe(0);
    expect(groundRow0Of(a)).toBe(0);
    expect(inCanal(a, 1)).toBe(false);
  });
});

describe('every banded canal', () => {
  const banded = AREAS.filter((a) => waterRowsOf(a) > 0 && waterRow0Of(a) > 0);

  it('is in an area with a canal for its far bank to be the far bank of', () => {
    // `waterRow0Of` reads 0 without `waterRows`, so a band declared on a dry map would be
    // silently ignored rather than drawn. Refuse it where it is written.
    for (const area of AREAS) {
      if ((area.props.waterRow0 ?? 0) > 0) expect(waterRowsOf(area), `${area.id} declares a far bank and no canal`).toBeGreaterThan(0);
    }
  });

  for (const area of banded) {
    const w0 = waterRow0Of(area);
    const n = waterRowsOf(area);
    const walk = (row: number, col: number): boolean => area.legend[area.grid[row]![col]!]?.walk === true;
    const wet = (row: number, col: number): boolean => area.legend[area.grid[row]![col]!]?.tex === 'water';

    it(`${area.id}: is water or bridge the whole way across, and fits inside the map`, () => {
      expect(w0 + n).toBeLessThan(area.rows);
      for (let row = w0; row < w0 + n; row++) {
        for (let col = 0; col < area.cols; col++) {
          // A bridge is baked over the water; anything else in the band is under the plane.
          expect(wet(row, col) || walk(row, col), `${area.id} row ${row} col ${col} is neither water nor a bridge`).toBe(true);
        }
      }
    });

    it(`${area.id}: lands every bridge on both banks`, () => {
      for (let col = 0; col < area.cols; col++) {
        if (!walk(w0, col)) continue;
        // A bridge runs straight across: walkable the whole depth of the band...
        for (let row = w0; row < w0 + n; row++) {
          expect(walk(row, col), `${area.id}: the bridge at col ${col} breaks at row ${row}`).toBe(true);
        }
        // ...and onto walkable ground at each end.
        expect(walk(w0 - 1, col), `${area.id}: the bridge at col ${col} has no north landing`).toBe(true);
        expect(walk(w0 + n, col), `${area.id}: the bridge at col ${col} has no south landing`).toBe(true);
      }
    });
  }
});
