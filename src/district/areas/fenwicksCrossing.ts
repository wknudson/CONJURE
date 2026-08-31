/**
 * Fenwick's Crossing — a town that is really a bridge with buildings on the approach.
 *
 * The river runs along the north and the crossing is the only reason anybody stopped here. Two
 * frontages face each other across a street that goes nowhere except to the bridgehead, and the
 * strips start again the moment the second frontage ends.
 *
 * The shape argues with Millharrow's on purpose. Millharrow is a crossroads and offers four
 * choices; this is a *crossing* and offers two — over the water to the Chalk Road, or west into
 * Weeping Stile. A town on a river is a town about one decision.
 */

import { defineArea, type AreaDef, type TileDef } from '../map.js';

/**
 * The Crossing's legend.
 *
 *   c  cobbles      — the frontages and the bridgehead
 *   ,  chalk street — the through street, and the bridge itself
 *   f  ploughed strip
 *   .  weeds
 *   W  the river     — impassable
 *   B  town building — impassable
 *   T  hedge        — impassable, the boundary
 */
const FEN_LEGEND: Record<string, TileDef> = {
  c: { tex: 'cobble', safe: false, walk: true },
  ',': { tex: 'chalk', safe: false, walk: true },
  f: { tex: 'field', safe: false, walk: true },
  '.': { tex: 'weeds', safe: false, walk: true },
  W: { tex: 'water', safe: false, walk: false },
  B: {
    tex: 'cobble',
    safe: false,
    walk: false,
    solid: { minHeight: 3.8, maxHeight: 5.6, inset: 0.35, depthInset: 0.35, chimneyChance: 0.55, split: true },
  },
  T: {
    tex: 'grass',
    safe: false,
    walk: false,
    solid: { minHeight: 3.2, maxHeight: 4.6, inset: 0.75, depthInset: 0.75, chimneyChance: 0, split: true },
  },
};

/** Two rows of river along the north edge. The bridge is the quay row below it. */
const WATER_ROWS = 2;

/**
 * 28 wide by 18 deep.
 *
 * The shallowest map in the game — eighteen rows against twenty-eight — because a river town is
 * wide and thin by nature. Row 2 is the bridgehead and carries the crossing north; column 0
 * opens at rows 8 and 9, which is the through street running west.
 */
const GRID: readonly string[] = [
  'WWWWWWWWWWWWWWWWWWWWWWWWWWWW', //  0  the river
  'WWWWWWWWWWWWWWWWWWWWWWWWWWWW', //  1
  'TccccccccccccccccccccccccccT', //  2  the bridgehead — north, over the water
  'Tcc.cccccccccccccccccccc.ccT', //  3
  'TccBBBBBcccccccccccBBBBBBccT', //  4  the frontages
  'TccBBBBBcccccccccccBBBBBBccT', //  5
  'TccccccccccccccccccccccccccT', //  6
  'TffffffcccccccccccccffffffcT', //  7
  ',,,,,,,,,,,,,,,,,,,,,,,,,,,,', //  8  the through street: west to Weeping Stile, east to the Shelf
  ',,,,,,,,,,,,,,,,,,,,,,,,,,,,', //  9
  'TccccccccccccccccccccccccccT', // 10
  'TccBBBBBBccccccccccBBBBBBccT', // 11
  'TccBBBBBBccccccccccBBBBBBccT', // 12
  'TccccccccccccccccccccccccccT', // 13
  'Tffffffffcc..ccccffffffffccT', // 14
  'TffffffffffffffffffffffffffT', // 15
  'TffffffffffffffffffffffffffT', // 16
  'TTTTTTTTTTTTTTTTTTTTTTTTTTTT', // 17
];

export const FENWICKS_CROSSING_ID = 'fenwicks_crossing';

