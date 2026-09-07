/**
 * The Records Office -- the building that used to be the Field Journal.
 *
 * The Journal is a thing you carry now (`J`, from anywhere), so the door across the street
 * from the Ironworks opens onto what a Magistracy ward keeps behind a book on a plaque: the
 * census. Shelves, lecterns, a rug the clerks are not allowed on, and the ledgers themselves
 * -- which will be readable, once notices exist. Until then it is a room with an opinion on
 * its wall, which is the minimum the world asks of a place.
 */

import { TILE, defineArea, type AreaDef, type TileDef } from '../../map.js';

const LEGEND: Record<string, TileDef> = {
  '#': {
    tex: 'planks',
    safe: false,
    walk: false,
    solid: { minHeight: 5.0, maxHeight: 5.0, inset: 0, depthInset: 0, chimneyChance: 0, split: false, wall: 'timber', bare: true },
  },
  p: { tex: 'planks', safe: false, walk: true },
  r: { tex: 'rug', safe: false, walk: true },
  f: { tex: 'flagstone', safe: false, walk: true },
};

const GRID: readonly string[] = [
  '##############', //  0
  '#pppppppppppp#', //  1  the stacks
  '#pppppppppppp#', //  2
  '#pppppppppppp#', //  3
  '#pppppppppppp#', //  4
  '#pppprrrrpppp#', //  5  the reading table
  '#pppprrrrpppp#', //  6
  '#pppppppppppp#', //  7
  '#pppppppppppp#', //  8
  '#pppppppppppp#', //  9
  '#ppppppffpppp#', // 10  the threshold
  '######ff######', // 11  the door, back to the cross-street
];

const HALF_X = (GRID[0]!.length * TILE) / 2;
const HALF_Z = (GRID.length * TILE) / 2;
const xOfCol = (col: number): number => col * TILE - HALF_X + TILE / 2;
const zOfRow = (row: number): number => row * TILE - HALF_Z + TILE / 2;

export const ASHFALL_RECORDS_ID = 'ashfall_records';

export const ASHFALL_RECORDS: AreaDef = defineArea({
  id: ASHFALL_RECORDS_ID,
  name: 'The Records Office',
  grid: GRID,
  legend: LEGEND,
  spawn: { x: 0, z: zOfRow(9) },
  safety: 'none',
  indoor: { camera: { distance: 19, pitch: 54, fov: 30 } },
  exits: [
    {
      to: 'ashfall_ward',
      x: (xOfCol(6) + xOfCol(7)) / 2,
      z: zOfRow(11),
      label: 'Out to the cross-street',
      arrive: { x: 22, z: 12.2 },
    },
  ],
  props: {
    sky: 'none',
    horizon: 'none',
    /** Shelves down both walls, and the one desk the clerk on duty sits at. */
    dressing: [
      { kind: 'shelves', x: xOfCol(1), z: zOfRow(2), yaw: Math.PI / 2 },
      { kind: 'shelves', x: xOfCol(1), z: zOfRow(5), yaw: Math.PI / 2 },
      { kind: 'shelves', x: xOfCol(12), z: zOfRow(2), yaw: Math.PI / 2 },
      { kind: 'shelves', x: xOfCol(12), z: zOfRow(5), yaw: Math.PI / 2 },
      { kind: 'desk', x: 8, z: 10 },
      { kind: 'sacks', x: xOfCol(12), z: zOfRow(9) },
      { kind: 'brazier', x: xOfCol(1), z: zOfRow(9) },
    ],
    graffiti: [
      { text: 'COUNTED, NOT NAMED', wallX: xOfCol(6), wallZ: zOfRow(0) + TILE / 2, dx: 0.8, facesSouth: true, tint: '#8a8070' },
    ],
  },
});
