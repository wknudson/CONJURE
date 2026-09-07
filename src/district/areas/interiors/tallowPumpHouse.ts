/**
 * The pump house -- the engine that was meant to keep the Levels drained.
 *
 * Iron floor, a cold boiler, and the pump log on a stand by the door with the last entries
 * in a different hand. Chained since the north field went over, and opened once the field is
 * answered for: what is in here is the strongbox the Magistracy's engineer left, his cot, and
 * the log that says the blight came up the pipe. Nobody keeps it. The door is on the south
 * wall, onto the bank.
 */

import { TILE, defineArea, type AreaDef, type TileDef } from '../../map.js';

const LEGEND: Record<string, TileDef> = {
  '#': {
    tex: 'ironplate',
    safe: false,
    walk: false,
    solid: { minHeight: 5.0, maxHeight: 5.0, inset: 0, depthInset: 0, chimneyChance: 0, split: false, wall: 'stone', bare: true },
  },
  i: { tex: 'ironplate', safe: false, walk: true },
};

const GRID: readonly string[] = [
  '############', //  0
  '#iiiiiiiiii#', //  1  the boiler, east
  '#iiiiiiiiii#', //  2
  '#iiiiiiiiii#', //  3
  '#iiiiiiiiii#', //  4
  '#iiiiiiiiii#', //  5
  '#iiiiiiiiii#', //  6  the log, west
  '#iiiiiiiiii#', //  7
  '#iiiiiiiiii#', //  8  the cot
  '#iiiiiiiiii#', //  9
  '#####ii#####', // 10  the door, onto the bank
];

const HALF_X = (GRID[0]!.length * TILE) / 2;
const HALF_Z = (GRID.length * TILE) / 2;
const xOfCol = (col: number): number => col * TILE - HALF_X + TILE / 2;
const zOfRow = (row: number): number => row * TILE - HALF_Z + TILE / 2;

export const TALLOW_PUMP_HOUSE_ID = 'tallow_pump_house';

export const TALLOW_PUMP_HOUSE: AreaDef = defineArea({
  id: TALLOW_PUMP_HOUSE_ID,
  name: 'The Pump House',
  grid: GRID,
  legend: LEGEND,
  spawn: { x: 0, z: zOfRow(6) },
  safety: 'none',
  indoor: { camera: { distance: 19, pitch: 54, fov: 30 } },
  exits: [
    {
      to: 'tallow_levels',
      x: 0,
      z: zOfRow(10),
      label: 'Out onto the bank',
      arrive: { x: 30, z: -16.6 },
    },
  ],
  props: {
    sky: 'none',
    horizon: 'none',
    dressing: [
      { kind: 'workbench', x: xOfCol(1), z: zOfRow(2) },
      { kind: 'anvil', x: xOfCol(4), z: zOfRow(1) },
      { kind: 'brazier', x: xOfCol(9), z: zOfRow(1) },
      { kind: 'rack', x: xOfCol(10), z: zOfRow(4) },
      { kind: 'barrel', x: xOfCol(10), z: zOfRow(7) },
      { kind: 'barrel', x: xOfCol(10), z: zOfRow(8) },
      { kind: 'trough', x: xOfCol(7), z: zOfRow(2) },
    ],
    graffiti: [
      { text: 'IT CAME UP THE PIPE', wallX: xOfCol(6), wallZ: zOfRow(0) + TILE / 2, dx: 0, facesSouth: true, tint: '#6a8a6a' },
    ],
  },
});
