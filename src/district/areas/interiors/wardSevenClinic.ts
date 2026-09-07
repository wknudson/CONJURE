/**
 * The back-alley clinic -- the one the `clinic_quota` contract names.
 *
 * Off the terrace lane in Ward Seven, limewashed, one storey: the healer who used to stand
 * on the bank is behind her table here, with a cot behind a curtain that is the cheapest bed
 * in Jolrek and the quota ledger the Magistracy makes her keep on a lectern by the door. The
 * dispensary opens once the quota has been answered for. The door is on the south wall,
 * onto the lane.
 */

import { TILE, defineArea, type AreaDef, type TileDef } from '../../map.js';

const LEGEND: Record<string, TileDef> = {
  '#': {
    tex: 'planks',
    safe: false,
    walk: false,
    solid: { minHeight: 4.4, maxHeight: 4.4, inset: 0, depthInset: 0, chimneyChance: 0, split: false, wall: 'plaster', bare: true },
  },
  p: { tex: 'planks', safe: false, walk: true },
  r: { tex: 'rug', safe: false, walk: true },
};

const GRID: readonly string[] = [
  '##########', //  0
  '#pppppppp#', //  1  the healer's end
  '#pppppppp#', //  2
  '#pppppppp#', //  3
  '#pprrpppp#', //  4  the cot's corner
  '#pprrpppp#', //  5
  '#pppppppp#', //  6
  '#pppppppp#', //  7
  '#pppppppp#', //  8
  '#pppppppp#', //  9
  '####pp####', // 10  the door, onto the lane
];

const HALF_Z = (GRID.length * TILE) / 2;
const zOfRow = (row: number): number => row * TILE - HALF_Z + TILE / 2;

export const WARD_SEVEN_CLINIC_ID = 'ward_seven_clinic';

export const WARD_SEVEN_CLINIC: AreaDef = defineArea({
  id: WARD_SEVEN_CLINIC_ID,
  name: 'The Back-Alley Clinic',
  grid: GRID,
  legend: LEGEND,
  spawn: { x: 0, z: zOfRow(8) },
  safety: 'none',
  indoor: { camera: { distance: 17, pitch: 54, fov: 30 } },
  exits: [
    {
      to: 'ward_seven',
      x: 0,
      z: zOfRow(10),
      label: 'Out onto the lane',
      arrive: { x: 29.2, z: 14 },
    },
  ],
  props: {
    sky: 'none',
    horizon: 'none',
    dressing: [
      { kind: 'table', x: -6, z: -12 },
      { kind: 'shelves', x: 14, z: -12, yaw: -Math.PI / 2 },
      { kind: 'shelves', x: 14, z: -4, yaw: -Math.PI / 2 },
      { kind: 'rack', x: -14, z: -4 },
      { kind: 'brazier', x: 14, z: 4 },
    ],
    npcs: [
      { id: 'ward_seven_healer', x: -6, z: -8, art: 'healer', label: 'Talk to the ward healer' },
    ],
    graffiti: [
      { text: 'SEVEN A WEEK', wallX: -6, wallZ: zOfRow(0) + TILE / 2, dx: 0, facesSouth: true, tint: '#7a8a5a' },
    ],
  },
});
