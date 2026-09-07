/**
 * The Tithe Office -- where Lamprow's light is billed.
 *
 * On the High Street, in dressed stone like every Magistracy counter, and sealed until the
 * tithe has been collected: the office does not open its books to a Whisperer it has not yet
 * paid. Inside, the same room as Ashfall's Counting House with the numbers changed -- desks,
 * a ledger of arrears on a lectern, a bailiff who does the collecting the clerk outside only
 * talks about, and a strongbox of what was collected twice.
 */

import { TILE, defineArea, type AreaDef, type TileDef } from '../../map.js';

const LEGEND: Record<string, TileDef> = {
  '#': {
    tex: 'flagstone',
    safe: false,
    walk: false,
    solid: { minHeight: 5.2, maxHeight: 5.2, inset: 0, depthInset: 0, chimneyChance: 0, split: false, wall: 'stone', bare: true },
  },
  f: { tex: 'flagstone', safe: false, walk: true },
  r: { tex: 'rug', safe: false, walk: true },
};

const GRID: readonly string[] = [
  '############', //  0
  '#ffffffffff#', //  1  the strongbox end
  '#ffffffffff#', //  2
  '#ffffffffff#', //  3
  '#fffrrrrfff#', //  4  the desks
  '#fffrrrrfff#', //  5
  '#fffrrrrfff#', //  6
  '#ffffffffff#', //  7
  '#ffffffffff#', //  8
  '#ffffffffff#', //  9
  '#####ff#####', // 10  the door, onto the High Street
];

const HALF_Z = (GRID.length * TILE) / 2;
const zOfRow = (row: number): number => row * TILE - HALF_Z + TILE / 2;

export const LAMPROW_TITHE_OFFICE_ID = 'lamprow_tithe_office';

export const LAMPROW_TITHE_OFFICE: AreaDef = defineArea({
  id: LAMPROW_TITHE_OFFICE_ID,
  name: 'The Tithe Office',
  grid: GRID,
  legend: LEGEND,
  spawn: { x: 0, z: zOfRow(8) },
  safety: 'none',
  indoor: { camera: { distance: 18, pitch: 54, fov: 30 } },
  exits: [
    {
      to: 'lamprow',
      x: 0,
      z: zOfRow(10),
      label: 'Out onto the High Street',
      arrive: { x: -0.4, z: -5 },
    },
  ],
  props: {
    sky: 'none',
    horizon: 'none',
    dressing: [
      { kind: 'desk', x: -10, z: -2 },
      { kind: 'desk', x: 10, z: -2 },
      { kind: 'shelves', x: -18, z: -14, yaw: Math.PI / 2 },
      { kind: 'shelves', x: 18, z: -14, yaw: Math.PI / 2 },
      { kind: 'brazier', x: 18, z: 10 },
    ],
    npcs: [
      { id: 'lamprow_bailiff', x: 0, z: 6, art: 'town_guard_b', label: 'Talk to the bailiff' },
    ],
    graffiti: [
      { text: 'LIGHT, BY THE HEARTH, IN ARREARS', wallX: 2, wallZ: zOfRow(0) + TILE / 2, dx: 0, facesSouth: true, tint: '#8a8070' },
    ],
  },
});
