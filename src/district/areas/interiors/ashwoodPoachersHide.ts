/**
 * The poacher's hide -- a long hut of deadfall and turf under the Ashwood's north edge.
 *
 * The poacher at the fire on the ride is one man and wants to be found. The crew in here are
 * the rest of the trade: the pickers who move what he takes down to the road at night, and
 * who are not looking to be found by anybody. Snares on the walls, a rack of what the snares
 * took, and under the floor what the trade is worth, which opens once the man at the fire has
 * been fought.
 */

import { TILE, defineArea, type AreaDef, type TileDef } from '../../map.js';

const LEGEND: Record<string, TileDef> = {
  '#': {
    tex: 'litter',
    safe: false,
    walk: false,
    solid: { minHeight: 4.6, maxHeight: 4.6, inset: 0, depthInset: 0, chimneyChance: 0, split: false, wall: 'timber', bare: true },
  },
  l: { tex: 'litter', safe: false, walk: true },
  p: { tex: 'planks', safe: false, walk: true },
  s: { tex: 'straw', safe: false, walk: true },
};

const GRID: readonly string[] = [
  '############', //  0
  '#ssssssssss#', //  1  the bedrolls; the take
  '#ssssssssss#', //  2
  '#pppppppppp#', //  3  the pickers
  '#pppppppppp#', //  4
  '#pppppppppp#', //  5
  '#pppppppppp#', //  6
  '#llllllllll#', //  7
  '#llllllllll#', //  8  the rot ring, west
  '#llllllllll#', //  9
  '#llllllllll#', // 10
  '#llllllllll#', // 11
  '#####ll#####', // 12  the door, onto the litter
];

const HALF_X = (GRID[0]!.length * TILE) / 2;
const HALF_Z = (GRID.length * TILE) / 2;
const xOfCol = (col: number): number => col * TILE - HALF_X + TILE / 2;
const zOfRow = (row: number): number => row * TILE - HALF_Z + TILE / 2;

export const ASHWOOD_POACHERS_HIDE_ID = 'ashwood_poachers_hide';

export const ASHWOOD_POACHERS_HIDE: AreaDef = defineArea({
  id: ASHWOOD_POACHERS_HIDE_ID,
  name: "The Poacher's Hide",
  grid: GRID,
  legend: LEGEND,
  spawn: { x: 0, z: zOfRow(9) },
  safety: 'none',
  indoor: { camera: { distance: 20, pitch: 54, fov: 30 } },
  exits: [
    {
      to: 'ashwood',
      x: 0,
      z: zOfRow(12),
      label: 'Out under the trees',
      arrive: { x: 18, z: -43 },
    },
  ],
  props: {
    sky: 'none',
    horizon: 'none',
    dressing: [
      { kind: 'rack', x: xOfCol(10), z: zOfRow(6) },
      { kind: 'logpile', x: xOfCol(1), z: zOfRow(6) },
      { kind: 'sacks', x: xOfCol(10), z: zOfRow(9) },
      { kind: 'barrel', x: xOfCol(10), z: zOfRow(10) },
      { kind: 'haybale', x: xOfCol(1), z: zOfRow(10) },
      { kind: 'brazier', x: xOfCol(5.5), z: zOfRow(7) },
    ],
    /** The pickers, off the road and in the dry. Short roam, for the same reason as every cellar. */
    packs: [{ encounterId: 'pack_freight_pickers', x: 0, z: zOfRow(4), roam: 5 }],
    graffiti: [
      { text: 'KEEP OFF THE RIDE', wallX: xOfCol(3), wallZ: zOfRow(0) + TILE / 2, dx: 0, facesSouth: true, tint: '#8a7a5a' },
    ],
  },
});
