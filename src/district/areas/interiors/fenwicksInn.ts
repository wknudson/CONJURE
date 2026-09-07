/**
 * The coach inn -- Fenwick's Crossing's, and the Ring's.
 *
 * Every rumour on Azo drinks here on its way somewhere else, the innkeeper says, and the
 * board by the hearth is where they are pinned when they have finished drinking. The good room
 * is upstairs and dearer than anywhere but Highcourt, because there is nowhere else to sleep
 * between Millharrow and the Shelf. The hatch behind the bar goes down to the cellars, which
 * the brewer has not opened since the spring. You can hear why.
 */

import { TILE, defineArea, type AreaDef, type TileDef } from '../../map.js';

const LEGEND: Record<string, TileDef> = {
  '#': {
    tex: 'planks',
    safe: false,
    walk: false,
    solid: { minHeight: 5.4, maxHeight: 5.4, inset: 0, depthInset: 0, chimneyChance: 0, split: false, wall: 'timber', bare: true },
  },
  p: { tex: 'planks', safe: false, walk: true },
  r: { tex: 'rug', safe: false, walk: true },
  h: { tex: 'hearth', safe: false, walk: true },
};

const GRID: readonly string[] = [
  '##############', //  0  the hatch, behind the bar
  '#pppppppppppp#', //  1  behind the bar; the strongroom, west; the stair, east
  '#pppppppppppp#', //  2
  '#pppppppppppp#', //  3  the bar
  '#pprrrrrrrrpp#', //  4
  '#pprrrrrrrrpp#', //  5  the tables
  '#pprrrrrrrrpp#', //  6
  '#pprrrrrrrrpp#', //  7
  '#pprrrrrrrrhh#', //  8  the hearth, and the board
  '#pprrrrrrrrhh#', //  9
  '#pppppppppppp#', // 10
  '#pppppppppppp#', // 11
  '######pp######', // 12  the door, onto the street
];

const HALF_X = (GRID[0]!.length * TILE) / 2;
const HALF_Z = (GRID.length * TILE) / 2;
const xOfCol = (col: number): number => col * TILE - HALF_X + TILE / 2;
const zOfRow = (row: number): number => row * TILE - HALF_Z + TILE / 2;

export const FENWICKS_INN_ID = 'fenwicks_inn';

export const FENWICKS_INN: AreaDef = defineArea({
  id: FENWICKS_INN_ID,
  name: 'The Coach Inn',
  grid: GRID,
  legend: LEGEND,
  spawn: { x: 0, z: zOfRow(6) },
  safety: 'none',
  indoor: { camera: { distance: 20, pitch: 54, fov: 30 } },
  exits: [
    {
      to: 'fenwicks_crossing',
      x: 0,
      z: zOfRow(12),
      label: 'Out onto the street',
      arrive: { x: -44, z: -15 },
    },
    {
      // The hatch behind the bar, and the cellars under it.
      to: 'fenwicks_cellars',
      x: xOfCol(10),
      z: zOfRow(0) + TILE / 2 + 1.4,
      label: 'Down the hatch to the cellars',
      door: { x: xOfCol(10), z: zOfRow(0) + TILE / 2 + 0.05, facesSouth: true, style: 'hatch' },
      arrive: { x: 0, z: -16 },
    },
  ],
  props: {
    sky: 'none',
    horizon: 'none',
    dressing: [
      { kind: 'counter', x: xOfCol(6.5), z: zOfRow(3) },
      { kind: 'shelves', x: xOfCol(5), z: zOfRow(0) + TILE / 2 + 0.9, yaw: 0 },
      { kind: 'table', x: xOfCol(3), z: zOfRow(5) },
      { kind: 'table', x: xOfCol(9), z: zOfRow(5) },
      { kind: 'table', x: xOfCol(3), z: zOfRow(9) },
      { kind: 'brazier', x: xOfCol(11.5), z: zOfRow(8.5) },
      { kind: 'barrel', x: xOfCol(1), z: zOfRow(2) },
      { kind: 'barrel', x: xOfCol(1), z: zOfRow(11) },
      { kind: 'sacks', x: xOfCol(12), z: zOfRow(11) },
    ],
    npcs: [
      { id: 'fenwick_potboy', x: xOfCol(9), z: zOfRow(10), art: 'street_urchin', label: 'Talk to the pot-boy' },
    ],
    graffiti: [
      { text: 'EVERY RUMOUR ON AZO', wallX: xOfCol(4), wallZ: zOfRow(12) - TILE / 2, dx: -3.2, facesSouth: false, tint: '#9a8a6a' },
    ],
  },
});
