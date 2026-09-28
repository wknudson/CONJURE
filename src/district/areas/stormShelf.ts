/**
 * The Storm Shelf — the ground the pylons stand on, and the ground they have been standing on
 * for long enough that it shows.
 *
 * Scorched rock in every direction, with the pylon footings set out across it in ranks. The
 * footings are the whole layout: tall, thin, regularly spaced, and repeated four times down the
 * map, so wherever you are you can see the pattern continuing past you in both directions.
 *
 * That repetition is the point and it is the only place in the world where a layout repeats on
 * purpose. Everywhere else the interest is in what is different about each part of the map; here
 * the interest is that nothing is, for as far as you can see, because somebody surveyed it that
 * way and then left.
 *
 * Fifty-two by forty-eight now, grown from thirty by twenty-eight, and the ranks are carried on
 * across the new ground at the same spacing, eight columns of footings in eight rows, so the
 * pattern goes on past the old shelf in every direction. The rock ring is gone but for the
 * stretch Pylon Nine's base was cut into, and behind it **Pylon Nine** itself, the tallest, with
 * the sky still coming down to its crown; the rank north of it breaks where it stands. The track
 * runs on east past where it used to stop and down to **the survey camp**, which the sky found.
 *
 * The Static Swarm prowls the whole shelf and hangs over the camp; the Pylon-Keepers stand at
 * Nine's foot and at the turn of the track, where the ranks end.
 */

import { TILE, defineArea, type AreaDef, type TileDef } from '../map.js';

/**
 * The Shelf's legend.
 *
 *   b  scorched rock — the shelf
 *   #  scrub         — what grows back between strikes
 *   ,  chalk track   — the way west, off the shelf
 *   P  pylon footing — impassable, tall and very thin
 *   R  rock          — impassable, the boundary
 *   h  burnt heath — scrub far enough from a footing to have grown back
 *   X  the survey hut — impassable; burnt down to its sills
 *
 * `P` has the largest inset of any solid in the game on both axes. A pylon leg is a mast, not a
 * building, and the footings have to read as something you can see *past* — the pattern only
 * works if you can see four ranks of them at once.
 */
const SHELF_LEGEND: Record<string, TileDef> = {
  h: { tex: 'heath', safe: false, walk: true },
  b: { tex: 'blasted', safe: false, walk: true },
  '#': { tex: 'grass', safe: false, walk: true },
  ',': { tex: 'chalk', safe: false, walk: true },
  P: {
    tex: 'blasted',
    safe: false,
    walk: false,
    solid: { style: 'pylon', minHeight: 10.0, maxHeight: 12.5, inset: 1.55, depthInset: 1.55, chimneyChance: 0, split: false },
  },
  R: {
    tex: 'blasted',
    safe: false,
    walk: false,
    solid: { style: 'rock', minHeight: 5.0, maxHeight: 8.0, inset: 0.15, depthInset: 0.15, chimneyChance: 0, split: false },
  },
  X: {
    tex: 'blasted',
    safe: false,
    walk: false,
    solid: { style: 'wall', minHeight: 0.6, maxHeight: 1.2, inset: 0.3, depthInset: 1.2, chimneyChance: 0, split: true, wall: 'timber' },
  },
  /** The cave mouth: rock, taken whole, with a door in the south face of it. */
  K: {
    tex: 'blasted',
    safe: false,
    walk: false,
    solid: { style: 'rock', minHeight: 5.5, maxHeight: 5.5, inset: 0.3, depthInset: 0.3, chimneyChance: 0, split: false, wall: 'rock', bare: true },
  },
};

/**
 * 52 wide by 48 deep.
 *
 * Column 0 opens at rows 22 and 23 — the track west, down to Fenwick's Crossing. The ranks of
 * footings sit at rows 5, 9, 15, 19, 25, 29, 33, 39 and 43, spaced so that no rank lines up with
 * the track.
 */
