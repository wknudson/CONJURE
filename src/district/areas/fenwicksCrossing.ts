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
 *
 * Thirty-four by twenty-two now, and two roofs on the north frontage. The toll house stands on
 * the bridgehead where Fenwick took the toll, with the book he took it in. The coach inn is the
 * other, and under the inn are the cellars: the `cellar_clearance` contract is fought down the
 * hatch behind the bar now, where the barking is, rather than on the cobbles behind the house.
 */

import { TILE, defineArea, type AreaDef, type TileDef } from '../map.js';

/**
 * The Crossing's legend.
 *
 *   c  cobbles      — the frontages and the bridgehead
 *   ,  chalk street — the through street, and the bridge itself
 *   f  ploughed strip
 *   .  weeds
 *   W  the river     — impassable
 *   B  town building — impassable
 *   I  the coach inn — impassable; timber, three stacks
 *   X  the toll house — impassable; dressed stone, Fenwick's
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
    solid: { style: 'terrace', minHeight: 3.8, maxHeight: 5.6, inset: 0.35, depthInset: 0.35, chimneyChance: 0.55, split: true },
  },
  I: {
    tex: 'cobble',
    safe: false,
    walk: false,
    solid: { style: 'shopfront', minHeight: 6.2, maxHeight: 6.2, inset: 0.3, depthInset: 0.3, chimneyChance: 1, split: false, wall: 'timber' },
  },
  X: {
    tex: 'cobble',
    safe: false,
    walk: false,
    solid: { style: 'hall', minHeight: 5.4, maxHeight: 5.4, inset: 0.3, depthInset: 0.3, chimneyChance: 0, split: false, wall: 'stone' },
  },
  T: {
    tex: 'grass',
    safe: false,
    walk: false,
    solid: { style: 'foliage', minHeight: 3.2, maxHeight: 4.6, inset: 0.75, depthInset: 0.75, chimneyChance: 0, split: true },
  },
};

/** Two rows of river along the north edge. The bridge is the quay row below it. */
const WATER_ROWS = 2;

const COBBLES = `T${'c'.repeat(32)}T`;
const STRIP = `T${'f'.repeat(32)}T`;
const SOUTH_FRONT = `Tcc${'B'.repeat(6)}${'c'.repeat(12)}${'B'.repeat(7)}${'c'.repeat(5)}T`;

/**
 * 34 wide by 22 deep.
 *
 * A river town is wide and thin by nature. Row 2 is the bridgehead and carries the crossing
 * north; column 0 opens at rows 8 and 9, which is the through street running west, and column
 * 33 at the same rows, running east onto the Shelf.
 */
const GRID: readonly string[] = [
  'W'.repeat(34), //  0  the river
  'W'.repeat(34), //  1
  COBBLES, //  2  the bridgehead — north, over the water
  `Tcc.${'c'.repeat(16)}${'X'.repeat(4)}ccc.cccccT`, //  3  THE TOLL HOUSE, on the bridgehead
  `Tcc${'I'.repeat(6)}${'c'.repeat(11)}${'X'.repeat(4)}cc${'B'.repeat(6)}cT`, //  4  THE COACH INN, and the north frontage
  `Tcc${'I'.repeat(6)}${'c'.repeat(17)}${'B'.repeat(6)}cT`, //  5  the toll house door
  COBBLES, //  6  the inn door
  `T${'f'.repeat(6)}${'c'.repeat(20)}${'f'.repeat(6)}T`, //  7
  ','.repeat(34), //  8  the through street: west to Weeping Stile, east to the Shelf
  ','.repeat(34), //  9
  COBBLES, // 10
  SOUTH_FRONT, // 11  the south frontages
  SOUTH_FRONT, // 12
  COBBLES, // 13
  `T${'f'.repeat(8)}cc..cccc${'f'.repeat(16)}T`, // 14
  STRIP, // 15
  STRIP, // 16
  STRIP, // 17
  `T${'f'.repeat(14)}....${'f'.repeat(14)}T`, // 18  the burying ground, such as it is
  STRIP, // 19
  STRIP, // 20
  'T'.repeat(34), // 21
];

