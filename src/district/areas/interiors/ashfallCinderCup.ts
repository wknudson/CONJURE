/**
 * The Cinder Cup -- Ashfall's tavern, on the plaza's south-east corner.
 *
 * Timber over plaster, a hearth that never goes out because the Cinderworks is upwind and
 * the coal is free, tables for the ward and a bar along the back with the publican at the
 * end of it. Upstairs is a bed, which is a clock you can rent. The notices by the door are
 * the ward's rumour mill, and they change with the campaign. The door is on the north wall,
 * onto the plaza; the yard with the woodpile is behind, reached from the lane.
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
  h: { tex: 'hearth', safe: false, walk: true },
};

const GRID: readonly string[] = [
  '#######pp#######', //  0  the door, from the plaza
  '#pppppppppppppp#', //  1
  '#pppppppppppppp#', //  2
  '#pppppppppppppp#', //  3  the tables
  '#pppppppppppphh#', //  4  the hearth, east
  '#pppppppppppphh#', //  5
  '#pppppppppppppp#', //  6
  '#pppppppppppppp#', //  7
  '#pppppppppppppp#', //  8
  '#ppprrrrrrrrppp#', //  9  the bar's runner
  '#ppprrrrrrrrppp#', // 10
  '#pppppppppppppp#', // 11  behind the bar; the stair to the bed, west
  '################', // 12
];

const HALF_X = (GRID[0]!.length * TILE) / 2;
const HALF_Z = (GRID.length * TILE) / 2;
const xOfCol = (col: number): number => col * TILE - HALF_X + TILE / 2;
const zOfRow = (row: number): number => row * TILE - HALF_Z + TILE / 2;

export const ASHFALL_CINDER_CUP_ID = 'ashfall_cinder_cup';

export const ASHFALL_CINDER_CUP: AreaDef = defineArea({
  id: ASHFALL_CINDER_CUP_ID,
  name: 'The Cinder Cup',
  grid: GRID,
  legend: LEGEND,
  spawn: { x: 0, z: zOfRow(3) },
  safety: 'none',
  indoor: { camera: { distance: 20, pitch: 54, fov: 30 } },
  exits: [
    {
      to: 'ashfall_ward',
      x: 0,
      z: zOfRow(0),
      label: 'Out onto the plaza',
      arrive: { x: 26, z: 31.8 },
    },
  ],
  props: {
    sky: 'none',
    horizon: 'none',
    /** Four tables, the bar, the fire, and the casks the fire is for. */
    dressing: [
      { kind: 'table', x: xOfCol(3), z: zOfRow(3) },
      { kind: 'table', x: xOfCol(3), z: zOfRow(7) },
      { kind: 'table', x: xOfCol(9), z: zOfRow(3) },
      { kind: 'table', x: xOfCol(9), z: zOfRow(7) },
      { kind: 'counter', x: xOfCol(7.5), z: zOfRow(10) + 1 },
      { kind: 'brazier', x: xOfCol(13.5), z: zOfRow(4.5) },
      { kind: 'barrel', x: xOfCol(14), z: zOfRow(9) },
      { kind: 'barrel', x: xOfCol(14), z: zOfRow(10) },
      { kind: 'shelves', x: xOfCol(11), z: zOfRow(11) + 1, yaw: 0 },
    ],
    /** The publican at the end of the bar, and two who are always in. */
    npcs: [
      { id: 'ashfall_publican', x: xOfCol(3), z: zOfRow(11), art: 'innkeeper', label: 'Talk to the publican' },
      { id: 'ashfall_drinker_a', x: xOfCol(6), z: zOfRow(6), art: 'miner_a', label: 'Talk to the man at the table' },
      { id: 'ashfall_drinker_b', x: xOfCol(12), z: zOfRow(1) + 1, art: 'bard_b', label: 'Talk to the singer' },
    ],
    graffiti: [
      { text: 'NO TAB FOR WHISPERERS', wallX: 8, wallZ: zOfRow(12) - TILE / 2, dx: 0, facesSouth: false, tint: '#9a8a6a' },
    ],
  },
});
