/**
 * Saltglass — the pans, and the panes.
 *
 * Brine works at the edge of the Ring: shallow pans along the north that were flooded and left,
 * and the fused sheets the trade is actually named for standing in rows across the flats. The
 * panes are the only vertical thing here and they are set in ranks, so the whole place is a
 * bright open floor with tall thin obstacles you keep having to walk around the end of.
 *
 * It is the brightest ground in the game and that is deliberate — after the Tallow Levels and
 * before Bray's Hollow, the Ring needs one place that is glare rather than gloom.
 *
 * Thirty by twenty-four now, and two roofs on the quay side. The Glasshouse is where the panes
 * are made and where a furnace burns on the coldest ground in the Ring, and the Customs House
 * is the building the writ came out of -- chained by that writ, and opened by the riot that
 * answers it. The Customs Chain the riot is named for is on the quay in front of it.
 */

import { TILE, defineArea, type AreaDef, type TileDef } from '../map.js';

/**
 * Saltglass's legend.
 *
 *   s  salt crust  — the flats
 *   ,  chalk track — the cart ways across them
 *   c  cobbles     — the quay along the pans
 *   W  brine pan   — impassable
 *   G  fused pane  — impassable, tall, thin, and taken whole
 *   H  the Glasshouse — impassable; timber, the furnace stack always going
 *   X  the Customs House — impassable; dressed stone, the Magistracy's
 *   T  scrub       — impassable, the boundary
 *
 * `G` is the narrowest solid in the game: a big `inset` on both axes leaves a sheet rather than
 * a block, which is what a pane of fused glass standing on edge should look like from any angle.
 */
const SALT_LEGEND: Record<string, TileDef> = {
  s: { tex: 'salt', safe: false, walk: true },
  ',': { tex: 'chalk', safe: false, walk: true },
  c: { tex: 'cobble', safe: false, walk: true },
  W: { tex: 'water', safe: false, walk: false },
  G: {
    tex: 'salt',
    safe: false,
    walk: false,
    solid: { minHeight: 4.4, maxHeight: 5.6, inset: 1.5, depthInset: 0.25, chimneyChance: 0, split: false },
  },
  H: {
    tex: 'salt',
    safe: false,
    walk: false,
    solid: { minHeight: 5.4, maxHeight: 5.4, inset: 0.3, depthInset: 0.3, chimneyChance: 1, split: false, wall: 'timber' },
  },
  X: {
    tex: 'cobble',
    safe: false,
    walk: false,
    solid: { minHeight: 6.0, maxHeight: 6.0, inset: 0.3, depthInset: 0.3, chimneyChance: 0, split: false, wall: 'stone' },
  },
  T: {
    tex: 'grass',
    safe: false,
    walk: false,
    solid: { minHeight: 2.6, maxHeight: 3.8, inset: 0.8, depthInset: 0.8, chimneyChance: 0, split: true },
  },
};

/** Two rows of standing brine along the north edge. */
const WATER_ROWS = 2;

const FLATS = `T${'s'.repeat(28)}T`;
const QUAY = `T${'c'.repeat(28)}T`;
const RANK_A = `Tss${'G'.repeat(4)}${'s'.repeat(10)}${'G'.repeat(4)}${'s'.repeat(8)}T`;
const RANK_B = `Tsss${'G'.repeat(6)}${'s'.repeat(6)}${'G'.repeat(6)}${'s'.repeat(7)}T`;
const CART_WAY = `Tss${','.repeat(20)}${'s'.repeat(6)}T`;

/**
 * 30 wide by 24 deep.
 *
 * Column 29 opens at rows 13 and 14 — the cart way east to Millharrow, and the only way in or
 * out. The pane ranks are offset between the north half and the south so the flats never read
 * as one repeated stamp.
 */
