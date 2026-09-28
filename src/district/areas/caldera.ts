/**
 * The Caldera — the crater the Cinderworks is downwind of.
 *
 * A floor of cooled slag ringed by rock, with a skirt of fallen ash where the walls meet it and
 * vents standing up through the middle. The only way in is the cut east, which is the same cut
 * the ward's smoke comes out of — Jolrek's foundry ward and this place are the same event at two
 * distances.
 *
 * Nothing is built here and nothing needs to be. The layout is entirely the rock: an unbroken
 * wall on all four sides, buttresses pushing in at the corners, and vents scattered across the
 * floor so that crossing it is never quite a straight line. It is the first area in the world
 * with no made ground on it at all.
 */

import { TILE, defineArea, type AreaDef, type TileDef } from '../map.js';

/**
 * The crater's legend.
 *
 *   s  cooled slag — the floor
 *   a  fallen ash  — the skirt, where the walls shed
 *   R  rock face   — impassable, and the whole boundary
 *   V  vent        — impassable, low and taken whole
 *   c  cooled crust — the floor where it set in sheets rather than shattering
 *   f  sulphur     — the bloom a vent leaves on the ash it breathes on
 *
 * Four characters, two of them solid. `R` is the tallest unsplit solid outside the Spire: a
 * crater wall chunked into two- and three-tile pieces would read as a row of buildings, and the
 * one thing this place must not look like is a street.
 */
const CALDERA_LEGEND: Record<string, TileDef> = {
  c: { tex: 'crust', safe: false, walk: true },
  f: { tex: 'sulphur', safe: false, walk: true },
  s: { tex: 'slag', safe: false, walk: true },
  a: { tex: 'ash', safe: false, walk: true },
  R: {
    tex: 'ash',
    safe: false,
    walk: false,
    solid: { style: 'rock', minHeight: 9.0, maxHeight: 13.0, inset: 0.05, depthInset: 0.05, chimneyChance: 0, split: false },
  },
  V: {
    tex: 'slag',
    safe: false,
    walk: false,
    solid: { style: 'rock', minHeight: 2.0, maxHeight: 3.6, inset: 1.1, depthInset: 1.1, chimneyChance: 0.8, split: false },
  },
  /** The cave mouth: rock, taken whole, with a door in the south face of it. */
  K: {
    tex: 'ash',
    safe: false,
    walk: false,
    solid: { style: 'rock', minHeight: 5.5, maxHeight: 5.5, inset: 0.3, depthInset: 0.3, chimneyChance: 0, split: false, wall: 'rock', bare: true },
  },
};

/**
 * 28 wide by 24 deep.
 *
 * Column 27 opens at rows 11 and 12 — the cut east to the Cinderworks, and the only gap in the
 * ring. The buttresses at rows 2/3 and 19/20 push the floor into a rough oval rather than
 * leaving it a rectangle, which is most of what makes it read as a crater.
 */
const GRID: readonly string[] = [
  'RRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRR', //  0
  'RaaaaaaaaaaaaaaaaaaaKKKKaaaaaaaR', //  1
  'RaaaaaaaaaaaaaaaaaaaKKKKaaaaaaaR', //  2
  'RaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaR', //  3
  'RaaaaaaRRRRaaaaaaaaRRRRaaaaaaaaR', //  4
  'RaaaaaaRRRRaaaaaaaaRRRRaaaaaaaaR', //  5
  'RaaaaaaffffffaaaffffffaaaaaaaaaR', //  6
  'RaaaassssssssssscssssssssssaaaaR', //  7
  'RaaascsssVVsssssssVVssssssssaaaR', //  8
  'RaaassssssssssssssssssssssssaaaR', //  9
  'RaaassssssssssssssssssssssssaaaR', // 10
  'RaaascsVVVVssssssscVVVVsssssaaaR', // 11
  'RaaasccsssssssssccccssssssssaaaR', // 12
  'Raaascccsssssssscccccsssssssaaas', // 13
  'Raaasccccsssssscccccccssssssaaas', // 14
  'RaaasccVVVVssscccccVVVVsssssaaaR', // 15
  'RaaasccccccssccccccccccssscsaaaR', // 16
  'RaaasccccccssccccccccccssscsaaaR', // 17
  'RaaasccccVVsscccccVVcccssscsaaaR', // 18
  'RaaaassssssssscccssssssssssaaaaR', // 19
  'RaaaaaaffffffaaaffffffaaaaaaaaaR', // 20
  'RaaaaaaRRRRaaaaaaaaRRRRaaaaaaaaR', // 21
  'RaaaaaaRRRRaaaaaaaaRRRRaaaaaaaaR', // 22
  'RaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaR', // 23
  'RaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaR', // 24
  'RaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaR', // 25
  'RaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaR', // 26
  'RaaRRRRRRRRRRRRRRRRRRRRRRRRRRaaR', // 27
];

const HALF_X = (GRID[0]!.length * TILE) / 2;
const HALF_Z = (GRID.length * TILE) / 2;
const xOfCol = (col: number): number => col * TILE - HALF_X + TILE / 2;
const zOfRow = (row: number): number => row * TILE - HALF_Z + TILE / 2;

export const CALDERA_ID = 'caldera';

