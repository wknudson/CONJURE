/**
 * Millharrow — the Ring's crossroads, and the reason the Chalk Road goes anywhere.
 *
 * Four ways out, one from each edge, and the town is simply what grew where they met. The plan
 * is the plan of every crossroads settlement: a cross of streets, buildings pressed against
 * both sides of it, and ploughed strips beginning the moment the last roof does.
 *
 * It is deliberately the most *legible* place in the world. Jolrek's wards are things you learn
 * by walking into their dead ends; this one you can read from the middle in one turn on the
 * spot. That is what a hub has to be — the four roads out of it are the point, and a town that
 * hid them would be a town you got stuck in.
 *
 * Thirty-two by twenty-eight now, and two of its roofs open. The Mill stands north of the
 * cross with the race running past it, and the low granary the race drowned is south of the
 * race with its door onto the cross: the `drowned_granary` contract is fought in the flooded
 * end of it, which used to be a label on the cobbles outside.
 */

import { TILE, defineArea, type AreaDef, type TileDef } from '../map.js';

/**
 * The town's legend.
 *
 *   ,  chalk street  — the crossroads themselves, and the four roads out
 *   c  cobbles       — the yards and frontages either side
 *   f  ploughed strip
 *   #  grass
 *   .  weeds
 *   W  the mill race — impassable, and below you
 *   B  town building — impassable
 *   M  the Mill      — impassable; timber, the stack going
 *   G  the granary   — impassable; low stone, the water line on it
 *   T  hedgerow      — impassable, the town's edge
 *
 * The streets are chalk rather than cobble on purpose: they are the Chalk Road, still, running
 * through a place that happens to be built on it.
 */
const MILL_LEGEND: Record<string, TileDef> = {
  ',': { tex: 'chalk', safe: false, walk: true },
  c: { tex: 'cobble', safe: false, walk: true },
  f: { tex: 'field', safe: false, walk: true },
  '#': { tex: 'grass', safe: false, walk: true },
  '.': { tex: 'weeds', safe: false, walk: true },
  W: { tex: 'water', safe: false, walk: false },
  B: {
    tex: 'cobble',
    safe: false,
    walk: false,
    solid: { minHeight: 3.6, maxHeight: 5.2, inset: 0.35, depthInset: 0.35, chimneyChance: 0.5, split: true },
  },
  M: {
    tex: 'cobble',
    safe: false,
    walk: false,
    solid: { minHeight: 6.4, maxHeight: 6.4, inset: 0.3, depthInset: 0.3, chimneyChance: 1, split: false, wall: 'timber' },
  },
  G: {
    tex: 'cobble',
    safe: false,
    walk: false,
    solid: { minHeight: 3.2, maxHeight: 3.2, inset: 0.3, depthInset: 0.3, chimneyChance: 0, split: false, wall: 'stone' },
  },
  T: {
    tex: 'grass',
    safe: false,
    walk: false,
    solid: { minHeight: 3.4, maxHeight: 4.6, inset: 0.7, depthInset: 0.7, chimneyChance: 0, split: true },
  },
};

const FIELDS = 'T##fffffffffff,,,,fffffffffff##T';
const VERGE = 'T#....#######,,,,,,#######....#T';
const YARDS = `T${'c'.repeat(12)}${','.repeat(6)}${'c'.repeat(12)}T`;

/**
 * 32 wide by 28 deep.
 *
 * The four gaps in the hedge are the four roads: north to the Tallow Levels, south to the
 * Chalk Road, west to Saltglass, east to Bray's Hollow. Everything else is enclosed, so the
 * only decisions the town offers are which of the four you take -- and, now, which of the two
 * doors.
 */
const GRID: readonly string[] = [
  `${'T'.repeat(14)},,${'T'.repeat(16)}`, //  0  north, to the Levels
  FIELDS, //  1
  FIELDS, //  2
  FIELDS, //  3
  VERGE, //  4
  YARDS, //  5
  'TcBBBBBBccMMMM,,,,,,cBBBBBBBBccT', //  6  the north frontages, and THE MILL
  'TcBBBBBBccMMMM,,,,,,cBBBBBBBBccT', //  7
  'TccWWWWWWcMMMM,,,,,,cccccccccccT', //  8  the mill race
  'TccWWWWWWccccc,,,,cccccccccccccT', //  9  the mill door
  'TcGGGGGGccBBBBc,,,,cBBBBBBcccccT', // 10  THE LOW GRANARY, drowned
  'TcGGGGGGccBBBBc,,,,cBBBBBBcccccT', // 11
  ','.repeat(32), // 12  THE CROSS — west to Saltglass, east to Bray's Hollow
  ','.repeat(32), // 13
  YARDS, // 14
  'TcBBBBBccBBBBc,,,,cBBBBBBccBBBcT', // 15  the south frontages
  'TcBBBBBccBBBBc,,,,cBBBBBBccBBBcT', // 16
  YARDS, // 17
  'TcBBBBBBccBBBB,,,,,,cBBBBBBBBccT', // 18
  'TcBBBBBBccBBBB,,,,,,cBBBBBBBBccT', // 19
  YARDS, // 20
  VERGE, // 21
  FIELDS, // 22
  FIELDS, // 23
  FIELDS, // 24
  FIELDS, // 25
  FIELDS, // 26
  `${'T'.repeat(14)},,${'T'.repeat(16)}`, // 27  south, to the Chalk Road
];

