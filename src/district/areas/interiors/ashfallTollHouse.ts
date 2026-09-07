/**
 * The Toll House -- the Magistracy's counter on the wharf.
 *
 * Every barge that ties up at Ashfall's quay pays here before it unloads, and every bargee
 * who argues pays twice. One room: a desk for the clerk, shelves of tariff books, a strongbox
 * that is not for you until you have read what it is for, and a bargee waiting to be told
 * what he owes. The door is on the south wall, onto the quay road.
 */

import { TILE, defineArea, type AreaDef, type TileDef } from '../../map.js';

const LEGEND: Record<string, TileDef> = {
  '#': {
    tex: 'planks',
    safe: false,
    walk: false,
    solid: { minHeight: 4.8, maxHeight: 4.8, inset: 0, depthInset: 0, chimneyChance: 0, split: false, wall: 'plaster', bare: true },
  },
  p: { tex: 'planks', safe: false, walk: true },
  f: { tex: 'flagstone', safe: false, walk: true },
};

const GRID: readonly string[] = [
  '##########', //  0
  '#pppppppp#', //  1  the clerk's end
  '#pppppppp#', //  2
  '#pppppppp#', //  3
  '#pppppppp#', //  4
  '#pppppppp#', //  5
  '#pppppppp#', //  6
  '#pppppppp#', //  7
  '#ppppffpp#', //  8
  '#ppppffpp#', //  9  the threshold
  '####ff####', // 10  the door, onto the quay road
];

const HALF_X = (GRID[0]!.length * TILE) / 2;
const HALF_Z = (GRID.length * TILE) / 2;
const zOfRow = (row: number): number => row * TILE - HALF_Z + TILE / 2;

export const ASHFALL_TOLL_HOUSE_ID = 'ashfall_toll_house';

export const ASHFALL_TOLL_HOUSE: AreaDef = defineArea({
  id: ASHFALL_TOLL_HOUSE_ID,
  name: 'The Toll House',
  grid: GRID,
  legend: LEGEND,
  spawn: { x: 0, z: zOfRow(8) },
  safety: 'none',
  indoor: { camera: { distance: 17, pitch: 54, fov: 30 } },
  exits: [
    {
      to: 'ashfall_ward',
      x: 0,
      z: zOfRow(10),
      label: 'Out onto the quay',
      // Beside the door rather than in front of it: the quay road is one tile deep, and a
      // stride straight out would be a stride into the yard wall.
      arrive: { x: -40.4, z: -34 },
    },
  ],
  props: {
    sky: 'none',
    horizon: 'none',
    dressing: [
      { kind: 'desk', x: -6, z: -12 },
      { kind: 'shelves', x: -14, z: -8, yaw: Math.PI / 2 },
      { kind: 'shelves', x: -14, z: 0, yaw: Math.PI / 2 },
      { kind: 'barrel', x: 14, z: 12 },
      { kind: 'brazier', x: 14, z: 2 },
    ],
    npcs: [
      { id: 'ashfall_toll_clerk', x: -6, z: -6, art: 'tax_collector', label: 'Talk to the toll clerk' },
      { id: 'ashfall_barge_hand', x: 6, z: 8, art: 'fisherman', label: 'Talk to the bargee' },
    ],
    graffiti: [
      { text: 'PAID TWICE', wallX: 8, wallZ: zOfRow(0) + TILE / 2, dx: 0, facesSouth: true, tint: '#7a6a5a' },
    ],
  },
});

void HALF_X;
