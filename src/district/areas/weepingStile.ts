/**
 * Weeping Stile — the smallest, closest place in the world.
 *
 * A wet hollow that the wood took back. Eighteen columns by twenty-two rows, no buildings, no
 * roads, and thicket standing in the middle of it rather than politely around the edge — so
 * unlike everywhere else in the Ring, you cannot see across it.
 *
 * That is the whole reason it exists. After Bray's Hollow, which asks nothing, and Saltglass,
 * which is glare and open floor, the Ring needed one place that closes in. It is the only map
 * where the boundary material and the obstacles are the same thing, which is what makes the
 * edge of it ambiguous: you are never quite sure whether the thicket ahead is the far side or
 * just more of it.
 */

import { defineArea, type AreaDef, type TileDef } from '../map.js';

/**
 * The Stile's legend.
 *
 *   g  soaked ground — walkable, most of the hollow
 *   w  leaf litter   — where it is dry enough for the wood
 *   .  weeds
 *   ,  chalk         — the lane east, and the only made ground here
 *   T  thicket       — impassable, and both the boundary and the obstacles
 */
const STILE_LEGEND: Record<string, TileDef> = {
  g: { tex: 'marsh', safe: false, walk: true },
  w: { tex: 'forest', safe: false, walk: true },
  '.': { tex: 'weeds', safe: false, walk: true },
  ',': { tex: 'chalk', safe: false, walk: true },
  T: {
    tex: 'forest',
    safe: false,
    walk: false,
    // Low and dense rather than tall: this is scrub you cannot get through, not timber you
    // walk under. Split, so a run of it breaks up instead of reading as one hedge.
    solid: { minHeight: 2.8, maxHeight: 4.2, inset: 0.5, depthInset: 0.5, chimneyChance: 0, split: true },
  },
};

/**
 * 18 wide by 22 deep.
 *
 * Column 17 opens at rows 10 and 11 — the lane east to Fenwick's Crossing, and the only way in
 * or out of the hollow.
 */
const GRID: readonly string[] = [
  'TTTTTTTTTTTTTTTTTT', //  0
  'TggggggwwggggggwwT', //  1
  'TggwwgggggggwwgggT', //  2
  'TggggggggggggggggT', //  3
  'TgwwgggggwwggggggT', //  4
  'TggggggggggggggggT', //  5
  'TgggTTggggggTTgggT', //  6  thicket standing in the open
  'TggggggggggggggggT', //  7
  'TggwwggggwwggggggT', //  8
  'TggggggggggggggggT', //  9
  'Tgggggggggggggggg,', // 10  the lane east, to the Crossing
  'Tgggggggggggggggg,', // 11
  'TggggggggggggggggT', // 12
  'TggwwgggggggwwgggT', // 13
  'TggggggggggggggggT', // 14
  'TgwwgggggwwgggggwT', // 15
  'TggggggggggggggggT', // 16
  'Tggg..gggggg..gggT', // 17
  'TggggggggggggggggT', // 18
  'TggwwggggwwggggggT', // 19
  'TggggggggggggggggT', // 20
  'TTTTTTTTTTTTTTTTTT', // 21
];

export const WEEPING_STILE_ID = 'weeping_stile';