export const CALDERA: AreaDef = defineArea({
  id: CALDERA_ID,
  name: 'The Caldera',
  grid: GRID,
  legend: CALDERA_LEGEND,
  /** In the middle of the floor. There is nowhere else to be. */
  spawn: { x: 0, z: -2 },
  safety: 'none',
  exits: [
    {
      // The lava tube, in the north wall. The drake denned in it before the tap field was cut.
      to: 'caldera_lava_tube',
      x: xOfCol(21.5),
      z: zOfRow(2) + TILE / 2 + 1.4,
      label: 'Into the lava tube',
      door: { x: xOfCol(21.5), z: zOfRow(2) + TILE / 2 + 0.05, facesSouth: true, style: 'cave' },
      arrive: { x: 0, z: 16 },
    },
    {
      to: 'cinderworks',
      x: HALF_X - 2,
      z: -2,
      label: 'East, out through the cut to the Cinderworks',
      arrive: { x: -98, z: 0 },
    },
  ],
  props: {
    /** Moths and nothing else, which is the whole statement. Nothing else could live on it. */
    sky: 'embers',
    wildlife: [
      { kind: 'moth', x: -54, z: -46, roam: 9, count: 3 },
      { kind: 'moth', x: 50, z: -34, roam: 9, count: 3 },
      { kind: 'moth', x: 42, z: -18, roam: 9, count: 3 },
      { kind: 'moth', x: -38, z: 2, roam: 9, count: 3 },
      { kind: 'moth', x: -26, z: 18, roam: 9, count: 3 },
      { kind: 'moth', x: -34, z: 34, roam: 9, count: 3 },
    ],
    /** Daubed on the crater wall by whoever last worked the tap field, and left. */
    graffiti: [
      { text: 'THE TAP FIELD TOOK NINE', wallX: -34, wallZ: -32.05, dx: 3.4, facesSouth: true, tint: '#a4543a' },
    ],
    /** The thinnest area in the game had one crate on it. Nothing lives here, so nothing here is built — only left. */
    dressing: [
      { kind: 'scorch', x: 56, z: -48 },
      { kind: 'spoilheap', x: -56, z: -12 },
      { kind: 'cairn', x: 56, z: 12 },
      { kind: 'scorch', x: -56, z: 20 },
      { kind: 'spoilheap', x: 56, z: -20 },
      { kind: 'cairn', x: -56, z: -28 },
      { kind: 'scorch', x: 40, z: -48 },
      { kind: 'cairn', x: -20, z: 48 },
      { kind: 'spoilheap', x: 24, z: 48 },
      { kind: 'scorch', x: -50, z: -42 },
      { kind: 'scorch', x: 6, z: -38 },
      { kind: 'scorch', x: -10, z: -30 },
      { kind: 'scorch', x: 30, z: -26 },
      { kind: 'scorch', x: -18, z: -18 },
      { kind: 'scorch', x: 22, z: -14 },
      { kind: 'scorch', x: -10, z: -6 },
      { kind: 'scorch', x: -42, z: 2 },
      { kind: 'scorch', x: 42, z: 6 },
      { kind: 'scorch', x: -22, z: 14 },
      { kind: 'scorch', x: 34, z: 18 },
      { kind: 'scorch', x: -30, z: 26 },
      { kind: 'scorch', x: 42, z: 30 },
      { kind: 'scorch', x: 10, z: 38 },
      { kind: 'cairn', x: -42, z: -42 },
      { kind: 'cairn', x: 50, z: -38 },
      { kind: 'cairn', x: 46, z: -30 },
      { kind: 'cairn', x: 22, z: -22 },
      { kind: 'cairn', x: -14, z: -14 },
      { kind: 'cairn', x: -30, z: -6 },
      { kind: 'cairn', x: -30, z: 2 },
      { kind: 'cairn', x: -26, z: 10 },
      { kind: 'cairn', x: 42, z: 14 },
      { kind: 'cairn', x: 10, z: 22 },
      { kind: 'cairn', x: -14, z: 30 },
      { kind: 'cairn', x: -6, z: 38 },
      { kind: 'spoilheap', x: -38, z: -42 },
      { kind: 'spoilheap', x: 38, z: -34 },
      { kind: 'spoilheap', x: -46, z: -22 },
      { kind: 'spoilheap', x: -10, z: -14 },
      { kind: 'spoilheap', x: 42, z: -6 },
      { kind: 'spoilheap', x: 2, z: 6 },
      { kind: 'spoilheap', x: 46, z: 14 },
      { kind: 'spoilheap', x: -38, z: 26 },
      { kind: 'spoilheap', x: 50, z: 34 },
      { kind: 'waystone', x: -34, z: -42, text: 'THE TAP FIELD — KEEP OUT' },
      { kind: 'waystone', x: -22, z: 2, text: 'THE TAP FIELD — KEEP OUT' },
    ],
    // No lamps. Nothing here has ever been lit by anybody.
    crates: [{ x: 42, z: -2 }],
    /**
     * The horizon is switched off rather than set to a treeline or a skyline.
     *
     * There is nothing beyond the rock and there should be nothing drawn beyond it: the walls
     * are twelve units tall and close the view on their own, and a ring of distant silhouettes
     * behind them would say the crater has an outside.
     */
    horizon: 'none',
  },
});
