/**
 * The barn -- Bray's, on the north slope of the Hollow, and the only roof in it.
 *
 * Where the herd is wintered and where the warrant came for it: the `warrant_of_distraint`
 * contract is fought over the straw here, between the pens, with the herdsman watching from
 * the loft ladder. The warrant itself is nailed to the post by the door. What the licence would
 * have cost is in a box under the hay, and it opens once the warrant has been answered.
 */

import { TILE, defineArea, type AreaDef, type TileDef } from '../../map.js';

const LEGEND: Record<string, TileDef> = {
  '#': {
    tex: 'straw',
    safe: false,
    walk: false,
    solid: { minHeight: 5.2, maxHeight: 5.2, inset: 0, depthInset: 0, chimneyChance: 0, split: false, wall: 'timber', bare: true },
  },
  s: { tex: 'straw', safe: false, walk: true },
  p: { tex: 'planks', safe: false, walk: true },
};

const GRID: readonly string[] = [
  '############', //  0
  '#ssssssssss#', //  1  the pens
  '#ssssssssss#', //  2
  '#ssssssssss#', //  3
  '#ssssssssss#', //  4  the fight
  '#ssssssssss#', //  5
  '#ssssssssss#', //  6
  '#ssssssssss#', //  7
  '#pppppppppp#', //  8  the threshing floor; the loft ladder
  '#pppppppppp#', //  9
  '#####pp#####', // 10  the door, onto the slope
];

const HALF_X = (GRID[0]!.length * TILE) / 2;
const HALF_Z = (GRID.length * TILE) / 2;
const xOfCol = (col: number): number => col * TILE - HALF_X + TILE / 2;
const zOfRow = (row: number): number => row * TILE - HALF_Z + TILE / 2;

export const BRAYS_BARN_ID = 'brays_barn';

export const BRAYS_BARN: AreaDef = defineArea({
  id: BRAYS_BARN_ID,
  name: "Bray's Barn",
  grid: GRID,
  legend: LEGEND,
  spawn: { x: 0, z: zOfRow(6) },
  safety: 'none',
  indoor: { camera: { distance: 19, pitch: 54, fov: 30 } },
  exits: [
    {
      to: 'brays_hollow',
      x: 0,
      z: zOfRow(10),
      label: 'Out onto the slope',
      arrive: { x: -16, z: -16.6 },
    },
  ],
  props: {
    sky: 'none',
    horizon: 'none',
    dressing: [
      { kind: 'pens', x: xOfCol(2), z: zOfRow(1), yaw: 0 },
      { kind: 'pens', x: xOfCol(9), z: zOfRow(1), yaw: 0 },
      { kind: 'haybale', x: xOfCol(1), z: zOfRow(4) },
      { kind: 'haybale', x: xOfCol(10), z: zOfRow(6) },
      { kind: 'trough', x: xOfCol(10), z: zOfRow(3) },
      { kind: 'sacks', x: xOfCol(1), z: zOfRow(7) },
      { kind: 'barrel', x: xOfCol(10), z: zOfRow(9) },
    ],
    npcs: [
      { id: 'brays_herdsman', x: xOfCol(2), z: zOfRow(9), art: 'butcher', label: 'Talk to the herdsman' },
    ],
    graffiti: [
      { text: 'SIXTY HEAD. ONE WARRANT.', wallX: xOfCol(5), wallZ: zOfRow(0) + TILE / 2, dx: 0, facesSouth: true, tint: '#8a7a5a' },
    ],
  },
});