const GRID: readonly string[] = [
  'W'.repeat(30), //  0  the pans
  'W'.repeat(30), //  1
  QUAY, //  2  the quay; the Customs Chain
  `Tss${'H'.repeat(6)}${'s'.repeat(11)}${'X'.repeat(5)}${'s'.repeat(4)}T`, //  3  THE GLASSHOUSE   THE CUSTOMS HOUSE
  `Tss${'H'.repeat(6)}${'s'.repeat(11)}${'X'.repeat(5)}${'s'.repeat(4)}T`, //  4
  `Tss${'H'.repeat(6)}${'s'.repeat(20)}T`, //  5  the customs house door
  FLATS, //  6  the glasshouse door
  RANK_A, //  7  the pane ranks
  RANK_A, //  8
  FLATS, //  9
  CART_WAY, // 10  a cart way across the flats
  FLATS, // 11
  RANK_B, // 12
  `T${','.repeat(29)}`, // 13  the way east, to Millharrow
  `T${','.repeat(29)}`, // 14
  RANK_B, // 15
  FLATS, // 16
  CART_WAY, // 17
  FLATS, // 18
  RANK_A, // 19
  RANK_A, // 20
  FLATS, // 21
  QUAY, // 22  the south quay
  'T'.repeat(30), // 23
];

const HALF_X = (GRID[0]!.length * TILE) / 2;
const HALF_Z = (GRID.length * TILE) / 2;
const xOfCol = (col: number): number => col * TILE - HALF_X + TILE / 2;
const zOfRow = (row: number): number => row * TILE - HALF_Z + TILE / 2;

export const SALTGLASS_ID = 'saltglass';

