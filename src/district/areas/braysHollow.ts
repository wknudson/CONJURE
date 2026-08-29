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
 */

import { defineArea, type AreaDef, type TileDef } from '../map.js';

/**
 * The Hollow's legend.
 *
 *   #  grass        — the bowl
 *   f  ploughed rim
 *   ,  chalk lane   — the way through
 *   .  weeds
 *   T  hedge        — impassable
 *
 * Five characters and one of them is the boundary. This is the simplest legend in the game and
 * it is meant to be.
 */
const HOLLOW_LEGEND: Record<string, TileDef> = {
  '#': { tex: 'grass', safe: false, walk: true },
  f: { tex: 'field', safe: false, walk: true },
  ',': { tex: 'chalk', safe: false, walk: true },
  '.': { tex: 'weeds', safe: false, walk: true },
  T: {
    tex: 'grass',
    safe: false,
    walk: false,
    solid: { minHeight: 3.0, maxHeight: 4.4, inset: 0.8, depthInset: 0.8, chimneyChance: 0, split: true },
  },
};

/**
 * 20 wide by 22 deep.
 *
 * Column 0 opens at rows 10 and 11 and nowhere else. The two hedge stubs inside — rows 7 and 14
 * — are the only things in the bowl, and they are there so that crossing it is not quite a
 * straight line.
 */
const GRID: readonly string[] = [
  'TTTTTTTTTTTTTTTTTTTT', //  0
  'TffffffffffffffffffT', //  1  the ploughed rim
  'Tff##############ffT', //  2
  'Tf################fT', //  3
  'T##################T', //  4
  'T###..##########..#T', //  5
  'T##################T', //  6
  'T####TT######TT####T', //  7  a stub of hedge, left standing
  'T##################T', //  8
  'T########,,########T', //  9
  ',,,,,,,,,,,,,,,,,,,T', // 10  the lane, west to Millharrow
  ',,,,,,,,,,,,,,,,,,,T', // 11
  'T########,,########T', // 12
  'T##################T', // 13
  'T####TT######TT####T', // 14
  'T##################T', // 15
  'T###..##########..#T', // 16
  'T##################T', // 17
  'Tf################fT', // 18
  'Tff##############ffT', // 19
  'TffffffffffffffffffT', // 20
  'TTTTTTTTTTTTTTTTTTTT', // 21
];

export const BRAYS_HOLLOW_ID = 'brays_hollow';

export const BRAYS_HOLLOW: AreaDef = defineArea({
  id: BRAYS_HOLLOW_ID,
  name: "Bray's Hollow",
  grid: GRID,
  legend: HOLLOW_LEGEND,
  /** On the lane, a little in from the west end. */
  spawn: { x: 0, z: -2 },
  safety: 'none',
  exits: [
    {
      to: 'millharrow',
      x: -38,
      z: -2,
      label: 'West, back to Millharrow',
      arrive: { x: 42, z: -2 },
    },
  ],
  props: {
    /**
     * Two people, which is the right number for a place that is not a town.
     *
     * Out in the bowl rather than along the lane. Bray's Hollow is defined by having nothing
     * built in it, and a pair of figures standing in open grass says that better than a row
     * of them beside a road would.
     */
    npcs: [
      { id: 'brays_elder', x: -14, z: -10, art: 'elder', label: 'Talk to old Bray' },
      { id: 'brays_child', x: 14, z: 6, art: 'child_beggar', label: 'Talk to the child' },
      { id: 'brays_weaver', x: -10, z: -14, art: 'weaver', label: 'Talk to the weaver' },
    ],
    /** Two, on the lane. Somebody puts them out and it is not the Magistracy. */
    lamps: [
      { x: -26, z: -2 },
      { x: 18, z: -2 },
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
    ],
    horizon: 'treeline',
  },
});
