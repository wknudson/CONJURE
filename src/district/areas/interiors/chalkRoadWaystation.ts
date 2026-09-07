/**
 * The waystation -- the toll house on the Chalk Road, and nobody in it.
 *
 * The Magistracy took a toll on this road once, from a counter in a timber room on the north
 * verge, and the Toll Stretch two hundred yards west is what happened when it stopped. The
 * room is as it was left: the ledger open on the counter with the last line unfinished, a
 * strongbox nobody came back for, a cot behind the counter with a tin on it for whoever
 * sleeps there now. The graves are in the yard. The road carries no notices; it carries
 * this.
 */

import { TILE, defineArea, type AreaDef, type TileDef } from '../../map.js';

const LEGEND: Record<string, TileDef> = {
  '#': {
    tex: 'planks',
    safe: false,
    walk: false,
    solid: { minHeight: 4.2, maxHeight: 4.2, inset: 0, depthInset: 0, chimneyChance: 0, split: false, wall: 'timber', bare: true },
  },
  p: { tex: 'planks', safe: false, walk: true },
  h: { tex: 'hearth', safe: false, walk: true },
};

const GRID: readonly string[] = [
  '############', //  0
  '#pppppppppp#', //  1
  '#pppppppppp#', //  2  the counter, west; the strongbox, east
  '#pppppppppp#', //  3
  '#pppppppphh#', //  4  the hearth, cold
  '#pppppppppp#', //  5
  '#pppppppppp#', //  6
  '#pppppppppp#', //  7
  '#pppppppppp#', //  8  the cot, west
  '#pppppppppp#', //  9
  '#####pp#####', // 10  the door, onto the yard
];

const HALF_X = (GRID[0]!.length * TILE) / 2;
const HALF_Z = (GRID.length * TILE) / 2;
const xOfCol = (col: number): number => col * TILE - HALF_X + TILE / 2;
const zOfRow = (row: number): number => row * TILE - HALF_Z + TILE / 2;

export const CHALK_ROAD_WAYSTATION_ID = 'chalk_road_waystation';

export const CHALK_ROAD_WAYSTATION: AreaDef = defineArea({
  id: CHALK_ROAD_WAYSTATION_ID,
  name: 'The Chalk Road Waystation',
  grid: GRID,
  legend: LEGEND,
  spawn: { x: 0, z: zOfRow(6) },
  safety: 'none',
  indoor: { camera: { distance: 19, pitch: 54, fov: 30 } },
  exits: [
    {
      to: 'chalk_road',
      x: 0,
      z: zOfRow(10),
      label: 'Out into the yard',
      arrive: { x: 24, z: -7 },
    },
  ],
  props: {
    sky: 'none',
    horizon: 'none',
    dressing: [
      { kind: 'counter', x: xOfCol(3), z: zOfRow(2) },
      { kind: 'table', x: xOfCol(8), z: zOfRow(2) },
      { kind: 'brazier', x: xOfCol(9.5), z: zOfRow(4) },
      { kind: 'barrel', x: xOfCol(10), z: zOfRow(7) },
      { kind: 'barrel', x: xOfCol(10), z: zOfRow(8) },
      { kind: 'sacks', x: xOfCol(1), z: zOfRow(6) },
      { kind: 'shelves', x: xOfCol(6), z: zOfRow(0) + TILE / 2 + 0.9, yaw: 0 },
    ],
    graffiti: [
      { text: 'TOLL TAKEN IN KIND', wallX: xOfCol(2), wallZ: zOfRow(0) + TILE / 2, dx: 0, facesSouth: true, tint: '#8a6a4a' },
    ],
  },
});
