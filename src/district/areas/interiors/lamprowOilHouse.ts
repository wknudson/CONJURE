/**
 * The Lamp-oil House -- where Lamprow's light is kept, in casks.
 *
 * Every lamp on the High Street burns oil that came through this door, and the ward pays for
 * it by the measure. One room: casks along the east wall, the tariff on the north one, a
 * keeper who has measured every drop and knows to the Ducat what the dark costs, and a lamp
 * of its own that never goes out, because a man who sells light cannot be seen sitting in
 * the dark. The door is on the south wall, onto the lane behind the quay.
 */

import { TILE, defineArea, type AreaDef, type TileDef } from '../../map.js';

const LEGEND: Record<string, TileDef> = {
  '#': {
    tex: 'planks',
    safe: false,
    walk: false,
    solid: { minHeight: 4.8, maxHeight: 4.8, inset: 0, depthInset: 0, chimneyChance: 0, split: false, wall: 'timber', bare: true },
  },
  p: { tex: 'planks', safe: false, walk: true },
  i: { tex: 'ironplate', safe: false, walk: true },
};

const GRID: readonly string[] = [
  '##########', //  0
  '#ppppppii#', //  1  the casks stand on iron, for the drips
  '#ppppppii#', //  2
  '#ppppppii#', //  3
  '#pppppppp#', //  4
  '#pppppppp#', //  5
  '#pppppppp#', //  6
  '#pppppppp#', //  7
  '#pppppppp#', //  8
  '#pppppppp#', //  9
  '####pp####', // 10  the door, onto the lane
];

const HALF_Z = (GRID.length * TILE) / 2;
const zOfRow = (row: number): number => row * TILE - HALF_Z + TILE / 2;

export const LAMPROW_OIL_HOUSE_ID = 'lamprow_oil_house';

export const LAMPROW_OIL_HOUSE: AreaDef = defineArea({
  id: LAMPROW_OIL_HOUSE_ID,
  name: 'The Lamp-oil House',
  grid: GRID,
  legend: LEGEND,
  spawn: { x: 0, z: zOfRow(8) },
  safety: 'none',
  indoor: { camera: { distance: 17, pitch: 54, fov: 30 } },
  exits: [
    {
      to: 'lamprow',
      x: 0,
      z: zOfRow(10),
      label: 'Out onto the lane',
      // Beside the door: the lane is one tile deep, with the yard behind you.
      arrive: { x: -4.4, z: -26 },
    },
  ],
  props: {
    sky: 'none',
    horizon: 'none',
    dressing: [
      { kind: 'shelves', x: -14, z: -8, yaw: Math.PI / 2 },
      { kind: 'shelves', x: -14, z: 0, yaw: Math.PI / 2 },
      { kind: 'barrel', x: 12, z: -12 },
      { kind: 'barrel', x: 12, z: -8 },
      { kind: 'barrel', x: 12, z: -4 },
      { kind: 'rack', x: 6, z: -14 },
    ],
    /** One lamp of his own. Indoors, so it burns at the anchor whatever the clock says. */
    lamps: [{ x: -6, z: 8 }],
    npcs: [
      { id: 'lamprow_oil_keeper', x: -4, z: -6, art: 'weaver', label: 'Talk to the oil keeper' },
    ],
    graffiti: [
      { text: 'BY THE MEASURE', wallX: -6, wallZ: zOfRow(0) + TILE / 2, dx: 0, facesSouth: true, tint: '#8a7a5a' },
    ],
  },
});
