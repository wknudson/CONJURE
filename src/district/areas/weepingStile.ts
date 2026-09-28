/**
 * Weeping Stile — the smallest, closest place in the world.
 *
 * A wet hollow that the wood took back. Thirty-six columns by forty rows now, grown evenly from
 * twenty-four by twenty-six, one ruin in the hollow, no roads, and thicket standing in the middle
 * of it rather than politely around the edge — so unlike everywhere else in the Ring, you cannot
 * see across it.
 *
 * That is the whole reason it exists. After Bray's Hollow, which asks nothing, and Saltglass,
 * which is glare and open floor, the Ring needed one place that closes in. It is the only map
 * where the boundary material and the obstacles are the same thing, which is what makes the
 * edge of it ambiguous: you are never quite sure whether the thicket ahead is the far side or
 * just more of it.
 *
 * The one roof is the chapel, and the roof is gone. What is left of it is where the sixty-one
 * are named, on a wall, in the same hand that wrote RELOCATED beside them on the roll.
 *
 * The growth did not open it up. It added more wood, and three things in it, each reached one way:
 * north, over **the stile** -- the one gap in the thicket, with a willow gone to bone beside it --
 * **the hermit's grave field**, where the hollow buried its own before the roll decided otherwise,
 * and the roofless cell of the man who kept it; west, down a path that winds off the hollow and
 * goes nowhere else, **the drowned well**; and east, where the lane leaves the hollow, **the
 * lych-gate**. South, the wood itself, the only dry ground here, thicket standing in it.
 *
 * The Stile Mourners stand at the stile after dark, watching the hollow through it; another crew
 * of them keeps the south wood.
 */

import { TILE, defineArea, type AreaDef, type TileDef } from '../map.js';

/**
 * The Stile's legend.
 *
 *   g  soaked ground — walkable, most of the hollow
 *   w  leaf litter   — where it is dry enough for the wood
 *   .  weeds
 *   ,  chalk         — the lane east, and the only made ground here
 *   C  the chapel    — impassable; stone, and the roof off it
 *   T  thicket       — impassable, and both the boundary and the obstacles
 *   D  the drowned well — impassable; full to the lip
 *   L  the lych-gate's posts — impassable
 */
const STILE_LEGEND: Record<string, TileDef> = {
  g: { tex: 'marsh', safe: false, walk: true },
  w: { tex: 'forest', safe: false, walk: true },
  '.': { tex: 'weeds', safe: false, walk: true },
  ',': { tex: 'chalk', safe: false, walk: true },
  C: {
    tex: 'marsh',
    safe: false,
    walk: false,
    solid: { style: 'wall', minHeight: 3.8, maxHeight: 3.8, inset: 0.3, depthInset: 0.3, chimneyChance: 0, split: false, wall: 'stone', bare: true },
  },
  T: {
    tex: 'forest',
    safe: false,
    walk: false,
    // Low and dense rather than tall: this is scrub you cannot get through, not timber you
    // walk under. Split, so a run of it breaks up instead of reading as one hedge.
    solid: { style: 'foliage', minHeight: 2.8, maxHeight: 4.2, inset: 0.5, depthInset: 0.5, chimneyChance: 0, split: true },
  },
  D: { tex: 'water', safe: false, walk: false },
  L: {
    tex: 'chalk',
    safe: false,
    walk: false,
    solid: { style: 'wall', minHeight: 3.2, maxHeight: 3.2, inset: 1.1, depthInset: 1.1, chimneyChance: 0, split: false, wall: 'stone' },
  },
};


/**
 * 36 wide by 40 deep.
 *
 * Column 23 opens at rows 13 and 14 — the lane east to Fenwick's Crossing, and the only way in
 * or out of the hollow.
 */
