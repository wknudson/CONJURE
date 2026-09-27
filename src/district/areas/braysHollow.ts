/**
 * Bray's Hollow — a bowl with a lane through it.
 *
 * The one place in the Ring with almost nothing built on it. Hedged on all four sides, ploughed
 * at the rim, and grass the whole way down to a chalk lane running east to west across the
 * bottom. There is no town here and there never was; the name belongs to whoever last kept the
 * hedges.
 *
 * It is in the world as breathing room. Between Millharrow's crossroads, Saltglass's ranks and
 * the Tallow cuts, the Ring needed one map whose layout asks nothing of you at all — somewhere
 * the only thing to do is walk across it and see how far it is.
 *
 * Twenty-six by twenty-six now, and one roof: the barn on the north slope, which is not a town
 * either. It is where the herd is wintered, and where the warrant came for it -- the
 * `warrant_of_distraint` contract is fought over the straw inside, which used to be a label
 * on the grass.
 */

import { TILE, defineArea, type AreaDef, type TileDef } from '../map.js';

/**
 * The Hollow's legend.
 *
 *   #  grass        — the bowl
 *   f  ploughed rim
 *   ,  chalk lane   — the way through
 *   .  weeds
 *   B  the barn     — impassable; timber, no stack
 *   T  hedge        — impassable
 *
 * Six characters and one of them is the boundary. This is the simplest legend in the game and
 * it is meant to be.
 */
const HOLLOW_LEGEND: Record<string, TileDef> = {
  '#': { tex: 'grass', safe: false, walk: true },
  f: { tex: 'field', safe: false, walk: true },
  ',': { tex: 'chalk', safe: false, walk: true },
  '.': { tex: 'weeds', safe: false, walk: true },
  B: {
    tex: 'grass',
    safe: false,
    walk: false,
    solid: { style: 'cottage', minHeight: 5.2, maxHeight: 5.2, inset: 0.3, depthInset: 0.3, chimneyChance: 0, split: false, wall: 'timber' },
  },
  T: {
    tex: 'grass',
    safe: false,
    walk: false,
    solid: { style: 'foliage', minHeight: 3.0, maxHeight: 4.4, inset: 0.8, depthInset: 0.8, chimneyChance: 0, split: true },
  },
};

const BOWL = `T${'#'.repeat(24)}T`;
const WEEDS = `T###..${'#'.repeat(14)}..###T`;
const LANE_EDGE = `T${'#'.repeat(11)},,${'#'.repeat(11)}T`;

/**
 * 26 wide by 26 deep.
 *
 * Column 0 opens at rows 12 and 13 and nowhere else. The hedge stubs inside — rows 9 and 16 —
 * are the only things in the bowl besides the barn, and they are there so that crossing it is
 * not quite a straight line.
 */
const GRID: readonly string[] = [
  'T'.repeat(26), //  0
  `T${'f'.repeat(24)}T`, //  1  the ploughed rim
  `Tff${'#'.repeat(20)}ffT`, //  2
  `Tf${'#'.repeat(22)}fT`, //  3
  BOWL, //  4
  WEEDS, //  5
  `T#####BBBB${'#'.repeat(15)}T`, //  6  THE BARN
  `T#####BBBB${'#'.repeat(15)}T`, //  7
  BOWL, //  8  the barn door
  `T###TT${'#'.repeat(12)}TT#####T`, //  9  a stub of hedge, left standing
  BOWL, // 10
  LANE_EDGE, // 11
  `${','.repeat(25)}T`, // 12  the lane, west to Millharrow
  `${','.repeat(25)}T`, // 13
  LANE_EDGE, // 14
  BOWL, // 15
  `T#####TT${'#'.repeat(10)}TT#####T`, // 16
  BOWL, // 17
  WEEDS, // 18
  BOWL, // 19
  BOWL, // 20
  `Tf${'#'.repeat(22)}fT`, // 21
  `Tff${'#'.repeat(20)}ffT`, // 22
  `T${'f'.repeat(24)}T`, // 23
  `T${'f'.repeat(24)}T`, // 24
  'T'.repeat(26), // 25
];

const HALF_X = (GRID[0]!.length * TILE) / 2;
const HALF_Z = (GRID.length * TILE) / 2;
const xOfCol = (col: number): number => col * TILE - HALF_X + TILE / 2;
const zOfRow = (row: number): number => row * TILE - HALF_Z + TILE / 2;

export const BRAYS_HOLLOW_ID = 'brays_hollow';

