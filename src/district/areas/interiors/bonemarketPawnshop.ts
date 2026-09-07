/**
 * The pawnshop -- where what did not sell on the floor ends up, on a ticket.
 *
 * One storey of plaster off the south lane, shelves of pledges nobody came back for, a desk
 * with the terms nailed over it, and a broker who was somebody once and keeps the manner. The
 * unredeemed shelf is a cache, and it opens after the wasps: the broker will not sell to a
 * Whisperer the market has not yet watched clear its own vermin. The door is on the north
 * wall, onto the lane.
 */

import { TILE, defineArea, type AreaDef, type TileDef } from '../../map.js';

const LEGEND: Record<string, TileDef> = {
  '#': {
    tex: 'planks',
    safe: false,
    walk: false,
    solid: { minHeight: 4.6, maxHeight: 4.6, inset: 0, depthInset: 0, chimneyChance: 0, split: false, wall: 'plaster', bare: true },
  },
  p: { tex: 'planks', safe: false, walk: true },
  r: { tex: 'rug', safe: false, walk: true },
};

const GRID: readonly string[] = [
  '####pp####', //  0  the door, from the lane
  '#pppppppp#', //  1
  '#pppppppp#', //  2
  '#pppppppp#', //  3
  '#pppppppp#', //  4
  '#pprrrrpp#', //  5  the broker's rug
  '#pprrrrpp#', //  6
  '#pppppppp#', //  7
  '#pppppppp#', //  8
  '#pppppppp#', //  9  the shelves
  '##########', // 10
];

const HALF_Z = (GRID.length * TILE) / 2;
const zOfRow = (row: number): number => row * TILE - HALF_Z + TILE / 2;

export const BONEMARKET_PAWNSHOP_ID = 'bonemarket_pawnshop';

export const BONEMARKET_PAWNSHOP: AreaDef = defineArea({
  id: BONEMARKET_PAWNSHOP_ID,
  name: 'The Pawnshop',
  grid: GRID,
  legend: LEGEND,
  spawn: { x: 0, z: zOfRow(2) },
  safety: 'none',
  indoor: { camera: { distance: 17, pitch: 54, fov: 30 } },
  exits: [
    {
      to: 'bonemarket',
      x: 0,
      z: zOfRow(0),
      label: 'Out onto the lane',
      arrive: { x: 44, z: 11.8 },
    },
  ],
  props: {
    sky: 'none',
    horizon: 'none',
    dressing: [
      { kind: 'desk', x: -4, z: 4 },
      { kind: 'shelves', x: -14, z: 4, yaw: Math.PI / 2 },
      { kind: 'shelves', x: -14, z: 12, yaw: Math.PI / 2 },
      { kind: 'shelves', x: 14, z: -4, yaw: -Math.PI / 2 },
      { kind: 'brazier', x: 14, z: 4 },
      { kind: 'urn', x: -14, z: -12 },
    ],
    npcs: [
      { id: 'bonemarket_pawnbroker', x: -4, z: 8, art: 'noblewoman', label: 'Talk to the pawnbroker' },
    ],
    graffiti: [
      { text: 'NOT REDEEMED', wallX: 4, wallZ: zOfRow(10) - TILE / 2, dx: 0, facesSouth: false, tint: '#8a7a6a' },
    ],
  },
});
