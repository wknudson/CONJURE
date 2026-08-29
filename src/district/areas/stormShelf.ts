/**
 * The Storm Shelf — the ground the pylons stand on, and the ground they have been standing on
 * for long enough that it shows.
 *
 * Scorched rock in every direction, with the pylon footings set out across it in ranks. The
 * footings are the whole layout: tall, thin, regularly spaced, and repeated four times down the
 * map, so wherever you are you can see the pattern continuing past you in both directions.
 *
 * That repetition is the point and it is the only place in the world where a layout repeats on
 * purpose. Everywhere else the interest is in what is different about each part of the map; here
 * the interest is that nothing is, for as far as you can see, because somebody surveyed it that
 * way and then left.
 */

import { defineArea, type AreaDef, type TileDef } from '../map.js';

/**
 * The Shelf's legend.
 *
 *   b  scorched rock — the shelf
 *   #  scrub         — what grows back between strikes
 *   ,  chalk track   — the way west, off the shelf
 *   P  pylon footing — impassable, tall and very thin
 *   R  rock          — impassable, the boundary
 *
 * `P` has the largest inset of any solid in the game on both axes. A pylon leg is a mast, not a
 * building, and the footings have to read as something you can see *past* — the pattern only
 * works if you can see four ranks of them at once.
 */
const SHELF_LEGEND: Record<string, TileDef> = {
  b: { tex: 'blasted', safe: false, walk: true },
  '#': { tex: 'grass', safe: false, walk: true },
  ',': { tex: 'chalk', safe: false, walk: true },
  P: {
    tex: 'blasted',
    safe: false,
    walk: false,
    solid: { minHeight: 10.0, maxHeight: 12.5, inset: 1.55, depthInset: 1.55, chimneyChance: 0, split: false },
  },
  R: {
    tex: 'blasted',
    safe: false,
    walk: false,
    solid: { minHeight: 5.0, maxHeight: 8.0, inset: 0.15, depthInset: 0.15, chimneyChance: 0, split: false },
  },
};

/**
 * 26 wide by 24 deep.
 *
 * Column 0 opens at rows 10 and 11 — the track west, down to Fenwick's Crossing. The four ranks
 * of footings sit at rows 3, 7, 13, 17 and 21, spaced so that no two ranks line up with the
 * track.
 */
const GRID: readonly string[] = [
  'RRRRRRRRRRRRRRRRRRRRRRRRRR', //  0
  'RbbbbbbbbbbbbbbbbbbbbbbbbR', //  1
  'RbbbbbbbbbbbbbbbbbbbbbbbbR', //  2
  'RbbPbbbbbbPbbbbbbPbbbbbPbR', //  3  a rank of footings
  'RbbbbbbbbbbbbbbbbbbbbbbbbR', //  4
  'Rbbbb##bbbbbbbbbb##bbbbbbR', //  5
  'RbbbbbbbbbbbbbbbbbbbbbbbbR', //  6
  'RbbPbbbbbbPbbbbbbPbbbbbPbR', //  7
  'RbbbbbbbbbbbbbbbbbbbbbbbbR', //  8
  'RbbbbbbbbbbbbbbbbbbbbbbbbR', //  9
  ',,,,,,,,,,,,,,,,,,,,,,,,,R', // 10  the track west, to the Crossing
  ',,,,,,,,,,,,,,,,,,,,,,,,,R', // 11
  'RbbbbbbbbbbbbbbbbbbbbbbbbR', // 12
  'RbbPbbbbbbPbbbbbbPbbbbbPbR', // 13
  'RbbbbbbbbbbbbbbbbbbbbbbbbR', // 14
  'Rbbbb##bbbbbbbbbb##bbbbbbR', // 15
  'RbbbbbbbbbbbbbbbbbbbbbbbbR', // 16
  'RbbPbbbbbbPbbbbbbPbbbbbPbR', // 17
  'RbbbbbbbbbbbbbbbbbbbbbbbbR', // 18
  'Rbbbb##bbbbbbbbbb##bbbbbbR', // 19
  'RbbbbbbbbbbbbbbbbbbbbbbbbR', // 20
  'RbbPbbbbbbPbbbbbbPbbbbbPbR', // 21
  'RbbbbbbbbbbbbbbbbbbbbbbbbR', // 22
  'RRRRRRRRRRRRRRRRRRRRRRRRRR', // 23
];

export const STORM_SHELF_ID = 'storm_shelf';

export const STORM_SHELF: AreaDef = defineArea({
  id: STORM_SHELF_ID,
  name: 'The Storm Shelf',
  grid: GRID,
  legend: SHELF_LEGEND,
  /** On the track, between the second and third ranks. */
  spawn: { x: 0, z: -6 },
  safety: 'none',
  exits: [
    {
      to: 'fenwicks_crossing',
      x: -50,
      z: -6,
      label: "West, down off the shelf to Fenwick's Crossing",
      arrive: { x: 46, z: -2 },
    },
  ],
  props: {
    crates: [
      { x: 38, z: -6 },
      { x: -34, z: -6 },
    ],
    /** In the scrub patches, and nowhere near a footing. */
    trees: [
      { x: -34, z: -26 },
      { x: 14, z: -26 },
      { x: -34, z: 14 },
      { x: 14, z: 30 },
    ],
    horizon: 'none',
  },
});
