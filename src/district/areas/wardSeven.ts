/**
 * Ward Seven — the ward built on top of a cistern that stopped draining.
 *
 * The basin at the north end is the whole place. It was the ward's water; it is now standing
 * peat and open pools, and the ward has arranged itself around the edge of it rather than
 * admit it. The terraces are set well back, the low walls are the Magistracy's answer to a
 * problem it did not want to solve, and the ground between the two is somewhere between a
 * street and a bank.
 *
 * It reads wet from one end to the other, which is the point of putting marsh both north of
 * the terraces and south of them: this is not a ward with a pond in it, it is a ward with
 * water underneath it.
 */

import { defineArea, type AreaDef, type TileDef } from '../map.js';

/**
 * The ward's legend.
 *
 *   c  cobbles      — the dry lanes, such as they are
 *   .  weeds        — the joints losing the argument
 *   g  soaked peat  — walkable, and it is not pretending otherwise
 *   W  open water   — impassable
 *   V  low wall     — impassable, the barrier round the basin
 *   B  terrace      — impassable
 *
 * The `V` walls are shorter than Ashfall's yard wall and taken whole rather than split: this
 * is a course of brick laid round a hazard, not a seal across a yard.
 */
const SEVEN_LEGEND: Record<string, TileDef> = {
  c: { tex: 'cobble', safe: false, walk: true },
  '.': { tex: 'weeds', safe: false, walk: true },
  g: { tex: 'marsh', safe: false, walk: true },
  W: { tex: 'water', safe: false, walk: false },
  V: {
    tex: 'cobble',
    safe: false,
    walk: false,
    solid: { minHeight: 2.2, maxHeight: 2.2, inset: 0.2, depthInset: 1.4, chimneyChance: 0, split: false },
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

/**
 * 22 wide by 22 deep.
 *
 * Column 21 opens at row 12 — the lane east, back up to the ward. Everything else is terrace
 * or wall, so the basin has one way in and one way out and you pass the whole of it either way.
 */
const GRID: readonly string[] = [
  'WWWWWWWWWWWWWWWWWWWWWW', //  0  the cistern
  'WWWWWWWWWWWWWWWWWWWWWW', //  1
  'WWWWWWWWWWWWWWWWWWWWWW', //  2
  'BccccccccccccccccccccB', //  3  the quay, such as it is
  'Bcc.ggggggggggggg.cccB', //  4  the north bank
  'BccggggggggggggggggccB', //  5
  'BcggggWWWWWWWWggggggcB', //  6  what is left of the water
  'BcggggWWWWWWWWggggggcB', //  7
  'BcggggggggggggggggggcB', //  8
  'Bccgggggggggggggggcc.B', //  9
  'BccccccccccccccccccccB', // 10  the ring lane
  'BcVVVVccccccccVVVVcccB', // 11  the wall round the basin
  'Bccccccccccccccccccccc', // 12  the way out, east to the ward
  'Bcc.ccccccccccccc.cccB', // 13
  'BccBBBBcccccccBBBBBccB', // 14  the terraces
  'BccBBBBcccccccBBBBBccB', // 15
  'BccccccccccccccccccccB', // 16
  'Bc..ggggg.cccc.gggg.cB', // 17  the south seep
  'BccgggggggccccggggggcB', // 18
  'BccccccccccccccccccccB', // 19
  'BcVVVVVVccccccVVVVVVcB', // 20
  'BBBBBBBBBBBBBBBBBBBBBB', // 21  the south range
];

export const WARD_SEVEN_ID = 'ward_seven';

export const WARD_SEVEN: AreaDef = defineArea({
  id: WARD_SEVEN_ID,
  name: 'Ward Seven',
  grid: GRID,
  legend: SEVEN_LEGEND,
  /** On the ring lane, with the basin in front of you. */
  spawn: { x: 0, z: 6 },
  safety: 'none',
  exits: [
    {
      to: 'ashfall_ward',
      x: 42,
      z: 6,
      label: 'East, up to Ashfall Ward',
      arrive: { x: -30, z: 26 },
    },
  ],
  props: {
    /** Built over a cistern that stopped draining. Everything here is about water nobody wants. */
    dressing: [
      { kind: 'well', x: -38, z: -30 },
      { kind: 'well', x: 26, z: -22 },
      { kind: 'well', x: 22, z: -6 },
      { kind: 'well', x: -6, z: 10 },
      { kind: 'well', x: -10, z: 26 },
      { kind: 'trough', x: -34, z: -30 },
      { kind: 'trough', x: 30, z: -22 },
      { kind: 'trough', x: 26, z: -6 },
      { kind: 'trough', x: 6, z: 10 },
      { kind: 'trough', x: -6, z: 26 },
      { kind: 'washing', x: -42, z: -42, yaw: 0 },
      { kind: 'washing', x: 6, z: -34, yaw: 0 },
      { kind: 'washing', x: -26, z: -22, yaw: 0 },
      { kind: 'washing', x: -42, z: -10, yaw: 0 },
      { kind: 'washing', x: 22, z: -2, yaw: 0 },
      { kind: 'washing', x: -38, z: 14, yaw: 0 },
      { kind: 'washing', x: 14, z: 22, yaw: 0 },
      { kind: 'washing', x: -6, z: 34, yaw: 0 },
      { kind: 'barrel', x: -30, z: -30 },
      { kind: 'barrel', x: 22, z: -26 },
      { kind: 'barrel', x: -26, z: -14 },
      { kind: 'barrel', x: -10, z: -6 },
      { kind: 'barrel', x: 6, z: 2 },
      { kind: 'barrel', x: -34, z: 14 },
      { kind: 'barrel', x: 10, z: 22 },
      { kind: 'barrel', x: 2, z: 30 },
    ],
    /**
     * The two people treating a ward built over its own water.
     *
     * Both kept off the open pools, which is the only siting note that matters here: a healer
     * standing in the thing that is making people ill would be the map arguing with itself.
     */
    npcs: [
      { id: 'ward_seven_healer', x: -18, z: -6, art: 'healer', label: 'Talk to the ward healer' },
      { id: 'ward_seven_apothecary', x: 18, z: 10, art: 'apothecary', label: 'Talk to the apothecary' },
      { id: 'ward_seven_herbalist', x: -22, z: -10, art: 'herbalist', label: 'Talk to the herbalist' },
    ],
    /** On the ring lane and the terrace row. None over the basin: nothing is lit out there. */
    lamps: [
      { x: -18, z: 2 },
      { x: 10, z: 2 },
      { x: -30, z: 34 },
      { x: 10, z: 34 },
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
      { x: -30, z: 30 },
      { x: 26, z: 30 },
    ],
    graffiti: [
      {
        text: 'SEVEN DRINKS FIRST',
        wallX: -22,
        wallZ: 14,
        dx: 3,
        facesSouth: true,
        tint: '#5e9e8f',
      },
    ],
    waterRows: WATER_ROWS,
    horizon: 'city',
  },
});
