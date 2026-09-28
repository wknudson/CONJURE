/**
 * The cistern -- what Ward Seven is built on, reached down through the pump house.
 *
 * Rock cut for water and holding it: a channel down the west side that never quite empties,
 * the pumpman at the foot of the stair who keeps the one pump the Magistracy paid for going,
 * and at the far end the mouth the `fouled_cistern` contract is fought at. Something has
 * moved in beside the pumps -- the things that came up when the pumps stopped, roaming the dry
 * end at every hour, because there is no hour down here -- and what they are keeping is in the
 * sump behind them. The door is on the south
 * wall, up to the lane.
 */

import { TILE, defineArea, type AreaDef, type TileDef } from '../../map.js';

const LEGEND: Record<string, TileDef> = {
  '#': {
    tex: 'cave',
    safe: false,
    walk: false,
    solid: { minHeight: 4.8, maxHeight: 4.8, inset: 0, depthInset: 0, chimneyChance: 0, split: false, wall: 'rock', bare: true },
  },
  W: { tex: 'water', safe: false, walk: false },
  k: { tex: 'cave', safe: false, walk: true },
  f: { tex: 'flagstone', safe: false, walk: true },
};

const GRID: readonly string[] = [
  '##############', //  0
  '#WWkkkkkkkkkk#', //  1  the mouth, north-west
  '#WWkkkkkkkkkk#', //  2
  '#WWkkkkkkkkkk#', //  3
  '#WWkkkkkkkkkk#', //  4
  '#WWkkkkkkkkkk#', //  5
  '#WWkkkkkkkkkk#', //  6
  '#WWkkkkkkkkkk#', //  7
  '#WWkkkkkkkkkk#', //  8
  '#WWkkkkkkkkkk#', //  9
  '#kkkkkkkkkkkk#', // 10  the pumps
  '#kkkkkkffkkkk#', // 11  the foot of the stair
  '######ff######', // 12  the stair, up to the pump house
];

const HALF_X = (GRID[0]!.length * TILE) / 2;
const HALF_Z = (GRID.length * TILE) / 2;
const xOfCol = (col: number): number => col * TILE - HALF_X + TILE / 2;
const zOfRow = (row: number): number => row * TILE - HALF_Z + TILE / 2;

export const WARD_SEVEN_CISTERN_ID = 'ward_seven_cistern';

export const WARD_SEVEN_CISTERN: AreaDef = defineArea({
  id: WARD_SEVEN_CISTERN_ID,
  name: 'The Cistern',
  grid: GRID,
  legend: LEGEND,
  spawn: { x: 0, z: zOfRow(10) },
  safety: 'none',
  indoor: { camera: { distance: 19, pitch: 54, fov: 30 } },
  exits: [
    {
      to: 'ward_seven',
      x: 0,
      z: zOfRow(12),
      label: 'Up the stair to the lane',
      arrive: { x: 3.2, z: 2 },
    },
  ],
  props: {
    sky: 'none',
    horizon: 'none',
    dressing: [
      { kind: 'reeds', x: xOfCol(1.5), z: zOfRow(3) },
      { kind: 'reeds', x: xOfCol(1.5), z: zOfRow(7) },
      { kind: 'barrel', x: xOfCol(12), z: zOfRow(10) },
      { kind: 'barrel', x: xOfCol(12), z: zOfRow(11) },
      { kind: 'spoilheap', x: xOfCol(10), z: zOfRow(9) },
      { kind: 'brazier', x: xOfCol(10), z: zOfRow(1) },
      { kind: 'brazier', x: xOfCol(3), z: zOfRow(11) },
    ],
    npcs: [
      { id: 'ward_seven_pumpman', x: xOfCol(4), z: zOfRow(10), art: 'miner_b', label: 'Talk to the pumpman' },
    ],
    /**
     * What moved in beside the pumps: the cistern's own things, roaming the dry end at every hour.
     * The roam is short for the reason the Sink cellars' is -- a crew that wandered to the
     * stair would take you on the first step down.
     */
    packs: [{ encounterId: 'pack_cistern_things', x: 8, z: -12, roam: 5 }],
    graffiti: [
      { text: 'DRINKS FIRST, DRINKS LAST', wallX: 8, wallZ: zOfRow(0) + TILE / 2, dx: 0, facesSouth: true, tint: '#5e9e8f' },
    ],
  },
});
