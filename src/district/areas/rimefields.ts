/**
 * The Rimefields — the west end of the Chalk Road, and what the road stops at.
 *
 * Old snow with the wind still working on it, swept down to bare ice in long bands where it
 * crosses open ground. The ice sheets and the pressure ridges run east to west, across the way
 * you are travelling, so the field is a sequence of things to get over rather than a space to
 * cross — the same argument the Tallow Levels makes with water, made with cold.
 *
 * It is the only place where the ground you would call the *background* is brighter than the
 * ground you would call the *feature*: the snow is pale and the ice sheets are dark, because ice
 * is transparent and what you see through it is not white.
 */

import { TILE, defineArea, type AreaDef, type TileDef } from '../map.js';

/**
 * The field's legend.
 *
 *   n  packed snow  — most of it
 *   i  glare ice    — swept bare, and darker than the snow around it
 *   #  frozen scrub — the only living thing
 *   ,  chalk road   — the road east, running out into the snow
 *   I  pressure ridge — impassable, low and broad
 *   R  rock         — impassable, the boundary
 *   d  drift       — where the wind put the snow down rather than scouring it
 *
 * `I` is the widest low solid in the game: almost no inset, so a ridge is a continuous barrier
 * you walk the end of rather than a row of blocks you walk between.
 */
const RIME_LEGEND: Record<string, TileDef> = {
  d: { tex: 'drift', safe: false, walk: true },
  n: { tex: 'snow', safe: false, walk: true },
  i: { tex: 'ice', safe: false, walk: true },
  '#': { tex: 'grass', safe: false, walk: true },
  ',': { tex: 'chalk', safe: false, walk: true },
  I: {
    tex: 'ice',
    safe: false,
    walk: false,
    solid: { style: 'ice', minHeight: 1.8, maxHeight: 2.8, inset: 0.05, depthInset: 0.6, chimneyChance: 0, split: false },
  },
  R: {
    tex: 'snow',
    safe: false,
    walk: false,
    solid: { style: 'rock', minHeight: 7.0, maxHeight: 11.0, inset: 0.1, depthInset: 0.1, chimneyChance: 0, split: false },
  },
  /** The cave mouth: rock, taken whole, with a door in the south face of it. */
  K: {
    tex: 'snow',
    safe: false,
    walk: false,
    solid: { style: 'rock', minHeight: 5.5, maxHeight: 5.5, inset: 0.3, depthInset: 0.3, chimneyChance: 0, split: false, wall: 'rock', bare: true },
  },
};

/**
 * 32 wide by 22 deep — the same width as the Chalk Road it continues.
 *
 * Column 31 opens at rows 10 and 11, which is the road itself arriving. The ridges above and
 * below it are offset from each other so that leaving the road in either direction means going
 * round something.
 */
const GRID: readonly string[] = [
  'RRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRR', //  0
  'RddddddddKKKdddddddddddddddddddddddR', //  1
  'RddddddddKKKdddddddddddddddddddddddR', //  2
  'RddddddddddddddddddddddddddddddddddR', //  3
  'RddddddIIIIddddddddddIIIIddddddddddR', //  4
  'RddddddIIIIddnndddnddIIIIdddnnnddddR', //  5
  'RddddddddddddnnnnnnddddddddnnnnddddR', //  6
  'RddddiiiiiiddnnnnnnddddiiiiiinnddddR', //  7
  'RddddiiiiiiddddddddnnddiiiiiiddddddR', //  8
  'RddddnnnnddddddddddnnddddddddddddddR', //  9
  'RddddnnnnddIIIIIIddnnddIIIIIIddddddR', // 10
  'RddddnnnnddddddddddnnddddddddddddddR', // 11
  'Rdd,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,dd,', // 12
  'Rdd,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,dd,', // 13
  'RddddnnnnddddddddddnnddddddddddddddR', // 14
  'RddddnnnnddIIIIIIddnnddIIIIIIddddddR', // 15
  'RddddnnnnddddddddddnnddddddddddddddR', // 16
  'RddddiiiiiiddddddddnnddiiiiiiddddddR', // 17
  'RddddiiiiiinnnnnnnnnnnniiiiiinnddddR', // 18
  'RddddddddddddnnnnnnddddddddnnnnddddR', // 19
  'Rdddddd##ddddnnndnndddd##ddnnddddddR', // 20
  'RddddddIIIIddddddddddIIIIddddddddddR', // 21
  'RddddddddddddddddddddddddddddddddddR', // 22
  'RddddddddddddddddddddddddddddddddddR', // 23
  'RddddddddddddddddddddddddddddddddddR', // 24
  'RddRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRddR', // 25
];

const HALF_X = (GRID[0]!.length * TILE) / 2;
const HALF_Z = (GRID.length * TILE) / 2;
const xOfCol = (col: number): number => col * TILE - HALF_X + TILE / 2;
const zOfRow = (row: number): number => row * TILE - HALF_Z + TILE / 2;

export const RIMEFIELDS_ID = 'rimefields';

