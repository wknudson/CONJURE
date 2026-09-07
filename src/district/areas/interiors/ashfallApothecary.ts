/**
 * The Apothecary -- the shop, and the Clinic behind the curtain.
 *
 * South side of Ashfall's cross-street, so its door is on the **north** wall and you come in
 * from the top of the room. Boards underfoot, a rug where customers wait, drying racks along
 * the walls, and the counter at the back where the apothecary stands. The Clinic is a cot in
 * the corner the `ShopScreen` already sells from; the room gives it a corner.
 */

import { TILE, defineArea, type AreaDef, type TileDef } from '../../map.js';

const LEGEND: Record<string, TileDef> = {
  '#': {
    tex: 'planks',
    safe: false,
    walk: false,
    solid: { minHeight: 4.6, maxHeight: 4.6, inset: 0, depthInset: 0, chimneyChance: 0, split: false, wall: 'plaster', bare: true },
  },
  p: { tex: 'planks', safe: false, walk: true },
  r: { tex: 'rug', safe: false, walk: true },
};

const GRID: readonly string[] = [
  '#####pp#######', //  0  the door, from the cross-street
  '#pppppppppppp#', //  1
  '#pppppppppppp#', //  2
  '#pppppppppppp#', //  3
  '#ppprrrrrrppp#', //  4  where you wait
  '#ppprrrrrrppp#', //  5
  '#ppprrrrrrppp#', //  6
  '#pppppppppppp#', //  7
  '#pppppppppppp#', //  8
  '#pppppppppppp#', //  9  the counter
  '#pppppppppppp#', // 10  the Clinic's corner, east
  '##############', // 11
];

const HALF_X = (GRID[0]!.length * TILE) / 2;
const HALF_Z = (GRID.length * TILE) / 2;
const xOfCol = (col: number): number => col * TILE - HALF_X + TILE / 2;
const zOfRow = (row: number): number => row * TILE - HALF_Z + TILE / 2;

export const ASHFALL_APOTHECARY_ID = 'ashfall_apothecary';

export const ASHFALL_APOTHECARY: AreaDef = defineArea({
  id: ASHFALL_APOTHECARY_ID,
  name: 'The Apothecary',
  grid: GRID,
  legend: LEGEND,
  spawn: { x: -4, z: zOfRow(2) },
  safety: 'none',
  indoor: { camera: { distance: 19, pitch: 54, fov: 30 } },
  exits: [
    {
      to: 'ashfall_ward',
      x: (xOfCol(5) + xOfCol(6)) / 2,
      z: zOfRow(0),
      label: 'Out to the cross-street',
      arrive: { x: -18, z: 11.8 },
    },
  ],
  props: {
    sky: 'none',
    horizon: 'none',
    dressing: [
      { kind: 'rack', x: xOfCol(1), z: zOfRow(3) },
      { kind: 'rack', x: xOfCol(12), z: zOfRow(3) },
      { kind: 'rack', x: xOfCol(1), z: zOfRow(6) },
      { kind: 'barrel', x: xOfCol(12), z: zOfRow(9) },
      { kind: 'sacks', x: xOfCol(1), z: zOfRow(10) },
      { kind: 'brazier', x: xOfCol(12), z: zOfRow(6) },
    ],
    /** Chalked on the back wall, where the queue can read it. */
    graffiti: [
      { text: 'THE QUOTA IS SEVEN A WEEK', wallX: xOfCol(5), wallZ: zOfRow(11) - TILE / 2, dx: -1.0, facesSouth: false, tint: '#8a7a5a' },
    ],
  },
});
