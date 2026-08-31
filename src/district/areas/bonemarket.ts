/**
 * The Bonemarket — where Jolrek sells what is left of things.
 *
 * A covered market that outgrew its building. The trade spilled out of the arcade into the
 * lanes either side of it, and the stall rows have stood in the same places long enough that
 * the ward now treats them as streets: you do not walk through the market, you walk the gaps
 * between what people have decided to leave standing.
 *
 * The shape is the argument. Three bands north to south — a lane, the market floor, a lane —
 * and the floor is the only open ground in the ward. Everything interesting is a dead end
 * behind a stall row, which is what a market feels like and what a grid of streets does not.
 * The arcade pillars at rows 8 and 11 are the one piece of architecture that survives from
 * whatever this was before the trade arrived.
 *
 * Nothing hunts here. It is a place to walk.
 */

import { defineArea, type AreaDef, type TileDef } from '../map.js';

/**
 * The market's legend.
 *
 *   m  market floor  — trodden dirt over the old paving
 *   c  cobbles       — the lanes, still swept
 *   .  weeds         — the corners nobody trades in
 *   T  stall row     — impassable, low, taken whole so a row reads as a row
 *   A  arcade pillar — impassable, tall and narrow
 *   B  the ranges    — impassable, the buildings that box the ward in
 *
 * `T` is deliberately not split: a stall row chunked into two- and three-tile pieces would
 * read as a terrace of little sheds rather than as one long counter, which is the difference
 * between a market and a street of shops.
 */
const MARKET_LEGEND: Record<string, TileDef> = {
  m: { tex: 'market', safe: false, walk: true },
  c: { tex: 'cobble', safe: false, walk: true },
  '.': { tex: 'weeds', safe: false, walk: true },
  T: {
    tex: 'market',
    safe: false,
    walk: false,
    solid: { minHeight: 1.9, maxHeight: 2.4, inset: 0.9, depthInset: 1.1, chimneyChance: 0, split: false },
  },
  A: {
    tex: 'cobble',
    safe: false,
    walk: false,
    solid: { minHeight: 5.4, maxHeight: 5.4, inset: 1.3, depthInset: 1.3, chimneyChance: 0, split: false },
  },
  B: {
    tex: 'cobble',
    safe: false,
    walk: false,
    solid: { minHeight: 4.4, maxHeight: 6.4, inset: 0.3, depthInset: 0.3, chimneyChance: 0.35, split: true },
  },
};

/**
 * 24 wide by 20 deep.
 *
 * Column 0 opens at rows 9 and 10 and nowhere else — the one way in, off Ashfall's
 * cross-street. Everything else is range wall, which is what makes the market feel enclosed
 * rather than laid out.
 */
const GRID: readonly string[] = [
  'BBBBBBBBBBBBBBBBBBBBBBBB', //  0  the north range
  'BccccccccccccccccccccccB', //  1  the north lane
  'Bc.TTTT.cc.TTTTTT.cc.ccB', //  2  stall rows, backed onto the range
  'BccTTTTccccTTTTTTccccccB', //  3
  'Bmmmmmmmmmmmmmmmmmmmmm.B', //  4  the market floor begins
  'Bmm.TTTTTT.mmm.TTTT.mmmB', //  5
  'BmmmTTTTTTmmmmmTTTTmmmmB', //  6
  'BmmmmmmmmmmmmmmmmmmmmmmB', //  7
  'BAmmmmAmmmmmAmmmmmAmmmmB', //  8  the arcade
  'cmmmmmmmmmmmmmmmmmmmmm.B', //  9  the way in, off the ward
  'cmmmmmmmmmmmmmmmmmmmmmmB', // 10
  'BAmmmmAmmmmmAmmmmmAmmmmB', // 11
  'BmmmmmmmmmmmmmmmmmmmmmmB', // 12
  'Bmm.TTTT.mmmm.TTTTTT.mmB', // 13
  'BmmmTTTTmmmmmmTTTTTTmmmB', // 14
  'Bcccccccccccccccccccc..B', // 15  the south lane
  'Bc.TTTTTT.cc.TTTT.cccccB', // 16
  'BccTTTTTTccccTTTTccccc.B', // 17
  'Bcccccccccccccccccccc..B', // 18
  'BBBBBBBBBBBBBBBBBBBBBBBB', // 19  the south range
];

export const BONEMARKET_ID = 'bonemarket';