export const SALTGLASS: AreaDef = defineArea({
  id: SALTGLASS_ID,
  name: 'Saltglass',
  grid: GRID,
  legend: SALT_LEGEND,
  /** On the cart way, in the middle of the flats. */
  spawn: { x: 0, z: 8 },
  safety: 'none',
  exits: [
    {
      to: 'millharrow',
      x: HALF_X - 2,
      z: 8,
      label: 'East, along the cart way to Millharrow',
      arrive: { x: -42, z: -2 },
    },
    {
      // The Glasshouse. The one warm room on the flats.
      to: 'saltglass_glasshouse',
      x: xOfCol(5.5),
      z: zOfRow(5) + TILE / 2 + 1.4,
      label: 'Into the Glasshouse',
      door: { x: xOfCol(5.5), z: zOfRow(5) + TILE / 2 + 0.05, facesSouth: true, sign: 'foundry', style: 'plank' },
      arrive: { x: 0, z: 14 },
    },
    {
      // The Customs House, chained by the writ it issued. The riot is what opens it.
      to: 'saltglass_customs_house',
      x: xOfCol(22),
      z: zOfRow(4) + TILE / 2 + 1.4,
      label: 'Into the Customs House',
      door: { x: xOfCol(22), z: zOfRow(4) + TILE / 2 + 0.05, facesSouth: true, sign: 'toll', style: 'iron' },
      when: { after: ['saltglass_riot'] },
      lockedReason: 'Chained, by the writ that shut the harbour. Nobody on the quay has the key, and the quay knows it.',
      arrive: { x: 0, z: 14 },
    },
  ],
  props: {
    /** Flats and fused panes. Gulls and crabs, and nothing that needs cover. */
    sky: 'drizzle',
    wildlife: [
      { kind: 'gull', x: -46, z: -46, roam: 24, count: 4 },
      { kind: 'gull', x: -18, z: -10, roam: 24, count: 4 },
      { kind: 'gull', x: 34, z: 14, roam: 24, count: 4 },
      { kind: 'crab', x: -14, z: -30, roam: 4, count: 2 },
      { kind: 'crab', x: 10, z: -10, roam: 4, count: 2 },
      { kind: 'crab', x: 6, z: -2, roam: 4, count: 2 },
      { kind: 'crab', x: 10, z: 18, roam: 4, count: 2 },
      { kind: 'crab', x: -10, z: 26, roam: 4, count: 2 },
    ],
    /** Fishing town with a shut harbour: nets that are not being used, salt that is not being sold. */
    dressing: [
      { kind: 'waystone', x: -18, z: -22, text: 'HARBOUR CLOSED BY WRIT' },
      { kind: 'rack', x: -46, z: -38 },
      { kind: 'rack', x: 14, z: -38 },
      { kind: 'rack', x: -18, z: -26 },
      { kind: 'rack', x: 10, z: -26 },
      { kind: 'rack', x: -38, z: -22 },
      { kind: 'rack', x: 30, z: -22 },
      { kind: 'rack', x: -2, z: -18 },
      { kind: 'rack', x: -38, z: -10 },
      { kind: 'rack', x: 2, z: -14 },
      { kind: 'spoilheap', x: -34, z: -38 },
      { kind: 'spoilheap', x: -42, z: -22 },
      { kind: 'spoilheap', x: 34, z: -26 },
      { kind: 'spoilheap', x: -46, z: -10 },
      { kind: 'spoilheap', x: -26, z: -14 },
      { kind: 'bollard', x: -26, z: -38 },
      { kind: 'bollard', x: 34, z: -38 },
      { kind: 'bollard', x: -2, z: -26 },
      { kind: 'bollard', x: -50, z: -38 },
      { kind: 'bollard', x: 42, z: -22 },
      { kind: 'bollard', x: 34, z: -18 },
      { kind: 'bollard', x: -6, z: -14 },
      { kind: 'barrel', x: -22, z: -38 },
      { kind: 'barrel', x: 2, z: -10 },
      { kind: 'barrel', x: -38, z: -2 },
      { kind: 'barrel', x: -34, z: 18 },
      { kind: 'barrel', x: 10, z: 26 },
      { kind: 'reeds', x: -14, z: -34 },
      { kind: 'reeds', x: -10, z: -26 },
      { kind: 'reeds', x: 6, z: -22 },
      { kind: 'reeds', x: -50, z: -14 },
      // The south quay, where the boats that do not go anywhere are pulled up.
      { kind: 'rack', x: -14, z: 42 },
      { kind: 'rack', x: 14, z: 42 },
      { kind: 'bollard', x: -42, z: 42 },
      { kind: 'bollard', x: 38, z: 42 },
      { kind: 'logpile', x: 42, z: 42 },
    ],
    /** Both up on the brine pans at the north end, where the work is and the writ bites. */
    npcs: [
      { id: 'saltglass_fisherman', x: -14, z: -38, art: 'fisherman', label: 'Talk to the fisherman' },
      { id: 'saltglass_panwife', x: 14, z: -26, art: 'seamstress', label: 'Talk to the pan-wife' },
      { id: 'saltglass_chartmaker', x: -18, z: -34, art: 'cartographer_b', label: 'Talk to the chart-maker' },
      { id: 'saltglass_bard', x: -10, z: -30, art: 'bard_b', label: 'Listen to the singer' },
    ],
    /**
     * Who walks the row.
     *
     * She is already up: the pans are worked before dawn, which makes her the only
     * person on the flats awake when the lamps matter.
     */
    lamplighter: 'saltglass_panwife',
    lamps: [
      { x: -30, z: -38 },
      { x: 2, z: -38 },
      { x: -30, z: 42 },
      { x: 2, z: 42 },
    ],
    crates: [
      { x: -38, z: -38 },
      { x: 22, z: -38 },
      { x: -38, z: 42 },
    ],
    graffiti: [
      // On the Customs House, facing the quay it shut.
      { text: 'ONE SHEET OF PAPER', wallX: xOfCol(20.5), wallZ: zOfRow(4) + TILE / 2 + 0.05, dx: 0, facesSouth: true, tint: '#a4543a' },
    ],
    waterRows: WATER_ROWS,
    horizon: 'treeline',
  },
});