const GRID: readonly string[] = [
  'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT', //  0  the wood
  'TTTTTTTgggCCCggggggggggggggggTTTTTTT', //  1  THE HERMIT'S GRAVE FIELD, closed round by the wood; the hermit's cell (west)
  'TTTTTTTgggCCCgggggggwwgggggggTTTTTTT', //  2
  'TTTTTTTggggggggggggggggggggggTTTTTTT', //  3
  'TTTTTTTggwwggggggggggggggwwggTTTTTTT', //  4
  'TTTTTTTggggggggggggggggggggggTTTTTTT', //  5
  'TTTTTTTTTTTTTTgggggggggTTTTTTTTTTTTT', //  6  the ground before the stile
  'TTTTTTTTTTTTTTTTTTgTTTTTTTTTTTTTTTTT', //  7  THE STILE, the one way through the old north thicket; the willow beside it
  'TTTTTTTggggggwwggggggwwggggggTTTTTTT', //  8
  'TTTTTTTggwwgggggggwwgggggggggTTTTTTT', //  9
  'TTTTTTTggggggggggggggggggggggTTTTTTT', // 10
  'TTTTTTTgwwgggggwwggggggggggggTTTTTTT', // 11
  'TwwwwwwgggCCCCgggggggggggggggTTTTTTT', // 12  a path west off the hollow, winding to the drowned well
  'TwTTTTTgggCCCCgggggggggggggggTTTTTTT', // 13
  'TwTTTTTgggCCCCgggggggggggggggTTTTTTT', // 14
  'TwTTTTTggggggggggggggggggggggTTTTTTT', // 15  the chapel door
  'TwTTTTTggggggggggggggTTggggggTTTTTTT', // 16  thicket standing in the open
  'TwwwTTTggggggggggggggggggggggTTTTTTT', // 17
  'TTTwTTTggwwggggwwggggggggggggTTwwwwT', // 18
  'TTTwTTTggggggggggggggggggggggLTwwwwT', // 19  THE LYCH-GATE, where the lane leaves the hollow
  'TTTwTTTgggggggggggggggggggggg,,wwww,', // 20  the lane east, to the Crossing
  'TTTwTTTgggggggggggggggggggggg,,wwww,', // 21
  'TTTwTTTggggggggggggggggggggggLTwwwwT', // 22
  'TTTwTTTggwwgggggggwwgggggggggTTwwwwT', // 23
  'TDDwTTTggggggggggggggggggggggTTTTTTT', // 24  the drowned well
  'TDDTTTTgwwgggggwwgggggwggggggTTTTTTT', // 25
  'TTTTTTTgggTTgggggggggggTTggggTTTTTTT', // 26
  'TTTTTTTggg..gggggg..gggggggggTTTTTTT', // 27
  'TTTTTTTggggggggggggggggggggggTTTTTTT', // 28
  'TTTTTTTggwwggggwwggggggggggggTTTTTTT', // 29
  'TTTTTTTggggggggggggggggggggggTTTTTTT', // 30
  'TTTTTTTggggggggggggggggggggggTTTTTTT', // 31
  'TTTTTTTTTTTTTTgTTTTTTTTgTTTTTTTTTTTT', // 32
  'TTTTTTTTwwwwwwwwwwwwTTTwwwwwTTTTTTTT', // 33  THE SOUTH WOOD, dry at last, thicket standing in it
  'TTTTTTTTwwwTTTwwwwwwTTTwwwggTTTTTTTT', // 34
  'TTTTTTTTwwwTTTwwwwwwwwwwTTggTTTTTTTT', // 35
  'TTTTTTTTwwwwwwwwTTTwwwwwTTwwTTTTTTTT', // 36
  'TTTTTTTTwwwwwwwwTTTwwwwwwwwwTTTTTTTT', // 37
  'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT', // 38
  'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT', // 39
];