export const WEEPING_STILE: AreaDef = defineArea({
  id: WEEPING_STILE_ID,
  name: 'Weeping Stile',
  grid: GRID,
  legend: STILE_LEGEND,
  /** In the middle of the hollow, which is as far from anything as this map gets. */
  spawn: { x: 0, z: -2 },
  safety: 'none',
  exits: [
    {
      to: 'fenwicks_crossing',
      x: 34,
      z: -2,
      label: "East, down the lane to Fenwick's Crossing",
      arrive: { x: -46, z: -2 },
    },
  ],
  props: {
    /** Small, close and overgrown — the tightest map in the game, and the wettest. */
    sky: 'drizzle',
    wildlife: [
      { kind: 'heron', x: -6, z: -38, roam: 5 },
      { kind: 'fox', x: -2, z: -38, roam: 8 },
      { kind: 'hare', x: 10, z: -38, roam: 6 },
      { kind: 'hare', x: 26, z: 2, roam: 6 },
      { kind: 'moth', x: -34, z: -42, roam: 6, count: 3 },
      { kind: 'moth', x: -30, z: 6, roam: 6, count: 3 },
    ],
    /** A village that stopped answering. Everything here is something somebody left. */
    dressing: [
      { kind: 'pens', x: -30, z: -38, yaw: 0 },
      { kind: 'pens', x: 18, z: -30, yaw: 0 },
      { kind: 'pens', x: 6, z: -18, yaw: 0 },
      { kind: 'pens', x: 6, z: -6, yaw: 0 },
      { kind: 'pens', x: 22, z: 6, yaw: 0 },
      { kind: 'pens', x: 2, z: 18, yaw: 0 },
      { kind: 'pens', x: -18, z: 30, yaw: 0 },
      { kind: 'fence', x: -22, z: -38, yaw: 0 },
      { kind: 'fence', x: -10, z: -26, yaw: 0 },
      { kind: 'fence', x: 10, z: -14, yaw: 0 },
      { kind: 'fence', x: -14, z: 2, yaw: 0 },
      { kind: 'fence', x: 10, z: 14, yaw: 0 },
      { kind: 'fence', x: 18, z: 26, yaw: 0 },
      { kind: 'logpile', x: -18, z: -38 },
      { kind: 'logpile', x: 22, z: -22 },
      { kind: 'logpile', x: -10, z: 2 },
      { kind: 'logpile', x: -14, z: 22 },
      { kind: 'cairn', x: -14, z: -38 },
      { kind: 'cairn', x: 26, z: -22 },
      { kind: 'cairn', x: -6, z: 2 },
      { kind: 'cairn', x: -10, z: 22 },
      { kind: 'waystone', x: -10, z: -38, text: 'RELOCATED — LABOUR — 61' },
      { kind: 'waystone', x: 6, z: 2, text: 'RELOCATED — LABOUR — 61' },
      { kind: 'reeds', x: -6, z: -38 },
      { kind: 'reeds', x: -30, z: -22 },
      { kind: 'reeds', x: -30, z: -6 },
      { kind: 'reeds', x: 6, z: 10 },
      { kind: 'reeds', x: -10, z: 26 },
      { kind: 'bracken', x: -2, z: -38 },
      { kind: 'bracken', x: -26, z: -22 },
      { kind: 'bracken', x: -26, z: -6 },
      { kind: 'bracken', x: 10, z: 10 },
      { kind: 'bracken', x: -6, z: 26 },
      { kind: 'bramble', x: 2, z: -38 },
      { kind: 'bramble', x: -26, z: -18 },
      { kind: 'bramble', x: 18, z: 2 },
      { kind: 'bramble', x: -2, z: 22 },
      { kind: 'mushrooms', x: 10, z: -38 },
      { kind: 'mushrooms', x: -22, z: -18 },
      { kind: 'mushrooms', x: 22, z: 2 },
      { kind: 'mushrooms', x: 6, z: 22 },
      { kind: 'deadfall', x: 14, z: -38 },
      { kind: 'deadfall', x: 30, z: -14 },
      { kind: 'deadfall', x: 30, z: 14 },
    ],
    /**
     * The only two people in a village of sixty-one.
     *
     * That is the point of them, and the reason the Stile gets a pair rather than a crowd:
     * the roll says sixty-one souls and the player can count what is actually standing here.
     * Both are outsiders — the clerk sent to take the count and the blade he hired to get him
     * back out. Nobody from the village answers.
     */
    npcs: [
      { id: 'stile_census_clerk', x: -10, z: -6, art: 'scribe', label: 'Talk to the Census clerk' },
      { id: 'stile_mercenary', x: 10, z: 2, art: 'mercenary', label: 'Talk to the hired blade' },
    ],
    // No lamps. Nobody lives here, and the one thing this place has to be is unlit.
    crates: [{ x: 26, z: -2 }],
    /** Standing timber, in the drier patches. */
    trees: [
      { x: -26, z: -38 },
      { x: 6, z: -38 },
      { x: -30, z: -26 },
      { x: 10, z: -10 },
      { x: -26, z: 10 },
      { x: 2, z: 22 },
      { x: -18, z: 34 },
      { x: 18, z: 34 },
    ],
    horizon: 'treeline',
  },
});
