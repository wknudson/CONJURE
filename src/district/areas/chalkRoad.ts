/**
 * The Chalk Road — the artery, and the first tile of the Middle Ring you can stand on.
 *
 * The atlas calls the Verge "the first wild stretch of the Chalk Road", so this is the same
 * road further out: the white cut that runs from the wildlands down to Jolrek, with ploughed
 * strips either side and nothing sanctioned anywhere on it.
 *
 * It is the longest map in the game — 36 columns against 14 rows — and the shape is the
 * point. A road is a corridor with sightlines down it, so the fighting happens where those
 * sightlines break: the waystones are set in pairs at rows 6 and 8 and never on row 7, which
 * keeps the artery itself open while giving three roam circles something to hide behind.
 *
 * Those three circles overlap far more tightly than the Verge's — the closest pair sits
 * seven units apart against twenty of combined reach — which is deliberate. This is the
 * ground the Combat Ring is meant to be tested on: walking into the middle of it should
 * reliably pull a second crew, and reliably fail to pull the third.
 *
 * The road carries no notices, because the notices are posted where somebody is accountable
 * for them. It does carry a waystation now, on the north verge east of the stones, with the
 * toll-keeper's ledger still on the counter and two graves in the yard behind it. Nobody
 * keeps it. That is the notice.
 */

import { TILE, defineArea, type AreaDef, type TileDef } from '../map.js';

/**
 * The road's legend.
 *
 *   ,  chalk track     — the road itself
 *   f  ploughed strip  — field, furrowed north-south against an east-west road
 *   #  grass verge     — the margin either side of the track
 *   .  weeds           — where the verge has gone over
 *   H  hedgerow        — impassable, tall and split into a broken line
 *   R  waystone        — impassable, low and taken whole
 *   W  the waystation  — impassable; timber, the stack cold
 *
 * No `S`. Nothing out here is sanctioned, the same way nothing on the Verge is — the Ring
 * ends at Jolrek's wards, and the road between them is nobody's to make safe.
 *
 * `H` and `R` reuse the Verge's thicket and rock recipes rather than inventing their own:
 * a hedgerow and a thicket are the same problem, and two spellings of it would drift.
 */
const ROAD_LEGEND: Record<string, TileDef> = {
  ',': { tex: 'chalk', safe: false, walk: true },
  f: { tex: 'field', safe: false, walk: true },
  '#': { tex: 'grass', safe: false, walk: true },
  '.': { tex: 'weeds', safe: false, walk: true },
  H: {
    tex: 'grass',
    safe: false,
    walk: false,
    solid: { minHeight: 4.0, maxHeight: 5.4, inset: 0.7, depthInset: 0.7, chimneyChance: 0, split: true },
  },
  R: {
    tex: 'cobble',
    safe: false,
    walk: false,
    solid: { minHeight: 2.2, maxHeight: 3.6, inset: 0.5, depthInset: 0.5, chimneyChance: 0, split: false },
  },
  W: {
    tex: 'weeds',
    safe: false,
    walk: false,
    solid: { minHeight: 4.6, maxHeight: 4.6, inset: 0.3, depthInset: 0.3, chimneyChance: 1, split: false, wall: 'timber' },
  },
};

/**
 * 36 wide by 14 deep.
 *
 * Column 0 was hedgerow the whole way down while the Rimefields were not walkable. They are
 * now, so the road runs out of the west end as well as the east — which is what a road is, and
 * makes this the only map in the world you can cross without stopping.
 */
