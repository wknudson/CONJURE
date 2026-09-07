/**
 * The Undercroft -- what is under Highcourt's service end.
 *
 * Down the stair from the stair-head on the lane: a vaulted floor of cut stone with the
 * columns still holding, colder than anywhere above it, and three of the campaign's last
 * fights on it. The relocation train forms up by the gate at the north end; the census is
 * taken on the west stair once the dead letters are read; and the floor below is at the far
 * south-east, once the duel has been fought. A clerk who has counted this floor twice, the
 * manifest on a lectern, and a strongbox that opens only when the last of it is done. The
 * door is on the north wall, up to the lane.
 */

import { TILE, defineArea, type AreaDef, type TileDef } from '../../map.js';

const LEGEND: Record<string, TileDef> = {
  '#': {
    tex: 'flagstone',
    safe: false,
    walk: false,
    solid: { minHeight: 5.0, maxHeight: 5.0, inset: 0, depthInset: 0, chimneyChance: 0, split: false, wall: 'stone', bare: true },
  },
  f: { tex: 'flagstone', safe: false, walk: true },
  k: { tex: 'cave', safe: false, walk: true },
};

const GRID: readonly string[] = [
  '######ff######', //  0  the stair, up to the lane
  '#ffffffffffff#', //  1
  '#ffffffffffff#', //  2
  '#ffffffffffff#', //  3
  '#ffffffffffff#', //  4  the gate, where the train forms up
  '#ffffffffffff#', //  5
  '#ffffffffffff#', //  6
  '#ffffffffffff#', //  7
  '#ffffffffffff#', //  8
  '#ffffffffffff#', //  9  the west stair
  '#ffffffffkkkk#', // 10  where the stone gives out
  '#ffffffffkkkk#', // 11
  '#ffffffffkkkk#', // 12  the floor below
  '#ffffffffkkkk#', // 13
  '##############', // 14
];

const HALF_X = (GRID[0]!.length * TILE) / 2;
const HALF_Z = (GRID.length * TILE) / 2;
const xOfCol = (col: number): number => col * TILE - HALF_X + TILE / 2;
const zOfRow = (row: number): number => row * TILE - HALF_Z + TILE / 2;

export const HIGHCOURT_UNDERCROFT_ID = 'highcourt_undercroft';

export const HIGHCOURT_UNDERCROFT: AreaDef = defineArea({
  id: HIGHCOURT_UNDERCROFT_ID,
  name: 'The Undercroft',
  grid: GRID,
  legend: LEGEND,
  spawn: { x: 0, z: zOfRow(2) },
  safety: 'none',
  indoor: { camera: { distance: 20, pitch: 54, fov: 30 } },
  exits: [
    {
      to: 'highcourt',
      x: 0,
      z: zOfRow(0),
      label: 'Up the stair to the lane',
      arrive: { x: -28.8, z: 38 },
    },
  ],
  props: {
    sky: 'none',
    horizon: 'none',
    /** Columns, and what a convoy leaves behind when it forms up in the dark. */
    dressing: [
      { kind: 'bollard', x: xOfCol(4), z: zOfRow(3) },
      { kind: 'bollard', x: xOfCol(9), z: zOfRow(3) },
      { kind: 'bollard', x: xOfCol(4), z: zOfRow(7) },
      { kind: 'bollard', x: xOfCol(9), z: zOfRow(7) },
      { kind: 'bollard', x: xOfCol(4), z: zOfRow(11) },
      { kind: 'urn', x: xOfCol(12), z: zOfRow(1) },
      { kind: 'sacks', x: xOfCol(1), z: zOfRow(1) },
      { kind: 'brazier', x: xOfCol(12), z: zOfRow(6) },
      { kind: 'brazier', x: xOfCol(1), z: zOfRow(12) },
      { kind: 'spoilheap', x: xOfCol(9), z: zOfRow(12) },
    ],
    npcs: [
      { id: 'highcourt_undercroft_clerk', x: xOfCol(12), z: zOfRow(9), art: 'scribe', label: 'Talk to the census clerk' },
    ],
    graffiti: [
      { text: 'SIXTY BERTHS, ONE DIRECTION', wallX: 2, wallZ: zOfRow(14) - TILE / 2, dx: 0, facesSouth: false, tint: '#8c93a6' },
    ],
  },
});
