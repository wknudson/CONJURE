/**
 * The Customs House -- the building the writ came out of.
 *
 * Dressed stone on a salt quay, the only Magistracy building in the Ring west of Millharrow,
 * and chained by its own writ: when the harbour was closed the customs men closed themselves
 * in with the bond money and then left by the back, and the chain has been on the front since.
 * The riot at the chain is what gets it off. Inside: the bond ledger, the bond, and the copy
 * of the writ that nobody on the quay has ever been allowed to read.
 */

import { TILE, defineArea, type AreaDef, type TileDef } from '../../map.js';

const LEGEND: Record<string, TileDef> = {
  '#': {
    tex: 'flagstone',
    safe: false,
    walk: false,
    solid: { minHeight: 5.6, maxHeight: 5.6, inset: 0, depthInset: 0, chimneyChance: 0, split: false, wall: 'stone', bare: true },
  },
  f: { tex: 'flagstone', safe: false, walk: true },
  r: { tex: 'rug', safe: false, walk: true },
};

const GRID: readonly string[] = [
  '############', //  0
  '#ffffffffff#', //  1  the counter, and the bond behind it
  '#ffffffffff#', //  2
  '#ffffffffff#', //  3
  '#ffffrrffff#', //  4
  '#ffffrrffff#', //  5
  '#ffffrrffff#', //  6
  '#ffffrrffff#', //  7
  '#ffffffffff#', //  8  the writ, on its stand
  '#ffffffffff#', //  9
  '#####ff#####', // 10  the door, onto the flats
];

const HALF_X = (GRID[0]!.length * TILE) / 2;
const HALF_Z = (GRID.length * TILE) / 2;
const xOfCol = (col: number): number => col * TILE - HALF_X + TILE / 2;
const zOfRow = (row: number): number => row * TILE - HALF_Z + TILE / 2;

export const SALTGLASS_CUSTOMS_HOUSE_ID = 'saltglass_customs_house';

export const SALTGLASS_CUSTOMS_HOUSE: AreaDef = defineArea({
  id: SALTGLASS_CUSTOMS_HOUSE_ID,
  name: 'The Customs House',
  grid: GRID,
  legend: LEGEND,
  spawn: { x: 0, z: zOfRow(6) },
  safety: 'none',
  indoor: { camera: { distance: 19, pitch: 54, fov: 30 } },
  exits: [
    {
      to: 'saltglass',
      x: 0,
      z: zOfRow(10),
      label: 'Out onto the quay',
      arrive: { x: 34, z: -24.6 },
    },
  ],
  props: {
    sky: 'none',
    horizon: 'none',
    dressing: [
      { kind: 'counter', x: xOfCol(4.5), z: zOfRow(2) },
      { kind: 'desk', x: xOfCol(9), z: zOfRow(3) },
      { kind: 'shelves', x: xOfCol(7), z: zOfRow(0) + TILE / 2 + 0.9, yaw: 0 },
      { kind: 'urn', x: xOfCol(1), z: zOfRow(6) },
      { kind: 'table', x: xOfCol(9), z: zOfRow(7) },
    ],
    graffiti: [
      { text: 'BOND HELD. HARBOUR HELD.', wallX: xOfCol(3), wallZ: zOfRow(0) + TILE / 2, dx: 0, facesSouth: true, tint: '#8c93a6' },
    ],
  },
});