const GRID: readonly string[] = [
  `${'H'.repeat(9)},,${'H'.repeat(25)}`, //  0  the north hedge, and the lane up to Millharrow
  'HffffffffH,,HHfffffffffWWWWffffHHffff'.slice(0, 0) + 'Hffffffff,,HHfffffffffWWWWffffHHffff', //  1  ploughed strips; THE WAYSTATION
  'Hfff.ffff,,HHffff.ffffWWWWffffHHffff', //  2
  'Hffffffff,,HHfffffffffWWWWf.ffHHffff', //  3
  'Hffff..ff,,HHff.ffffff....ffffHHfff.', //  4  the waystation's yard, and its graves
  `H##.#####,,${'#'.repeat(25)}`, //  5  the north verge
  `${','.repeat(12)}RR${','.repeat(10)}RR${','.repeat(10)}`, //  6  waystones, set in pairs
  ','.repeat(36), //  7  THE ROAD — never blocked, end to end
  `${','.repeat(12)}RR${','.repeat(10)}RR${','.repeat(10)}`, //  8
  `H${'#'.repeat(25)},,${'#'.repeat(8)}`, //  9  the south verge, and the lane down to the Crossing
  'HfffffffffffffHHffffffffff,,ffffffff', // 10
  'Hffff.ffffffffHHfffff.ffff,,fffffff.', // 11
  'HfffffffffffffHHffffffffff,,ffffffff', // 12
  `${'H'.repeat(26)},,${'H'.repeat(8)}`, // 13  the south hedge
];

const HALF_X = (GRID[0]!.length * TILE) / 2;
const HALF_Z = (GRID.length * TILE) / 2;
const xOfCol = (col: number): number => col * TILE - HALF_X + TILE / 2;
const zOfRow = (row: number): number => row * TILE - HALF_Z + TILE / 2;

export const CHALK_ROAD_ID = 'chalk_road';

