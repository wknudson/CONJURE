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
 * Forty-eight by thirty-six now, grown evenly from thirty-two by twenty-four, and the market's
 * trades that were too foul for the floor have somewhere to be. North, down three gaps in the
 * north range, **the Shambles**: the lairage pens, the killing sheds, and the gutter that runs
 * to the canal. West, **Knacker's Lane**, the ward's back artery from the Shambles to the
 * works, with the knacker's yard off it and rag-and-bone dead ends; the way in off Ashfall
 * crosses it. East, through two gaps in the range, **the rag lanes**, a warren of sorting sheds.
 * South, **the glue works**, the vats between them and the tallow sheds below.
 *
 * By day nothing hunts here. After dark the Knacker's Lads work two beats -- one crew along the
 * Shambles, the other up and down Knacker's Lane, across the way in -- and the comb under the
 * east eaves still bites whatever the hour.
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
 *   u  the pens      — lairage mud, trodden to soup
 *   K  a killing shed — impassable; timber, and the knacker's the same
 *   d  the gutter    — impassable; the Shambles' channel, and the glue vats
 *   e  a board       — over the gutter
 *   k  a shed        — impassable; the rag lanes' sorting sheds, the tallow sheds
 *   G  the glue works — impassable; brick, a stack always going
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
  u: { tex: 'marsh', safe: false, walk: true },
  K: {
    tex: 'marsh',
    safe: false,
    walk: false,
    solid: { style: 'warehouse', minHeight: 4.2, maxHeight: 5.0, inset: 0.3, depthInset: 0.3, chimneyChance: 0.3, split: true, wall: 'timber' },
  },
  d: { tex: 'water', safe: false, walk: false },
  e: { tex: 'planks', safe: false, walk: true },
  k: {
    tex: 'weeds',
    safe: false,
    walk: false,
    solid: { style: 'cottage', minHeight: 3.2, maxHeight: 3.8, inset: 0.3, depthInset: 0.3, chimneyChance: 0.3, split: true, wall: 'plaster' },
  },
  G: {
    tex: 'cobble',
    safe: false,
    walk: false,
    solid: { style: 'warehouse', minHeight: 5.6, maxHeight: 6.4, inset: 0.3, depthInset: 0.3, chimneyChance: 1, split: true },
  },
};


/**
 * 48 wide by 36 deep.
 *
 * The west edge opens at rows 15 and 16 and nowhere else — the one way in, off Ashfall's
 * cross-street, across Knacker's Lane. Everything else is range wall, which is what makes the
 * market feel enclosed rather than laid out; the new quarters are reached through gaps in the
 * old ranges, which is how a market grows.
 */
