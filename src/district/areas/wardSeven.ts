/**
 * Ward Seven — the ward built on top of a cistern that stopped draining.
 *
 * The basin at the north end is the whole place. It was the ward's water; it is now standing
 * peat and open pools, and the ward has arranged itself around the edge of it rather than
 * admit it. The terraces are set well back, the low walls are the Magistracy's answer to a
 * problem it did not want to solve, and the ground between the two is somewhere between a
 * street and a bank.
 *
 * Thirty by twenty-six now. Two boardwalks cross the basin so the north bank can be reached
 * without wading; the pump house on the ring lane goes down into the cistern itself, which
 * is where the `fouled_cistern` contract is fought and where something has moved in beside
 * the pumps; and the back-alley clinic the `clinic_quota` contract names is a room off the
 * terrace lane, with the healer in it and a cot for the night. South of the terraces the
 * seep runs on, with the drowned graves in it, to a second row of terraces and a second seep.
 *
 * It reads wet from one end to the other, which is the point of putting marsh north of the
 * terraces and south of them twice: this is not a ward with a pond in it, it is a ward with
 * water underneath it.
 */

import { TILE, defineArea, type AreaDef, type TileDef } from '../map.js';

/**
 * The ward's legend.
 *
 *   c  cobbles      — the dry lanes, such as they are
 *   .  weeds        — the joints losing the argument
 *   g  soaked peat  — walkable, and it is not pretending otherwise
 *   k  boardwalk    — planks over the peat, the one thing the ward built for itself
 *   W  open water   — impassable
 *   V  low wall     — impassable, the barrier round the basin
 *   M  the pump house — impassable; stone, the Magistracy's one answer
 *   L  the clinic   — impassable; limewashed plaster, one storey
 *   B  terrace      — impassable
 *
 * The `V` walls are shorter than Ashfall's yard wall and taken whole rather than split: this
 * is a course of brick laid round a hazard, not a seal across a yard.
 */
const SEVEN_LEGEND: Record<string, TileDef> = {
  c: { tex: 'cobble', safe: false, walk: true },
  '.': { tex: 'weeds', safe: false, walk: true },
  g: { tex: 'marsh', safe: false, walk: true },
  k: { tex: 'planks', safe: false, walk: true },
  W: { tex: 'water', safe: false, walk: false },
  V: {
    tex: 'cobble',
    safe: false,
    walk: false,
    solid: { minHeight: 2.2, maxHeight: 2.2, inset: 0.2, depthInset: 1.4, chimneyChance: 0, split: false },
  },
  M: {
    tex: 'cobble',
    safe: false,
    walk: false,
    solid: { minHeight: 5.4, maxHeight: 5.4, inset: 0.3, depthInset: 0.3, chimneyChance: 1, split: false, wall: 'stone' },
  },
  L: {
    tex: 'cobble',
    safe: false,
    walk: false,
    solid: { minHeight: 4.4, maxHeight: 4.4, inset: 0.3, depthInset: 0.3, chimneyChance: 0.5, split: false, wall: 'plaster' },
  },
  B: {
    tex: 'cobble',
    safe: false,
    walk: false,
    solid: { minHeight: 4.2, maxHeight: 6.0, inset: 0.3, depthInset: 0.3, chimneyChance: 0.45, split: true },
  },
};

/** Three rows of the cistern proper, along the north edge. */
const WATER_ROWS = 3;

const C28 = 'c'.repeat(28);

/**
 * 30 wide by 26 deep.
 *
 * Column 29 opens at row 12 — the lane east, back up to the ward. Everything else is terrace
 * or wall, so the basin has one way in and one way out and you pass the whole of it either way.
 */
