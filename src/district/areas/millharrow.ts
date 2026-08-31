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
 */

import { defineArea, type AreaDef, type TileDef } from '../map.js';

/**
 * The town's legend.
 *
 *   ,  chalk street  — the crossroads themselves, and the four roads out
 *   c  cobbles       — the yards and frontages either side
 *   f  ploughed strip
 *   #  grass
 *   .  weeds
 *   B  town building — impassable
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
  B: {
    tex: 'cobble',
    safe: false,
    walk: false,
    solid: { minHeight: 3.6, maxHeight: 5.2, inset: 0.35, depthInset: 0.35, chimneyChance: 0.5, split: true },
  },
  T: {
    tex: 'grass',
    safe: false,
    walk: false,
    solid: { minHeight: 3.4, maxHeight: 4.6, inset: 0.7, depthInset: 0.7, chimneyChance: 0, split: true },
  },
};

/**
 * 26 wide by 24 deep.
 *
 * The four gaps in the hedge are the four roads: north to the Tallow Levels, south to the
 * Chalk Road, west to Saltglass, east to Bray's Hollow. Everything else is enclosed, so the
 * only decisions the town offers are which of the four you take.
 */
const GRID: readonly string[] = [
  'TTTTTTTTTTTT,,TTTTTTTTTTTT', //  0  north, to the Levels
  'T##ffffffff,,,,ffffffff##T', //  1
  'T##ffffffff,,,,ffffffff##T', //  2
  'T##ffffffff,,,,ffffffff##T', //  3
  'T#....####,,,,,,####....#T', //  4
  'Tccccccccc,,,,,,cccccccccT', //  5
  'TcBBBBBBcc,,,,,,ccBBBBBBcT', //  6  the north frontages
  'TcBBBBBBcc,,,,,,ccBBBBBBcT', //  7
  'Tcccccccc,,,,,,,,ccccccccT', //  8
  'TcBBBBBcc,,,,,,,,ccBBBBBcT', //  9
  'TcBBBBBcc,,,,,,,,ccBBBBBcT', // 10
  ',,,,,,,,,,,,,,,,,,,,,,,,,,', // 11  THE CROSS — west to Saltglass, east to Bray's Hollow
  ',,,,,,,,,,,,,,,,,,,,,,,,,,', // 12
  'TcBBBBBcc,,,,,,,,ccBBBBBcT', // 13
  'TcBBBBBcc,,,,,,,,ccBBBBBcT', // 14
  'Tcccccccc,,,,,,,,ccccccccT', // 15
  'TcBBBBBBcc,,,,,,ccBBBBBBcT', // 16  the south frontages
  'TcBBBBBBcc,,,,,,ccBBBBBBcT', // 17
  'Tccccccccc,,,,,,cccccccccT', // 18
  'T#....####,,,,,,####....#T', // 19
  'T##ffffffff,,,,ffffffff##T', // 20
  'T##ffffffff,,,,ffffffff##T', // 21
  'T##ffffffff,,,,ffffffff##T', // 22
  'TTTTTTTTTTTT,,TTTTTTTTTTTT', // 23  south, to the Chalk Road
];

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
      z: 46,
      label: 'South, down onto the Chalk Road',
      arrive: { x: -34, z: -14 },
    },
    {
      to: 'tallow_levels',
      x: -2,
      z: -46,
      label: 'North, out onto the Tallow Levels',
      arrive: { x: -2, z: 30 },
    },
    {
      to: 'saltglass',
      x: -50,
      z: -2,
      label: 'West, to Saltglass',
      arrive: { x: 38, z: 2 },
    },
    {
      to: 'brays_hollow',
      x: 50,
      z: -2,
      label: "East, into Bray's Hollow",
      arrive: { x: -30, z: -2 },
    },
  ],
  props: {
    /** A crossroads town in worked country. Stock in the fields, rats at the mill. */
    sky: 'pollen',
    wildlife: [
      { kind: 'sheep', x: -18, z: -42, roam: 7, count: 4 },
      { kind: 'sheep', x: -38, z: -14, roam: 7, count: 4 },
      { kind: 'sheep', x: 2, z: 18, roam: 7, count: 4 },
      { kind: 'goat', x: -10, z: -42, roam: 7, count: 2 },
      { kind: 'goat', x: -14, z: 2, roam: 7, count: 2 },
      { kind: 'rat', x: 6, z: -42, roam: 5, count: 2 },
      { kind: 'rat', x: -6, z: 2, roam: 5, count: 2 },
      { kind: 'rook', x: -50, z: -46, roam: 22, count: 4 },
    ],
    /**
     * The crossroads has opinions about the toll.
     *
     * On the west range, where the road into town runs past it — the graffiti in this game is
     * always on the wall of whatever the line is complaining about.
     */
    graffiti: [
      { text: 'THE TOLL IS NOT THE KINGS', wallX: -42, wallZ: -16.05, dx: 3.0, facesSouth: true, tint: '#a46a4a' },
      { text: 'WEIGH IT AT THE MILL', wallX: -42, wallZ: 11.95, dx: -3.2, facesSouth: true, tint: '#b7ae9d' },
    ],
    /** Mill town at the crossroads: grain in, beer out, and a toll on the best road. */
    dressing: [
      { kind: 'sacks', x: -46, z: -42 },
      { kind: 'sacks', x: -38, z: -34 },
      { kind: 'sacks', x: -46, z: -26 },
      { kind: 'sacks', x: 18, z: -18 },
      { kind: 'sacks', x: 14, z: -6 },
      { kind: 'sacks', x: -2, z: 6 },
      { kind: 'sacks', x: -18, z: 18 },
      { kind: 'sacks', x: 46, z: 26 },
      { kind: 'sacks', x: 38, z: 34 },
      { kind: 'haybale', x: -38, z: -42 },
      { kind: 'haybale', x: 18, z: -34 },
      { kind: 'haybale', x: -10, z: -22 },
      { kind: 'haybale', x: -10, z: -6 },
      { kind: 'haybale', x: 46, z: 6 },
      { kind: 'haybale', x: 14, z: 22 },
      { kind: 'haybale', x: -18, z: 34 },
      { kind: 'cart', x: -34, z: -42 },
      { kind: 'cart', x: 18, z: -30 },
      { kind: 'cart', x: -10, z: -10 },
      { kind: 'cart', x: 18, z: 10 },
      { kind: 'cart', x: -10, z: 30 },
      { kind: 'fence', x: -30, z: -42, yaw: 0 },
      { kind: 'fence', x: -30, z: -34, yaw: 0 },
      { kind: 'fence', x: -34, z: -26, yaw: 0 },
      { kind: 'fence', x: -46, z: -14, yaw: 0 },
      { kind: 'fence', x: -42, z: -2, yaw: 0 },
      { kind: 'fence', x: 2, z: 6, yaw: 0 },
      { kind: 'fence', x: -10, z: 18, yaw: 0 },
      { kind: 'fence', x: -46, z: 30, yaw: 0 },
      { kind: 'fence', x: 46, z: 34, yaw: 0 },
      { kind: 'waystone', x: -26, z: -42, text: 'BY ORDER — TOLL PAYABLE' },
      { kind: 'waystone', x: -26, z: 2, text: 'BY ORDER — TOLL PAYABLE' },
      { kind: 'well', x: -22, z: -42 },
      { kind: 'well', x: -22, z: 2 },
      { kind: 'wildflowers', x: -18, z: -42 },
      { kind: 'wildflowers', x: 30, z: -30 },
      { kind: 'wildflowers', x: 2, z: -10 },
      { kind: 'wildflowers', x: -42, z: 14 },
      { kind: 'wildflowers', x: 2, z: 30 },
      { kind: 'bramble', x: -14, z: -42 },
      { kind: 'bramble', x: 38, z: -30 },
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
      { id: 'millharrow_farmer_wife', x: -10, z: 6, art: 'farmer_wife', label: 'Talk to the farmer' },
      { id: 'millharrow_baker', x: 14, z: 14, art: 'baker', label: 'Talk to the baker' },
      { id: 'millharrow_brewer', x: 2, z: -14, art: 'brewer_b', label: 'Talk to the brewer' },
      { id: 'millharrow_tollman', x: 10, z: -14, art: 'town_guard_b', label: 'Talk to the tollman' },
    ],
    /** Down the cross, and nowhere else — the strips are not the town's to light. */
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
      { x: -34, z: -18 },
      { x: 30, z: -18 },
      { x: -34, z: 22 },
      { x: 30, z: 22 },
    ],
    trees: [
      { x: -42, z: -42 },
      { x: 38, z: -42 },
      { x: -42, z: 42 },
      { x: 38, z: 42 },
    ],
    horizon: 'treeline',
  },
});