const GRID: readonly string[] = [
  'BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB', //  0  the outer range
  'BuuuuuKKKKuuuuuuKKKKuuuuuuuuKKKKuuuuuuKKKKuuuuuB', //  1  THE SHAMBLES: the lairage pens and the killing sheds
  'BuuuuuKKKKuuuuuuKKKKuuuuuuuuKKKKuuuuuuKKKKuuuuuB', //  2
  'BccccccccccccccccccccccccccccccccccccccccccccccB', //  3  the Shambles lane (a crew of Knacker's Lads walks it at night)
  'BdddddddddddedddddddddddeddddddddddedddddddddddB', //  4  the gutter, boarded in three places
  'B..............................................B', //  5  the offal yard
  'BBBBBBccBBBBccBBBBBBBBBBccBBBBBBBBccBBBBBBBBBBBB', //  6  the north range, with three ways down through it
  'B.....ccBccccccccccccccccccccccccccccccBkkk.kkkB', //  7  KNACKER'S LANE (west: the knacker's yard)            THE RAG LANES (east)
  'B.KKK.ccBc.TTTTT.cc.TTTTTTT.cc.TTTTT.ccBkkk.kkkB', //  8  stall rows, backed onto the range
  'B.KKK.ccBccTTTTTccccTTTTTTTccccTTTTTcccB.......B', //  9
  'B.....ccBmmmmmmmmmmmmmmmmmmmmmmmmmmmmm.c.kk.kk.B', // 10  the market floor begins
  'B.....ccBmm.TTTTTT.mmmm.TTTTT.mmmm.TTT.B.kk.kk.B', // 11
  'B.....ccBmmmTTTTTTmmmmmmTTTTTmmmmmmTTTmB...k...B', // 12
  'B.....ccBmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmBkk.k.kkB', // 13
  'B.....ccBAmmmmmmHHHHHHHHHHHHHHHHmmmmmmABkk.k.kkB', // 14  THE MARKET HALL, between the arcade's last pillars
  'cccccccccmmmmmmmHHHHHHHHHHHHHHHHmmmmmmmB...k...B', // 15  the way in, off the ward -- across the lane the second crew walks
  'cccccccccmmmmmmmHHHHHHHHHHHHHHHHmmmmmmmB.kkkkk.B', // 16
  'BBBBBBccBAmmmmmmHHHHHHHHHHHHHHHHmmmmmmAB.kkkkk.B', // 17
  'BBBBBBccBmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmB.......B', // 18  the Hall's door, on its south face
  'B.....ccBmm.TTTT.mmmmm.TTTTTTT.mmmm.TT.Bkk.k.kkB', // 19  rag-and-bone dead ends off the lane
  'BBBBBBccBmmmTTTTmmmmmmmTTTTTTTmmmmmmTTmBkk.k.kkB', // 20
  'BBBBBBccBcccccccccccccccccccccccccccc..B...k...B', // 21  the south lane
  'BBBBBBccBc.TTTTTT.cc.TTTTT.ccccc.PPPP.cc.kk.kk.B', // 22  THE PAWNSHOP, east
  'B.....ccBccTTTTTTccccTTTTTcccccccPPPPccB.kk.kk.B', // 23
  'BBBBBBccBccccccccccccccccccccccccccccccB.......B', // 24  the back lane
  'BBBBBBccB.........cccccccccc...........Bkkk.kkkB', // 25  west: the bone-boiler's yard   east: the eaves
  'BBBBBBccB.........cccccccccc...........Bkkk.kkkB', // 26
  'B.....ccB.........cccccccccc...........B.......B', // 27
  'BBBBBBccBccccccccccccccccccccccccccccccBkkk.kkkB', // 28
  'BBBBBBccBBBBBB..BBBBBBBBBBBBBB..BBBBBBBBBBBBBBBB', // 29  the south range, the lane and two gaps through it
  'B..............................................B', // 30  THE GLUE WORKS: the yard
  'B...GGGGGGGGGG...dddddddddd...GGGGGGGGGGG......B', // 31  the works, the vats between them
  'B...GGGGGGGGGG...dddddddddd...GGGGGGGGGGG......B', // 32
  'BccccccccccccccccccccccccccccccccccccccccccccccB', // 33  the tallow lane
  'B..kkkkkk.............kkkkkk........kkkkkkkkk..B', // 34  the tallow sheds
  'BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB', // 35  the outer range
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
      arrive: { x: 102, z: 8 },
    },
    {
      // The Hall. Its door is on the south face, onto the floor, because the floor is where
      // everybody already is.
      to: 'bonemarket_hall',
      x: 0,
      z: zOfRow(17) + TILE / 2 + 1.4,
      label: 'Into the Market Hall',
      door: { x: 0, z: zOfRow(17) + TILE / 2 + 0.05, facesSouth: true, sign: 'market', style: 'arch' },
      arrive: { x: 0, z: 20 },
    },
    {
      // The pawnshop, off the south lane. What did not sell on the floor ends up here.
      to: 'bonemarket_pawnshop',
      x: xOfCol(34.5),
      z: zOfRow(22) - TILE / 2 - 1.4,
      label: 'Into the pawnshop',
      door: { x: xOfCol(34.5), z: zOfRow(22) - TILE / 2 - 0.05, facesSouth: false, sign: 'pawn' },
      arrive: { x: 0, z: -16 },
    },
  ],
  props: {
    /**
     * Who passes through by day: buyers, carters, the Shambles emptying out onto the lanes.
     */
    passersby: {
      peak: 6,
      folk: ['butcher_b', 'grocer', 'cobbler', 'herald', 'street_urchin', 'carpenter'],
      lanes: [
        [{ x: -60, z: 0 }, { x: 59, z: 0 }],
        [{ x: -60, z: 24 }, { x: 59, z: 24 }],
        [{ x: -49, z: -41 }, { x: 59, z: -41 }],
        [{ x: -92, z: 60 }, { x: 91, z: 60 }],
      ],
      barks: [
        "Fresh off the cart this morning. Don't ask off what.",
        "Glue works is boiling. Breathe through your mouth.",
        "Knacker’s Lane? Not for a purse of Ducats.",
        "Mind the gutters. They run red on a Tuesday.",
      ],
    },
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
      // The new quarters: rats in the rag lanes and the offal yard, crows over the pens.
      { kind: 'rat', x: 66, z: -24, roam: 4, count: 2 },
      { kind: 'rat', x: -10, z: -50, roam: 3, count: 2 },
      { kind: 'rook', x: 0, z: -66, roam: 20, count: 4 },
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

      // The Shambles: hurdles and fodder in the pens, the offal yard's bones and racks.
      { kind: 'pens', x: -82, z: -64 },
      { kind: 'pens', x: -54, z: -64 },
      { kind: 'pens', x: -10, z: -64 },
      { kind: 'pens', x: 38, z: -64 },
      { kind: 'pens', x: 74, z: -64 },
      { kind: 'haybale', x: -40, z: -66 },
      { kind: 'haybale', x: 52, z: -62 },
      { kind: 'trough', x: -46, z: -62 },
      { kind: 'bonepile', x: -26, z: -50 },
      { kind: 'bonepile', x: 60, z: -50 },
      { kind: 'barrel', x: -60, z: -50 },
      { kind: 'rack', x: -36, z: -50 },
      // The knacker's yard, and what the rag-and-bone men could not sell.
      { kind: 'spoilheap', x: -84, z: -24 },
      { kind: 'bonepile', x: -86, z: -42 },
      { kind: 'sacks', x: -88, z: 6 },
      { kind: 'barrel', x: -80, z: 22 },
      { kind: 'spoilheap', x: -86, z: 38 },
      // The rag lanes.
      { kind: 'sacks', x: 68, z: -34 },
      { kind: 'sacks', x: 86, z: 26 },
      // The glue works.
      { kind: 'spoilheap', x: -56, z: 50 },
      { kind: 'barrel', x: -34, z: 50 },
      { kind: 'barrel', x: 20, z: 50 },
      { kind: 'rack', x: 84, z: 66 },
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
      // The trades that grew out past the ranges: the knacker in his yard, a sorter in the rags.
      { id: 'bonemarket_knacker', x: -84, z: -30, art: 'butcher', label: 'Talk to the knacker' },
      { id: 'bonemarket_rag_sorter', x: 80, z: -34, art: 'seamstress', label: 'Talk to the rag-sorter' },
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
      // At the three ways down from the Shambles, so the gaps show at night.
      { x: -50, z: -50 },
      { x: 10, z: -50 },
      { x: 38, z: -50 },
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
      { text: 'WEIGH IT TWICE', wallX: -34, wallZ: zOfRow(6) + TILE / 2 + 0.05, dx: 3, facesSouth: true, tint: '#c2a25e' },
      { text: 'NOTHING HERE WAS GIVEN', wallX: 14, wallZ: zOfRow(29) - TILE / 2 - 0.05, dx: -4, facesSouth: false, tint: '#8f6f9e' },
      // On the Hall's face, beside the door: what the building was before the trade arrived.
      { text: 'THIS WAS A CHAPEL', wallX: 0, wallZ: zOfRow(17) + TILE / 2 + 0.05, dx: 8, facesSouth: true, tint: '#a09a82' },
    ],
    horizon: 'city',
    /**
     * The Knacker's Lads, after dark, in two crews that never meet: one walks the Shambles end to
     * end, the other walks Knacker's Lane from the pens to the works and back -- across the way in
     * off Ashfall, so coming into the market at night is a matter of timing.
     */
    packs: [
      {
        encounterId: 'pack_knackers_lads',
        id: 'shambles',
        x: 0,
        z: -58,
        roam: 6,
        hours: 'night',
        band: 'shambles',
        behaviour: 'beat',
        route: [
          { x: -80, z: -58 },
          { x: 80, z: -58 },
        ],
      },
      {
        encounterId: 'pack_knackers_lads',
        id: 'knackers_lane',
        x: -68,
        z: 2,
        roam: 6,
        hours: 'night',
        band: 'lane',
        behaviour: 'beat',
        route: [
          { x: -68, z: -40 },
          { x: -68, z: 40 },
        ],
      },
    ],
    /** The market clock, on the floor beside the Hall, seven minutes fast. */
    landmarks: [{ kind: 'bell_tower', x: 44, z: -8 }],
    vignettes: [
      { id: 'broken_cart', x: -82, z: -20 },
      { id: 'washing_court', x: 78, z: 1.2 },
    ],
  },
});