const GRID: readonly string[] = [
  'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWW', //  0  the cistern
  'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWW', //  1
  'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWW', //  2
  `B${C28}B`, //  3  the quay, such as it is
  'Bcc.gggggggggggggggggggggg.ccB', //  4  the north bank
  'BckkkkkkkkkkkkkkkkkkkkkkkkkkcB', //  5  the north boardwalk
  'BcgggWWWWWWWWggggWWWWWWWWgggcB', //  6  what is left of the water
  'BcgggWWWWWWWWggggWWWWWWWWgggcB', //  7
  'BckkkkkkkkkkkkkkkkkkkkkkkkkkcB', //  8  the south boardwalk
  'Bccggggggggggggggggggggggg.ccB', //  9
  `B${C28}B`, // 10  the ring lane
  'BcVVVVVccccccMMMMccccccVVVVVcB', // 11  the wall round the basin, and THE PUMP HOUSE
  `B${'c'.repeat(12)}MMMM${'c'.repeat(13)}`, // 12  the way out, east to the ward
  `B${C28}B`, // 13  the pump house door, onto the lane
  'BccBBBBBcccccBBBBBcLLLLLcccccB', // 14  the terraces, and THE CLINIC
  'BccBBBBBcccccBBBBBcLLLLLcccccB', // 15
  `B${C28}B`, // 16  the terrace lane; the clinic door
  'Bc..ggggg.ccccc.gggggg.ccccccB', // 17  the south seep, and the drowned graves
  'BccggggggggccccgggggggggcccccB', // 18
  `B${C28}B`, // 19
  'BccBBBBBBccccccccBBBBBBBcccccB', // 20  the south terraces
  'BccBBBBBBccccccccBBBBBBBcccccB', // 21
  `B${C28}B`, // 22
  'Bcc.ggggggg.cccc.ggggggg.ccccB', // 23  the second seep
  `B${C28}B`, // 24
  'BBBBBBBBBBBBBBBBBBBBBBBBBBBBBB', // 25  the south range
];

const HALF_X = (GRID[0]!.length * TILE) / 2;
const HALF_Z = (GRID.length * TILE) / 2;
const xOfCol = (col: number): number => col * TILE - HALF_X + TILE / 2;
const zOfRow = (row: number): number => row * TILE - HALF_Z + TILE / 2;

export const WARD_SEVEN_ID = 'ward_seven';