const HALF_X = (GRID[0]!.length * TILE) / 2;
const HALF_Z = (GRID.length * TILE) / 2;
const xOfCol = (col: number): number => col * TILE - HALF_X + TILE / 2;
const zOfRow = (row: number): number => row * TILE - HALF_Z + TILE / 2;

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
      x: HALF_X - 2,
      z: 2,
      label: "East, down the lane to Fenwick's Crossing",
      arrive: { x: -82, z: -2 },
    },
    {
      // The chapel. The door is the only part of it that still shuts.
      to: 'weeping_stile_chapel',
      x: xOfCol(11.5),
      z: zOfRow(14) + TILE / 2 + 1.4,
      label: 'Into the chapel',
      door: { x: xOfCol(11.5), z: zOfRow(14) + TILE / 2 + 0.05, facesSouth: true, sign: 'chapel', style: 'arch' },
      arrive: { x: 0, z: 14 },
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
      // Moths in the grave field, a fox in the south wood.
      { kind: 'moth', x: 10, z: -70, roam: 6, count: 3 },
      { kind: 'fox', x: -30, z: 62, roam: 6 },
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
      { kind: 'reeds', x: -38, z: -22 },
      { kind: 'reeds', x: -30, z: -6 },
      { kind: 'reeds', x: 6, z: 10 },
      { kind: 'reeds', x: -10, z: 26 },
      { kind: 'bracken', x: -2, z: -38 },
      { kind: 'bracken', x: -34, z: -26 },
      { kind: 'bracken', x: -26, z: -6 },
      { kind: 'bracken', x: 10, z: 10 },
      { kind: 'bracken', x: -6, z: 26 },
      { kind: 'bramble', x: 2, z: -38 },
      { kind: 'bramble', x: -34, z: -14 },
      { kind: 'bramble', x: 18, z: 2 },
      { kind: 'bramble', x: -2, z: 22 },
      { kind: 'mushrooms', x: 10, z: -38 },
      { kind: 'mushrooms', x: -22, z: -18 },
      { kind: 'mushrooms', x: 22, z: 2 },
      { kind: 'mushrooms', x: 6, z: 22 },
      { kind: 'deadfall', x: 14, z: -38 },
      { kind: 'deadfall', x: 30, z: -14 },
      { kind: 'deadfall', x: 30, z: 14 },

      // The hermit's grave field, in rows; his own grave at its head.
      { kind: 'gravestone', x: -14, z: -74 },
      { kind: 'gravestone', x: -6, z: -74 },
      { kind: 'gravestone', x: 2, z: -74 },
      { kind: 'gravestone', x: 18, z: -74 },
      { kind: 'gravestone', x: 26, z: -74 },
      { kind: 'gravestone', x: -38, z: -66 },
      { kind: 'gravestone', x: -6, z: -66 },
      { kind: 'gravestone', x: 10, z: -66 },
      { kind: 'gravestone', x: 26, z: -66 },
      { kind: 'gravestone', x: 34, z: -66 },
      { kind: 'cairn', x: -22, z: -66 },
      { kind: 'urn', x: -22, z: -62 },
      // The path to the well.
      { kind: 'reeds', x: -58, z: 14 },
      { kind: 'mushrooms', x: -58, z: -2 },
      // The lych-gate: its roof is a sheet of canvas now; a cairn in the wood by it.
      { kind: 'awning', x: 46, z: 4, yaw: Math.PI / 2 },
      { kind: 'cairn', x: 54, z: -6 },
      // The south wood.
      { kind: 'deadfall', x: -30, z: 58 },
      { kind: 'mushrooms', x: -18, z: 66 },
      { kind: 'logpile', x: 6, z: 58 },
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
      { id: 'stile_census_clerk', x: -6, z: -10, art: 'scribe', label: 'Talk to the Census clerk' },
      { id: 'stile_mercenary', x: 10, z: 2, art: 'mercenary', label: 'Talk to the hired blade' },
    ],
    // No lamps. Nobody lives here, and the one thing this place has to be is unlit.
    crates: [{ x: 26, z: -2 }],
    /** Standing timber, in the drier patches. */
    trees: [
      { x: -26, z: -38 },
      { x: 6, z: -38 },
      { x: -38, z: -30 },
      { x: 10, z: -10 },
      { x: -26, z: 10 },
      { x: 2, z: 22 },
      { x: -18, z: 34 },
      { x: 18, z: 34 },
      { x: 34, z: -34 },
      { x: -38, z: 14 },
      { x: 34, z: 30 },
    ],
    horizon: 'treeline',
    /**
     * The Stile Mourners, after dark: one stands at the stile on the grave field's side, looking
     * back through it at the hollow; the rest keep the south wood.
     */
    packs: [
      {
        encounterId: 'pack_stile_mourners',
        id: 'stile',
        x: 2,
        z: -58,
        roam: 4,
        hours: 'night',
        band: 'stile',
        behaviour: 'sentry',
        // Facing south, through the stile, at the hollow.
        sweep: [-0.7, 0.7],
      },
      { encounterId: 'pack_stile_mourners', id: 'south_wood', x: -10, z: 66, roam: 5, hours: 'night', band: 'wood' },
    ],
    /** The willow gone to bone beside the stile, its limbs over the way through. */
    landmarks: [{ kind: 'great_tree', x: -6, z: -56 }],
    vignettes: [
      { id: 'wayside_shrine', x: 60, z: 12 },
      { id: 'grave_plot', x: -14, z: -60 },
    ],
  },
});
