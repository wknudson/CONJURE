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
 * Forty by forty now, grown evenly from twenty-six square, and the bowl in the middle is as it
 * was: one roof, the barn on the north slope, where the herd is wintered and where the warrant
 * came for it -- the `warrant_of_distraint` contract is fought over the straw inside.
 *
 * What the growth added is still not a town. North, over the hedge, **the rim** and the stone
 * circle on its crown. West, on the lane out, **Old Bray's farm**: the farmhouse, the dairy, the
 * byre, the pond. East, **the orchard** and its hives. South, **the south rim**, ploughed, with a
 * hedge between the strips -- and, after dark, a few strays who keep to the rim and nowhere else,
 * which is as close as the Hollow comes to anything hunting it.
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
 *   h  the farm     — impassable; Old Bray's farmhouse, dairy and byre
 *   P  the pond     — impassable
 *
 * Eight characters now, and one of them is the boundary. Still the simplest legend in the Ring,
 * and it is meant to be.
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
  h: {
    tex: 'weeds',
    safe: false,
    walk: false,
    solid: { style: 'cottage', minHeight: 3.8, maxHeight: 4.4, inset: 0.3, depthInset: 0.3, chimneyChance: 0.7, split: true, wall: 'stone' },
  },
  P: { tex: 'water', safe: false, walk: false },
};


/**
 * 26 wide by 26 deep.
 *
 * Column 0 opens at rows 12 and 13 and nowhere else. The hedge stubs inside — rows 9 and 16 —
 * are the only things in the bowl besides the barn, and they are there so that crossing it is
 * not quite a straight line.
 */
const GRID: readonly string[] = [
  'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT', //  0  the far hedge
  'T#fffffffffff###############ffffffffff#T', //  1  THE NORTH RIM: strips either side, and the stone circle on the crown
  'T#fffffffffff###############ffffffffff#T', //  2
  'T######################################T', //  3
  'T######################################T', //  4
  'T######################################T', //  5
  'T######################################T', //  6
  'T######TTTTT##TTTTTTTTTTTT##TTTTT######T', //  7  the old north hedge, two gaps in it
  'T######TffffffffffffffffffffffffT######T', //  8  the ploughed rim
  'T######Tff####################ffT######T', //  9
  'T......Tf######################fT######T', // 10  OLD BRAY'S FARM (west): the yard, the farmhouse, the dairy        THE ORCHARD (east)
  'Thhhh..T########################T######T', // 11
  'Thhhh..####..##############..##########T', // 12
  'Thhhh..T#####BBBB###############T######T', // 13  THE BARN
  'T......T#####BBBB###############T######T', // 14
  'T....hhT########################T######T', // 15  the barn door
  'T....hhT###TT############TT#####T######T', // 16  a stub of hedge, left standing
  'T......T########################T######T', // 17
  'T######T###########,,###########T######T', // 18
  ',,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,T######T', // 19  the lane, west to Millharrow, through the farm
  ',,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,T######T', // 20
  'T######T###########,,###########T######T', // 21
  'T######T########################T######T', // 22
  'Thhh###T#####TT##########TT#####T######T', // 23  the byre
  'Thhh###T########################T######T', // 24
  'T######T###..##############..###T######T', // 25
  'T#PPPP#################################T', // 26  the pond
  'T#PPPP#T########################T######T', // 27
  'T#PPPP#Tf######################fT######T', // 28
  'T#PPPP#Tff####################ffT######T', // 29
  'T######TffffffffffffffffffffffffT######T', // 30
  'T######TffffffffffffffffffffffffT######T', // 31
  'T######TTT##TTTTTTTTTTTTTTTT##TTT######T', // 32  the old south hedge, two gaps in it
  'TffffffffffffffffffffffffffffffffffffffT', // 33  THE SOUTH RIM: ploughed strips, a hedge between them
  'TffffffffffffffffffffffffffffffffffffffT', // 34
  'TffffffffffffffffffffffffffffffffffffffT', // 35
  'TTTTTTTTffTTTTTTTTTTTTTTTTTTTTffTTTTTTTT', // 36
  'TffffffffffffffffffffffffffffffffffffffT', // 37
  'TffffffffffffffffffffffffffffffffffffffT', // 38
  'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT', // 39  the far hedge
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
      arrive: { x: 98, z: -2 },
    },
    {
      // The barn. Where the herd is, and where the warrant came for it.
      to: 'brays_barn',
      x: xOfCol(14.5),
      z: zOfRow(14) + TILE / 2 + 1.4,
      label: 'Into the barn',
      door: { x: xOfCol(14.5), z: zOfRow(14) + TILE / 2 + 0.05, facesSouth: true, style: 'plank' },
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
      // Sheep on the north rim, a hare by the circle, a heron at the pond.
      { kind: 'sheep', x: -40, z: -70, roam: 6, count: 3 },
      { kind: 'hare', x: 40, z: -62, roam: 8 },
      { kind: 'heron', x: -54, z: 30, roam: 4 },
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

      // Old Bray's farm.
      { kind: 'haybale', x: -58, z: -26 },
      { kind: 'cart', x: -70, z: -10 },
      { kind: 'well', x: -62, z: -14 },
      { kind: 'trough', x: -58, z: 14 },
      { kind: 'washing', x: -66, z: -38, yaw: 0 },
      { kind: 'reeds', x: -54, z: 26 },
      { kind: 'reeds', x: -74, z: 40 },
      // The orchard's hives.
      { kind: 'honeycomb', x: 60, z: -6 },
      { kind: 'honeycomb', x: 60, z: 2 },
      { kind: 'honeycomb', x: 60, z: 10 },
      // Fodder on the south rim.
      { kind: 'haybale', x: -30, z: 56 },
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
      // The orchard, in its rows either side of the lane's end.
      { x: 56, z: -40 },
      { x: 64, z: -40 },
      { x: 72, z: -40 },
      { x: 56, z: -28 },
      { x: 64, z: -28 },
      { x: 72, z: -28 },
      { x: 56, z: 28 },
      { x: 64, z: 28 },
      { x: 72, z: 28 },
      { x: 56, z: 40 },
      { x: 64, z: 40 },
      { x: 72, z: 40 },
    ],
    horizon: 'treeline',
    /** A few strays after dark, on the south rim and nowhere else. The Hollow's whole menace. */
    packs: [{ encounterId: 'pack_verge_stray_dogs', id: 'rim', x: 0, z: 58, roam: 6, hours: 'night', band: 'rim' }],
    /** The stone circle on the crown of the north rim, older than the hedges and the name. */
    landmarks: [{ kind: 'stone_circle', x: 0, z: -64 }],
    vignettes: [{ id: 'wayside_shrine', x: 20, z: -62 }],
  },
});
