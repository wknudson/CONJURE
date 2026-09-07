/**
 * The low granary -- drowned when the sluice went, and not empty since.
 *
 * The `drowned_granary` contract is fought here, in the flooded end: the far third of the
 * floor is under water and whatever dammed the race is in it. The miller's aside afterwards
 * says the thing was the lid on the channel, not the dam, and the strongbox that opens once
 * it is dealt with is what the granary was keeping dry. Reeds have come up through the
 * boards. The door is on the south wall, onto the cross.
 */

import { TILE, defineArea, type AreaDef, type TileDef } from '../../map.js';

const LEGEND: Record<string, TileDef> = {
  '#': {
    tex: 'straw',
    safe: false,
    walk: false,
    solid: { minHeight: 4.0, maxHeight: 4.0, inset: 0, depthInset: 0, chimneyChance: 0, split: false, wall: 'stone', bare: true },
  },
  s: { tex: 'straw', safe: false, walk: true },
  k: { tex: 'cave', safe: false, walk: true },
  w: { tex: 'water', safe: false, walk: false },
};

const GRID: readonly string[] = [
  '##############', //  0
  '#kkwwwwwwwwkk#', //  1  the flooded end
  '#kkkwwwwwwkkk#', //  2
  '#kkkkkkkkkkkk#', //  3  where the water stops, today
  '#kkkkkkkkkkkk#', //  4
  '#ssssssssssss#', //  5  the fight
  '#ssssssssssss#', //  6
  '#ssssssssssss#', //  7
  '#ssssssssssss#', //  8
  '#ssssssssssss#', //  9
  '#ssssssssssss#', // 10
  '#ssssssssssss#', // 11
  '#ssssssssssss#', // 12
  '######ss######', // 13  the door, onto the cross
];

const HALF_X = (GRID[0]!.length * TILE) / 2;
const HALF_Z = (GRID.length * TILE) / 2;
const xOfCol = (col: number): number => col * TILE - HALF_X + TILE / 2;
const zOfRow = (row: number): number => row * TILE - HALF_Z + TILE / 2;

export const MILLHARROW_GRANARY_ID = 'millharrow_granary';

export const MILLHARROW_GRANARY: AreaDef = defineArea({
  id: MILLHARROW_GRANARY_ID,
  name: 'The Drowned Granary',
  grid: GRID,
  legend: LEGEND,
  spawn: { x: 0, z: zOfRow(9) },
  safety: 'none',
  indoor: { camera: { distance: 20, pitch: 54, fov: 30 } },
  exits: [
    {
      to: 'millharrow',
      x: 0,
      z: zOfRow(13),
      label: 'Out onto the cross',
      arrive: { x: -44, z: -3 },
    },
  ],
  props: {
    sky: 'none',
    horizon: 'none',
    dressing: [
      { kind: 'sacks', x: xOfCol(1), z: zOfRow(8) },
      { kind: 'sacks', x: xOfCol(1), z: zOfRow(11) },
      { kind: 'sacks', x: xOfCol(12), z: zOfRow(11) },
      { kind: 'barrel', x: xOfCol(12), z: zOfRow(7) },
      { kind: 'haybale', x: xOfCol(2), z: zOfRow(5) },
    ],
    graffiti: [
      { text: 'THE WATER LINE', wallX: xOfCol(3), wallZ: zOfRow(0) + TILE / 2, dx: 0, facesSouth: true, tint: '#6a7a8a' },
      {
        text: 'THE LID IS OFF',
        wallX: xOfCol(9),
        wallZ: zOfRow(0) + TILE / 2,
        dx: 0,
        facesSouth: true,
        tint: '#8a6a4a',
        gate: { after: ['drowned_granary'] },
      },
    ],
  },
});