const GRID: readonly string[] = [
  'RRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRR', //  0  the rock
  'Rhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhh#hhhhhh#hhhh#hhhhhhR', //  1
  'Rhhhhhhhhhhh#h##hhhhhhhhhhhhhh#hhh#hhhhhhhhhhhhhhhhR', //  2
  'Rhhhhhhhh#h#hhhhhhhbbbbbbbbbbbbhhhhhhhhhhhhhhhhhhhhR', //  3
  'RbbbhhhhbbbhhhhbbbhbbbbbbbbbbbbbhhhbbbhhhhbbbhhhbbbR', //  4
  'RbPbhhhhbPbhh#hbPbhbbbbbbbbbbbPbhhhbPbhhhhbPbhhhbPbR', //  5  a rank, carried on: the gap at col 23 is where PYLON NINE stands behind it
  'RbbbhhhhbbbhhhhbbbhbbbbbbbbbbbbbhhhbbbhhhhbbbhhhbbbR', //  6
  'Rhh#hh#hhhhhhhhhhhhbbbbbbbbbbbbhhhhhhhhhhhhhhhhhhhhR', //  7
  'Rbbbhh#hbbb#hhhhhhhbbbbbbbbbbbbhhhhhhhhhhhbbbhhhbbbR', //  8
  'RbPbhhhhbPbhhhh#h#hhhhRRRRRRhhhhhhhhhhhhhhbPbhhhbPbR', //  9  Nine's base cut into what is left of the old north face
  'Rbbbhhhhbbbhhh#hhhhhRRRRRRRRRRhh#hhh#hhhh#bbbhhhbbbR', // 10
  'Rhhh#hhhhhhhhhhhhhhhhhhKKKKhhhhhhhhhhhhhh#hhhhhhhhhR', // 11  PYLON NINE's base (the K)
  'RhhhhhhhhhhhhhhhhhhhhhhKKKKhhhhhhhhhhhhh#hhhhhhhhhhR', // 12
  'Rhhh#hhhhhhhhhhhhhhhhhhhbbbbhhhhhhhhhhhhhhhhhhhhhhhR', // 13
  'RbbbhhhhbbbhhhhbbbhhhhbbbbbbbbbbhhhbbbhhhhbbbhhhbbbR', // 14
  'RbPbhhhhbPbhhhhbPbhhhhbPbbbbbbPbhhhbPbhhhhbPbhhhbPbR', // 15
  'Rbbbhh#hbbbhhhhbbbhhhbbbbbbbbbbbhhhbbbhhhhbbbhhhbbbR', // 16
  'Rhhhhhhhhhhhhhbbhh##bbbbbbbbbb##hhhhbbhh#hhhhhhhhh#R', // 17
  'RbbbhhhhbbbhhhbbbbbbbbbbbbbbbbbbbbbbbbhhhhbbbhhhbbbR', // 18
  'RbPbhhh#bPbhhhbbPbbbbbbPbbbbbbPbbbbbPbhhhhbPbhhhbPbR', // 19
  'RbbbhhhhbbbhhhbbbbbbbbbbbbbbbbbbbhhbbbhhhhbbbhhhbbbR', // 20
  'Rhhhh#hhh#hhhhbhhhhhbbbbbbbbbbbbhhhhbbhhhhhhhhhhhhhR', // 21
  ',,,,,,,,,,,,hh,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,hhhhR', // 22  the track, in from the west edge, on east, and down cols 45-46 to the survey camp
  ',,,,,,,,,,,,hh,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,hhhhR', // 23
  'Rbbbhhhhbbb#hhhbbbhhhhbbbbbbhbbbhhhbbbhhhhbbb,,#bbbR', // 24
  'RbPbhhhhbPbhhhhbPbhhhhbPbbbhhbPbhhhbPbhhhhbPb,,hbPbR', // 25
  'Rbbb#hhhbbbhhhhbbbhhhhbbbbbhhbbbhhhbbbhhhhbbb,,#bbbR', // 26
  'Rhhhhhhhh#h#hhhhhh##hhhhbbbbhh##hhhhhhhhhhhhh,,hhhhR', // 27
  'Rbbbh#hhbbbhhhhbbbhhhhbbbbbbbbbbhhhbbbhhhhbbb,,hbbbR', // 28
  'RbPbhhh#bPbhhhhbPbhhhhbPbbbbbbPbhhhbPbhhhhbPb,,hbPbR', // 29
  'Rbbbhhhhbbbhhhbbbbhhbbbbbbbbbbbbhhhbbbhh#hbbb,,hbbbR', // 30
  'Rh#h#hhhhhhhhhbbhh##bbbbbbbbbb##bhhhbbhhhhhhh,,hhhhR', // 31
  'Rbbbhhhhbbbhhhbbbbbbbbbbbbbbbbbbbbbbbbhhhhbbb,,hbbbR', // 32
  'RbPbhhhhbPbhhhbbPbbbbbbPbbbbbbPbbbbbPbhhhhbPb,,#bPbR', // 33
  'Rbbbhhhhbbbhhhbbbbhbbbbbbbbbbbbbbhhbbbhhhhbbb,,hbbbR', // 34
  'Rhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhh,,hhhhR', // 35
  'Rhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhh,,hhhhR', // 36
  'Rhhhhhhhhhhhhhh#hhhhhhh#hhhhh#h#hhhhhhhhbbbbbbbbbbbR', // 37  THE SURVEY CAMP (south-east), struck
  'RbbbhhhhbbbhhhhbbbhhhhbbbhhhhbbbhhhbbbhhbbbbbbbbbbbR', // 38
  'RbPbhhhhbPbh#hhbPbhhhhbPbhhhhbPbhhhbPbhhbbbbbXXXXbbR', // 39  a rank, carried on
  'Rbbbhhhhbbbhhhhbbbhhhhbbbhhhhbbbh#hbbbhhbbbbbXbbXbbR', // 40
  'Rhhhhhhh#hhhh#hhhhhhhh#hhhhhhhhhh#hhhhhhbbbbbXbbXbbR', // 41
  'Rbbbhhhhbbbhhhhbbbhhh#bbbhhh#bbbhhhbbbhhbbbbbbbbbbbR', // 42
  'RbPbhhh#bPbhhh#bPbhhhhbPbhhhhbPbhhhbPbhhbbbbbbbbbbbR', // 43  a rank, carried on
  'Rbbbhh#hbbbhhhhbbbhhhhbbbhhhhbbbhhhbbbhhbbbbbbbbbbbR', // 44
  'Rhhhhhhhhhhhhhhhhhhhhhh#hhhhhhhhhhhhhhhhbbbbbbbbbbbR', // 45
  'Rhhhhhhhhhhhhhhh#hhhhhhhhhhhhhhhhhhhhhhhhhh#hhhhhhhR', // 46
  'RRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRR', // 47  the rock
];

