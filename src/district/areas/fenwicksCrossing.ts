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
 * Fifty-two by thirty-four now, grown evenly from thirty-four by twenty-two, and two roofs on the
 * north frontage. The toll house stands on
 * the bridgehead where Fenwick took the toll, with the book he took it in. The coach inn is the
 * other, and under the inn are the cellars: the `cellar_clearance` contract is fought down the
 * hatch behind the bar now, where the barking is, rather than on the cobbles behind the house.
 *
 * What the growth added is the other side of the river, and the river itself: wider, a band
 * across the map now rather than the map's edge, with **the great bridge** over it six carts
 * wide and a chapel standing on its deck for the crossing's prayers and its tolls. North of it,
 * **the far bank**, the Chalk Road side and a different place: the ferry hut and landing, the
 * far bank's own watermill with its wheel in a race off the river, the drovers' fold, the old
 * moorings. The town side gets its south ferry landing west of the bridgehead, the tollers'
 * lodge to the east, and a burying ground grown with the town.
 *
 * The Bridge Tollers walk the bridge by day, end to end; at night a crew of them works the far
 * bank, where the drovers hold the herds they would rather not pay for.
 */

import { TILE, defineArea, type AreaDef, type TileDef } from '../map.js';

/**
 * The Crossing's legend.
 *
 *   c  cobbles      — the frontages and the bridgehead
 *   ,  chalk street — the through street, and the bridge itself
 *   f  ploughed strip
 *   .  weeds
 *   #  grass        — the far bank
 *   W  the river     — impassable
 *   B  town building — impassable
 *   I  the coach inn — impassable; timber, three stacks
 *   X  the toll house — impassable; dressed stone, Fenwick's
 *   T  hedge        — impassable, the boundary
 *   h  cottage      — impassable; the ferry hut, the ferryman's, the tollers' lodge
 *   M  the watermill — impassable; the far bank's, timber
 *   r  the mill race — impassable
 *   b  a plank      — over the race
 */
const FEN_LEGEND: Record<string, TileDef> = {
  c: { tex: 'cobble', safe: false, walk: true },
  ',': { tex: 'chalk', safe: false, walk: true },
  f: { tex: 'field', safe: false, walk: true },
  '.': { tex: 'weeds', safe: false, walk: true },
  '#': { tex: 'grass', safe: false, walk: true },
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
  h: {
    tex: 'grass',
    safe: false,
    walk: false,
    solid: { style: 'cottage', minHeight: 3.6, maxHeight: 4.2, inset: 0.3, depthInset: 0.3, chimneyChance: 0.7, split: true, wall: 'plaster' },
  },
  M: {
    tex: 'grass',
    safe: false,
    walk: false,
    solid: { style: 'hall', minHeight: 5.6, maxHeight: 5.6, inset: 0.3, depthInset: 0.3, chimneyChance: 0.4, split: false, wall: 'timber' },
  },
  r: { tex: 'water', safe: false, walk: false },
  b: { tex: 'planks', safe: false, walk: true },
};

/** Three rows of river now, a band with the far bank above it; the great bridge crosses it. */
const WATER_ROWS = 3;
const WATER_ROW0 = 5;


/**
 * 34 wide by 22 deep.
 *
 * A river town is wide and thin by nature. Row 2 is the bridgehead and carries the crossing
 * north; column 0 opens at rows 8 and 9, which is the through street running west, and column
 * 33 at the same rows, running east onto the Shelf.
 */