const HALF_X = (GRID[0]!.length * TILE) / 2;
const HALF_Z = (GRID.length * TILE) / 2;
const xOfCol = (col: number): number => col * TILE - HALF_X + TILE / 2;
const zOfRow = (row: number): number => row * TILE - HALF_Z + TILE / 2;

export const MILLHARROW_ID = 'millharrow';

export const MILLHARROW: AreaDef = defineArea({
  id: MILLHARROW_ID,
  name: 'Millharrow',
  grid: GRID,
  legend: MILL_LEGEND,
  /** The middle of the cross, which is the only honest place to put somebody down here. */
  spawn: { x: 0, z: 0 },
  safety: 'none',
  exits: [
    {
      to: 'chalk_road',
      x: -2,
      z: zOfRow(26),
      label: 'South, down onto the Chalk Road',
      arrive: { x: -34, z: -14 },
    },
    {
      to: 'tallow_levels',
      x: -2,
      z: zOfRow(1),
      label: 'North, out onto the Tallow Levels',
      arrive: { x: -2, z: 30 },
    },
    {
      to: 'saltglass',
      x: -HALF_X + 2,
      z: -2,
      label: 'West, to Saltglass',
      arrive: { x: 38, z: 2 },
    },
    {
      to: 'brays_hollow',
      x: HALF_X - 2,
      z: -2,
      label: "East, into Bray's Hollow",
      arrive: { x: -30, z: -2 },
    },
    {
      // The Mill, with its door on the lane between the race and the cross.
      to: 'millharrow_mill',
      x: xOfCol(11.5),
      z: zOfRow(8) + TILE / 2 + 1.4,
      label: 'Into the Mill',
      door: { x: xOfCol(11.5), z: zOfRow(8) + TILE / 2 + 0.05, facesSouth: true, style: 'plank' },
      arrive: { x: 0, z: 14 },
    },
    {
      // The low granary. The water is in it, and so is what dammed the race.
      to: 'millharrow_granary',
      x: xOfCol(4.5),
      z: zOfRow(11) + TILE / 2 + 1.4,
      label: 'Into the drowned granary',
      door: { x: xOfCol(4.5), z: zOfRow(11) + TILE / 2 + 0.05, facesSouth: true, style: 'plank' },
      arrive: { x: 0, z: 20 },
    },
  ],
  props: {
    /** A crossroads town in worked country. Stock in the fields, rats at the mill. */
    sky: 'pollen',
    wildlife: [
      { kind: 'sheep', x: -26, z: -46, roam: 7, count: 4 },
      { kind: 'sheep', x: 30, z: -46, roam: 7, count: 4 },
      { kind: 'sheep', x: -30, z: 42, roam: 7, count: 4 },
      { kind: 'goat', x: -14, z: -46, roam: 7, count: 2 },
      { kind: 'goat', x: 34, z: 38, roam: 7, count: 2 },
      { kind: 'rat', x: -26, z: -14, roam: 5, count: 2 },
      { kind: 'rat', x: -6, z: 2, roam: 5, count: 2 },
      { kind: 'rook', x: -54, z: -50, roam: 22, count: 4 },
    ],
    /**
     * The crossroads has opinions about the toll.
     *
     * On the granary and the Mill, where the road into town runs past them — the graffiti in
     * this game is always on the wall of whatever the line is complaining about.
     */
    graffiti: [
      { text: 'THE TOLL IS NOT THE KINGS', wallX: -36, wallZ: zOfRow(11) + TILE / 2 + 0.05, dx: 0, facesSouth: true, tint: '#a46a4a' },
      { text: 'WEIGH IT AT THE MILL', wallX: -10, wallZ: zOfRow(8) + TILE / 2 + 0.05, dx: 0, facesSouth: true, tint: '#b7ae9d' },
    ],
    /** Mill town at the crossroads: grain in, beer out, and a toll on the best road. */
    dressing: [
      { kind: 'sacks', x: -46, z: -46 },
      { kind: 'sacks', x: -42, z: -34 },
      { kind: 'sacks', x: -26, z: -26 },
      { kind: 'sacks', x: 18, z: -18 },
      { kind: 'sacks', x: 14, z: -6 },
      { kind: 'sacks', x: -2, z: 6 },
      { kind: 'sacks', x: -26, z: 14 },
      { kind: 'sacks', x: 46, z: 26 },
      { kind: 'sacks', x: 38, z: 34 },
      { kind: 'haybale', x: -38, z: -46 },
      { kind: 'haybale', x: 18, z: -34 },
      { kind: 'haybale', x: -10, z: -34 },
      { kind: 'haybale', x: -10, z: -6 },
      { kind: 'haybale', x: 42, z: 6 },
      { kind: 'haybale', x: 14, z: 22 },
      { kind: 'haybale', x: -18, z: 34 },
      { kind: 'cart', x: -34, z: -46 },
      { kind: 'cart', x: 18, z: -30 },
      { kind: 'cart', x: -26, z: -10 },
      { kind: 'cart', x: 18, z: 2 },
      { kind: 'cart', x: -10, z: 30 },
      { kind: 'fence', x: -30, z: -46, yaw: 0 },
      { kind: 'fence', x: -30, z: -34, yaw: 0 },
      { kind: 'fence', x: -54, z: -18, yaw: 0 },
      { kind: 'fence', x: -42, z: -2, yaw: 0 },
      { kind: 'fence', x: 2, z: 6, yaw: 0 },
      { kind: 'fence', x: -10, z: 14, yaw: 0 },
      { kind: 'fence', x: -38, z: 30, yaw: 0 },
      { kind: 'fence', x: 46, z: 34, yaw: 0 },
      { kind: 'waystone', x: -26, z: -46, text: 'BY ORDER — TOLL PAYABLE' },
      { kind: 'waystone', x: -26, z: 2, text: 'BY ORDER — TOLL PAYABLE' },
      { kind: 'well', x: -22, z: -46 },
      { kind: 'well', x: -22, z: 2 },
      { kind: 'trough', x: 26, z: -34 },
      { kind: 'pens', x: 42, z: -46 },
      { kind: 'awning', x: 30, z: -18, yaw: 0 },
      { kind: 'wildflowers', x: -18, z: -46 },
      { kind: 'wildflowers', x: 30, z: -30 },
      { kind: 'wildflowers', x: 2, z: -10 },
      { kind: 'wildflowers', x: -42, z: 14 },
      { kind: 'wildflowers', x: 2, z: 30 },
      { kind: 'bramble', x: -14, z: -46 },
      { kind: 'bramble', x: 38, z: -34 },
      { kind: 'bramble', x: -2, z: 30 },
    ],
    /**
     * The hub, populated as a hub.
     *
     * One on each of three of the four arms of the crossroads, so that whichever road the
     * player arrives on there is somebody on it before the junction.
     */
    npcs: [
      { id: 'millharrow_miller', x: 6, z: -10, art: 'miller', label: 'Talk to the miller' },
      { id: 'millharrow_farmer_wife', x: -10, z: 2, art: 'farmer_wife', label: 'Talk to the farmer' },
      { id: 'millharrow_baker', x: 14, z: 14, art: 'baker', label: 'Talk to the baker' },
      { id: 'millharrow_brewer', x: 2, z: -14, art: 'brewer_b', label: 'Talk to the brewer' },
      { id: 'millharrow_tollman', x: 10, z: -14, art: 'town_guard_b', label: 'Talk to the tollman' },
    ],
    /**
     * Who walks the row.
     *
     * No Magistracy man comes this far out. The tollman keeps the gate on the
     * crossroads and the lamps *are* the crossroads, so he does it himself.
     */
    lamplighter: 'millharrow_tollman',
    lamps: [
      { x: -2, z: -30 },
      { x: -2, z: -10 },
      { x: -2, z: 14 },
      { x: -2, z: 34 },
      { x: -26, z: -2 },
      { x: 22, z: -2 },
    ],
    crates: [
      { x: -26, z: -22 },
      { x: 30, z: -22 },
      { x: -34, z: 26 },
      { x: 30, z: 26 },
    ],
    trees: [
      { x: -50, z: -46 },
      { x: 46, z: -46 },
      { x: -50, z: 46 },
      { x: 46, z: 46 },
    ],
    horizon: 'treeline',
  },
});
