/**
 * The Spire's lobby -- under the footing, and the last floor before the throne room.
 *
 * Marble laid to a line, a runner of red down the middle, braziers either side of it, and at
 * the far end the doors the Summons opens: the `the_summons` contract starts at them, which
 * used to be a label on the flagstones outside. An usher who has never been past the doors,
 * the census of Azo on a plaque, and a strongbox of what the census is worth, which opens
 * once the Summons has been answered. The door is on the south wall, onto the processional.
 */

import { TILE, defineArea, type AreaDef, type TileDef } from '../../map.js';

const LEGEND: Record<string, TileDef> = {
  '#': {
    tex: 'flagstone',
    safe: false,
    walk: false,
    solid: { minHeight: 8.0, maxHeight: 8.0, inset: 0, depthInset: 0, chimneyChance: 0, split: false, wall: 'stone', bare: true },
  },
  f: { tex: 'flagstone', safe: false, walk: true },
  r: { tex: 'rug', safe: false, walk: true },
};

const GRID: readonly string[] = [
  '##################', //  0
  '#ffffffffffffffff#', //  1  the doors
  '#fffffffrrfffffff#', //  2
  '#fffffffrrfffffff#', //  3
  '#fffffffrrfffffff#', //  4
  '#fffffffrrfffffff#', //  5
  '#fffffffrrfffffff#', //  6
  '#fffffffrrfffffff#', //  7
  '#fffffffrrfffffff#', //  8
  '#fffffffrrfffffff#', //  9
  '#fffffffrrfffffff#', // 10
  '#fffffffrrfffffff#', // 11
  '########rr########', // 12  the door, onto the processional
];

const HALF_X = (GRID[0]!.length * TILE) / 2;
const HALF_Z = (GRID.length * TILE) / 2;
const xOfCol = (col: number): number => col * TILE - HALF_X + TILE / 2;
const zOfRow = (row: number): number => row * TILE - HALF_Z + TILE / 2;

export const HIGHCOURT_SPIRE_LOBBY_ID = 'highcourt_spire_lobby';

export const HIGHCOURT_SPIRE_LOBBY: AreaDef = defineArea({
  id: HIGHCOURT_SPIRE_LOBBY_ID,
  name: 'The Spire Lobby',
  grid: GRID,
  legend: LEGEND,
  spawn: { x: 0, z: zOfRow(9) },
  safety: 'none',
  indoor: { camera: { distance: 21, pitch: 54, fov: 30 } },
  exits: [
    {
      to: 'highcourt',
      x: 0,
      z: zOfRow(12),
      label: 'Out onto the processional',
      arrive: { x: 3.2, z: -34 },
    },
  ],
  props: {
    sky: 'none',
    horizon: 'none',
    /** Braziers and posts down the runner, and two tables the ushers sit at. */
    dressing: [
      { kind: 'brazier', x: xOfCol(4), z: zOfRow(2) },
      { kind: 'brazier', x: xOfCol(13), z: zOfRow(2) },
      { kind: 'brazier', x: xOfCol(4), z: zOfRow(8) },
      { kind: 'brazier', x: xOfCol(13), z: zOfRow(8) },
      { kind: 'bollard', x: xOfCol(6), z: zOfRow(4) },
      { kind: 'bollard', x: xOfCol(11), z: zOfRow(4) },
      { kind: 'bollard', x: xOfCol(6), z: zOfRow(10) },
      { kind: 'bollard', x: xOfCol(11), z: zOfRow(10) },
      { kind: 'table', x: xOfCol(2), z: zOfRow(6) },
      { kind: 'table', x: xOfCol(15), z: zOfRow(6) },
    ],
    npcs: [
      { id: 'highcourt_usher', x: xOfCol(3), z: zOfRow(7) + 2, art: 'town_guard', label: 'Talk to the usher' },
    ],
    graffiti: [
      { text: 'THE DOORS STAND OPEN', wallX: xOfCol(3), wallZ: zOfRow(0) + TILE / 2, dx: 0, facesSouth: true, tint: '#8c93a6' },
    ],
  },
});