const HALF_X = (GRID[0]!.length * TILE) / 2;
const HALF_Z = (GRID.length * TILE) / 2;
const xOfCol = (col: number): number => col * TILE - HALF_X + TILE / 2;
const zOfRow = (row: number): number => row * TILE - HALF_Z + TILE / 2;

export const STORM_SHELF_ID = 'storm_shelf';

export const STORM_SHELF: AreaDef = defineArea({
  id: STORM_SHELF_ID,
  name: 'The Storm Shelf',
  grid: GRID,
  legend: SHELF_LEGEND,
  /** On the track, between the second and third ranks. */
  spawn: { x: 0, z: -6 },
  safety: 'none',
  exits: [
    {
      // Pylon Nine's base, in the north face of the shelf. The iron the warnings are about goes down into it.
      to: 'storm_shelf_pylon_base',
      x: xOfCol(24.5),
      z: zOfRow(12) + TILE / 2 + 1.4,
      label: 'Into Pylon Nine\'s base',
      door: { x: xOfCol(24.5), z: zOfRow(12) + TILE / 2 + 0.05, facesSouth: true, style: 'cave' },
      arrive: { x: 0, z: 16 },
    },
    {
      to: 'fenwicks_crossing',
      x: -HALF_X + 2,
      z: -6,
      label: "West, down off the shelf to Fenwick's Crossing",
      arrive: { x: 82, z: -6 },
    },
  ],
  props: {
    /** Goats on the footings — the one animal that will stand where the sky comes down. */
    sky: 'drizzle',
    wildlife: [
      { kind: 'goat', x: -42, z: -42, roam: 9, count: 2 },
      { kind: 'goat', x: -14, z: -14, roam: 9, count: 2 },
      { kind: 'goat', x: 34, z: 14, roam: 9, count: 2 },
      { kind: 'hare', x: -26, z: -42, roam: 9 },
      { kind: 'hare', x: -14, z: 2, roam: 9 },
      { kind: 'rook', x: -50, z: -46, roam: 26, count: 3 },
      // Goats on the new footings too, hares in the heath, rooks off the rock.
      { kind: 'goat', x: 60, z: -78, roam: 9, count: 2 },
      { kind: 'goat', x: -90, z: 60, roam: 9, count: 2 },
      { kind: 'hare', x: -80, z: 30, roam: 8 },
      { kind: 'rook', x: -80, z: -80, roam: 20, count: 3 },
    ],
    /** On the footings themselves. Whoever wrote this had been under one. */
    graffiti: [
      { text: 'DO NOT SHELTER UNDER IRON', wallX: 18, wallZ: 7.95, dx: -3.0, facesSouth: true, tint: '#b7ae9d' },
      { text: 'NINE WAS NOT AN ACCIDENT', wallX: -38, wallZ: -32.05, dx: 3.2, facesSouth: true, tint: '#a4543a' },
    ],
    /** Pylon country. Scorch where the sky has been down, and cairns where shepherds have been. */
    dressing: [
      { kind: 'scorch', x: -52, z: -48 },
      { kind: 'cairn', x: 52, z: -20 },
      { kind: 'spoilheap', x: -52, z: -16 },
      { kind: 'bracken', x: 52, z: 16 },
      { kind: 'scorch', x: -52, z: 28 },
      { kind: 'cairn', x: 52, z: 36 },
      { kind: 'scorch', x: 28, z: -48 },
      { kind: 'spoilheap', x: -28, z: 48 },
      { kind: 'cairn', x: 20, z: 48 },
      { kind: 'scorch', x: -46, z: -42 },
      { kind: 'scorch', x: -14, z: -38 },
      { kind: 'scorch', x: 34, z: -34 },
      { kind: 'scorch', x: -18, z: -26 },
      { kind: 'scorch', x: 22, z: -22 },
      { kind: 'scorch', x: -22, z: -14 },
      { kind: 'scorch', x: 26, z: -10 },
      { kind: 'scorch', x: -10, z: -2 },
      { kind: 'scorch', x: 30, z: 2 },
      { kind: 'scorch', x: -14, z: 10 },
      { kind: 'scorch', x: 26, z: 14 },
      { kind: 'scorch', x: -30, z: 22 },
      { kind: 'scorch', x: 18, z: 26 },
      { kind: 'scorch', x: -38, z: 34 },
      { kind: 'scorch', x: 6, z: 38 },
      { kind: 'cairn', x: -38, z: -42 },
      { kind: 'cairn', x: -34, z: -34 },
      { kind: 'cairn', x: -6, z: -26 },
      { kind: 'cairn', x: 6, z: -18 },
      { kind: 'cairn', x: 38, z: -10 },
      { kind: 'cairn', x: -22, z: 2 },
      { kind: 'cairn', x: 6, z: 10 },
      { kind: 'cairn', x: 10, z: 18 },
      { kind: 'cairn', x: 34, z: 26 },
      { kind: 'cairn', x: 38, z: 34 },
      { kind: 'spoilheap', x: -34, z: -42 },
      { kind: 'spoilheap', x: 22, z: -34 },
      { kind: 'spoilheap', x: -2, z: -22 },
      { kind: 'spoilheap', x: -26, z: -10 },
      { kind: 'spoilheap', x: -18, z: 2 },
      { kind: 'spoilheap', x: -42, z: 14 },
      { kind: 'spoilheap', x: 30, z: 22 },
      { kind: 'spoilheap', x: -6, z: 34 },
      { kind: 'waystone', x: -30, z: -42, text: 'PYLON IX — DO NOT SHELTER' },
      { kind: 'waystone', x: -6, z: -14, text: 'PYLON IX — DO NOT SHELTER' },
      { kind: 'waystone', x: -46, z: 18, text: 'PYLON IX — DO NOT SHELTER' },
      { kind: 'bracken', x: -42, z: -42 },
      { kind: 'bracken', x: 18, z: -30 },
      { kind: 'bracken', x: -14, z: -14 },
      { kind: 'bracken', x: -30, z: 2 },
      { kind: 'bracken', x: 34, z: 14 },
      { kind: 'bracken', x: -6, z: 30 },
      { kind: 'bramble', x: -26, z: -42 },
      { kind: 'bramble', x: -10, z: -14 },
      { kind: 'bramble', x: 38, z: 14 },

      // Nine's ground: struck so often it is all scorch, and the warning the shepherds left.
      { kind: 'scorch', x: -10, z: -80, size: 2.2 },
      { kind: 'scorch', x: 8, z: -72, size: 1.8 },
      { kind: 'scorch', x: -18, z: -58, size: 1.6 },
      { kind: 'waystone', x: -26, z: -54, text: 'PYLON IX — DO NOT SHELTER' },
      // The survey camp: the strike, the hut's table, what was left standing.
      { kind: 'scorch', x: 74, z: 60, size: 2.6 },
      { kind: 'lectern', x: 86, z: 70 },
      { kind: 'sacks', x: 62, z: 56 },
      { kind: 'barrel', x: 92, z: 58 },
      { kind: 'cart', x: 94, z: 80 },
      { kind: 'cairn', x: 60, z: 84 },
      { kind: 'cairn', x: 76, z: 84 },
      // The new ranks: scorch at the footings, cairns between them.
      { kind: 'scorch', x: -90, z: -40 },
      { kind: 'scorch', x: 40, z: -80 },
      { kind: 'scorch', x: 90, z: -40 },
      { kind: 'scorch', x: 20, z: 80 },
      { kind: 'scorch', x: -90, z: 60, size: 1.4 },
      { kind: 'cairn', x: -60, z: -30 },
      { kind: 'cairn', x: -40, z: 70 },
      { kind: 'cairn', x: 90, z: 30 },
      { kind: 'spoilheap', x: -30, z: -84 },
    ],
    crates: [
      { x: 38, z: -6 },
      { x: -34, z: -6 },
      { x: 94, z: 86 },
    ],
    /** In the scrub patches, and nowhere near a footing. */
    trees: [
      { x: -34, z: -26 },
      { x: 14, z: -26 },
      { x: -34, z: 14 },
      { x: 14, z: 30 },
    ],
    horizon: 'none',
    /**
     * The Static Swarm prowls the whole shelf -- nobody lives on it -- and a knot of it hangs over
     * the survey camp, where the sky came down. The Pylon-Keepers hold Nine's foot, facing the way
     * up to it from the field, and the turn of the track at the ranks' end.
     */
    packs: [
      { encounterId: 'pack_static_swarm', id: 'prowler', x: -70, z: 70, roam: 8, behaviour: 'prowl' },
      { encounterId: 'pack_static_swarm', id: 'camp', x: 70, z: 78, roam: 7, band: 'camp' },
      {
        encounterId: 'pack_pylon_keepers',
        id: 'nine',
        x: -18,
        z: -66,
        roam: 4,
        band: 'nine',
        behaviour: 'sentry',
        // South, down the west side of the rock to the field.
        sweep: [-0.7, 0.7],
      },
      {
        encounterId: 'pack_pylon_keepers',
        id: 'turn',
        x: 70,
        z: -14,
        roam: 4,
        band: 'turn',
        behaviour: 'sentry',
        // West, back along the track.
        sweep: [-2.2, -0.9],
      },
    ],
    /** Pylon Nine, behind the rock its base is cut into: the tallest iron on the shelf, arcing. */
    landmarks: [{ kind: 'great_pylon', x: -4, z: -66 }],
    vignettes: [{ id: 'ruined_camp', x: 66, z: 72 }],
  },
});
