/**
 * The Chalk Road — the artery, and the first tile of the Middle Ring you can stand on.
 *
 * The atlas calls the Verge "the first wild stretch of the Chalk Road", so this is the same
 * road further out: the white cut that runs from the wildlands down to Jolrek, with ploughed
 * strips either side and nothing sanctioned anywhere on it.
 *
 * It is the longest map in the game — 32 columns against 12 rows — and the shape is the
 * point. A road is a corridor with sightlines down it, so the fighting happens where those
 * sightlines break: the waystones are set in pairs at rows 5 and 7 and never on row 6, which
 * keeps the artery itself open while giving three roam circles something to hide behind.
 *
 * Those three circles overlap far more tightly than the Verge's — the closest pair sits
 * seven units apart against twenty of combined reach — which is deliberate. This is the
 * ground the Combat Ring is meant to be tested on: walking into the middle of it should
 * reliably pull a second crew, and reliably fail to pull the third.
 */

import { defineArea, type AreaDef, type TileDef } from '../map.js';

/**
 * The road's legend.
 *
 *   ,  chalk track     — the road itself
 *   f  ploughed strip  — field, furrowed north-south against an east-west road
 *   #  grass verge     — the margin either side of the track
 *   .  weeds           — where the verge has gone over
 *   H  hedgerow        — impassable, tall and split into a broken line
 *   R  waystone        — impassable, low and taken whole
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
};

/**
 * 32 wide by 12 deep.
 *
 * Column 0 was hedgerow the whole way down while the Rimefields were not walkable. They are
 * now, so the road runs out of the west end as well as the east — which is what a road is, and
 * makes this the only map in the world you can cross without stopping.
 */
const GRID: readonly string[] = [
  'HHHHHHH,,HHHHHHHHHHHHHHHHHHHHHHH', //  0  the north hedge, and the lane up to Millharrow
  'HfffffffHHffffffffffHHffffffffff', //  1  ploughed strips, broken by field hedges
  'HfffffffHHffffffffffHHffffffffff', //  2
  'Hfffff..HHffffff.fffHHfff.ffffff', //  3
  'H##.############.###########.###', //  4  the north verge
  ',,,,,,,,,,RR,,,,,,,,,,RR,,,,,,,,', //  5  waystones, set in pairs
  ',,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,', //  6  THE ROAD — never blocked, end to end
  ',,,,,,,,,,RR,,,,,,,,,,RR,,,,,,,,', //  7
  'H###.###########.############.##', //  8  the south verge
  'HfffffffffffffHHffffffffffffffff', //  9
  'Hffff.ffffffffHHfffff.fffffffff.', // 10
  'HHHHHHHHHHHHHHHHHHHHHHH,,HHHHHHH', // 11  the south hedge, and the lane down to the Crossing
];

export const CHALK_ROAD_ID = 'chalk_road';

export const CHALK_ROAD: AreaDef = defineArea({
  id: CHALK_ROAD_ID,
  name: 'The Chalk Road',
  grid: GRID,
  legend: ROAD_LEGEND,
  /** The east trailhead, inside the cut. Where a lost fight puts you back. */
  spawn: { x: 54, z: 2 },
  safety: 'none',
  exits: [
    {
      // East, back up the road onto the Verge. No gate: it is the same road, and the only
      // thing marking the join is that the fields stop.
      to: 'chalk_verge',
      x: 62,
      z: 2,
      label: 'Follow the road east onto the Chalk Verge',
      arrive: { x: -42, z: -8 },
    },
    {
      // North through the hedge, up the lane to the crossroads. The Ring proper starts here:
      // everything the road exists to reach is on the other side of these two gaps.
      to: 'millharrow',
      x: -34,
      z: -22,
      label: 'North, up the lane to Millharrow',
      arrive: { x: -2, z: 38 },
    },
    {
      // And south, to the river town. Set well along from the Millharrow lane so the two are
      // never in prompt range of each other.
      to: 'fenwicks_crossing',
      x: 30,
      z: 22,
      label: "South, down to Fenwick's Crossing",
      arrive: { x: -2, z: -18 },
    },
    {
      // West, out of the cut and into the snow. The road does not end here so much as stop
      // being maintained.
      to: 'rimefields',
      x: -62,
      z: 2,
      label: 'West, on into the Rimefields',
      arrive: { x: 54, z: -2 },
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
      { kind: 'fox', x: -22, z: -18, roam: 10 },
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
      { kind: 'wildflowers', x: 26, z: -10 },
      { kind: 'wildflowers', x: 50, z: -6 },
      { kind: 'wildflowers', x: 22, z: 2 },
      { kind: 'wildflowers', x: 18, z: 10 },
      { kind: 'wildflowers', x: 62, z: 14 },
      { kind: 'bramble', x: -22, z: -18 },
      { kind: 'bramble', x: 34, z: -14 },
      { kind: 'bramble', x: 42, z: -2 },
      { kind: 'bramble', x: 34, z: 14 },
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
      { encounterId: 'pack_hedgerow_vermin', x: -16, z: 4, roam: 10 },
      // Freight moves after dark -- there is a whole contract about it (`night_freight`) -- so
      // the people picking it over move after dark too.
      { encounterId: 'pack_freight_pickers', x: -26, z: -4, roam: 10, hours: 'night' },
    ],
    /** Freight off the back of something, and nobody left to claim it. */
    crates: [
      { x: -36, z: -2 },
      { x: -16, z: -2 },
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
