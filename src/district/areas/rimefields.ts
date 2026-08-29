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

import { defineArea, type AreaDef, type TileDef } from '../map.js';

/**
 * The field's legend.
 *
 *   n  packed snow  — most of it
 *   i  glare ice    — swept bare, and darker than the snow around it
 *   #  frozen scrub — the only living thing
 *   ,  chalk road   — the road east, running out into the snow
 *   I  pressure ridge — impassable, low and broad
 *   R  rock         — impassable, the boundary
 *
 * `I` is the widest low solid in the game: almost no inset, so a ridge is a continuous barrier
 * you walk the end of rather than a row of blocks you walk between.
 */
const RIME_LEGEND: Record<string, TileDef> = {
  n: { tex: 'snow', safe: false, walk: true },
  i: { tex: 'ice', safe: false, walk: true },
  '#': { tex: 'grass', safe: false, walk: true },
  ',': { tex: 'chalk', safe: false, walk: true },
  I: {
    tex: 'ice',
    safe: false,
    walk: false,
    solid: { minHeight: 1.8, maxHeight: 2.8, inset: 0.05, depthInset: 0.6, chimneyChance: 0, split: false },
  },
  R: {
    tex: 'snow',
    safe: false,
    walk: false,
    solid: { minHeight: 7.0, maxHeight: 11.0, inset: 0.1, depthInset: 0.1, chimneyChance: 0, split: false },
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
  'RRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRR', //  0
  'RnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnR', //  1
  'RnnnnIIIInnnnnnnnnnIIIInnnnnnnnR', //  2  pressure ridges
  'RnnnnIIIInnnnnnnnnnIIIInnnnnnnnR', //  3
  'RnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnR', //  4
  'RnniiiiiinnnnnnnnnnnniiiiiinnnnR', //  5  swept to the ice
  'RnniiiiiinnnnnnnnnnnniiiiiinnnnR', //  6
  'RnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnR', //  7
  'RnnnnnnnnIIIIIInnnnnnIIIIIInnnnR', //  8
  'RnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnR', //  9
  'R,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,', // 10  the road, east to the Chalk Road
  'R,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,', // 11
  'RnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnR', // 12
  'RnnnnnnnnIIIIIInnnnnnIIIIIInnnnR', // 13
  'RnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnR', // 14
  'RnniiiiiinnnnnnnnnnnniiiiiinnnnR', // 15
  'RnniiiiiinnnnnnnnnnnniiiiiinnnnR', // 16
  'RnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnR', // 17
  'Rnnnn##nnnnnnnnnnnnnn##nnnnnnnnR', // 18
  'RnnnnIIIInnnnnnnnnnIIIInnnnnnnnR', // 19
  'RnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnR', // 20
  'RRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRR', // 21
];

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
      to: 'chalk_road',
      x: 62,
      z: -2,
      label: 'East, back down the Chalk Road',
      arrive: { x: -54, z: 2 },
    },
  ],
  props: {
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
