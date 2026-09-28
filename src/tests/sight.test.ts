/**
 * What stands between a watcher and the watched.
 *
 * Packs and Wardens saw through terraces until this existed -- the cone was a sector and the
 * check was range and angle -- so a map's walls did nothing for the player being hunted across
 * it. These pin the grid walk on a small map drawn for the purpose, where every answer can be
 * read off the picture, and then on the real Chalk Verge thicket the atlas says was drawn "tall
 * enough to break a sightline".
 */

import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { SIGHT_HEIGHT, TILE, defineArea, sightClear, sightReach, xOfCol, zOfRow, type TileDef } from '../district/map.js';
import { ColliderSet } from '../district/collision.js';
import { Pack, SightFan, Warden } from '../district/entities.js';
import { CHALK_VERGE } from '../district/areas/index.js';
import { buildActorArt, type ActorArt } from '../district/sprites3d.js';

const LEGEND: Record<string, TileDef> = {
  '.': { tex: 'chalk', safe: false, walk: true },
  W: { tex: 'water', safe: false, walk: false },
  R: { tex: 'cobble', safe: false, walk: false, solid: { minHeight: 2.2, maxHeight: 3, inset: 0, depthInset: 0, chimneyChance: 0, split: false } },
  // A kerb-high wall: solid, and below eye height, so it stops a body and not a look.
  L: { tex: 'cobble', safe: false, walk: false, solid: { minHeight: 1.0, maxHeight: 1.2, inset: 0, depthInset: 0, chimneyChance: 0, split: false } },
};

/**
 * Ten by five. Row 2 carries a rock wall on the left, a canal in the middle and a low wall on
 * the right, with open ground above and below all three.
 */
const YARD = defineArea({
  id: 'sight_yard',
  name: 'Sight yard',
  grid: [
    '..........', //  0
    '..........', //  1
    '..RRWWLL..', //  2
    '..........', //  3
    '..........', //  4
  ],
  legend: LEGEND,
  spawn: { x: 0, z: 0 },
  exits: [],
  safety: 'none',
  props: {},
});

const x = (col: number): number => xOfCol(YARD, col);
const z = (row: number): number => zOfRow(YARD, row);

const img = (tag: string): HTMLImageElement => ({ tag, width: 136, height: 361 }) as unknown as HTMLImageElement;
const art = (): ActorArt =>
  buildActorArt({ front: img('f'), back: img('b'), side: img('s'), sideWalk: [img('w0'), img('w1'), img('w2'), img('w3')] }, 1);

describe('sight through the grid', () => {
  it('is blocked by a wall taller than eye height', () => {
    expect(SIGHT_HEIGHT).toBeLessThan(2.2);
    expect(sightClear(YARD, x(3), z(1), x(3), z(3))).toBe(false);
  });

  it('crosses open ground, water, and a wall below eye height', () => {
    expect(sightClear(YARD, x(1), z(1), x(1), z(3)), 'open ground').toBe(true);
    expect(sightClear(YARD, x(4), z(1), x(5), z(3)), 'across the canal').toBe(true);
    expect(sightClear(YARD, x(6), z(1), x(7), z(3)), 'over the low wall').toBe(true);
  });

  it('is the same looking either way', () => {
    for (let c = 0; c < 10; c++) {
      for (let c2 = 0; c2 < 10; c2++) {
        expect(sightClear(YARD, x(c), z(1), x(c2), z(3))).toBe(sightClear(YARD, x(c2), z(3), x(c), z(1)));
      }
    }
  });

  it('reports how far a ray gets before the wall', () => {
    // From the middle of row 1 straight south: the wall's near face is half a tile away.
    const reach = sightReach(YARD, x(2), z(1), 0, 1, 20);
    expect(reach).toBeCloseTo(TILE / 2, 6);
    // Along the open row, the ray runs to its limit.
    expect(sightReach(YARD, x(0), z(1), 1, 0, 20)).toBe(20);
  });

  it('never lets a watcher see out of the map', () => {
    expect(sightReach(YARD, x(0), z(0), -1, 0, 50)).toBeCloseTo(TILE / 2, 6);
  });

  it('is broken by the Chalk Verge thicket, and not by the chalk around it', () => {
    // The middle thicket is two tiles square at columns 21-22, rows 13-14 -- 13-14 and 8-9 before
    // the Verge grew by eight columns and five rows a side.
    const west = { x: xOfCol(CHALK_VERGE, 19), z: zOfRow(CHALK_VERGE, 13) };
    const east = { x: xOfCol(CHALK_VERGE, 24), z: zOfRow(CHALK_VERGE, 13) };
    expect(sightClear(CHALK_VERGE, west.x, west.z, east.x, east.z), 'through the thicket').toBe(false);
    const southW = { x: xOfCol(CHALK_VERGE, 19), z: zOfRow(CHALK_VERGE, 15) };
    const southE = { x: xOfCol(CHALK_VERGE, 24), z: zOfRow(CHALK_VERGE, 15) };
    expect(sightClear(CHALK_VERGE, southW.x, southW.z, southE.x, southE.z), 'below it').toBe(true);
  });
});

describe('a watcher cannot see through a wall', () => {
  it('a pack does not see you behind rock, and does across open ground', () => {
    // Facing south, which is where a pack's heading starts; the player a little over a tile away.
    const walled = new Pack('pack_chalk_scavengers', art(), 1.9, x(3), z(2) - 2.5, 4, new ColliderSet(YARD), () => 0.5);
    walled.playerAt.set(x(3), 0, z(2) + 2.5);
    walled.playerSafe = false;
    expect(walled.sees()).toBe(false);

    const open = new Pack('pack_chalk_scavengers', art(), 1.9, x(8), z(2) - 2.5, 4, new ColliderSet(YARD), () => 0.5);
    open.playerAt.set(x(8), 0, z(2) + 2.5);
    open.playerSafe = false;
    expect(open.sees()).toBe(true);
  });

  it('draws its cone stopped at the wall', () => {
    const walled = new Pack('pack_chalk_scavengers', art(), 1.9, x(3), z(2) - 2.5, 4, new ColliderSet(YARD), () => 0.5);
    const mid = Math.floor(SightFan.RAYS / 2);
    expect(walled.coneReach(mid), 'the middle ray ends on the rock').toBeLessThan(1);
    const open = new Pack('pack_chalk_scavengers', art(), 1.9, x(8), z(2) - 2.5, 4, new ColliderSet(YARD), () => 0.5);
    expect(open.coneReach(mid), 'the open cone runs its full length').toBeCloseTo(open.range, 6);
  });

  it('a Warden does not see you behind rock either', () => {
    const beat = [{ x: x(3), z: z(2) - 2.5 }];
    const w = new Warden(art(), 2.5, beat, new ColliderSet(YARD));
    w.playerAt.set(x(3), 0, z(2) + 2.5);
    w.playerSafe = false;
    // Its sight check is private; a frame is how it is asked. Facing south by default, a player
    // it could see would take it out of PATROL.
    w.update(0.05, 0, 0);
    expect(w.state).toBe('PATROL');

    const clear = new Warden(art(), 2.5, [{ x: x(8), z: z(2) - 2.5 }], new ColliderSet(YARD));
    clear.playerAt.copy(new THREE.Vector3(x(8), 0, z(2) + 2.5));
    clear.playerSafe = false;
    clear.update(0.05, 0, 0);
    expect(clear.state).toBe('ALERT');
  });
});
