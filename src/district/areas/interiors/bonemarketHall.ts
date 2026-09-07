/**
 * The Market Hall -- the arcade with its roof back on.
 *
 * Whatever this was before the trade arrived, it was tall and stone and had a nave, and the
 * five traders with slabs have their slabs where the pews were. Grocer and fishmonger at the
 * north end, the stallkeeper's sundries under an awning between them, the butcher and the
 * jeweller at the south beside the door. What they sell the game cannot yet hold in a hand
 * -- food, fish, rings -- so what they have is a voice, a board over the slab, and a cache
 * under one of them. The door is on the south face, onto the market floor.
 */

import { TILE, defineArea, type AreaDef, type TileDef } from '../../map.js';

const LEGEND: Record<string, TileDef> = {
  '#': {
    tex: 'market',
    safe: false,
    walk: false,
    solid: { minHeight: 6.4, maxHeight: 6.4, inset: 0, depthInset: 0, chimneyChance: 0, split: false, wall: 'stone', bare: true },
  },
  m: { tex: 'market', safe: false, walk: true },
  f: { tex: 'flagstone', safe: false, walk: true },
};

const GRID: readonly string[] = [
  '##################', //  0
  '#mmmmmmmmmmmmmmmm#', //  1  the north slabs
  '#mmmmmmmmmmmmmmmm#', //  2
  '#mmmmmmmmmmmmmmmm#', //  3
  '#mmmmmmmffmmmmmmm#', //  4  the old nave, flagged
  '#mmmmmmmffmmmmmmm#', //  5
  '#mmmmmmmffmmmmmmm#', //  6
  '#mmmmmmmffmmmmmmm#', //  7
  '#mmmmmmmffmmmmmmm#', //  8
  '#mmmmmmmmmmmmmmmm#', //  9  the south slabs
  '#mmmmmmmmmmmmmmmm#', // 10
  '#mmmmmmmffmmmmmmm#', // 11
  '########ff########', // 12  the door, onto the floor
];

const HALF_X = (GRID[0]!.length * TILE) / 2;
const HALF_Z = (GRID.length * TILE) / 2;
const xOfCol = (col: number): number => col * TILE - HALF_X + TILE / 2;
const zOfRow = (row: number): number => row * TILE - HALF_Z + TILE / 2;

export const BONEMARKET_HALL_ID = 'bonemarket_hall';

export const BONEMARKET_HALL: AreaDef = defineArea({
  id: BONEMARKET_HALL_ID,
  name: 'The Market Hall',
  grid: GRID,
  legend: LEGEND,
  spawn: { x: 0, z: zOfRow(9) },
  safety: 'none',
  indoor: { camera: { distance: 21, pitch: 54, fov: 30 } },
  exits: [
    {
      to: 'bonemarket',
      x: 0,
      z: zOfRow(12),
      label: 'Out onto the market floor',
      // Beside the door rather than in front of it: a stall row stands one tile south.
      arrive: { x: 3.2, z: 2 },
    },
  ],
  props: {
    sky: 'none',
    horizon: 'none',
    /** Each trade's slab and what stands round it. Nothing between a trader and the aisle. */
    dressing: [
      // The grocer, north-west.
      { kind: 'sacks', x: xOfCol(1), z: zOfRow(1) },
      { kind: 'sacks', x: xOfCol(3), z: zOfRow(1) },
      { kind: 'rack', x: xOfCol(1), z: zOfRow(3) },
      // The fishmonger, north-east.
      { kind: 'barrel', x: xOfCol(14), z: zOfRow(1) },
      { kind: 'barrel', x: xOfCol(16), z: zOfRow(1) },
      { kind: 'rack', x: xOfCol(16), z: zOfRow(3) },
      // The stallkeeper, under an awning in the middle of the north end.
      { kind: 'awning', x: 0, z: zOfRow(1), yaw: 0 },
      { kind: 'sacks', x: xOfCol(10), z: zOfRow(1) },
      // The butcher, south-west, and the jeweller, south-east.
      { kind: 'rack', x: xOfCol(1), z: zOfRow(10) },
      { kind: 'barrel', x: xOfCol(2), z: zOfRow(9) },
      { kind: 'table', x: xOfCol(16), z: zOfRow(10) },
      { kind: 'shelves', x: xOfCol(16), z: zOfRow(8), yaw: -Math.PI / 2 },
      // Braziers down the nave; the trade brings its own light.
      { kind: 'brazier', x: xOfCol(5), z: zOfRow(6) },
      { kind: 'brazier', x: xOfCol(12), z: zOfRow(6) },
    ],
    npcs: [
      { id: 'bonemarket_grocer', x: xOfCol(3), z: zOfRow(3), art: 'grocer', label: 'Talk to the grocer' },
      { id: 'bonemarket_fishmonger', x: xOfCol(14), z: zOfRow(3), art: 'fishmonger', label: 'Talk to the fishmonger' },
      { id: 'bonemarket_stallkeeper', x: 0, z: zOfRow(3), art: 'shopkeeper', label: 'Talk to the stallkeeper' },
      { id: 'bonemarket_butcher', x: xOfCol(3), z: zOfRow(9), art: 'butcher', label: 'Talk to the butcher' },
      { id: 'bonemarket_jeweler', x: xOfCol(14), z: zOfRow(9), art: 'jeweler', label: 'Talk to the jeweller' },
    ],
    graffiti: [
      { text: 'WEIGHED IN THE SIGHT OF GOD, ONCE', wallX: 0, wallZ: zOfRow(0) + TILE / 2, dx: 0, facesSouth: true, tint: '#a09a82' },
    ],
  },
});
