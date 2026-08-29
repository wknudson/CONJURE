/**
 * The Ashwood — deep timber, and the largest area in the world.
 *
 * Thirty columns by twenty-six rows of standing wood with clearings cut into it. The clearings
 * are the layout: they are what you navigate between, and the trunks between them are close
 * enough together that you are usually in one or heading for the next.
 *
 * It reads as the opposite of the Caldera, which is one open floor inside a wall. Here the
 * boundary and the obstacles are the same timber, so the wood has no visible edge — you find out
 * where it ends by running out of clearings. That is deliberately the same trick Weeping Stile
 * plays at a fifth of the size, because this is what that hollow is a corner of.
 */

import { defineArea, type AreaDef, type TileDef } from '../map.js';

/**
 * The wood's legend.
 *
 *   w  leaf litter  — the floor, under the canopy
 *   #  clearing     — grass, where light gets down
 *   .  weeds        — the edges of a clearing going over
 *   ,  chalk track  — the ride south, out to the Levels
 *   T  timber       — impassable
 *
 * `T` is tall and split. Split matters here more than anywhere: a run of unsplit timber would be
 * a fence, and the whole point of a wood is that the trunks are at different heights and do not
 * line up.
 */
const WOOD_LEGEND: Record<string, TileDef> = {
  w: { tex: 'forest', safe: false, walk: true },
  '#': { tex: 'grass', safe: false, walk: true },
  '.': { tex: 'weeds', safe: false, walk: true },
  ',': { tex: 'chalk', safe: false, walk: true },
  T: {
    tex: 'forest',
    safe: false,
    walk: false,
    solid: { minHeight: 6.0, maxHeight: 9.5, inset: 1.0, depthInset: 1.0, chimneyChance: 0, split: true },
  },
};

/**
 * 30 wide by 26 deep.
 *
 * The ride out is the two-column chalk track at rows 22 to 25, and it is the only made ground in
 * the wood. Everything else is timber and what grows under it.
 */
const GRID: readonly string[] = [
  'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTT', //  0
  'TwwwwwwwwwwwwwwwwwwwwwwwwwwwwT', //  1
  'TwwTTwwwwwwwwTTwwwwwwwwTTwwwwT', //  2
  'Twwwwwwww####wwwwwwww####wwwwT', //  3  clearings
  'Twwwwwwww####wwwwwwww####wwwwT', //  4
  'TwwwwwwwwwwwwwwwwwwwwwwwwwwwwT', //  5
  'TTTwwwwTTwwwwwwTTwwwwTTwwwwTTT', //  6
  'TwwwwwwwwwwwwwwwwwwwwwwwwwwwwT', //  7
  'Tww####wwwwwwwwww####wwwwwwwwT', //  8
  'Tww####wwwwwwwwww####wwwwwwwwT', //  9
  'TwwwwwwwwwwwwwwwwwwwwwwwwwwwwT', // 10
  'TwwTTwwwwTTwwwwwwwwTTwwwwTTwwT', // 11
  'TwwwwwwwwwwwwwwwwwwwwwwwwwwwwT', // 12
  'Tww..wwwwwwww..wwwwwwww..wwwwT', // 13
  'TwwwwwwwwwwwwwwwwwwwwwwwwwwwwT', // 14
  'TTTwwwwTTwwwwwwTTwwwwTTwwwwTTT', // 15
  'TwwwwwwwwwwwwwwwwwwwwwwwwwwwwT', // 16
  'Tww####wwwwwwwwww####wwwwwwwwT', // 17
  'Tww####wwwwwwwwww####wwwwwwwwT', // 18
  'TwwwwwwwwwwwwwwwwwwwwwwwwwwwwT', // 19
  'TwwTTwwwwwwwwTTwwwwwwwwTTwwwwT', // 20
  'TwwwwwwwwwwwwwwwwwwwwwwwwwwwwT', // 21
  'Twwwwwwwwwwww,,wwwwwwwwwwwwwwT', // 22  the ride
  'Twwwwwwwwwwww,,wwwwwwwwwwwwwwT', // 23
  'Twwwwwwwwwwww,,wwwwwwwwwwwwwwT', // 24
  'TTTTTTTTTTTTT,,TTTTTTTTTTTTTTT', // 25  south, down to the Tallow Levels
];

export const ASHWOOD_ID = 'ashwood';

export const ASHWOOD: AreaDef = defineArea({
  id: ASHWOOD_ID,
  name: 'The Ashwood',
  grid: GRID,
  legend: WOOD_LEGEND,
  /** In a clearing near the middle, which is the only sort of place you can stand and see. */
  spawn: { x: 0, z: 0 },
  safety: 'none',
  exits: [
    {
      to: 'tallow_levels',
      x: -6,
      z: 50,
      label: 'South, down the ride to the Tallow Levels',
      arrive: { x: -26, z: -34 },
    },
  ],
  props: {
    // No lamps. Nothing has ever lit a wood.
    crates: [
      { x: -6, z: 42 },
      { x: -38, z: -18 },
    ],
    /**
     * Standing timber, in the clearings.
     *
     * The `T` tiles are the wood itself; these are the individual trees left inside the open
     * ground, which is what makes a clearing read as a clearing rather than as a room.
     */
    trees: [
      { x: -46, z: -14 },
      { x: 6, z: -14 },
      { x: -46, z: 22 },
      { x: 6, z: 22 },
      { x: -22, z: -42 },
      { x: 26, z: -42 },
      { x: -22, z: 34 },
      { x: 26, z: 6 },
    ],
    horizon: 'treeline',
  },
});
