/**
 * The Bonemarket — where Jolrek sells what is left of things.
 *
 * A covered market that outgrew its building. The trade spilled out of the arcade into the
 * lanes either side of it, and the stall rows have stood in the same places long enough that
 * the ward now treats them as streets: you do not walk through the market, you walk the gaps
 * between what people have decided to leave standing.
 *
 * The shape is the argument. Bands north to south — a lane, the market floor, the Hall, the
 * floor again, a lane, the yards — and the floor is the only open ground in the ward.
 * Everything interesting is a dead end behind a stall row, which is what a market feels like
 * and what a grid of streets does not. The arcade is a building again: the Market Hall, the
 * one roof the trade never spilled out from under, and the five traders who were standing in
 * the aisles are behind their slabs inside it. South of the lanes, the bone-boiler's yard the
 * ward is named for, and the pawnshop where what did not sell ends up.
 *
 * Nothing hunts here. It is a place to walk -- and, in the comb under the east eaves, one
 * place that bites.
 */

import { TILE, defineArea, type AreaDef, type TileDef } from '../map.js';

/**
 * The market's legend.
 *
 *   m  market floor  — trodden dirt over the old paving
 *   c  cobbles       — the lanes, still swept
 *   .  weeds         — the corners nobody trades in, and the yards
 *   T  stall row     — impassable, low, taken whole so a row reads as a row
 *   A  arcade pillar — impassable, tall and narrow
 *   H  the Market Hall — impassable; stone, the arcade with its roof back on
 *   P  the pawnshop  — impassable; plaster, one storey
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
    solid: { style: 'stall', minHeight: 1.9, maxHeight: 2.4, inset: 0.9, depthInset: 1.1, chimneyChance: 0, split: false },
  },
  A: {
    tex: 'cobble',
    safe: false,
    walk: false,
    solid: { style: 'wall', minHeight: 5.4, maxHeight: 5.4, inset: 1.3, depthInset: 1.3, chimneyChance: 0, split: false },
  },
  H: {
    tex: 'market',
    safe: false,
    walk: false,
    solid: { style: 'hall', minHeight: 7.0, maxHeight: 7.0, inset: 0.3, depthInset: 0.3, chimneyChance: 0, split: false, wall: 'stone' },
  },
  P: {
    tex: 'cobble',
    safe: false,
    walk: false,
    solid: { style: 'shopfront', minHeight: 4.6, maxHeight: 4.6, inset: 0.3, depthInset: 0.3, chimneyChance: 0.6, split: false, wall: 'plaster' },
  },
  B: {
    tex: 'cobble',
    safe: false,
    walk: false,
    solid: { style: 'terrace', minHeight: 4.4, maxHeight: 6.4, inset: 0.3, depthInset: 0.3, chimneyChance: 0.35, split: true },
  },
};

const M30 = 'm'.repeat(30);
const C30 = 'c'.repeat(30);

/**
 * 32 wide by 24 deep.
 *
 * Column 0 opens at rows 9 and 10 and nowhere else — the one way in, off Ashfall's
 * cross-street. Everything else is range wall, which is what makes the market feel enclosed
 * rather than laid out.
 */
const GRID: readonly string[] = [
  'BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB', //  0  the north range
  `B${C30}B`, //  1  the north lane
  'Bc.TTTTT.cc.TTTTTTT.cc.TTTTT.ccB', //  2  stall rows, backed onto the range
  'BccTTTTTccccTTTTTTTccccTTTTTcccB', //  3
  'Bmmmmmmmmmmmmmmmmmmmmmmmmmmmmm.B', //  4  the market floor begins
  'Bmm.TTTTTT.mmmm.TTTTT.mmmm.TTT.B', //  5
  'BmmmTTTTTTmmmmmmTTTTTmmmmmmTTTmB', //  6
  `B${M30}B`, //  7
  'BAmmmmmmHHHHHHHHHHHHHHHHmmmmmmAB', //  8  THE MARKET HALL, between the arcade's last pillars
  'cmmmmmmmHHHHHHHHHHHHHHHHmmmmmmmB', //  9  the way in, off the ward
  'cmmmmmmmHHHHHHHHHHHHHHHHmmmmmmmB', // 10
  'BAmmmmmmHHHHHHHHHHHHHHHHmmmmmmAB', // 11
  `B${M30}B`, // 12  the Hall's door, on its south face
  'Bmm.TTTT.mmmmm.TTTTTTT.mmmm.TT.B', // 13
  'BmmmTTTTmmmmmmmTTTTTTTmmmmmmTTmB', // 14
  'Bcccccccccccccccccccccccccccc..B', // 15  the south lane
  'Bc.TTTTTT.cc.TTTTT.ccccc.PPPP.cB', // 16  THE PAWNSHOP, east
  'BccTTTTTTccccTTTTTcccccccPPPPccB', // 17
  `B${C30}B`, // 18  the back lane
  'B.........cccccccccc...........B', // 19  west: the bone-boiler's yard   east: the eaves
  'B.........cccccccccc...........B', // 20
  'B.........cccccccccc...........B', // 21
  `B${C30}B`, // 22
  'BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB', // 23  the south range
];

