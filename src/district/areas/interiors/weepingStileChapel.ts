/**
 * The chapel -- Weeping Stile's, with the roof off it and the wood coming in.
 *
 * Four walls of stone, weeds through the flags, and on the east wall the sixty-one names cut
 * into the plaster in the same hand that wrote RELOCATED beside them on the roll. A candle
 * still burns on the altar, and nobody from the village is here to have lit it. What the clerk
 * was not shown is under the altar, and it opens once the cold hearths have been walked.
 */

import { TILE, defineArea, type AreaDef, type TileDef } from '../../map.js';

const LEGEND: Record<string, TileDef> = {
  '#': {
    tex: 'flagstone',
    safe: false,
    walk: false,
    solid: { minHeight: 3.8, maxHeight: 3.8, inset: 0, depthInset: 0, chimneyChance: 0, split: false, wall: 'stone', bare: true },
  },
  f: { tex: 'flagstone', safe: false, walk: true },
  '.': { tex: 'weeds', safe: false, walk: true },
};

const GRID: readonly string[] = [
  '############', //  0
  '#ffffffffff#', //  1  the altar
  '#ffffffffff#', //  2
  '#ff.ffff.ff#', //  3
  '#f..ffff..f#', //  4  the weeds, where the roof let the rain in
  '#f..ffff..f#', //  5
  '#ff.ffff.ff#', //  6
  '#ffffffffff#', //  7
  '#ffffffffff#', //  8  the names, east
  '#ffffffffff#', //  9
  '#####ff#####', // 10  the door, onto the hollow
];

const HALF_X = (GRID[0]!.length * TILE) / 2;
const HALF_Z = (GRID.length * TILE) / 2;
const xOfCol = (col: number): number => col * TILE - HALF_X + TILE / 2;
const zOfRow = (row: number): number => row * TILE - HALF_Z + TILE / 2;

export const WEEPING_STILE_CHAPEL_ID = 'weeping_stile_chapel';

export const WEEPING_STILE_CHAPEL: AreaDef = defineArea({
  id: WEEPING_STILE_CHAPEL_ID,
  name: 'The Stile Chapel',
  grid: GRID,
  legend: LEGEND,
  spawn: { x: 0, z: zOfRow(6) },
  safety: 'none',
  indoor: { camera: { distance: 19, pitch: 54, fov: 30 } },
  exits: [
    {
      to: 'weeping_stile',
      x: 0,
      z: zOfRow(10),
      label: 'Out into the hollow',
      arrive: { x: -20, z: -16.6 },
    },
  ],
  props: {
    sky: 'none',
    horizon: 'none',
    dressing: [
      { kind: 'brazier', x: xOfCol(5.5), z: zOfRow(1) },
      { kind: 'urn', x: xOfCol(1), z: zOfRow(5) },
      { kind: 'urn', x: xOfCol(10), z: zOfRow(5) },
      { kind: 'bramble', x: xOfCol(2), z: zOfRow(4.5) },
      { kind: 'mushrooms', x: xOfCol(9), z: zOfRow(4.5) },
      { kind: 'deadfall', x: xOfCol(1), z: zOfRow(8) },
    ],
    graffiti: [
      { text: 'SIXTY-ONE', wallX: 0, wallZ: zOfRow(0) + TILE / 2, dx: 0, facesSouth: true, tint: '#8c93a6' },
    ],
  },
});