const GRID: readonly string[] = [
  'TTTTTTTTTTTTTTTTTTTTTTTTT,,TTTTTTTTTTTTTTTTTTTTTTTTT', //  0  the far hedge; the lane north, to the Chalk Road
  'T#hhh####################,,######rMMMMM############T', //  1  THE FAR BANK: the ferry hut (west)     the lane     THE WATERMILL and its race (east)
  'T#hhh####################,,######rMMMMM############T', //  2
  'T#ccccccc################,,######b#################T', //  3  the north ferry landing
  'T#ccccccc##############cccccc####r#################T', //  4  the bridge's north landing
  'WWWWWWWWWWWWWWWWWWWWWWW,,,,,,WWWWWWWWWWWWWWWWWWWWWWW', //  5  the river, wider now -- THE GREAT BRIDGE across it, and the bridge chapel on it
  'WWWWWWWWWWWWWWWWWWWWWWW,,,,,,WWWWWWWWWWWWWWWWWWWWWWW', //  6  the river
  'WWWWWWWWWWWWWWWWWWWWWWW,,,,,,WWWWWWWWWWWWWWWWWWWWWWW', //  7
  'TccccccccTcccccccccccccccccccccccccccccccccccccccccc', //  8  the bridgehead — the south ferry landing (west)                   the quay (east)
  'TccccccccTcc.ccccccccccccccccXXXXccc.cccccTffhhhhffT', //  9  THE TOLL HOUSE, on the bridgehead; the tollers' lodge (east)
  'TchhhcccccccIIIIIIcccccccccccXXXXccBBBBBBcTffhhhhffT', // 10  THE COACH INN, and the north frontage
  'TfhhhffffTccIIIIIIcccccccccccccccccBBBBBBccccccccccT', // 11  the toll house door
  'TffffffffTccccccccccccccccccccccccccccccccTccccccccT', // 12  the inn door
  'TffffffffTffffffccccccccccccccccccccffffffTffffffffT', // 13
  ',,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,', // 14  the through street: west to Weeping Stile, east to the Shelf
  ',,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,', // 15
  'TffffffffTccccccccccccccccccccccccccccccccTffffffffT', // 16
  'TffffffffTccBBBBBBccccccccccccBBBBBBBcccccTffffffffT', // 17  the south frontages
  'TffffffffTccBBBBBBccccccccccccBBBBBBBcccccTffffffffT', // 18
  'TffffffffTccccccccccccccccccccccccccccccccTffffffffT', // 19
  'Tfffffffffffffffffcc..ccccfffffffffffffffffffffffffT', // 20
  'TffffffffTffffffffffffffffffffffffffffffffTffffffffT', // 21
  'TffffffffTffffffffffffffffffffffffffffffffTffffffffT', // 22
  'TffffffffTffffffffffffffffffffffffffffffffTffffffffT', // 23
  'TffffffffTffffffffffffff....ffffffffffffffTffffffffT', // 24  the burying ground, such as it is
  'TffffffffTffffffffffffffffffffffffffffffffTffffffffT', // 25
  'TffffffffTffffffffffffffffffffffffffffffffTffffffffT', // 26
  'TffffffffTTTTTffTTTTTTTTTTTTTTTTTTTTffTTTTTffffffffT', // 27
  'Tfffffffffffffffffff............fffffffffffffffffffT', // 28  the burying ground, grown with the town
  'Tfffffffffffffffffff............fffffffffffffffffffT', // 29
  'TffffffffffffffffffffffffffffffffffffffffffffffffffT', // 30
  'TTTTTTTTTTTTffTTTTTTTTTTTTTTTTTTTTTTTTffTTTTTTTTTTTT', // 31  a hedge between the strips
  'TffffffffffffffffffffffffffffffffffffffffffffffffffT', // 32
  'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT', // 33  the far hedge
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
      // Over the great bridge and up the far bank's lane to the edge.
      to: 'chalk_road',
      x: -2,
      z: zOfRow(0),
      label: 'North, up the far bank to the Chalk Road',
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
      x: xOfCol(30.5),
      z: zOfRow(10) + TILE / 2 + 1.4,
      label: 'Into the toll house',
      door: { x: xOfCol(30.5), z: zOfRow(10) + TILE / 2 + 0.05, facesSouth: true, sign: 'toll', style: 'iron' },
      arrive: { x: 0, z: 14 },
    },
    {
      // The coach inn. Every rumour on Azo drinks here, and the cellars are under the bar.
      to: 'fenwicks_inn',
      x: xOfCol(14.5),
      z: zOfRow(11) + TILE / 2 + 1.4,
      label: 'Into the coach inn',
      door: { x: xOfCol(14.5), z: zOfRow(11) + TILE / 2 + 0.05, facesSouth: true, sign: 'tavern' },
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
      // Herons on the far bank, gulls over the bridge.
      { kind: 'heron', x: -40, z: -58, roam: 6 },
      { kind: 'gull', x: 10, z: -46, roam: 20, count: 3 },
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

      // The far bank: the ferry's posts, the old moorings, the drovers' hurdles, the mill's sacks.
      { kind: 'bollard', x: -90, z: -49 },
      { kind: 'bollard', x: -74, z: -49 },
      { kind: 'bollard', x: 50, z: -49 },
      { kind: 'bollard', x: 62, z: -49 },
      { kind: 'bollard', x: 78, z: -49 },
      { kind: 'pens', x: 74, z: -62 },
      { kind: 'pens', x: 86, z: -62 },
      { kind: 'sacks', x: 42, z: -50 },
      { kind: 'cart', x: 46, z: -54 },
      // The south ferry landing.
      { kind: 'bollard', x: -94, z: -34.6 },
      { kind: 'bollard', x: -78, z: -34.6 },
      { kind: 'rack', x: -70, z: -30 },
      // The tollers' lodge yard: the rates on a post.
      { kind: 'barrel', x: 80, z: -22 },
      { kind: 'noticepost', x: 90, z: -22 },
      // The burying ground.
      { kind: 'gravestone', x: -10, z: 46 },
      { kind: 'gravestone', x: 6, z: 46 },
      { kind: 'gravestone', x: 14, z: 50 },
      { kind: 'wildflowers', x: -2, z: 50 },
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
        wallZ: zOfRow(17) - TILE / 2 - 0.05,
        dx: 0,
        facesSouth: false,
        tint: '#9e8f5e',
      },
    ],
    waterRows: WATER_ROWS,
    waterRow0: WATER_ROW0,
    horizon: 'treeline',
    /**
     * The Bridge Tollers: one crew walks the great bridge by day, far landing to bridgehead and
     * back, down the lane the chapel leaves open; a crew of them works the far bank at night.
     */
    packs: [
      {
        encounterId: 'pack_bridge_tollers',
        id: 'bridge',
        x: 4,
        z: -42,
        roam: 6,
        hours: 'day',
        band: 'bridge',
        behaviour: 'beat',
        route: [
          { x: 4, z: -54 },
          { x: 4, z: -30 },
        ],
      },
      { encounterId: 'pack_bridge_tollers', id: 'far_bank', x: 70, z: -58, roam: 6, hours: 'night', band: 'far_bank' },
    ],
    /** The bridge chapel, standing on the great bridge's deck; the far bank's wheel in its race. */
    landmarks: [
      { kind: 'bell_tower', x: -8, z: -42 },
      { kind: 'water_wheel', x: 34, z: -54 },
    ],
    vignettes: [{ id: 'fish_racks', x: -74, z: -24 }],
  },
});
