/**
 * The Crossroads Arms -- Millharrow's inn, at the head of the fair green.
 *
 * Four roads in and a room for whoever came down each of them. The bar along the back wall,
 * the hearth in the west corner, tables down both sides so the floor stays clear for the fair's
 * dancing and anything else that happens on a floor. The innkeeper, a drover off the downs, and
 * a fiddler who charges more for silence than for tunes. The door is on the south wall, onto
 * the green.
 */

import { TILE, defineArea, type AreaDef, type TileDef } from '../../map.js';

const LEGEND: Record<string, TileDef> = {
  '#': {
    tex: 'planks',
    safe: false,
    walk: false,
    solid: { minHeight: 4.6, maxHeight: 4.6, inset: 0, depthInset: 0, chimneyChance: 0, split: false, wall: 'timber', bare: true },
  },
  '.': { tex: 'planks', safe: false, walk: true },
  s: { tex: 'straw', safe: false, walk: true },
};

const GRID: readonly string[] = [
  '##############', //  0
  '#............#', //  1  the bar, along the back wall
  '#............#', //  2
  '#............#', //  3
  '#............#', //  4  the floor
  '#............#', //  5
  '#............#', //  6
  '#............#', //  7
  '#............#', //  8
  '#.....ss.....#', //  9
  '#.....ss.....#', // 10  the threshold
  '######..######', // 11  the door, onto the green
];

const HALF_Z = (GRID.length * TILE) / 2;
const zOfRow = (row: number): number => row * TILE - HALF_Z + TILE / 2;

export const MILLHARROW_INN_ID = 'millharrow_inn';

export const MILLHARROW_INN: AreaDef = defineArea({
  id: MILLHARROW_INN_ID,
  name: 'The Crossroads Arms',
  grid: GRID,
  legend: LEGEND,
  spawn: { x: 0, z: zOfRow(9) },
  safety: 'none',
  indoor: { camera: { distance: 17, pitch: 54, fov: 30 } },
  exits: [
    {
      to: 'millharrow',
      x: 0,
      z: zOfRow(11),
      label: 'Out onto the green',
      // West along the inn's front, clear of the door.
      arrive: { x: 22, z: 71 },
    },
  ],
  props: {
    sky: 'none',
    horizon: 'none',
    dressing: [
      // The bar, and what is behind it.
      { kind: 'counter', x: -14, z: -16 },
      { kind: 'counter', x: -10, z: -16 },
      { kind: 'counter', x: -6, z: -16 },
      { kind: 'shelves', x: -10, z: -18.6, yaw: 0 },
      { kind: 'barrel', x: 18, z: -16 },
      { kind: 'barrel', x: 20, z: -12 },
      // The hearth, and tables down both walls.
      { kind: 'brazier', x: -20, z: -8 },
      { kind: 'table', x: -18, z: 2 },
      { kind: 'table', x: -18, z: 10 },
      { kind: 'table', x: 18, z: 2 },
      { kind: 'table', x: 18, z: 10 },
    ],
    npcs: [
      { id: 'millharrow_innkeeper', x: -8, z: -12, art: 'innkeeper', label: 'Talk to the innkeeper' },
      { id: 'millharrow_drover', x: 14, z: 6, art: 'farmer_daughter', label: 'Talk to the drover' },
      { id: 'millharrow_fiddler', x: -14, z: 6, art: 'bard_b', label: 'Talk to the fiddler' },
    ],
    graffiti: [
      { text: 'NO WRIT SERVED HERE', wallX: 10, wallZ: zOfRow(0) + TILE / 2, dx: 0, facesSouth: true, tint: '#7a6a5a' },
    ],
  },
});