const HALF_X = (GRID[0]!.length * TILE) / 2;
const HALF_Z = (GRID.length * TILE) / 2;
const xOfCol = (col: number): number => col * TILE - HALF_X + TILE / 2;
const zOfRow = (row: number): number => row * TILE - HALF_Z + TILE / 2;

export const FENWICKS_CROSSING_ID = 'fenwicks_crossing';

export const FENWICKS_CROSSING: AreaDef = defineArea({
  id: FENWICKS_CROSSING_ID,
  name: "Fenwick's Crossing",
  grid: GRID,
  legend: FEN_LEGEND,
  /** On the through street, between the two frontages. */
  spawn: { x: 0, z: -6 },
  safety: 'none',
  exits: [
    {
      to: 'chalk_road',
      x: -2,
      z: zOfRow(2),
      label: 'North, over the bridge to the Chalk Road',
      arrive: { x: 38, z: 14 },
    },
    {
      to: 'weeping_stile',
      x: -HALF_X + 2,
      z: -6,
      label: 'West, up the lane to Weeping Stile',
      arrive: { x: 26, z: -2 },
    },
    {
      // East, up onto the shelf. The through street runs the whole width of the town and out
      // both ends, which is the one thing a river town's street is for.
      to: 'storm_shelf',
      x: HALF_X - 2,
      z: -6,
      label: 'East, up onto the Storm Shelf',
      arrive: { x: -42, z: -6 },
    },
    {
      // The toll house. Fenwick's, and then the Magistracy's, and the book never changed hands.
      to: 'fenwicks_toll_house',
      x: xOfCol(21.5),
      z: zOfRow(4) + TILE / 2 + 1.4,
      label: 'Into the toll house',
      door: { x: xOfCol(21.5), z: zOfRow(4) + TILE / 2 + 0.05, facesSouth: true, sign: 'toll', style: 'iron' },
      arrive: { x: 0, z: 14 },
    },
    {
      // The coach inn. Every rumour on Azo drinks here, and the cellars are under the bar.
      to: 'fenwicks_inn',
      x: xOfCol(5.5),
      z: zOfRow(5) + TILE / 2 + 1.4,
      label: 'Into the coach inn',
      door: { x: xOfCol(5.5), z: zOfRow(5) + TILE / 2 + 0.05, facesSouth: true, sign: 'tavern' },
      arrive: { x: 0, z: 18 },
    },
  ],
  props: {
    /** A bridge town on a river. Everything here belongs to the water. */
    sky: 'drizzle',
    wildlife: [
      { kind: 'gull', x: -54, z: -42, roam: 22, count: 4 },
      { kind: 'gull', x: -6, z: 2, roam: 22, count: 4 },
      { kind: 'heron', x: -26, z: -34, roam: 6 },
      { kind: 'crab', x: -18, z: -34, roam: 4, count: 2 },
      { kind: 'crab', x: -22, z: -6, roam: 4, count: 2 },
      { kind: 'crab', x: 18, z: 18, roam: 4, count: 2 },
      { kind: 'rat', x: -14, z: -34, roam: 5, count: 2 },
      { kind: 'rat', x: -30, z: 6, roam: 5, count: 2 },
    ],
    /** Coach inn and bridge. Beer, horses, and somewhere to tie them. */
    dressing: [
      { kind: 'barrel', x: -50, z: -34 },
      { kind: 'barrel', x: 6, z: -30 },
      { kind: 'barrel', x: -2, z: -22 },
      { kind: 'barrel', x: 46, z: -14 },
      { kind: 'barrel', x: -10, z: -2 },
      { kind: 'barrel', x: 50, z: 2 },
      { kind: 'barrel', x: -14, z: 10 },
      { kind: 'barrel', x: -26, z: 18 },
      { kind: 'barrel', x: -2, z: 22 },
      { kind: 'barrel', x: 26, z: 26 },
      { kind: 'trough', x: -46, z: -34 },
      { kind: 'trough', x: -14, z: -18 },
      { kind: 'trough', x: 54, z: 2 },
      { kind: 'trough', x: 38, z: 18 },
      { kind: 'cart', x: -38, z: -34 },
      { kind: 'cart', x: -10, z: -18 },
      { kind: 'cart', x: 46, z: 2 },
      { kind: 'cart', x: 42, z: 18 },
      { kind: 'fence', x: -34, z: -34, yaw: 0 },
      { kind: 'fence', x: 18, z: -14, yaw: 0 },
      { kind: 'fence', x: 6, z: -2, yaw: 0 },
      { kind: 'fence', x: -58, z: 6, yaw: 0 },
      { kind: 'fence', x: 18, z: 14, yaw: 0 },
      { kind: 'fence', x: 50, z: 22, yaw: 0 },
      { kind: 'haybale', x: -30, z: -34 },
      { kind: 'haybale', x: -6, z: -18 },
      { kind: 'haybale', x: -46, z: 10 },
      { kind: 'haybale', x: 50, z: 18 },
      { kind: 'reeds', x: -58, z: -34 },
      { kind: 'reeds', x: -50, z: -30 },
      { kind: 'reeds', x: 34, z: -30 },
      { kind: 'reeds', x: -2, z: -26 },
      { kind: 'reeds', x: 2, z: -22 },
      { kind: 'reeds', x: -18, z: -18 },
      { kind: 'bollard', x: -54, z: -34 },
      { kind: 'bollard', x: 6, z: -34 },
      { kind: 'bollard', x: 26, z: -34 },
      { kind: 'awning', x: -36, z: -18, yaw: 0 },
    ],
    /**
     * The busiest street in the Ring, and the only place five people is not too many.
     *
     * The innkeeper on the street outside his own door, because the stall and the errands
     * find him there; the carpenter at the span he keeps re-decking; the cartographer by the
     * toll board, where the roads are written down.
     */
    npcs: [
      { id: 'fenwick_innkeeper', x: -22, z: -10, art: 'innkeeper', label: 'Talk to the innkeeper' },
      { id: 'fenwick_brewer', x: -6, z: -6, art: 'brewer', label: 'Talk to the brewer' },
      { id: 'fenwick_bard', x: 10, z: 6, art: 'bard', label: 'Listen to the bard' },
      { id: 'fenwick_cartographer', x: 34, z: -22, art: 'cartographer', label: 'Talk to the cartographer' },
      { id: 'fenwick_carpenter', x: -10, z: -30, art: 'carpenter', label: 'Talk to the carpenter' },
    ],
    /**
     * Who walks the row.
     *
     * A bridge town lit by its inn. Nobody is paid to do it -- an unlit crossing
     * is simply bad for trade, which is a better reason than a wage.
     */
    lamplighter: 'fenwick_innkeeper',
    lamps: [
      { x: -22, z: -34 },
      { x: 18, z: -34 },
      { x: -26, z: -6 },
      { x: 22, z: -6 },
    ],
    crates: [
      { x: -42, z: -34 },
      { x: 38, z: -34 },
      { x: -38, z: 22 },
    ],
    trees: [
      { x: -46, z: 26 },
      { x: 42, z: 26 },
      { x: -6, z: 26 },
    ],
    graffiti: [
      {
        // On the south frontage, facing the toll house across the street.
        text: 'FENWICK TOOK THE TOLL AND THE BRIDGE',
        wallX: 32,
        wallZ: zOfRow(11) - TILE / 2 - 0.05,
        dx: 0,
        facesSouth: false,
        tint: '#9e8f5e',
      },
    ],
    waterRows: WATER_ROWS,
    horizon: 'treeline',
  },
});