export const RIMEFIELDS: AreaDef = defineArea({
  id: RIMEFIELDS_ID,
  name: 'The Rimefields',
  grid: GRID,
  legend: RIME_LEGEND,
  /** On the road, in the middle of the field. */
  spawn: { x: 0, z: -2 },
  safety: 'none',
  exits: [
    {
      // The ice cave, cut into the north face. The only shelter past the stones that say there is none.
      to: 'rimefields_ice_cave',
      x: xOfCol(10),
      z: zOfRow(2) + TILE / 2 + 1.4,
      label: 'Into the ice cave',
      door: { x: xOfCol(10), z: zOfRow(2) + TILE / 2 + 0.05, facesSouth: true, style: 'cave' },
      arrive: { x: 0, z: 16 },
    },
    {
      to: 'chalk_road',
      x: HALF_X - 2,
      z: -2,
      label: 'East, back down the Chalk Road',
      arrive: { x: -62, z: 2 },
    },
  ],
  props: {
    /** Hares that break at fifty yards, and wolves that do not break at all. */
    sky: 'snow',
    wildlife: [
      { kind: 'hare', x: -46, z: -38, roam: 10 },
      { kind: 'hare', x: -46, z: -18, roam: 10 },
      { kind: 'hare', x: -22, z: 2, roam: 10 },
      { kind: 'hare', x: -26, z: 22, roam: 10 },
      { kind: 'wolf', x: -38, z: -38, roam: 14, count: 2 },
      { kind: 'wolf', x: 22, z: -14, roam: 14, count: 2 },
      { kind: 'wolf', x: 38, z: 14, roam: 14, count: 2 },
      { kind: 'rook', x: -62, z: -42, roam: 26, count: 3 },
    ],
    /** Two crates on a snowfield was the whole area. Cairns are what people leave on ice. */
    dressing: [
      { kind: 'cairn', x: -64, z: -44 },
      { kind: 'spoilheap', x: 64, z: -16 },
      { kind: 'cairn', x: -64, z: 8 },
      { kind: 'bramble', x: 64, z: 20 },
      { kind: 'spoilheap', x: -64, z: 32 },
      { kind: 'cairn', x: 64, z: -32 },
      { kind: 'cairn', x: 20, z: -44 },
      { kind: 'spoilheap', x: -20, z: 44 },
      { kind: 'cairn', x: 40, z: 44 },
      { kind: 'cairn', x: -58, z: -38 },
      { kind: 'cairn', x: 50, z: -38 },
      { kind: 'cairn', x: -50, z: -30 },
      { kind: 'cairn', x: -30, z: -26 },
      { kind: 'cairn', x: -42, z: -22 },
      { kind: 'cairn', x: -54, z: -18 },
      { kind: 'cairn', x: 54, z: -18 },
      { kind: 'cairn', x: 42, z: -14 },
      { kind: 'cairn', x: -42, z: -6 },
      { kind: 'cairn', x: -38, z: -2 },
      { kind: 'cairn', x: -34, z: 2 },
      { kind: 'cairn', x: -34, z: 6 },
      { kind: 'cairn', x: -46, z: 10 },
      { kind: 'cairn', x: -10, z: 14 },
      { kind: 'cairn', x: -22, z: 18 },
      { kind: 'cairn', x: -34, z: 22 },
      { kind: 'cairn', x: -46, z: 26 },
      { kind: 'cairn', x: -58, z: 30 },
      { kind: 'cairn', x: 50, z: 30 },
      { kind: 'cairn', x: -50, z: 38 },
      { kind: 'waystone', x: -54, z: -38, text: 'THE ROAD — EAST' },
      { kind: 'waystone', x: -46, z: -30, text: 'NO SHELTER PAST HERE' },
      { kind: 'waystone', x: -38, z: -22, text: 'COUNT YOUR PARTY' },
      { kind: 'waystone', x: 58, z: -18, text: 'THE ROAD — EAST' },
      { kind: 'waystone', x: -38, z: -6, text: 'NO SHELTER PAST HERE' },
      { kind: 'waystone', x: -30, z: 2, text: 'COUNT YOUR PARTY' },
      { kind: 'waystone', x: -42, z: 10, text: 'THE ROAD — EAST' },
      { kind: 'waystone', x: -18, z: 18, text: 'NO SHELTER PAST HERE' },
      { kind: 'waystone', x: -42, z: 26, text: 'COUNT YOUR PARTY' },
      { kind: 'waystone', x: 54, z: 30, text: 'THE ROAD — EAST' },
      { kind: 'spoilheap', x: -50, z: -38 },
      { kind: 'spoilheap', x: -26, z: -30 },
      { kind: 'spoilheap', x: -34, z: -22 },
      { kind: 'spoilheap', x: -58, z: -14 },
      { kind: 'spoilheap', x: -34, z: -6 },
      { kind: 'spoilheap', x: -26, z: 2 },
      { kind: 'spoilheap', x: -38, z: 10 },
      { kind: 'spoilheap', x: -14, z: 18 },
      { kind: 'spoilheap', x: -38, z: 26 },
      { kind: 'spoilheap', x: 58, z: 30 },
      { kind: 'bracken', x: -46, z: -38 },
      { kind: 'bracken', x: -46, z: -18 },
      { kind: 'bracken', x: -22, z: 2 },
      { kind: 'bracken', x: -26, z: 22 },
      { kind: 'bramble', x: -42, z: -38 },
      { kind: 'bramble', x: 54, z: 2 },
    ],
    // No lamps and no trees. There is nothing out here to hang one on or for one to be.
    crates: [
      { x: 46, z: -2 },
      { x: -50, z: -2 },
    ],
    /**
     * No horizon silhouette.
     *
     * The rock is eleven units tall and closes the view on its own, and the alternatives on
     * offer are a city skyline and a treeline — neither of which belongs at the top of a
     * snowfield. Better to draw nothing than to draw the wrong distance.
     */
    horizon: 'none',
  },
});
