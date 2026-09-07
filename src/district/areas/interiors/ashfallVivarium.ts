/**
 * The Vivarium -- a walled yard, open to the ash.
 *
 * A room with no roof: the walls are the yard wall, low and brick, and what is inside is straw,
 * hurdles and troughs. It is `indoor` all the same, because what `indoor` means is "lit as
 * authored, framed close, no horizon" -- and a yard four walls deep in the ward has no horizon
 * either. The handler's table stands at the back; the `VivariumScreen` opens from it.
 */

import { TILE, defineArea, type AreaDef, type TileDef } from '../../map.js';

const LEGEND: Record<string, TileDef> = {
  '#': {
    tex: 'straw',
    safe: false,
    walk: false,
    solid: { minHeight: 3.8, maxHeight: 3.8, inset: 0, depthInset: 0, chimneyChance: 0, split: false, wall: 'brick', bare: true },
  },
  s: { tex: 'straw', safe: false, walk: true },
  c: { tex: 'cobble', safe: false, walk: true },
};

const GRID: readonly string[] = [
  '#####cc#######', //  0  the gate, from the cross-street
  '#ssssccssssss#', //  1
  '#ssssccssssss#', //  2  a cobbled path down the middle
  '#ssssccssssss#', //  3
  '#ssssccssssss#', //  4
  '#ssssccssssss#', //  5
  '#ssssccssssss#', //  6
  '#ssssccssssss#', //  7
  '#ssssssssssss#', //  8
  '#ssssssssssss#', //  9  the handler's table
  '#ssssssssssss#', // 10
  '##############', // 11
];

const HALF_X = (GRID[0]!.length * TILE) / 2;
const HALF_Z = (GRID.length * TILE) / 2;
const xOfCol = (col: number): number => col * TILE - HALF_X + TILE / 2;
const zOfRow = (row: number): number => row * TILE - HALF_Z + TILE / 2;

export const ASHFALL_VIVARIUM_ID = 'ashfall_vivarium';

export const ASHFALL_VIVARIUM: AreaDef = defineArea({
  id: ASHFALL_VIVARIUM_ID,
  name: 'The Vivarium',
  grid: GRID,
  legend: LEGEND,
  spawn: { x: -4, z: zOfRow(2) },
  safety: 'none',
  indoor: { camera: { distance: 20, pitch: 54, fov: 30 } },
  exits: [
    {
      to: 'ashfall_ward',
      x: (xOfCol(5) + xOfCol(6)) / 2,
      z: zOfRow(0),
      label: 'Out to the cross-street',
      arrive: { x: 22, z: 11.8 },
    },
  ],
  props: {
    sky: 'none',
    horizon: 'none',
    /** Pens down both sides, a trough in each, fodder stacked at the back. */
    dressing: [
      { kind: 'pens', x: xOfCol(2) + 1.2, z: zOfRow(2), yaw: Math.PI / 2 },
      { kind: 'pens', x: xOfCol(2) + 1.2, z: zOfRow(4), yaw: Math.PI / 2 },
      { kind: 'pens', x: xOfCol(2) + 1.2, z: zOfRow(6), yaw: Math.PI / 2 },
      { kind: 'pens', x: xOfCol(9) - 1.2, z: zOfRow(2), yaw: Math.PI / 2 },
      { kind: 'pens', x: xOfCol(9) - 1.2, z: zOfRow(4), yaw: Math.PI / 2 },
      { kind: 'pens', x: xOfCol(9) - 1.2, z: zOfRow(6), yaw: Math.PI / 2 },
      { kind: 'trough', x: xOfCol(1), z: zOfRow(3) },
      { kind: 'trough', x: xOfCol(12), z: zOfRow(3) },
      { kind: 'haybale', x: xOfCol(1), z: zOfRow(9) },
      { kind: 'haybale', x: xOfCol(1), z: zOfRow(10) },
      { kind: 'haybale', x: xOfCol(12), z: zOfRow(10) },
      { kind: 'brazier', x: xOfCol(12), z: zOfRow(8) },
    ],
    graffiti: [
      { text: 'FEED BEFORE YOU BIND', wallX: xOfCol(6), wallZ: zOfRow(11) - TILE / 2, dx: 0.6, facesSouth: false, tint: '#a89a7a' },
    ],
  },
});
