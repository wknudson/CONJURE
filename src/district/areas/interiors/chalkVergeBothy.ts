/**
 * The shepherd's bothy -- one room, drystone, on the Verge's north track.
 *
 * Nobody lives on the Verge, and the bothy is how the map says *any more*. A straw floor,
 * a cold hearth, a bed that takes whatever you leave in the tin, and a tally cut into the
 * lintel by somebody who counted the road's crews for four winters and wrote down when they
 * came out. It is the first roof outside the ward and the first place the world tells you
 * the packs keep hours, in a hand that is not the Magistracy's.
 */

import { TILE, defineArea, type AreaDef, type TileDef } from '../../map.js';

const LEGEND: Record<string, TileDef> = {
  '#': {
    tex: 'straw',
    safe: false,
    walk: false,
    solid: { minHeight: 3.6, maxHeight: 3.6, inset: 0, depthInset: 0, chimneyChance: 0, split: false, wall: 'stone', bare: true },
  },
  s: { tex: 'straw', safe: false, walk: true },
  h: { tex: 'hearth', safe: false, walk: true },
};

const GRID: readonly string[] = [
  '##########', //  0
  '#ssssssss#', //  1  the bed, west; the table, east
  '#ssssssss#', //  2
  '#ssssssss#', //  3
  '#sssssshh#', //  4  the hearth
  '#sssssshh#', //  5
  '#ssssssss#', //  6
  '#ssssssss#', //  7
  '#ssssssss#', //  8  the tally, west; the box, east
  '#ssssssss#', //  9
  '####ss####', // 10  the door, onto the track
];

const HALF_X = (GRID[0]!.length * TILE) / 2;
const HALF_Z = (GRID.length * TILE) / 2;
const xOfCol = (col: number): number => col * TILE - HALF_X + TILE / 2;
const zOfRow = (row: number): number => row * TILE - HALF_Z + TILE / 2;

export const CHALK_VERGE_BOTHY_ID = 'chalk_verge_bothy';

export const CHALK_VERGE_BOTHY: AreaDef = defineArea({
  id: CHALK_VERGE_BOTHY_ID,
  name: "The Shepherd's Bothy",
  grid: GRID,
  legend: LEGEND,
  spawn: { x: 0, z: zOfRow(7) },
  safety: 'none',
  indoor: { camera: { distance: 18, pitch: 54, fov: 30 } },
  exits: [
    {
      to: 'chalk_verge',
      x: 0,
      z: zOfRow(10),
      label: 'Out onto the track',
      arrive: { x: 34, z: -23 },
    },
  ],
  props: {
    sky: 'none',
    horizon: 'none',
    dressing: [
      { kind: 'table', x: xOfCol(7), z: zOfRow(1) },
      { kind: 'barrel', x: xOfCol(8), z: zOfRow(3) },
      { kind: 'brazier', x: xOfCol(7.5), z: zOfRow(4.5) },
      { kind: 'sacks', x: xOfCol(1), z: zOfRow(6) },
      { kind: 'haybale', x: xOfCol(8), z: zOfRow(7) },
    ],
    graffiti: [
      { text: 'FOUR WINTERS, ONE FLOCK', wallX: 0, wallZ: zOfRow(0) + TILE / 2, dx: 0, facesSouth: true, tint: '#8a7a5a' },
    ],
  },
});
