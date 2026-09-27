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

import { TILE, defineArea, type AreaDef, type TileDef } from '../map.js';

/**
 * The Shelf's legend.
 *
 *   b  scorched rock — the shelf
 *   #  scrub         — what grows back between strikes
 *   ,  chalk track   — the way west, off the shelf
 *   P  pylon footing — impassable, tall and very thin
 *   R  rock          — impassable, the boundary
 *   h  burnt heath — scrub far enough from a footing to have grown back
 *
 * `P` has the largest inset of any solid in the game on both axes. A pylon leg is a mast, not a
 * building, and the footings have to read as something you can see *past* — the pattern only
 * works if you can see four ranks of them at once.
 */
const SHELF_LEGEND: Record<string, TileDef> = {
  h: { tex: 'heath', safe: false, walk: true },
  b: { tex: 'blasted', safe: false, walk: true },
  '#': { tex: 'grass', safe: false, walk: true },
  ',': { tex: 'chalk', safe: false, walk: true },
  P: {
    tex: 'blasted',
    safe: false,
    walk: false,
    solid: { style: 'pylon', minHeight: 10.0, maxHeight: 12.5, inset: 1.55, depthInset: 1.55, chimneyChance: 0, split: false },
  },
  R: {
    tex: 'blasted',
    safe: false,
    walk: false,
    solid: { style: 'rock', minHeight: 5.0, maxHeight: 8.0, inset: 0.15, depthInset: 0.15, chimneyChance: 0, split: false },
  },
  /** The cave mouth: rock, taken whole, with a door in the south face of it. */
  K: {
    tex: 'blasted',
    safe: false,
    walk: false,
    solid: { style: 'rock', minHeight: 5.5, maxHeight: 5.5, inset: 0.3, depthInset: 0.3, chimneyChance: 0, split: false, wall: 'rock', bare: true },
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
  'RRRRRRRRRRRRRRRRRRRRRRRRRRRRRR', //  0
  'RhhhhhhhhhhhKKKKhhhhhhhhhhhhhR', //  1
  'RhhhhhhhhhhhKKKKhhhhhhhhhhhhhR', //  2
  'RhhhhhhhhhhhhbbbbhhhhhhhhhhhhR', //  3
  'RhhhbbbhhhhbbbbbbbbbbhhhbbbhhR', //  4
  'RhhhbPbhhhhbPbbbbbbPbhhhbPbhhR', //  5
  'RhhhbbbhhhbbbbbbbbbbbhhhbbbhhR', //  6
  'Rhhbbhh##bbbbbbbbbb##hhhhbbhhR', //  7
  'RhhbbbbbbbbbbbbbbbbbbbbbbbbhhR', //  8
  'RhhbbPbbbbbbPbbbbbbPbbbbbPbhhR', //  9
  'RhhbbbbbbbbbbbbbbbbbbbhhbbbhhR', // 10
  'RhhbhhhhhbbbbbbbbbbbbhhhhbbhhR', // 11
  ',hh,,,,,,,,,,,,,,,,,,,,,,,,hhR', // 12
  ',hh,,,,,,,,,,,,,,,,,,,,,,,,hhR', // 13
  'RhhhbbbhhhhbbbbbbhbbbhhhbbbhhR', // 14
  'RhhhbPbhhhhbPbbbhhbPbhhhbPbhhR', // 15
  'RhhhbbbhhhhbbbbbhhbbbhhhbbbhhR', // 16
  'Rhhhhhh##hhhhbbbbhh##hhhhhhhhR', // 17
  'RhhhbbbhhhhbbbbbbbbbbhhhbbbhhR', // 18
  'RhhhbPbhhhhbPbbbbbbPbhhhbPbhhR', // 19
  'RhhbbbbhhbbbbbbbbbbbbhhhbbbhhR', // 20
  'Rhhbbhh##bbbbbbbbbb##bhhhbbhhR', // 21
  'RhhbbbbbbbbbbbbbbbbbbbbbbbbhhR', // 22
  'RhhbbPbbbbbbPbbbbbbPbbbbbPbhhR', // 23
  'RhhbbbbhbbbbbbbbbbbbbbhhbbbhhR', // 24
  'RhhhhhhhhhhhhhhhhhhhhhhhhhhhhR', // 25
  'RhhhhhhhhhhhhhhhhhhhhhhhhhhhhR', // 26
  'RhhRRRRRRRRRRRRRRRRRRRRRRRRhhR', // 27
];

const HALF_X = (GRID[0]!.length * TILE) / 2;
const HALF_Z = (GRID.length * TILE) / 2;
const xOfCol = (col: number): number => col * TILE - HALF_X + TILE / 2;
const zOfRow = (row: number): number => row * TILE - HALF_Z + TILE / 2;

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
      // Pylon Nine's base, in the north face of the shelf. The iron the warnings are about goes down into it.
      to: 'storm_shelf_pylon_base',
      x: xOfCol(13.5),
      z: zOfRow(2) + TILE / 2 + 1.4,
      label: 'Into Pylon Nine\'s base',
      door: { x: xOfCol(13.5), z: zOfRow(2) + TILE / 2 + 0.05, facesSouth: true, style: 'cave' },
      arrive: { x: 0, z: 16 },
    },
    {
      to: 'fenwicks_crossing',
      x: -HALF_X + 2,
      z: -6,
      label: "West, down off the shelf to Fenwick's Crossing",
      arrive: { x: 46, z: -6 },
    },
  ],
  props: {
    /** Goats on the footings — the one animal that will stand where the sky comes down. */
    sky: 'drizzle',
    wildlife: [
      { kind: 'goat', x: -42, z: -42, roam: 9, count: 2 },
      { kind: 'goat', x: -14, z: -14, roam: 9, count: 2 },
      { kind: 'goat', x: 34, z: 14, roam: 9, count: 2 },
      { kind: 'hare', x: -26, z: -42, roam: 9 },
      { kind: 'hare', x: -14, z: 2, roam: 9 },
      { kind: 'rook', x: -50, z: -46, roam: 26, count: 3 },
    ],
    /** On the footings themselves. Whoever wrote this had been under one. */
    graffiti: [
      { text: 'DO NOT SHELTER UNDER IRON', wallX: 18, wallZ: 7.95, dx: -3.0, facesSouth: true, tint: '#b7ae9d' },
      { text: 'NINE WAS NOT AN ACCIDENT', wallX: -38, wallZ: -32.05, dx: 3.2, facesSouth: true, tint: '#a4543a' },
    ],
    /** Pylon country. Scorch where the sky has been down, and cairns where shepherds have been. */
    dressing: [
      { kind: 'scorch', x: -52, z: -48 },
      { kind: 'cairn', x: 52, z: -20 },
      { kind: 'spoilheap', x: -52, z: -16 },
      { kind: 'bracken', x: 52, z: 16 },
      { kind: 'scorch', x: -52, z: 28 },
      { kind: 'cairn', x: 52, z: 36 },
      { kind: 'scorch', x: 28, z: -48 },
      { kind: 'spoilheap', x: -28, z: 48 },
      { kind: 'cairn', x: 20, z: 48 },
      { kind: 'scorch', x: -46, z: -42 },
      { kind: 'scorch', x: -14, z: -38 },
      { kind: 'scorch', x: 34, z: -34 },
      { kind: 'scorch', x: -18, z: -26 },
      { kind: 'scorch', x: 22, z: -22 },
      { kind: 'scorch', x: -22, z: -14 },
      { kind: 'scorch', x: 26, z: -10 },
      { kind: 'scorch', x: -10, z: -2 },
      { kind: 'scorch', x: 30, z: 2 },
      { kind: 'scorch', x: -14, z: 10 },
      { kind: 'scorch', x: 26, z: 14 },
      { kind: 'scorch', x: -30, z: 22 },
      { kind: 'scorch', x: 18, z: 26 },
      { kind: 'scorch', x: -38, z: 34 },
      { kind: 'scorch', x: 6, z: 38 },
      { kind: 'cairn', x: -38, z: -42 },
      { kind: 'cairn', x: -34, z: -34 },
      { kind: 'cairn', x: -6, z: -26 },
      { kind: 'cairn', x: 6, z: -18 },
      { kind: 'cairn', x: 38, z: -10 },
      { kind: 'cairn', x: -22, z: 2 },
      { kind: 'cairn', x: 6, z: 10 },
      { kind: 'cairn', x: 10, z: 18 },
      { kind: 'cairn', x: 34, z: 26 },
      { kind: 'cairn', x: 38, z: 34 },
      { kind: 'spoilheap', x: -34, z: -42 },
      { kind: 'spoilheap', x: 22, z: -34 },
      { kind: 'spoilheap', x: -2, z: -22 },
      { kind: 'spoilheap', x: -26, z: -10 },
      { kind: 'spoilheap', x: -18, z: 2 },
      { kind: 'spoilheap', x: -42, z: 14 },
      { kind: 'spoilheap', x: 30, z: 22 },
      { kind: 'spoilheap', x: -6, z: 34 },
      { kind: 'waystone', x: -30, z: -42, text: 'PYLON IX — DO NOT SHELTER' },
      { kind: 'waystone', x: -6, z: -14, text: 'PYLON IX — DO NOT SHELTER' },
      { kind: 'waystone', x: -46, z: 18, text: 'PYLON IX — DO NOT SHELTER' },
      { kind: 'bracken', x: -42, z: -42 },
      { kind: 'bracken', x: 18, z: -30 },
      { kind: 'bracken', x: -14, z: -14 },
      { kind: 'bracken', x: -30, z: 2 },
      { kind: 'bracken', x: 34, z: 14 },
      { kind: 'bracken', x: -6, z: 30 },
      { kind: 'bramble', x: -26, z: -42 },
      { kind: 'bramble', x: -10, z: -14 },
      { kind: 'bramble', x: 38, z: 14 },
    ],
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
