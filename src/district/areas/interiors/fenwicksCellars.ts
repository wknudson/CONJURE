/**
 * The cellars -- under the coach inn, and not opened since the spring.
 *
 * The `cellar_clearance` contract is fought down here, among the casks the brewer cannot get
 * at: the barking the whole Crossing can hear through the floor is what has been living in the
 * dark end since the river came up through the wall. What the brewer had put down to keep --
 * and what the dogs were keeping -- opens once the cellar is cleared. The stair goes up to the
 * hatch behind the bar.
 */

import { TILE, defineArea, type AreaDef, type TileDef } from '../../map.js';

const LEGEND: Record<string, TileDef> = {
  '#': {
    tex: 'cave',
    safe: false,
    walk: false,
    solid: { minHeight: 4.0, maxHeight: 4.0, inset: 0, depthInset: 0, chimneyChance: 0, split: false, wall: 'rock', bare: true },
  },
  k: { tex: 'cave', safe: false, walk: true },
  s: { tex: 'straw', safe: false, walk: true },
};

const GRID: readonly string[] = [
  '######ss######', //  0  the stair, up to the hatch
  '#ssssssssssss#', //  1  the casks
  '#ssssssssssss#', //  2
  '#ssssssssssss#', //  3
  '#kkkkkkkkkkkk#', //  4  where the floor goes to rock
  '#kkkkkkkkkkkk#', //  5  the fight
  '#kkkkkkkkkkkk#', //  6
  '#kkkkkkkkkkkk#', //  7
  '#kkkkkkkkkkkk#', //  8
  '#kkkkkkkkkkkk#', //  9
  '#kkkkkkkkkkkk#', // 10  the dark end; what was kept
  '#kkkkkkkkkkkk#', // 11
  '##############', // 12
];

const HALF_X = (GRID[0]!.length * TILE) / 2;
const HALF_Z = (GRID.length * TILE) / 2;
const xOfCol = (col: number): number => col * TILE - HALF_X + TILE / 2;
const zOfRow = (row: number): number => row * TILE - HALF_Z + TILE / 2;

export const FENWICKS_CELLARS_ID = 'fenwicks_cellars';

export const FENWICKS_CELLARS: AreaDef = defineArea({
  id: FENWICKS_CELLARS_ID,
  name: 'The Inn Cellars',
  grid: GRID,
  legend: LEGEND,
  spawn: { x: 0, z: zOfRow(3) },
  safety: 'none',
  indoor: { camera: { distance: 20, pitch: 54, fov: 30 } },
  exits: [
    {
      to: 'fenwicks_inn',
      x: 0,
      z: zOfRow(0),
      label: 'Up the stair to the bar',
      arrive: { x: 12, z: -17 },
    },
  ],
  props: {
    sky: 'none',
    horizon: 'none',
    dressing: [
      { kind: 'barrel', x: xOfCol(1), z: zOfRow(1) },
      { kind: 'barrel', x: xOfCol(2), z: zOfRow(1) },
      { kind: 'barrel', x: xOfCol(12), z: zOfRow(1) },
      { kind: 'barrel', x: xOfCol(12), z: zOfRow(2) },
      { kind: 'sacks', x: xOfCol(1), z: zOfRow(3) },
      { kind: 'bonepile', x: xOfCol(12), z: zOfRow(11) },
      { kind: 'brazier', x: xOfCol(1), z: zOfRow(11) },
    ],
    graffiti: [
      { text: 'KEEP THE HATCH DOWN', wallX: xOfCol(3), wallZ: zOfRow(0) + TILE / 2, dx: 0, facesSouth: true, tint: '#8a7a5a' },
      {
        text: 'THE BARKING STOPPED',
        wallX: 0,
        wallZ: zOfRow(12) - TILE / 2,
        dx: 0,
        facesSouth: false,
        tint: '#6a8a6a',
        gate: { after: ['cellar_clearance'] },
      },
    ],
  },
});
