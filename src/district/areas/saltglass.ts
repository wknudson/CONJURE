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
 */

import { defineArea, type AreaDef, type TileDef } from '../map.js';

/**
 * Saltglass's legend.
 *
 *   s  salt crust  — the flats
 *   ,  chalk track — the cart ways across them
 *   c  cobbles     — the quay along the pans
 *   W  brine pan   — impassable
 *   G  fused pane  — impassable, tall, thin, and taken whole
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
  T: {
    tex: 'grass',
    safe: false,
    walk: false,
    solid: { minHeight: 2.6, maxHeight: 3.8, inset: 0.8, depthInset: 0.8, chimneyChance: 0, split: true },
  },
};

/** Two rows of standing brine along the north edge. */
const WATER_ROWS = 2;

/**
 * 24 wide by 20 deep.
 *
 * Column 23 opens at rows 10 and 11 — the cart way east to Millharrow, and the only way in or
 * out. The pane ranks are offset between the north half and the south so the flats never read
 * as one repeated stamp.
 */
const GRID: readonly string[] = [
  'WWWWWWWWWWWWWWWWWWWWWWWW', //  0  the pans
  'WWWWWWWWWWWWWWWWWWWWWWWW', //  1
  'TccccccccccccccccccccccT', //  2  the quay
  'TssssssssssssssssssssssT', //  3
  'TssGGGGssssssssGGGGssssT', //  4  the pane ranks
  'TssGGGGssssssssGGGGssssT', //  5
  'TssssssssssssssssssssssT', //  6
  'Tss,,,,,,,,,,,,,,,,ssssT', //  7  a cart way across the flats
  'TssssssssssssssssssssssT', //  8
  'TsssGGGGGGssssGGGGGGsssT', //  9
  'T,,,,,,,,,,,,,,,,,,,,,,,', // 10  the way east, to Millharrow
  'T,,,,,,,,,,,,,,,,,,,,,,,', // 11
  'TsssGGGGGGssssGGGGGGsssT', // 12
  'TssssssssssssssssssssssT', // 13
  'Tss,,,,,,,,,,,,,,,,ssssT', // 14
  'TssssssssssssssssssssssT', // 15
  'TssGGGGssssssssGGGGssssT', // 16
  'TssGGGGssssssssGGGGssssT', // 17
  'TccccccccccccccccccccccT', // 18
  'TTTTTTTTTTTTTTTTTTTTTTTT', // 19
];

export const SALTGLASS_ID = 'saltglass';

export const SALTGLASS: AreaDef = defineArea({
  id: SALTGLASS_ID,
  name: 'Saltglass',
  grid: GRID,
  legend: SALT_LEGEND,
  /** On the cart way, in the middle of the flats. */
  spawn: { x: 0, z: 2 },
  safety: 'none',
  exits: [
    {
      to: 'millharrow',
      x: 46,
      z: 2,
      label: 'East, along the cart way to Millharrow',
      arrive: { x: -42, z: -2 },
    },
  ],
  props: {
    /** Flats and fused panes. Gulls and crabs, and nothing that needs cover. */
    sky: 'drizzle',
    wildlife: [
      { kind: 'gull', x: -46, z: -38, roam: 24, count: 4 },
      { kind: 'gull', x: -18, z: -10, roam: 24, count: 4 },
      { kind: 'gull', x: 34, z: 14, roam: 24, count: 4 },
      { kind: 'crab', x: -14, z: -30, roam: 4, count: 2 },
      { kind: 'crab', x: 10, z: -14, roam: 4, count: 2 },
      { kind: 'crab', x: 6, z: -2, roam: 4, count: 2 },
      { kind: 'crab', x: 10, z: 14, roam: 4, count: 2 },
      { kind: 'crab', x: -10, z: 26, roam: 4, count: 2 },
    ],
    /** Fishing town with a shut harbour: nets that are not being used, salt that is not being sold. */
    dressing: [
      { kind: 'waystone', x: -18, z: -22, text: 'HARBOUR CLOSED BY WRIT' },
      { kind: 'rack', x: -42, z: -30 },
      { kind: 'rack', x: 14, z: -30 },
      { kind: 'rack', x: -30, z: -26 },
      { kind: 'rack', x: 10, z: -26 },
      { kind: 'rack', x: -38, z: -22 },
      { kind: 'rack', x: 30, z: -22 },
      { kind: 'rack', x: -2, z: -18 },
      { kind: 'rack', x: -38, z: -14 },
      { kind: 'rack', x: 2, z: -14 },
      { kind: 'spoilheap', x: -34, z: -30 },
      { kind: 'spoilheap', x: -38, z: -26 },
      { kind: 'spoilheap', x: 34, z: -26 },
      { kind: 'spoilheap', x: -38, z: -18 },
      { kind: 'spoilheap', x: -26, z: -14 },
      { kind: 'bollard', x: -26, z: -30 },
      { kind: 'bollard', x: 34, z: -30 },
      { kind: 'bollard', x: -2, z: -26 },
      { kind: 'bollard', x: -42, z: -22 },
      { kind: 'bollard', x: 42, z: -22 },
      { kind: 'bollard', x: 34, z: -18 },
      { kind: 'bollard', x: -6, z: -14 },
      { kind: 'barrel', x: -22, z: -30 },
      { kind: 'barrel', x: -2, z: -14 },
      { kind: 'barrel', x: -38, z: -2 },
      { kind: 'barrel', x: -34, z: 14 },
      { kind: 'barrel', x: 10, z: 22 },
      { kind: 'reeds', x: -14, z: -30 },
      { kind: 'reeds', x: -10, z: -26 },
      { kind: 'reeds', x: 6, z: -22 },
      { kind: 'reeds', x: -42, z: -14 },
    ],
    /** Both up on the brine pans at the north end, where the work is and the writ bites. */
    npcs: [
      { id: 'saltglass_fisherman', x: -14, z: -26, art: 'fisherman', label: 'Talk to the fisherman' },
      { id: 'saltglass_panwife', x: 14, z: -14, art: 'seamstress', label: 'Talk to the pan-wife' },
      { id: 'saltglass_chartmaker', x: -18, z: -30, art: 'cartographer_b', label: 'Talk to the chart-maker' },
      { id: 'saltglass_bard', x: -10, z: -30, art: 'bard_b', label: 'Listen to the singer' },
    ],
    /** On the quay, where the pans are worked before dawn. */
    /**
     * Who walks the row.
     *
     * She is already up: the pans are worked before dawn, which makes her the only
     * person on the flats awake when the lamps matter.
     */
    lamplighter: 'saltglass_panwife',
    lamps: [
      { x: -30, z: -30 },
      { x: 2, z: -30 },
      { x: -30, z: 34 },
      { x: 2, z: 34 },
    ],
    crates: [
      { x: -38, z: -30 },
      { x: 26, z: -30 },
      { x: -38, z: 34 },
    ],
    waterRows: WATER_ROWS,
    horizon: 'treeline',
  },
});