export const BRAYS_HOLLOW: AreaDef = defineArea({
  id: BRAYS_HOLLOW_ID,
  name: "Bray's Hollow",
  grid: GRID,
  legend: HOLLOW_LEGEND,
  /** On the lane, a little in from the west end. */
  spawn: { x: 0, z: 0 },
  safety: 'none',
  exits: [
    {
      to: 'millharrow',
      x: -HALF_X + 2,
      z: 0,
      label: 'West, back to Millharrow',
      arrive: { x: 42, z: -2 },
    },
    {
      // The barn. Where the herd is, and where the warrant came for it.
      to: 'brays_barn',
      x: xOfCol(7.5),
      z: zOfRow(7) + TILE / 2 + 1.4,
      label: 'Into the barn',
      door: { x: xOfCol(7.5), z: zOfRow(7) + TILE / 2 + 0.05, facesSouth: true, style: 'plank' },
      arrive: { x: 0, z: 14 },
    },
  ],
  props: {
    /** A bowl with hedges on the rim. The most alive place in the Ring, and the least worked. */
    sky: 'pollen',
    wildlife: [
      { kind: 'sheep', x: -14, z: -38, roam: 7, count: 4 },
      { kind: 'sheep', x: 10, z: 10, roam: 7, count: 4 },
      { kind: 'goat', x: -6, z: -38, roam: 8, count: 2 },
      { kind: 'goat', x: 22, z: -10, roam: 8, count: 2 },
      { kind: 'goat', x: -30, z: 26, roam: 8, count: 2 },
      { kind: 'hare', x: 2, z: -38, roam: 8 },
      { kind: 'hare', x: 30, z: 2, roam: 8 },
      { kind: 'fox', x: 10, z: -38, roam: 10 },
    ],
    /** Livestock, and the licences that cost more than the herd. Fences, a well, and fodder. */
    dressing: [
      { kind: 'waystone', x: 10, z: -18, text: 'BRAY — NO MARKET, NO INN' },
      { kind: 'pens', x: -34, z: -38, yaw: 0 },
      { kind: 'pens', x: -10, z: -30, yaw: 0 },
      { kind: 'pens', x: 14, z: -22, yaw: 0 },
      { kind: 'pens', x: -6, z: -10, yaw: 0 },
      { kind: 'pens', x: -18, z: 6, yaw: 0 },
      { kind: 'pens', x: 14, z: 10, yaw: 0 },
      { kind: 'pens', x: -14, z: 22, yaw: 0 },
      { kind: 'pens', x: 14, z: 30, yaw: 0 },
      { kind: 'fence', x: -30, z: -38, yaw: 0 },
      { kind: 'fence', x: -34, z: -26, yaw: 0 },
      { kind: 'fence', x: -2, z: -14, yaw: 0 },
      { kind: 'fence', x: -10, z: 6, yaw: 0 },
      { kind: 'fence', x: 10, z: 14, yaw: 0 },
      { kind: 'fence', x: 34, z: 26, yaw: 0 },
      { kind: 'haybale', x: -26, z: -38 },
      { kind: 'haybale', x: 26, z: -26 },
      { kind: 'haybale', x: 30, z: -10 },
      { kind: 'haybale', x: -14, z: 10 },
      { kind: 'haybale', x: -14, z: 26 },
      { kind: 'well', x: -22, z: -38 },
      { kind: 'well', x: -6, z: 10 },
      { kind: 'trough', x: -18, z: -38 },
      { kind: 'trough', x: 6, z: -14 },
      { kind: 'trough', x: 26, z: 10 },
      { kind: 'logpile', x: -34, z: -22 },
      { kind: 'cart', x: -6, z: -22 },
      { kind: 'wildflowers', x: -14, z: -38 },
      { kind: 'wildflowers', x: 26, z: -30 },
      { kind: 'wildflowers', x: -2, z: -18 },
      { kind: 'wildflowers', x: 18, z: -6 },
      { kind: 'wildflowers', x: 26, z: 6 },
      { kind: 'wildflowers', x: 22, z: 18 },
      { kind: 'wildflowers', x: 2, z: 30 },
      { kind: 'bramble', x: -10, z: -38 },
      { kind: 'bramble', x: 2, z: -30 },
      { kind: 'bramble', x: 30, z: -14 },
      { kind: 'bramble', x: -26, z: 18 },
      { kind: 'bramble', x: 30, z: 30 },
      { kind: 'bracken', x: -6, z: -38 },
      { kind: 'bracken', x: 30, z: -22 },
      { kind: 'bracken', x: 22, z: 6 },
      { kind: 'bracken', x: 2, z: 22 },
    ],
    /**
     * Three people out in the bowl, which is the right number for a place that is not a town.
     *
     * Out in the bowl rather than along the lane. Bray's Hollow is defined by having nothing
     * built in it, and a few figures standing in open grass says that better than a row of
     * them beside a road would. The herdsman is in the barn, with the herd.
     */
    npcs: [
      { id: 'brays_elder', x: -14, z: -10, art: 'elder', label: 'Talk to old Bray' },
      { id: 'brays_child', x: 14, z: 6, art: 'child_beggar', label: 'Talk to the child' },
      { id: 'brays_weaver', x: -10, z: -14, art: 'weaver', label: 'Talk to the weaver' },
    ],
    /** Two, on the lane. Somebody puts them out and it is not the Magistracy. */
    lamps: [
      { x: -26, z: 0 },
      { x: 18, z: 0 },
    ],
    crates: [{ x: 30, z: -2 }],
    /** In the bowl, where the hedges gave out and nobody replanted. */
    trees: [
      { x: -22, z: -30 },
      { x: 14, z: -30 },
      { x: -22, z: 26 },
      { x: 14, z: 26 },
      { x: 30, z: -18 },
      { x: -30, z: 18 },
    ],
    horizon: 'treeline',
  },
});