export const CHALK_ROAD: AreaDef = defineArea({
  id: CHALK_ROAD_ID,
  name: 'The Chalk Road',
  grid: GRID,
  legend: ROAD_LEGEND,
  /** The east trailhead, inside the cut. Where a lost fight puts you back. */
  spawn: { x: 62, z: 2 },
  safety: 'none',
  exits: [
    {
      // East, back up the road onto the Verge. No gate: it is the same road, and the only
      // thing marking the join is that the fields stop.
      to: 'chalk_verge',
      x: HALF_X - 2,
      z: 2,
      label: 'Follow the road east onto the Chalk Verge',
      arrive: { x: -52, z: -6 },
    },
    {
      // North through the hedge, up the lane to the crossroads. The Ring proper starts here:
      // everything the road exists to reach is on the other side of these two gaps.
      to: 'millharrow',
      x: -34,
      z: zOfRow(1),
      label: 'North, up the lane to Millharrow',
      arrive: { x: -2, z: 38 },
    },
    {
      // And south, to the river town. Set well along from the Millharrow lane so the two are
      // never in prompt range of each other.
      to: 'fenwicks_crossing',
      x: 38,
      z: zOfRow(12),
      label: "South, down to Fenwick's Crossing",
      arrive: { x: -2, z: -18 },
    },
    {
      // West, out of the cut and into the snow. The road does not end here so much as stop
      // being maintained.
      to: 'rimefields',
      x: -HALF_X + 2,
      z: 2,
      label: 'West, on into the Rimefields',
      arrive: { x: 54, z: -2 },
    },
    {
      // The waystation. The toll was taken here once; the door has not been barred since.
      to: 'chalk_road_waystation',
      x: xOfCol(23.5),
      z: zOfRow(3) + TILE / 2 + 1.4,
      label: 'Into the waystation',
      door: { x: xOfCol(23.5), z: zOfRow(3) + TILE / 2 + 0.05, facesSouth: true, sign: 'toll', style: 'plank' },
      arrive: { x: 0, z: 14 },
    },
  ],
  props: {
    /** Farmland either side of a corridor. The longest sightline in the game, so: birds. */
    sky: 'pollen',
    wildlife: [
      { kind: 'hare', x: -42, z: -18, roam: 9 },
      { kind: 'hare', x: 58, z: -10, roam: 9 },
      { kind: 'hare', x: 46, z: 6, roam: 9 },
      { kind: 'rook', x: -62, z: -22, roam: 26, count: 4 },
      { kind: 'rook', x: 46, z: -2, roam: 26, count: 4 },
      { kind: 'fox', x: -2, z: -18, roam: 10 },
    ],
    /** The artery. The atlas puts waystone pairs on it, so here they are, plus what falls off a cart. */
    dressing: [
      { kind: 'waystone', x: -58, z: -18, text: 'JOLREK — VIII' },
      { kind: 'waystone', x: 10, z: -14, text: 'MILLHARROW — III' },
      { kind: 'waystone', x: -54, z: -6, text: 'THE RIME — XI' },
      { kind: 'waystone', x: 34, z: -2, text: 'FENWICK — V' },
      { kind: 'waystone', x: -58, z: 10, text: 'JOLREK — VIII' },
      { kind: 'waystone', x: 10, z: 14, text: 'MILLHARROW — III' },
      { kind: 'fence', x: -54, z: -18, yaw: 0 },
      { kind: 'fence', x: -46, z: -14, yaw: 0 },
      { kind: 'fence', x: -6, z: -10, yaw: 0 },
      { kind: 'fence', x: 10, z: -6, yaw: 0 },
      { kind: 'fence', x: 38, z: -2, yaw: 0 },
      { kind: 'fence', x: 10, z: 6, yaw: 0 },
      { kind: 'fence', x: 42, z: 10, yaw: 0 },
      { kind: 'fence', x: -58, z: 18, yaw: 0 },
      { kind: 'cart', x: -50, z: -18 },
      { kind: 'cart', x: -46, z: -6 },
      { kind: 'cart', x: -50, z: 10 },
      { kind: 'cairn', x: -46, z: -18 },
      { kind: 'cairn', x: -42, z: -6 },
      { kind: 'cairn', x: -46, z: 10 },
      { kind: 'wildflowers', x: -42, z: -18 },
      { kind: 'wildflowers', x: -2, z: -14 },
      { kind: 'wildflowers', x: 46, z: -10 },
      { kind: 'wildflowers', x: 50, z: -6 },
      { kind: 'wildflowers', x: 22, z: 2 },
      { kind: 'wildflowers', x: 18, z: 10 },
      { kind: 'wildflowers', x: 62, z: 14 },
      { kind: 'bramble', x: -6, z: -18 },
      { kind: 'bramble', x: 34, z: -14 },
      { kind: 'bramble', x: 42, z: -2 },
      { kind: 'bramble', x: 30, z: 14 },
      // The toll bar itself, at the stretch the contract names: two posts and nothing between.
      { kind: 'fence', x: -30, z: -6, yaw: 0 },
      { kind: 'fence', x: -22, z: 10, yaw: 0 },
    ],
    /**
     * Three crews working one stretch.
     *
     * Every pair overlaps, and the tight pair — the Waywatch and the Freight-Pickers, seven
     * units apart — is what makes a two-pull something you can walk into on purpose. The
     * third is close enough to be reached by a ring that had room and far enough to be
     * refused by one that does not, which is the cap doing its job where it can be seen.
     */
    packs: [
      // The one daylight crew in the world, and it is daylight for a reason a player can work
      // out: a waywatch robs carts, carts travel by day, and an empty road pays nothing. Standing
      // on the Chalk Road at noon is the only place in Azo where the sun is the dangerous time.
      { encounterId: 'pack_road_waywatch', x: -30, z: 2, roam: 10, hours: 'day' },
      // Vermin do not keep a schedule.
      { encounterId: 'pack_hedgerow_vermin', x: -12, z: 4, roam: 10 },
      // Freight moves after dark -- there is a whole contract about it (`night_freight`) -- so
      // the people picking it over move after dark too.
      { encounterId: 'pack_freight_pickers', x: -26, z: -4, roam: 10, hours: 'night' },
    ],
    /** Freight off the back of something, and nobody left to claim it. */
    crates: [
      { x: -36, z: -2 },
      { x: -8, z: -2 },
      { x: 2, z: 6 },
      { x: -44, z: 6 },
    ],
    /** Standing out in the strips, where the hedges give out. */
    trees: [
      { x: -52, z: -14 },
      { x: -8, z: -14 },
      { x: 44, z: -14 },
      { x: -52, z: 14 },
      { x: 20, z: 14 },
      { x: 44, z: 14 },
    ],
    // No lamps: the light is the safe zone, and there is none here to have.
    // No board and no signpost: the notices are posted where somebody is accountable for them.
    horizon: 'treeline',
  },
});
