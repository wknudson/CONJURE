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
 *
 * Forty-six by forty now, grown evenly from thirty by twenty-six, and the growth is where the
 * water went. North, across the cistern by two plank bridges, **the drowned terraces**: a
 * street the flood took, its walls standing out of the water and the boardwalks the only dry
 * ways through -- to a door with no house behind it, the old parish pump, a mooring post at the
 * edge, and the one dry island, where the Magistracy has stood a water tower full of the clean
 * water the ward cannot have. West, **the punt moorings** and the punters' cottages, and the
 * soak below them with its own drowned graves. East, **the washhouse** and the drying yard.
 * South, through the range, **the new cut**: the drain the Magistracy began and flooded, and
 * the engine house for an engine that never came.
 *
 * What Lives in the Cistern comes up at night -- along the boardwalks, and into the soak.
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
 *   X  a drowned terrace — impassable; broken walls standing out of the flood
 *   h  cottage      — impassable; the punters'
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
    solid: { style: 'wall', minHeight: 2.2, maxHeight: 2.2, inset: 0.2, depthInset: 1.4, chimneyChance: 0, split: false },
  },
  M: {
    tex: 'cobble',
    safe: false,
    walk: false,
    solid: { style: 'hall', minHeight: 5.4, maxHeight: 5.4, inset: 0.3, depthInset: 0.3, chimneyChance: 1, split: false, wall: 'stone' },
  },
  L: {
    tex: 'cobble',
    safe: false,
    walk: false,
    solid: { style: 'cottage', minHeight: 4.4, maxHeight: 4.4, inset: 0.3, depthInset: 0.3, chimneyChance: 0.5, split: false, wall: 'plaster' },
  },
  B: {
    tex: 'cobble',
    safe: false,
    walk: false,
    solid: { style: 'terrace', minHeight: 4.2, maxHeight: 6.0, inset: 0.3, depthInset: 0.3, chimneyChance: 0.45, split: true },
  },
  X: {
    tex: 'marsh',
    safe: false,
    walk: false,
    // Broken courses at every height, split so no two lengths of it stand the same.
    solid: { style: 'wall', minHeight: 1.2, maxHeight: 2.8, inset: 0.3, depthInset: 1.2, chimneyChance: 0, split: true },
  },
  h: {
    tex: 'weeds',
    safe: false,
    walk: false,
    solid: { style: 'cottage', minHeight: 3.6, maxHeight: 4.2, inset: 0.3, depthInset: 0.3, chimneyChance: 0.7, split: true, wall: 'plaster' },
  },
};

/** Three rows of the cistern proper -- with the drowned terraces north of it now, not the edge. */
const WATER_ROWS = 3;
const WATER_ROW0 = 7;


/**
 * 46 wide by 40 deep.
 *
 * The east edge opens at row 19 — the lane east, back up to the ward. The old ward is still
 * terrace or wall all round, so the basin has one way in and one way out and you pass the whole
 * of it either way; the new ground is reached through gaps in the old walls and over the two
 * bridges.
 */