const HALF_X = (GRID[0]!.length * TILE) / 2;
const HALF_Z = (GRID.length * TILE) / 2;
const xOfCol = (col: number): number => col * TILE - HALF_X + TILE / 2;
const zOfRow = (row: number): number => row * TILE - HALF_Z + TILE / 2;

export const BONEMARKET_ID = 'bonemarket';

export const BONEMARKET: AreaDef = defineArea({
  id: BONEMARKET_ID,
  name: 'The Bonemarket',
  grid: GRID,
  legend: MARKET_LEGEND,
  /** On the floor, a few strides in from the lane. */
  spawn: { x: -48, z: -8 },
  safety: 'none',
  exits: [
    {
      // West, back onto Ashfall's cross-street. Gateless: the Magistracy does not seal a
      // market, it taxes one.
      to: 'ashfall_ward',
      x: -HALF_X + 2,
      z: -8,
      label: 'Back onto the cross-street',
      arrive: { x: 54, z: 8 },
    },
    {
      // The Hall. Its door is on the south face, onto the floor, because the floor is where
      // everybody already is.
      to: 'bonemarket_hall',
      x: 0,
      z: zOfRow(11) + TILE / 2 + 1.4,
      label: 'Into the Market Hall',
      door: { x: 0, z: zOfRow(11) + TILE / 2 + 0.05, facesSouth: true, sign: 'market', style: 'arch' },
      arrive: { x: 0, z: 20 },
    },
    {
      // The pawnshop, off the south lane. What did not sell on the floor ends up here.
      to: 'bonemarket_pawnshop',
      x: xOfCol(26.5),
      z: zOfRow(16) - TILE / 2 - 1.4,
      label: 'Into the pawnshop',
      door: { x: xOfCol(26.5), z: zOfRow(16) - TILE / 2 - 0.05, facesSouth: false, sign: 'pawn' },
      arrive: { x: 0, z: -16 },
    },
  ],
  props: {
    /** Everything here is about food that is out in the open. Gulls follow a market inland. */
    sky: 'ash',
    wildlife: [
      { kind: 'gull', x: -42, z: -46, roam: 20, count: 3 },
      { kind: 'gull', x: 46, z: -10, roam: 20, count: 3 },
      { kind: 'rat', x: -26, z: -34, roam: 5, count: 2 },
      { kind: 'rat', x: 2, z: -18, roam: 5, count: 2 },
      { kind: 'rat', x: -10, z: 2, roam: 5, count: 2 },
      { kind: 'rat', x: -38, z: 26, roam: 5, count: 2 },
      { kind: 'rook', x: -26, z: -46, roam: 22, count: 4 },
    ],
    /** The stall rows are the legend (`T`), so this is what hangs off them, not the stalls themselves. */
    dressing: [
      // Awnings over the rows, and the racks, sacks and casks of the trade.
      { kind: 'awning', x: -42, z: -38, yaw: 0 },
      { kind: 'awning', x: -2, z: -38, yaw: 0 },
      { kind: 'awning', x: 38, z: -38, yaw: 0 },
      { kind: 'awning', x: -34, z: -22, yaw: 0 },
      { kind: 'awning', x: 10, z: -22, yaw: 0 },
      { kind: 'awning', x: 50, z: -22, yaw: 0 },
      { kind: 'awning', x: -34, z: 10, yaw: 0 },
      { kind: 'awning', x: 14, z: 10, yaw: 0 },
      { kind: 'awning', x: 50, z: 10, yaw: 0 },
      { kind: 'awning', x: -42, z: 20, yaw: 0 },
      { kind: 'awning', x: -6, z: 20, yaw: 0 },
      { kind: 'rack', x: -54, z: -38 },
      { kind: 'rack', x: 26, z: -22 },
      { kind: 'rack', x: -10, z: 10 },
      { kind: 'rack', x: 58, z: 20 },
      { kind: 'sacks', x: -50, z: -30 },
      { kind: 'sacks', x: -6, z: -30 },
      { kind: 'sacks', x: -14, z: 6 },
      { kind: 'sacks', x: 26, z: 6 },
      { kind: 'sacks', x: -54, z: 20 },
      { kind: 'barrel', x: -58, z: -30 },
      { kind: 'barrel', x: 42, z: -30 },
      { kind: 'barrel', x: -58, z: 6 },
      { kind: 'barrel', x: 58, z: 6 },
      { kind: 'brazier', x: -30, z: -30 },
      { kind: 'brazier', x: 30, z: -30 },
      { kind: 'brazier', x: -30, z: 6 },
      { kind: 'brazier', x: 30, z: 6 },
      // The bone-boiler's yard.
      { kind: 'spoilheap', x: -50, z: 36 },
      { kind: 'cart', x: -14, z: 36 },
      { kind: 'trough', x: -54, z: 30 },
      { kind: 'barrel', x: -34, z: 30 },
      // The east yard, under the eaves.
      { kind: 'logpile', x: 30, z: 36 },
      { kind: 'washing', x: 46, z: 30, yaw: 0 },
      { kind: 'bramble', x: 58, z: 36 },
      { kind: 'wildflowers', x: 40, z: 36 },
    ],
    /**
     * Who is still out on the floor.
     *
     * The five traders with slabs are inside the Hall now; what stays out is the trade that
     * never had a slab -- the alchemist's Core bench, the lamplighter, and the boiler in his
     * yard, who is the reason the ward is called what it is.
     */
    npcs: [
      { id: 'bonemarket_lamplighter', x: -50, z: -42, art: 'night_watchman', label: 'Talk to the lamplighter' },
      { id: 'bonemarket_alchemist', x: -22, z: 4, art: 'alchemist', label: 'Talk to the alchemist' },
      { id: 'bonemarket_boiler', x: -40, z: 32, art: 'tanner', label: 'Talk to the bone-boiler' },
    ],
    /**
     * Who walks the row.
     *
     * A market packs up after dark, so somebody has to light it while it does. Strung down the
     * lanes, not over the floor — the trade brings its own light.
     */
    lamplighter: 'bonemarket_lamplighter',
    lamps: [
      { x: -30, z: -42 },
      { x: 2, z: -42 },
      { x: 34, z: -42 },
      { x: -30, z: 14 },
      { x: 2, z: 14 },
      { x: 34, z: 14 },
      { x: -10, z: 26 },
      { x: 20, z: 26 },
    ],
    /** Stock, and what the stock came in. */
    crates: [
      { x: -46, z: -30 },
      { x: 46, z: -30 },
      { x: -46, z: 2 },
      { x: 46, z: 2 },
      { x: 10, z: 2 },
    ],
    graffiti: [
      { text: 'WEIGH IT TWICE', wallX: -34, wallZ: zOfRow(0) + TILE / 2 + 0.05, dx: 3, facesSouth: true, tint: '#c2a25e' },
      { text: 'NOTHING HERE WAS GIVEN', wallX: 14, wallZ: zOfRow(23) - TILE / 2 - 0.05, dx: -4, facesSouth: false, tint: '#8f6f9e' },
      // On the Hall's face, beside the door: what the building was before the trade arrived.
      { text: 'THIS WAS A CHAPEL', wallX: 0, wallZ: zOfRow(11) + TILE / 2 + 0.05, dx: 8, facesSouth: true, tint: '#a09a82' },
    ],
    horizon: 'city',
  },
});
