/**
 * The Counting House -- where the ward's arrears are kept, in coin.
 *
 * Inside the Warden's yard, and sealed until the ward has watched you serve a writ; the door
 * on the street is drawn boarded until then, with the reason under the prompt. Once it opens
 * it is a room of desks and ledgers with one clerk who has counted everything in it twice and
 * would rather you did not, and the strongbox the Magistracy would rather you did not find.
 */

import { TILE, defineArea, type AreaDef, type TileDef } from '../../map.js';

const LEGEND: Record<string, TileDef> = {
  '#': {
    tex: 'flagstone',
    safe: false,
    walk: false,
    solid: { minHeight: 5.2, maxHeight: 5.2, inset: 0, depthInset: 0, chimneyChance: 0, split: false, wall: 'stone', bare: true },
  },
  f: { tex: 'flagstone', safe: false, walk: true },
  r: { tex: 'rug', safe: false, walk: true },
};

const GRID: readonly string[] = [
  '############', //  0
  '#ffffffffff#', //  1  the strongroom end
  '#ffffffffff#', //  2
  '#ffffffffff#', //  3
  '#fffrrrrfff#', //  4  the clerks' desks
  '#fffrrrrfff#', //  5
  '#fffrrrrfff#', //  6
  '#ffffffffff#', //  7
  '#ffffffffff#', //  8
  '#ffffffffff#', //  9
  '#####ff#####', // 10  the door, onto the yard
];

const HALF_Z = (GRID.length * TILE) / 2;
const zOfRow = (row: number): number => row * TILE - HALF_Z + TILE / 2;

export const ASHFALL_COUNTING_HOUSE_ID = 'ashfall_counting_house';

export const ASHFALL_COUNTING_HOUSE: AreaDef = defineArea({
  id: ASHFALL_COUNTING_HOUSE_ID,
  name: 'The Counting House',
  grid: GRID,
  legend: LEGEND,
  spawn: { x: 0, z: zOfRow(8) },
  safety: 'none',
  indoor: { camera: { distance: 18, pitch: 54, fov: 30 } },
  exits: [
    {
      to: 'ashfall_ward',
      x: 0,
      z: zOfRow(10),
      label: 'Out into the yard',
      // Beside the door: the yard is one tile deep here, with the terrace behind you.
      arrive: { x: -36.4, z: -5 },
    },
  ],
  props: {
    sky: 'none',
    horizon: 'none',
    dressing: [
      { kind: 'desk', x: -10, z: -2 },
      { kind: 'desk', x: 10, z: -2 },
      { kind: 'shelves', x: -18, z: -14, yaw: Math.PI / 2 },
      { kind: 'shelves', x: 18, z: -14, yaw: Math.PI / 2 },
      { kind: 'brazier', x: 18, z: 10 },
    ],
    npcs: [
      { id: 'ashfall_counting_clerk', x: 0, z: 6, art: 'scribe_scholar', label: 'Talk to the counting clerk' },
    ],
    graffiti: [
      { text: 'COUNTED, AND OWED', wallX: 4, wallZ: zOfRow(0) + TILE / 2, dx: 0, facesSouth: true, tint: '#8a8070' },
    ],
  },
});
