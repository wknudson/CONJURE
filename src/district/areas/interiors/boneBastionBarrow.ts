/**
 * The great barrow -- in the Bastion's north wall, the mound the rows were laid out from.
 *
 * Bone underfoot and bone in the walls, the way the whole Bastion is, and the difference is
 * that in here it is arranged. The first sarcophagus is at the door and nobody has ever
 * opened it, because nothing is buried shallow and everybody knows what that means. The
 * hollows have the middle. The antechamber at the back is the sovereign's, and what is in it
 * waits for the sovereign to be answered for.
 */

import { TILE, defineArea, type AreaDef, type TileDef } from '../../map.js';

const LEGEND: Record<string, TileDef> = {
  '#': {
    tex: 'bone',
    safe: false,
    walk: false,
    solid: { minHeight: 5.5, maxHeight: 5.5, inset: 0, depthInset: 0, chimneyChance: 0, split: false, wall: 'rock', bare: true },
  },
  o: { tex: 'bone', safe: false, walk: true },
  t: { tex: 'barrow', safe: false, walk: true },
};

const GRID: readonly string[] = [
  '############', //  0
  '#oooooooooo#', //  1  the antechamber
  '#oooooooooo#', //  2
  '#tooooooooт#'.replace('т', 't'), //  3  the hollows
  '#ttoooooott#', //  4
  '#ttoooooott#', //  5
  '#tttttttttt#', //  6
  '#tttttttttt#', //  7
  '#tttttttttt#', //  8  the bones, west; the count, east
  '#tttttttttt#', //  9
  '#tttttttttt#', // 10
  '#tttttttttt#', // 11  the first sarcophagus
  '#####tt#####', // 12  the mouth
];

const HALF_X = (GRID[0]!.length * TILE) / 2;
const HALF_Z = (GRID.length * TILE) / 2;
const xOfCol = (col: number): number => col * TILE - HALF_X + TILE / 2;
const zOfRow = (row: number): number => row * TILE - HALF_Z + TILE / 2;

export const BONE_BASTION_BARROW_ID = 'bone_bastion_barrow';

export const BONE_BASTION_BARROW: AreaDef = defineArea({
  id: BONE_BASTION_BARROW_ID,
  name: 'The Great Barrow',
  grid: GRID,
  legend: LEGEND,
  spawn: { x: 0, z: zOfRow(9) },
  safety: 'none',
  indoor: { camera: { distance: 20, pitch: 54, fov: 30 } },
  exits: [
    {
      to: 'bone_bastion',
      x: 0,
      z: zOfRow(12),
      label: 'Out among the mounds',
      arrive: { x: 16, z: -43 },
    },
  ],
  props: {
    sky: 'none',
    horizon: 'none',
    dressing: [
      { kind: 'urn', x: xOfCol(1), z: zOfRow(6) },
      { kind: 'urn', x: xOfCol(10), z: zOfRow(6) },
      { kind: 'urn', x: xOfCol(5.5), z: zOfRow(1) },
      { kind: 'cairn', x: xOfCol(1), z: zOfRow(10) },
      { kind: 'brazier', x: xOfCol(10), z: zOfRow(10) },
    ],
    /** The hollows have the middle. Short roam, and they do not come to the door. */
    packs: [{ encounterId: 'pack_spoil_heap_hollows', x: 0, z: zOfRow(4), roam: 5 }],
    graffiti: [
      { text: 'NOTHING IS BURIED SHALLOW', wallX: xOfCol(4), wallZ: zOfRow(0) + TILE / 2, dx: 0, facesSouth: true, tint: '#b7ae9d' },
    ],
  },
});
