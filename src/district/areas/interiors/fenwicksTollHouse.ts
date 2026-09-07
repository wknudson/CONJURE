/**
 * The toll house -- on the bridgehead, where Fenwick took the toll.
 *
 * He took the bridge with it, the bard says, and left the upkeep. The Magistracy took the toll
 * off Fenwick and kept the house, the keeper and the book, and the book still opens at the
 * page it did the day it changed hands. A counter, a strongbox that answers to the book, and
 * the keeper who has never once been asked what is in either.
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
  p: { tex: 'planks', safe: false, walk: true },
};

const GRID: readonly string[] = [
  '############', //  0
  '#pppppppppp#', //  1  behind the counter; the strongbox
  '#pppppppppp#', //  2
  '#ffffffffff#', //  3  the counter
  '#ffffffffff#', //  4  the keeper
  '#ffffffffff#', //  5
  '#ffffffffff#', //  6
  '#ffffffffff#', //  7  the book
  '#ffffffffff#', //  8
  '#ffffffffff#', //  9
  '#####ff#####', // 10  the door, onto the bridgehead
];

const HALF_X = (GRID[0]!.length * TILE) / 2;
const HALF_Z = (GRID.length * TILE) / 2;
const xOfCol = (col: number): number => col * TILE - HALF_X + TILE / 2;
const zOfRow = (row: number): number => row * TILE - HALF_Z + TILE / 2;

export const FENWICKS_TOLL_HOUSE_ID = 'fenwicks_toll_house';

export const FENWICKS_TOLL_HOUSE: AreaDef = defineArea({
  id: FENWICKS_TOLL_HOUSE_ID,
  name: "Fenwick's Toll House",
  grid: GRID,
  legend: LEGEND,
  spawn: { x: 0, z: zOfRow(6) },
  safety: 'none',
  indoor: { camera: { distance: 19, pitch: 54, fov: 30 } },
  exits: [
    {
      to: 'fenwicks_crossing',
      x: 0,
      z: zOfRow(10),
      label: 'Out onto the bridgehead',
      arrive: { x: 24, z: -20.6 },
    },
  ],
  props: {
    sky: 'none',
    horizon: 'none',
    dressing: [
      { kind: 'counter', x: xOfCol(5.5), z: zOfRow(3) },
      { kind: 'shelves', x: xOfCol(3), z: zOfRow(0) + TILE / 2 + 0.9, yaw: 0 },
      { kind: 'desk', x: xOfCol(9), z: zOfRow(1) },
      { kind: 'brazier', x: xOfCol(1), z: zOfRow(8) },
      { kind: 'barrel', x: xOfCol(10), z: zOfRow(8) },
    ],
    npcs: [
      { id: 'fenwick_tollkeeper', x: xOfCol(8), z: zOfRow(5), art: 'tax_collector', label: 'Talk to the toll-keeper' },
    ],
    graffiti: [
      { text: 'A DUCAT A WHEEL', wallX: xOfCol(7), wallZ: zOfRow(0) + TILE / 2, dx: 0, facesSouth: true, tint: '#8c93a6' },
    ],
  },
});