export const BONEMARKET: AreaDef = defineArea({
  id: BONEMARKET_ID,
  name: 'The Bonemarket',
  grid: GRID,
  legend: MARKET_LEGEND,
  /** On the floor, a few strides in from the lane. */
  spawn: { x: -30, z: 2 },
  safety: 'none',
  exits: [
    {
      // West, back onto Ashfall's cross-street. Gateless: the Magistracy does not seal a
      // market, it taxes one.
      to: 'ashfall_ward',
      x: -46,
      z: 2,
      label: 'Back onto the cross-street',
      arrive: { x: 30, z: 10 },
    },
  ],
  props: {
    /** Everything here is about food that is out in the open. Gulls follow a market inland. */
    sky: 'ash',
    wildlife: [
      { kind: 'gull', x: -42, z: -38, roam: 20, count: 3 },
      { kind: 'gull', x: 46, z: -2, roam: 20, count: 3 },
      { kind: 'rat', x: -26, z: -34, roam: 5, count: 2 },
      { kind: 'rat', x: 2, z: -18, roam: 5, count: 2 },
      { kind: 'rat', x: -2, z: 2, roam: 5, count: 2 },
      { kind: 'rat', x: -38, z: 22, roam: 5, count: 2 },
      { kind: 'rook', x: -26, z: -38, roam: 22, count: 4 },
    ],
    /** The stall rows are the legend (`T`), so this is what hangs off them, not the stalls themselves. */
    dressing: [
      { kind: 'awning', x: -46, z: -38, yaw: 0 },
      { kind: 'awning', x: 46, z: -34, yaw: 0 },
      { kind: 'awning', x: 34, z: -26, yaw: 0 },
      { kind: 'awning', x: 30, z: -18, yaw: 0 },
      { kind: 'awning', x: 30, z: -10, yaw: 0 },
      { kind: 'awning', x: 42, z: -2, yaw: 0 },
      { kind: 'awning', x: -34, z: 10, yaw: 0 },
      { kind: 'awning', x: -30, z: 18, yaw: 0 },
      { kind: 'awning', x: -30, z: 26, yaw: 0 },
      { kind: 'awning', x: -42, z: 34, yaw: 0 },
      { kind: 'rack', x: -42, z: -34 },
      { kind: 'rack', x: -14, z: -26 },
      { kind: 'rack', x: 6, z: -18 },
      { kind: 'rack', x: 42, z: -10 },
      { kind: 'rack', x: -38, z: 2 },
      { kind: 'rack', x: -42, z: 10 },
      { kind: 'rack', x: -10, z: 18 },
      { kind: 'rack', x: 30, z: 26 },
      { kind: 'sacks', x: -38, z: -34 },
      { kind: 'sacks', x: -26, z: -22 },
      { kind: 'sacks', x: -10, z: -10 },
      { kind: 'sacks', x: -22, z: 2 },
      { kind: 'sacks', x: 10, z: 10 },
      { kind: 'sacks', x: 34, z: 22 },
      { kind: 'barrel', x: -34, z: -34 },
      { kind: 'barrel', x: 34, z: -18 },
      { kind: 'barrel', x: -18, z: 2 },
      { kind: 'barrel', x: -2, z: 18 },
    ],
    /**
     * The traders the market was missing.
     *
     * Spread one to an aisle rather than clustered, so the stall rows still read as streets
     * you walk down and not as a queue. None of them stands in a lane a dead end opens off.
     */
    npcs: [
      { id: 'bonemarket_lamplighter', x: -26, z: -34, art: 'night_watchman', label: 'Talk to the lamplighter' },
      { id: 'bonemarket_grocer', x: -14, z: -10, art: 'grocer', label: 'Talk to the grocer' },
      { id: 'bonemarket_fishmonger', x: 18, z: -10, art: 'fishmonger', label: 'Talk to the fishmonger' },
      { id: 'bonemarket_jeweler', x: -14, z: 22, art: 'jeweler', label: 'Talk to the jeweller' },
      { id: 'bonemarket_stallkeeper', x: 22, z: 10, art: 'shopkeeper', label: 'Talk to the stallkeeper' },
      { id: 'bonemarket_butcher', x: -18, z: -6, art: 'butcher', label: 'Talk to the butcher' },
      { id: 'bonemarket_alchemist', x: -10, z: -6, art: 'alchemist', label: 'Talk to the alchemist' },
    ],
    /** Strung down the two lanes, not over the floor — the trade brings its own light. */
    /**
     * Who walks the row.
     *
     * A market packs up after dark, so somebody has to light it while it does.
     */
    lamplighter: 'bonemarket_lamplighter',
    lamps: [
      { x: -22, z: -34 },
      { x: 10, z: -34 },
      { x: -22, z: 22 },
      { x: 10, z: 22 },
      { x: -6, z: 34 },
    ],
    /** Stock, and what the stock came in. */
    crates: [
      { x: -38, z: -18 },
      { x: 26, z: -18 },
      { x: -38, z: 14 },
      { x: 30, z: 14 },
      { x: 2, z: -6 },
    ],
    graffiti: [
      {
        text: 'WEIGH IT TWICE',
        wallX: -34,
        wallZ: -38,
        dx: 3,
        facesSouth: true,
        tint: '#c2a25e',
      },
      {
        text: 'NOTHING HERE WAS GIVEN',
        wallX: 14,
        wallZ: 38,
        dx: -4,
        facesSouth: false,
        tint: '#8f6f9e',
      },
    ],
    horizon: 'city',
  },
});
