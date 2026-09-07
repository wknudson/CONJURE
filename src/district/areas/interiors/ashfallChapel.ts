/**
 * The Chapel of the Quiet Flame -- the one roof in Ashfall the Magistracy does not own.
 *
 * Stone, cold, and mostly empty: a flagged floor, a runner of red down the middle to the flame
 * at the far end, plaques on the walls for the ward's dead who could afford a plaque, and an
 * old man who keeps the flame and remembers who could not. The door is on the north wall,
 * onto the plaza; the graves are outside, west of the door.
 */

import { TILE, defineArea, type AreaDef, type TileDef } from '../../map.js';

const LEGEND: Record<string, TileDef> = {
  '#': {
    tex: 'flagstone',
    safe: false,
    walk: false,
    solid: { minHeight: 6.4, maxHeight: 6.4, inset: 0, depthInset: 0, chimneyChance: 0, split: false, wall: 'stone', bare: true },
  },
  f: { tex: 'flagstone', safe: false, walk: true },
  r: { tex: 'rug', safe: false, walk: true },
  h: { tex: 'hearth', safe: false, walk: true },
};

const GRID: readonly string[] = [
  '#####ff#####', //  0  the door, from the plaza
  '#ffffrrffff#', //  1
  '#ffffrrffff#', //  2
  '#ffffrrffff#', //  3
  '#ffffrrffff#', //  4  the nave
  '#ffffrrffff#', //  5
  '#ffffrrffff#', //  6
  '#ffffrrffff#', //  7
  '#ffffrrffff#', //  8
  '#ffffrrffff#', //  9
  '#fffhhhhfff#', // 10  the flame
  '#fffhhhhfff#', // 11
  '############', // 12
];

const HALF_X = (GRID[0]!.length * TILE) / 2;
const HALF_Z = (GRID.length * TILE) / 2;
const xOfCol = (col: number): number => col * TILE - HALF_X + TILE / 2;
const zOfRow = (row: number): number => row * TILE - HALF_Z + TILE / 2;

export const ASHFALL_CHAPEL_ID = 'ashfall_chapel';

export const ASHFALL_CHAPEL: AreaDef = defineArea({
  id: ASHFALL_CHAPEL_ID,
  name: 'The Chapel of the Quiet Flame',
  grid: GRID,
  legend: LEGEND,
  spawn: { x: 0, z: zOfRow(3) },
  safety: 'none',
  indoor: { camera: { distance: 19, pitch: 56, fov: 30 } },
  exits: [
    {
      to: 'ashfall_ward',
      x: 0,
      z: zOfRow(0),
      label: 'Out onto the plaza',
      arrive: { x: -26, z: 31.8 },
    },
  ],
  props: {
    sky: 'none',
    horizon: 'none',
    /** The flame itself is a brazier at the far end; the benches are tables turned side-on. */
    dressing: [
      { kind: 'brazier', x: 0, z: zOfRow(11) - 1 },
      { kind: 'table', x: xOfCol(2), z: zOfRow(4), yaw: 0 },
      { kind: 'table', x: xOfCol(2), z: zOfRow(7), yaw: 0 },
      { kind: 'table', x: xOfCol(9), z: zOfRow(4), yaw: 0 },
      { kind: 'table', x: xOfCol(9), z: zOfRow(7), yaw: 0 },
      { kind: 'urn', x: xOfCol(1), z: zOfRow(10) },
    ],
    npcs: [
      { id: 'ashfall_priest', x: xOfCol(8), z: zOfRow(9), art: 'elder', label: 'Speak to the keeper of the Flame' },
    ],
    graffiti: [
      { text: 'WHAT BURNS QUIETLY BURNS LONGEST', wallX: 0, wallZ: zOfRow(12) - TILE / 2, dx: 0, facesSouth: false, tint: '#a89a7a' },
    ],
  },
});
