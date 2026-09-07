/**
 * The Sink cellars -- under the west tenement, where the Tithe-Takers keep the count.
 *
 * The first room in the world with something in it that fights. A pack roams the far end of
 * a cellar cut out of the rock under Lamprow, at every hour, because there is no hour down
 * here; the strongbox behind it is what it is counting. Walking in is the fight: the crew is
 * a `PackSpec` like any road's, the ring closes on the cellar floor, and `endFight` puts the
 * cellar back. The hatch is on the south wall, up to the Sink.
 *
 * Big enough to seat the pack arena cleanly, which is the one rule a room with a pack in it
 * has to keep -- see `worldBoard.test.ts` -- and no bigger: a cellar is not a hall.
 */

import { TILE, defineArea, type AreaDef, type TileDef } from '../../map.js';

const LEGEND: Record<string, TileDef> = {
  '#': {
    tex: 'cave',
    safe: false,
    walk: false,
    solid: { minHeight: 4.4, maxHeight: 4.4, inset: 0, depthInset: 0, chimneyChance: 0, split: false, wall: 'rock', bare: true },
  },
  k: { tex: 'cave', safe: false, walk: true },
  f: { tex: 'flagstone', safe: false, walk: true },
};

const GRID: readonly string[] = [
  '############', //  0
  '#kkkkkkkkkk#', //  1  the count
  '#kkkkkkkkkk#', //  2
  '#kkkkkkkkkk#', //  3
  '#kkkkkkkkkk#', //  4
  '#kkkkkkkkkk#', //  5
  '#kkkkkkkkkk#', //  6
  '#kkkkkkkkkk#', //  7
  '#kkkkkffkkk#', //  8  the foot of the stair
  '#kkkkkffkkk#', //  9
  '#####ff#####', // 10  the hatch, up to the Sink
];

const HALF_Z = (GRID.length * TILE) / 2;
const zOfRow = (row: number): number => row * TILE - HALF_Z + TILE / 2;

export const LAMPROW_SINK_CELLARS_ID = 'lamprow_sink_cellars';

export const LAMPROW_SINK_CELLARS: AreaDef = defineArea({
  id: LAMPROW_SINK_CELLARS_ID,
  name: 'The Sink Cellars',
  grid: GRID,
  legend: LEGEND,
  spawn: { x: 0, z: zOfRow(8) },
  safety: 'none',
  indoor: { camera: { distance: 18, pitch: 54, fov: 30 } },
  exits: [
    {
      to: 'lamprow',
      x: 0,
      z: zOfRow(10),
      label: 'Up the hatch to the Sink',
      arrive: { x: -40.4, z: 14 },
    },
  ],
  props: {
    sky: 'none',
    horizon: 'none',
    /** What a crew keeps in a cellar: casks, a heap of what came out of the rock, an urn of coin. */
    dressing: [
      { kind: 'barrel', x: -14, z: -12 },
      { kind: 'barrel', x: -14, z: -8 },
      { kind: 'spoilheap', x: 16, z: 6 },
      { kind: 'brazier', x: -16, z: 8 },
    ],
    /**
     * The crew, at the far end and at every hour. Underground has no night to work by.
     *
     * The roam is short: a cellar is not a road, and a crew that wandered to the foot of the
     * stair would jump you on the first step down rather than let you see what you had come
     * into.
     */
    packs: [{ encounterId: 'pack_lamprow_tithe_takers', x: 0, z: -10, roam: 5 }],
    graffiti: [
      { text: 'THE COUNT IS KEPT DOWN HERE', wallX: 0, wallZ: zOfRow(0) + TILE / 2, dx: 0, facesSouth: true, tint: '#7a8a9a' },
    ],
  },
});