const GRID: readonly string[] = [
  'WWWWWWWWWWWWWWWWWWkWWWWWWWWWWWWWWWWWWWWWWWWWWW', //  0  THE DROWNED TERRACES: the flood, and what stands out of it
  'WWXXXXXXXXWWkkkkkkkkkkkkkWWWWWWWWWWXXXXXXXXXWW', //  1  the boardwalks along the old terrace fronts
  'WWWkWWWWWWWWkWWWWWWWWWWWkWggWWWWWWWWWWWWWWkWWW', //  2  the island, and the water tower on it
  'WWWkWWWWWWWWkWWWWWWWWWWWkkkkkkkkkkWWWWWWWWkWWW', //  3
  'WWWkkkkkkkkkkWWWWWWWXXXXXXXXWWWWWkWWWXXXXXkXXW', //  4
  'WWWWWWWWWWWWkWWWWWWWWWWWWWWWWWWWWkkkkkkkkkkWWW', //  5
  'WXXXXXXXXWWWkkWWWWWWWWWWWWWWWWWWkkWWWWXXXXXXXW', //  6
  'WWWWWWWWWWWWkkWWWWWWWWWWWWWWWWWWkkWWWWWWWWWWWW', //  7  the cistern -- the two bridges across it
  'WWWWWWWWWWWWkkWWWWWWWWWWWWWWWWWWkkWWWWWWWWWWWW', //  8
  'WWWWWWWWWWWWkkWWWWWWWWWWWWWWWWWWkkWWWWWWWWWWWW', //  9
  'cccccccccccccccccccccccccccccccccccccccccccccc', // 10  the quay; the punt moorings (west)                     the washhouse (east)
  '.hhh....Bcc.gggggggggggggggggggggg.ccB........', // 11  the north bank
  '.hhh....BckkkkkkkkkkkkkkkkkkkkkkkkkkcB.LLLLLL.', // 12  the north boardwalk
  '........BcgggWWWWWWWWggggWWWWWWWWgggcB.LLLLLL.', // 13  what is left of the water
  '.hhhhhh.BcgggWWWWWWWWggggWWWWWWWWgggcB.LLLLLL.', // 14
  '.hhhhhh.BckkkkkkkkkkkkkkkkkkkkkkkkkkcB........', // 15  the south boardwalk
  '........Bccggggggggggggggggggggggg.ccB........', // 16
  'cccccccccccccccccccccccccccccccccccccccccccccc', // 17  the ring lane, on through both old walls
  '........BcVVVVVccccccMMMMccccccVVVVVcB........', // 18  the wall round the basin, and THE PUMP HOUSE
  'ggggggggBccccccccccccMMMMccccccccccccccccccccc', // 19  the soak (west)                              the way out, east to the ward
  'ggggggggBccccccccccccccccccccccccccccB........', // 20  the pump house door, onto the lane
  'ggWWWgggBccBBBBBcccccBBBBBcLLLLLcccccB........', // 21  the terraces, and THE CLINIC
  'ggWWWgggBccBBBBBcccccBBBBBcLLLLLcccccB........', // 22
  'ggggggggBccccccccccccccccccccccccccccB........', // 23  the terrace lane; the clinic door
  'ggggggggBc..ggggg.ccccc.gggggg.ccccccB........', // 24  the south seep, and the drowned graves
  'gggggWWWBccggggggggccccgggggggggcccccB........', // 25
  'cccccccccccccccccccccccccccccccccccccB........', // 26
  'ggggggggBccBBBBBBccccccccBBBBBBBcccccB..BBBBB.', // 27                                               the drying yard, and its terraces
  'gWWWggggBccBBBBBBccccccccBBBBBBBcccccB..BBBBB.', // 28
  'gWWWggggBccccccccccccccccccccccccccccB........', // 29
  'ggggggggBcc.ggggggg.cccc.ggggggg.ccccB........', // 30  the second seep
  'ggggggggBccccccccccccccccccccccccccccB........', // 31
  'BBBBBBBBBBBBBBcBBBBBBBBBBBBBBBBcBBBBBBBBBBBBBB', // 32  the south range, with two ways down through it
  '..............................................', // 33  THE NEW CUT: the drain the Magistracy began, boarded twice
  'WWWWWWWWWWWWWWkWWWWWWWWWWWWWWWWkWWWWWWWWWWWWWW', // 34
  'WWWWWWWWWWWWWWkWWWWWWWWWWWWWWWWkWWWWWWWWWWWWWW', // 35
  '..............................................', // 36
  '....................MMMMMM....................', // 37  the engine house, with no engine
  '....................MMMMMM....................', // 38
  'BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB', // 39  the far range
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
      arrive: { x: -102, z: 30 },
    },
    {
      // Down through the pump house into the cistern under the ward.
      to: 'ward_seven_cistern',
      x: 0,
      z: zOfRow(19) + TILE / 2 + 1.4,
      label: 'Into the pump house, and down',
      door: { x: 0, z: zOfRow(19) + TILE / 2 + 0.05, facesSouth: true, sign: 'cistern', style: 'iron' },
      arrive: { x: 0, z: 20 },
    },
    {
      to: 'ward_seven_clinic',
      x: xOfCol(29),
      z: zOfRow(22) + TILE / 2 + 1.4,
      label: 'Into the back-alley clinic',
      door: { x: xOfCol(29), z: zOfRow(22) + TILE / 2 + 0.05, facesSouth: true, sign: 'clinic' },
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
      // A heron on the washhouse's run-off, rats in the soak.
      { kind: 'heron', x: 76, z: 20, roam: 5 },
      { kind: 'rat', x: -70, z: 14, roam: 4, count: 2 },
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

      // The drowned terraces: a mooring post where the boardwalk stops.
      { kind: 'bollard', x: -18, z: -78.4 },
      // The punt moorings.
      { kind: 'bollard', x: -86, z: -39 },
      { kind: 'bollard', x: -78, z: -39 },
      { kind: 'bollard', x: -66, z: -39 },
      { kind: 'logpile', x: -74, z: -32 },
      { kind: 'barrel', x: -70, z: -28 },
      { kind: 'washing', x: -62, z: -26, yaw: 0 },
      // The soak, and the graves in it.
      { kind: 'gravestone', x: -82, z: 46 },
      { kind: 'gravestone', x: -74, z: 42 },
      { kind: 'reeds', x: -86, z: 26 },
      { kind: 'reeds', x: -70, z: 18 },
      // The washhouse and the drying yard.
      { kind: 'washing', x: 70, z: -14, yaw: 0 },
      { kind: 'trough', x: 82, z: -16 },
      { kind: 'barrel', x: 90, z: -30 },
      { kind: 'washing', x: 66, z: 10, yaw: 0 },
      { kind: 'washing', x: 76, z: 14, yaw: 0 },
      { kind: 'washing', x: 86, z: 6, yaw: 0 },
      // The new cut, and the house for its engine.
      { kind: 'spoilheap', x: -40, z: 66 },
      { kind: 'spoilheap', x: 20, z: 66 },
      { kind: 'cart', x: -10, z: 66 },
      { kind: 'barrel', x: 40, z: 54 },
      { kind: 'logpile', x: -20, z: 74 },
      { kind: 'barrel', x: 18, z: 75 },
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
      // And at the foot of each bridge over the cistern, so the way north shows at night.
      { x: -46, z: -38 },
      { x: 46, z: -38 },
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
      { text: 'SEVEN DRINKS FIRST', wallX: -36, wallZ: zOfRow(21) - TILE / 2 - 0.05, dx: 0, facesSouth: false, tint: '#5e9e8f' },
      { text: 'RUNS UPHILL', wallX: 0, wallZ: zOfRow(19) + TILE / 2 + 0.05, dx: 4.6, facesSouth: true, tint: '#5e9e8f' },
    ],
    waterRows: WATER_ROWS,
    waterRow0: WATER_ROW0,
    horizon: 'city',
    /**
     * What Lives in the Cistern, up after dark: one crew walks the boardwalks through the drowned
     * terraces, over the island and back, and another works the soak west of the ward.
     */
    packs: [
      {
        encounterId: 'pack_cistern_things',
        id: 'drowned_terraces',
        x: -42,
        z: -62,
        roam: 6,
        hours: 'night',
        band: 'drowned',
        behaviour: 'beat',
        route: [
          { x: -42, z: -54 },
          { x: -42, z: -74 },
          { x: 6, z: -74 },
          { x: 6, z: -66 },
          { x: 42, z: -66 },
          { x: 42, z: -54 },
        ],
      },
      { encounterId: 'pack_cistern_things', id: 'soak', x: -80, z: 40, roam: 7, hours: 'night', band: 'soak' },
    ],
    /** The water tower on the one dry island, locked, full of the water the ward cannot have. */
    landmarks: [{ kind: 'water_tower', x: 16, z: -70 }],
    vignettes: [{ id: 'washing_court', x: 64, z: 30.8 }],
  },
});
