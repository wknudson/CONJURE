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
 *   l  leaf litter — the floor under the canopy; bare ground is the clearings
 *
 * `T` is tall and split. Split matters here more than anywhere: a run of unsplit timber would be
 * a fence, and the whole point of a wood is that the trunks are at different heights and do not
 * line up.
 */
const WOOD_LEGEND: Record<string, TileDef> = {
  l: { tex: 'litter', safe: false, walk: true },
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
  'TllllllllllllllllllllllllllllT', //  1
  'TlwTTwwwwwwwlTTwwwwwwwlTTwwwlT', //  2
  'Tllwwwwww####wllwwwww####wwwlT', //  3  clearings
  'Tlwwwwwww####wwwwwwww####wwwlT', //  4
  'TlwlwwlwlwwwwwlllwwwllwlwwlllT', //  5
  'TTTlwwlTTwwwwwwTTwwwlTTlwwlTTT', //  6
  'TlwwwwwllwwwwwwlwlwwwwllwwwllT', //  7
  'Tlw####wwwwwwwwww####wwwwwwwlT', //  8
  'Tlw####wwwwwwwwww####wwwwwwwlT', //  9
  'TllwllwwwlwwwwwwwwllwwwwllwllT', // 10
  'TlwTTlwwwTTlwwwwwwwTTlwwlTTwlT', // 11
  'TlllllwwwllwwwwwwwllwlwwlllllT', // 12
  'Tlw..wwwwwwww..wwwwwwww..wwwlT', // 13
  'TllwwwllwlwwwwlllwwwwwlwwwlwlT', // 14
  'TTTlwwlTTlwwwwlTTlwwwTTwwwlTTT', // 15
  'TlwwwwllwwwwwwllwwwwwlllwwlllT', // 16
  'Tlw####wwwwwwwwww####wwwwwwwlT', // 17
  'Tlw####wwwwwwwwww####wwwwwwwlT', // 18
  'TlwwwlwwwwwwlwllwwwwwwllwwwwlT', // 19
  'TllTTwwwwwwwlTTlwwwwwwlTTwwwlT', // 20
  'TlwlwlwwwwwwwlwwwwwwwwwwllwwlT', // 21
  'Tlwwwwwwwwwww,,wwwwwwwwwwwwwlT', // 22  the ride
  'Tlwwwwwwwwwww,,wwwwwwwwwwwwwlT', // 23
  'Tllllllllllll,,llllllllllllllT', // 24
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
    /** The largest map and the most alive. Deer in the clearings, wolves between them. */
    sky: 'leaves',
    wildlife: [
      { kind: 'deer', x: -42, z: -46, roam: 10, count: 2 },
      { kind: 'deer', x: -42, z: -14, roam: 10, count: 2 },
      { kind: 'deer', x: -26, z: 18, roam: 10, count: 2 },
      { kind: 'hare', x: -34, z: -46, roam: 8 },
      { kind: 'hare', x: 54, z: -18, roam: 8 },
      { kind: 'hare', x: -14, z: 18, roam: 8 },
      { kind: 'fox', x: -26, z: -46, roam: 10 },
      { kind: 'fox', x: -30, z: 2, roam: 10 },
      { kind: 'wolf', x: -18, z: -46, roam: 12, count: 2 },
      { kind: 'wolf', x: -18, z: 2, roam: 12, count: 2 },
      { kind: 'rook', x: -58, z: -50, roam: 26, count: 4 },
      { kind: 'rook', x: 14, z: 2, roam: 26, count: 4 },
    ],
    /** Deep timber. Cut wood, and the marks left by whoever cut it. */
    dressing: [
      { kind: 'waystone', x: -18, z: 18, text: 'THE RIDE — KEEP TO IT' },
      { kind: 'logpile', x: -54, z: -46 },
      { kind: 'logpile', x: -10, z: -42 },
      { kind: 'logpile', x: 42, z: -38 },
      { kind: 'logpile', x: -38, z: -30 },
      { kind: 'logpile', x: 18, z: -26 },
      { kind: 'logpile', x: -46, z: -18 },
      { kind: 'logpile', x: -2, z: -14 },
      { kind: 'logpile', x: 34, z: -10 },
      { kind: 'logpile', x: -14, z: -2 },
      { kind: 'logpile', x: 34, z: 2 },
      { kind: 'logpile', x: -34, z: 10 },
      { kind: 'logpile', x: 30, z: 14 },
      { kind: 'logpile', x: -42, z: 22 },
      { kind: 'logpile', x: -6, z: 26 },
      { kind: 'logpile', x: 50, z: 30 },
      { kind: 'logpile', x: -26, z: 38 },
      { kind: 'logpile', x: 10, z: 42 },
      { kind: 'cairn', x: -50, z: -46 },
      { kind: 'cairn', x: -2, z: -38 },
      { kind: 'cairn', x: 22, z: -30 },
      { kind: 'cairn', x: -22, z: -18 },
      { kind: 'cairn', x: 6, z: -10 },
      { kind: 'cairn', x: -42, z: 2 },
      { kind: 'cairn', x: 14, z: 10 },
      { kind: 'cairn', x: 50, z: 18 },
      { kind: 'cairn', x: -22, z: 30 },
      { kind: 'cairn', x: 22, z: 38 },
      { kind: 'scorch', x: -46, z: -46 },
      { kind: 'scorch', x: 2, z: -38 },
      { kind: 'scorch', x: 26, z: -30 },
      { kind: 'scorch', x: -18, z: -18 },
      { kind: 'scorch', x: 10, z: -10 },
      { kind: 'scorch', x: -38, z: 2 },
      { kind: 'scorch', x: 18, z: 10 },
      { kind: 'scorch', x: 54, z: 18 },
      { kind: 'scorch', x: -18, z: 30 },
      { kind: 'scorch', x: 26, z: 38 },
      { kind: 'fence', x: -38, z: -46, yaw: 0 },
      { kind: 'fence', x: -6, z: -34, yaw: 0 },
      { kind: 'fence', x: 46, z: -22, yaw: 0 },
      { kind: 'fence', x: -14, z: -6, yaw: 0 },
      { kind: 'fence', x: 38, z: 6, yaw: 0 },
      { kind: 'fence', x: -10, z: 22, yaw: 0 },
      { kind: 'fence', x: 38, z: 34, yaw: 0 },
      { kind: 'bracken', x: -42, z: -46 },
      { kind: 'bracken', x: 34, z: -38 },
      { kind: 'bracken', x: -14, z: -26 },
      { kind: 'bracken', x: -42, z: -14 },
      { kind: 'bracken', x: 34, z: -6 },
      { kind: 'bracken', x: -10, z: 6 },
      { kind: 'bracken', x: -26, z: 18 },
      { kind: 'bracken', x: 34, z: 26 },
      { kind: 'bracken', x: -2, z: 38 },
      { kind: 'mushrooms', x: -34, z: -46 },
      { kind: 'mushrooms', x: 6, z: -34 },
      { kind: 'mushrooms', x: 54, z: -22 },
      { kind: 'mushrooms', x: -10, z: -6 },
      { kind: 'mushrooms', x: 34, z: 6 },
      { kind: 'mushrooms', x: -6, z: 22 },
      { kind: 'mushrooms', x: 30, z: 34 },
      { kind: 'deadfall', x: -30, z: -46 },
      { kind: 'deadfall', x: -50, z: -30 },
      { kind: 'deadfall', x: -38, z: -14 },
      { kind: 'deadfall', x: -30, z: 2 },
      { kind: 'deadfall', x: -22, z: 18 },
      { kind: 'deadfall', x: -26, z: 34 },
      { kind: 'bramble', x: -26, z: -46 },
      { kind: 'bramble', x: 38, z: -30 },
      { kind: 'bramble', x: 18, z: -10 },
      { kind: 'bramble', x: 38, z: 10 },
      { kind: 'bramble', x: 2, z: 30 },
    ],
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
