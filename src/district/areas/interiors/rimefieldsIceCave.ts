/**
 * The ice cave -- in the Rimefields' north face, and the only roof on the snow.
 *
 * The stones outside say there is no shelter past them. There is this, which is why they say
 * it: a party sheltered here, and what dens here now denned with them. Blue ice on the walls,
 * a floor swept to the black by whatever walks it, a cairn somebody built over what was left,
 * and at the back what the party was carrying, frozen into the floor until the face is broken.
 */

import { TILE, defineArea, type AreaDef, type TileDef } from '../../map.js';

const LEGEND: Record<string, TileDef> = {
  '#': {
    tex: 'ice',
    safe: false,
    walk: false,
    solid: { minHeight: 5.5, maxHeight: 5.5, inset: 0, depthInset: 0, chimneyChance: 0, split: false, wall: 'rock', bare: true },
  },
  i: { tex: 'ice', safe: false, walk: true },
  n: { tex: 'snow', safe: false, walk: true },
};

const GRID: readonly string[] = [
  '############', //  0
  '#iiiiiiiiii#', //  1  the back; what was carried
  '#iiiiiiiiii#', //  2
  '#iiiiiiiiii#', //  3  the den
  '#iiiiiiiiii#', //  4
  '#iiiiiiiiii#', //  5
  '#niiiiiiiin#', //  6
  '#nniiiiiinn#', //  7
  '#nnnnnnnnnn#', //  8  the ice bloom, west; the cairn
  '#nnnnnnnnnn#', //  9
  '#nnnnnnnnnn#', // 10
  '#nnnnnnnnnn#', // 11
  '#####nn#####', // 12  the mouth
];

const HALF_X = (GRID[0]!.length * TILE) / 2;
const HALF_Z = (GRID.length * TILE) / 2;
const xOfCol = (col: number): number => col * TILE - HALF_X + TILE / 2;
const zOfRow = (row: number): number => row * TILE - HALF_Z + TILE / 2;

export const RIMEFIELDS_ICE_CAVE_ID = 'rimefields_ice_cave';

export const RIMEFIELDS_ICE_CAVE: AreaDef = defineArea({
  id: RIMEFIELDS_ICE_CAVE_ID,
  name: 'The Ice Cave',
  grid: GRID,
  legend: LEGEND,
  spawn: { x: 0, z: zOfRow(9) },
  safety: 'none',
  indoor: { camera: { distance: 20, pitch: 54, fov: 30 } },
  exits: [
    {
      to: 'rimefields',
      x: 0,
      z: zOfRow(12),
      label: 'Out onto the snow',
      arrive: { x: -26, z: -37 },
    },
  ],
  props: {
    sky: 'none',
    horizon: 'none',
    dressing: [
      { kind: 'cairn', x: xOfCol(10), z: zOfRow(9) },
      { kind: 'spoilheap', x: xOfCol(1), z: zOfRow(6) },
      { kind: 'bonepile', x: xOfCol(10), z: zOfRow(6) },
      { kind: 'scorch', x: xOfCol(5.5), z: zOfRow(10) },
    ],
    /** What dens here: the hoarhounds, white on white until they move. */
    packs: [{ encounterId: 'pack_hoarhounds', x: 0, z: zOfRow(4), roam: 5 }],
    graffiti: [
      { text: 'COUNT YOUR PARTY', wallX: xOfCol(3), wallZ: zOfRow(0) + TILE / 2, dx: 0, facesSouth: true, tint: '#8caacc' },
    ],
  },
});