export const FENWICKS_CROSSING: AreaDef = defineArea({
  id: FENWICKS_CROSSING_ID,
  name: "Fenwick's Crossing",
  grid: GRID,
  legend: FEN_LEGEND,
  /** On the through street, between the two frontages. */
  spawn: { x: 0, z: -2 },
  safety: 'none',
  exits: [
    {
      to: 'chalk_road',
      x: -2,
      z: -26,
      label: 'North, over the bridge to the Chalk Road',
      arrive: { x: 30, z: 14 },
    },
    {
      to: 'weeping_stile',
      x: -54,
      z: -2,
      label: 'West, up the lane to Weeping Stile',
      arrive: { x: 26, z: -2 },
    },
    {
      // East, up onto the shelf. The through street runs the whole width of the town and out
      // both ends, which is the one thing a river town's street is for.
      to: 'storm_shelf',
      x: 54,
      z: -2,
      label: 'East, up onto the Storm Shelf',
      arrive: { x: -42, z: -6 },
    },
  ],
  props: {
    /** A bridge town on a river. Everything here belongs to the water. */
    sky: 'drizzle',
    wildlife: [
      { kind: 'gull', x: -54, z: -34, roam: 22, count: 4 },
      { kind: 'gull', x: -6, z: 2, roam: 22, count: 4 },
      { kind: 'heron', x: -26, z: -26, roam: 6 },
      { kind: 'crab', x: -18, z: -26, roam: 4, count: 2 },
      { kind: 'crab', x: -22, z: -6, roam: 4, count: 2 },
      { kind: 'crab', x: 18, z: 18, roam: 4, count: 2 },
      { kind: 'rat', x: -14, z: -26, roam: 5, count: 2 },
      { kind: 'rat', x: -30, z: 6, roam: 5, count: 2 },
    ],
    /** Coach inn and bridge. Beer, horses, and somewhere to tie them. */
    dressing: [
      { kind: 'barrel', x: -50, z: -26 },
      { kind: 'barrel', x: 14, z: -22 },
      { kind: 'barrel', x: -2, z: -14 },
      { kind: 'barrel', x: 46, z: -10 },
      { kind: 'barrel', x: -10, z: -2 },
      { kind: 'barrel', x: 38, z: 2 },
      { kind: 'barrel', x: -14, z: 10 },
      { kind: 'barrel', x: -26, z: 18 },
      { kind: 'barrel', x: -2, z: 22 },
      { kind: 'barrel', x: 26, z: 26 },
      { kind: 'trough', x: -46, z: -26 },
      { kind: 'trough', x: -14, z: -10 },
      { kind: 'trough', x: 42, z: 2 },
      { kind: 'trough', x: 38, z: 18 },
      { kind: 'cart', x: -38, z: -26 },
      { kind: 'cart', x: -10, z: -10 },
      { kind: 'cart', x: 46, z: 2 },
      { kind: 'cart', x: 42, z: 18 },
      { kind: 'fence', x: -34, z: -26, yaw: 0 },
      { kind: 'fence', x: 18, z: -18, yaw: 0 },
      { kind: 'fence', x: 6, z: -6, yaw: 0 },
      { kind: 'fence', x: -50, z: 6, yaw: 0 },
      { kind: 'fence', x: 18, z: 14, yaw: 0 },
      { kind: 'fence', x: 50, z: 22, yaw: 0 },
      { kind: 'haybale', x: -30, z: -26 },
      { kind: 'haybale', x: -6, z: -10 },
      { kind: 'haybale', x: -46, z: 6 },
      { kind: 'haybale', x: 50, z: 18 },
      { kind: 'reeds', x: -26, z: -26 },
      { kind: 'reeds', x: -50, z: -22 },
      { kind: 'reeds', x: 22, z: -22 },
      { kind: 'reeds', x: -2, z: -18 },
      { kind: 'reeds', x: 2, z: -14 },
      { kind: 'reeds', x: -18, z: -10 },
    ],
    /**
     * The busiest street in the Ring, and the only place four people is not too many.
     *
     * Two on the north frontage and two on the south, so the through street has somebody on
     * both sides of it — which is what makes a coaching town read as one rather than as a
     * bridge with a queue.
     */
    npcs: [
      { id: 'fenwick_innkeeper', x: -22, z: -10, art: 'innkeeper', label: 'Talk to the innkeeper' },
      { id: 'fenwick_brewer', x: -6, z: -6, art: 'brewer', label: 'Talk to the brewer' },
      { id: 'fenwick_bard', x: 10, z: 6, art: 'bard', label: 'Listen to the bard' },
      { id: 'fenwick_cartographer', x: 26, z: -22, art: 'cartographer', label: 'Talk to the cartographer' },
      { id: 'fenwick_carpenter', x: 22, z: -26, art: 'carpenter', label: 'Talk to the carpenter' },
    ],
    /** The bridgehead and the street. A crossing that is not lit is a crossing nobody uses. */
    /**
     * Who walks the row.
     *
     * A bridge town lit by its inn. Nobody is paid to do it -- an unlit crossing
     * is simply bad for trade, which is a better reason than a wage.
     */
    lamplighter: 'fenwick_innkeeper',
    lamps: [
      { x: -22, z: -26 },
      { x: 18, z: -26 },
      { x: -26, z: -2 },
      { x: 22, z: -2 },
    ],
    crates: [
      { x: -42, z: -26 },
      { x: 38, z: -26 },
      { x: -38, z: 22 },
    ],
    trees: [
      { x: -46, z: 26 },
      { x: 42, z: 26 },
      { x: -6, z: 26 },
    ],
    graffiti: [
      {
        text: 'FENWICK TOOK THE TOLL AND THE BRIDGE',
        wallX: -34,
        wallZ: -14,
        dx: 4,
        facesSouth: true,
        tint: '#9e8f5e',
      },
    ],
    waterRows: WATER_ROWS,
    horizon: 'treeline',
  },
});
