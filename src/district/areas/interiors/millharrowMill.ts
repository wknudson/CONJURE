/**
 * The Mill -- Millharrow's, on the race north of the cross.
 *
 * The stones are upstairs and the grain is here: sacks against every wall, the millhand who
 * humps them, the book the toll is costed in, and the store the town's flour sits in until the
 * carts come. The miller himself is out on the cross, where an errand-giver belongs. His hand
 * is in here, and has a job for you that the miller would not admit to needing done.
 */

import { TILE, defineArea, type AreaDef, type TileDef } from '../../map.js';

const LEGEND: Record<string, TileDef> = {
  '#': {
    tex: 'planks',
    safe: false,
    walk: false,
    solid: { minHeight: 5.6, maxHeight: 5.6, inset: 0, depthInset: 0, chimneyChance: 0, split: false, wall: 'timber', bare: true },
  },
  p: { tex: 'planks', safe: false, walk: true },
  s: { tex: 'straw', safe: false, walk: true },
};

const GRID: readonly string[] = [
  '############', //  0
  '#ssssssssss#', //  1  the grain store
  '#ssssssssss#', //  2
  '#pppppppppp#', //  3
  '#pppppppppp#', //  4
  '#pppppppppp#', //  5  the millhand
  '#pppppppppp#', //  6
  '#pppppppppp#', //  7
  '#pppppppppp#', //  8  the book
  '#pppppppppp#', //  9
  '#####pp#####', // 10  the door, onto the lane
];

const HALF_X = (GRID[0]!.length * TILE) / 2;
const HALF_Z = (GRID.length * TILE) / 2;
const xOfCol = (col: number): number => col * TILE - HALF_X + TILE / 2;
const zOfRow = (row: number): number => row * TILE - HALF_Z + TILE / 2;

export const MILLHARROW_MILL_ID = 'millharrow_mill';

export const MILLHARROW_MILL: AreaDef = defineArea({
  id: MILLHARROW_MILL_ID,
  name: 'The Mill',
  grid: GRID,
  legend: LEGEND,
  spawn: { x: 0, z: zOfRow(6) },
  safety: 'none',
  indoor: { camera: { distance: 19, pitch: 54, fov: 30 } },
  exits: [
    {
      to: 'millharrow',
      x: 0,
      z: zOfRow(10),
      label: 'Out onto the lane',
      arrive: { x: -11, z: -16.6 },
    },
  ],
  props: {
    sky: 'none',
    horizon: 'none',
    dressing: [
      { kind: 'sacks', x: xOfCol(1), z: zOfRow(1) },
      { kind: 'sacks', x: xOfCol(3), z: zOfRow(1) },
      { kind: 'sacks', x: xOfCol(5), z: zOfRow(1) },
      { kind: 'sacks', x: xOfCol(1), z: zOfRow(4) },
      { kind: 'workbench', x: xOfCol(9), z: zOfRow(4) },
      { kind: 'barrel', x: xOfCol(10), z: zOfRow(7) },
      { kind: 'shelves', x: xOfCol(7), z: zOfRow(0) + TILE / 2 + 0.9, yaw: 0 },
    ],
    npcs: [
      { id: 'millharrow_millhand', x: xOfCol(2), z: zOfRow(6), art: 'carpenter', label: 'Talk to the millhand' },
    ],
    graffiti: [
      { text: 'FOUR SACKS IN, TWO PAID', wallX: xOfCol(6), wallZ: zOfRow(10) - TILE / 2, dx: 3.2, facesSouth: false, tint: '#8a7a5a' },
    ],
  },
});