export const WARD_SEVEN: AreaDef = defineArea({
  id: WARD_SEVEN_ID,
  name: 'Ward Seven',
  grid: GRID,
  legend: SEVEN_LEGEND,
  /** On the ring lane, with the basin in front of you. */
  spawn: { x: 0, z: -10 },
  safety: 'none',
  exits: [
    {
      to: 'ashfall_ward',
      x: HALF_X - 2,
      z: -2,
      label: 'East, up to Ashfall Ward',
      arrive: { x: -54, z: 30 },
    },
    {
      // Down through the pump house into the cistern under the ward.
      to: 'ward_seven_cistern',
      x: 0,
      z: zOfRow(12) + TILE / 2 + 1.4,
      label: 'Into the pump house, and down',
      door: { x: 0, z: zOfRow(12) + TILE / 2 + 0.05, facesSouth: true, sign: 'cistern', style: 'iron' },
      arrive: { x: 0, z: 20 },
    },
    {
      to: 'ward_seven_clinic',
      x: xOfCol(21),
      z: zOfRow(15) + TILE / 2 + 1.4,
      label: 'Into the back-alley clinic',
      door: { x: xOfCol(21), z: zOfRow(15) + TILE / 2 + 0.05, facesSouth: true, sign: 'clinic' },
      arrive: { x: 0, z: 16 },
    },
  ],
  props: {
    /** Built over a cistern that stopped draining, so: reeds, a heron, and rats. */
    sky: 'drizzle',
    wildlife: [
      { kind: 'heron', x: -26, z: -34, roam: 6 },
      { kind: 'rat', x: -18, z: -34, roam: 5, count: 2 },
      { kind: 'rat', x: 18, z: -18, roam: 5, count: 2 },
      { kind: 'rat', x: -38, z: 2, roam: 5, count: 2 },
      { kind: 'rat', x: 22, z: 26, roam: 5, count: 2 },
      { kind: 'gull', x: -38, z: -46, roam: 20, count: 2 },
    ],
    /** Built over a cistern that stopped draining. Everything here is about water nobody wants. */
    dressing: [
      { kind: 'well', x: -38, z: -10 },
      { kind: 'well', x: 26, z: -14 },
      { kind: 'well', x: -26, z: 2 },
      { kind: 'well', x: -10, z: 26 },
      { kind: 'well', x: 14, z: 42 },
      { kind: 'trough', x: -34, z: -10 },
      { kind: 'trough', x: 30, z: -14 },
      { kind: 'trough', x: 22, z: 2 },
      { kind: 'trough', x: -6, z: 26 },
      { kind: 'washing', x: -42, z: -38, yaw: 0 },
      { kind: 'washing', x: 6, z: -38, yaw: 0 },
      { kind: 'washing', x: -50, z: -22, yaw: 0 },
      { kind: 'washing', x: -42, z: -2, yaw: 0 },
      { kind: 'washing', x: 22, z: -2, yaw: 0 },
      { kind: 'washing', x: -38, z: 22, yaw: 0 },
      { kind: 'washing', x: 14, z: 22, yaw: 0 },
      { kind: 'washing', x: -6, z: 38, yaw: 0 },
      { kind: 'barrel', x: -30, z: -38 },
      { kind: 'barrel', x: 22, z: -38 },
      { kind: 'barrel', x: -26, z: -14 },
      { kind: 'barrel', x: -10, z: -2 },
      { kind: 'barrel', x: 2, z: 18 },
      { kind: 'barrel', x: -34, z: 14 },
      { kind: 'barrel', x: 10, z: 26 },
      { kind: 'barrel', x: 2, z: 34 },
      { kind: 'reeds', x: -26, z: -34 },
      { kind: 'reeds', x: 22, z: -34 },
      { kind: 'reeds', x: -10, z: -26 },
      { kind: 'reeds', x: -38, z: -22 },
      { kind: 'reeds', x: 14, z: -22 },
      { kind: 'reeds', x: 26, z: -10 },
      // The drowned graves, in the south seep.
      { kind: 'gravestone', x: -42, z: 22 },
      { kind: 'gravestone', x: -34, z: 18 },
      { kind: 'bramble', x: 18, z: 42 },
    ],
    /**
     * The people treating a ward built over its own water.
     *
     * All kept off the open pools, which is the only siting note that matters here: a healer
     * standing in the thing that is making people ill would be the map arguing with itself.
     * The healer is indoors now, at the clinic; the pumpman is down with his pumps.
     */
    npcs: [
      { id: 'ward_seven_lamplighter', x: 10, z: -10, art: 'night_watchman', label: 'Talk to the lamplighter' },
      { id: 'ward_seven_apothecary', x: 18, z: 14, art: 'apothecary', label: 'Talk to the apothecary' },
      { id: 'ward_seven_herbalist', x: -22, z: -10, art: 'herbalist', label: 'Talk to the herbalist' },
      { id: 'ward_seven_washerwoman', x: -30, z: 22, art: 'seamstress', label: 'Talk to the washerwoman' },
    ],
    /**
     * Who walks the row.
     *
     * Six lamps over a flooded ward. He lights them and goes.
     */
    lamplighter: 'ward_seven_lamplighter',
    lamps: [
      { x: -30, z: -10 },
      { x: 30, z: -10 },
      { x: -10, z: 14 },
      { x: 10, z: 14 },
      { x: -18, z: 34 },
      { x: 0, z: 42 },
    ],
    crates: [
      { x: -34, z: -18 },
      { x: 30, z: -18 },
      { x: -18, z: 14 },
    ],
    /** On the bank, where the ground is too wet to build on and too soft to clear. */
    trees: [
      { x: -34, z: -14 },
      { x: 34, z: -14 },
      { x: -30, z: 42 },
      { x: 26, z: 42 },
    ],
    graffiti: [
      { text: 'SEVEN DRINKS FIRST', wallX: -36, wallZ: zOfRow(14) - TILE / 2 - 0.05, dx: 0, facesSouth: false, tint: '#5e9e8f' },
      { text: 'RUNS UPHILL', wallX: 0, wallZ: zOfRow(12) + TILE / 2 + 0.05, dx: 4.6, facesSouth: true, tint: '#5e9e8f' },
    ],
    waterRows: WATER_ROWS,
    horizon: 'city',
  },
});
