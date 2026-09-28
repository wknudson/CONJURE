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
 * Forty-six by thirty-six now, grown evenly from thirty by twenty-four, and two roofs on the quay
 * side. The Glasshouse is where the panes
 * are made and where a furnace burns on the coldest ground in the Ring, and the Customs House
 * is the building the writ came out of -- chained by that writ, and opened by the riot that
 * answers it. The Customs Chain the riot is named for is on the quay in front of it.
 *
 * What the growth added is the trade either side of the flats. North, between the quay and the
 * sea, **the salt pans** in their ranks between the bunds -- the works' own pans among them -- and
 * the headland with **the lighthouse** on it, still lit though the harbour is shut. West, **the
 * glass kilns**, fired on driftwood, and their cullet heaps. South, through the scrub, **the wreck
 * on the salt**: a ship a mile from any water that could have put it there, its stern broken open
 * to the ribs.
 *
 * The Glass-Pickers work the pans' bunds by day, keep a man on the wreck at night, and pick over
 * the kilns' cullet after dark.
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
 *   P  a salt pan   — impassable; brine, left for the sun
 *   k  the rakers' shed — impassable; timber
 *   K  a glass kiln — impassable; stone, fired on driftwood
 *   Z  the wreck    — impassable; a hull on the salt
 *   R  its stern    — impassable; broken open to the ribs
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
    solid: { style: 'ice', minHeight: 4.4, maxHeight: 5.6, inset: 1.5, depthInset: 0.25, chimneyChance: 0, split: false },
  },
  H: {
    tex: 'salt',
    safe: false,
    walk: false,
    solid: { style: 'warehouse', minHeight: 5.4, maxHeight: 5.4, inset: 0.3, depthInset: 0.3, chimneyChance: 1, split: false, wall: 'timber' },
  },
  X: {
    tex: 'cobble',
    safe: false,
    walk: false,
    solid: { style: 'hall', minHeight: 6.0, maxHeight: 6.0, inset: 0.3, depthInset: 0.3, chimneyChance: 0, split: false, wall: 'stone' },
  },
  T: {
    tex: 'grass',
    safe: false,
    walk: false,
    solid: { style: 'foliage', minHeight: 2.6, maxHeight: 3.8, inset: 0.8, depthInset: 0.8, chimneyChance: 0, split: true },
  },
  P: { tex: 'water', safe: false, walk: false },
  k: {
    tex: 'salt',
    safe: false,
    walk: false,
    solid: { style: 'cottage', minHeight: 3.4, maxHeight: 3.6, inset: 0.3, depthInset: 0.3, chimneyChance: 0.3, split: false, wall: 'timber' },
  },
  K: {
    tex: 'salt',
    safe: false,
    walk: false,
    solid: { style: 'cottage', minHeight: 3.8, maxHeight: 4.2, inset: 0.3, depthInset: 0.3, chimneyChance: 1, split: false, wall: 'stone' },
  },
  Z: {
    tex: 'salt',
    safe: false,
    walk: false,
    solid: { style: 'plain', minHeight: 2.8, maxHeight: 3.2, inset: 0.4, depthInset: 0.5, chimneyChance: 0, split: false, wall: 'timber' },
  },
  R: {
    tex: 'salt',
    safe: false,
    walk: false,
    solid: { style: 'wall', minHeight: 1.4, maxHeight: 2.6, inset: 0.5, depthInset: 1.0, chimneyChance: 0, split: true, wall: 'timber' },
  },
};

/** Two rows of the sea along the north edge; the pans are between it and the quay now. */
const WATER_ROWS = 2;


/**
 * 30 wide by 24 deep.
 *
 * Column 29 opens at rows 13 and 14 — the cart way east to Millharrow, and the only way in or
 * out. The pane ranks are offset between the north half and the south so the flats never read
 * as one repeated stamp.
 */
const GRID: readonly string[] = [
  'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW', //  0  the sea
  'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW', //  1
  'ssssssssssssssssssssssssssssssssssssssssssssss', //  2  THE SALT PANS, in their ranks between the bunds; the headland (east)
  'sPPPsPPPsPPPsPPPsPPPsPPPsPPPsPPPsPPPssssssssss', //  3
  'sPPPsPPPsPPPsPPPsPPPsPPPsPPPsPPPsPPPssssssssss', //  4
  'ssssssssssssssssssssssssssssssssssssssssssssss', //  5
  'sPPPsPPPsPPPsPPPsPPPsPPPsPPPsPPPsPPPsskkksssss', //  6  the pans that were the works' own; the salt-rakers' shed
  'sPPPsPPPsPPPsPPPsPPPsPPPsPPPsPPPsPPPsskkksssss', //  7
  'cccccccccccccccccccccccccccccccccccccccccccccc', //  8  the quay; the Customs Chain
  'TsssssssTssHHHHHHsssssssssssXXXXXssssTsssssssT', //  9  THE GLASSHOUSE   THE CUSTOMS HOUSE
  'TKKKssssTssHHHHHHsssssssssssXXXXXssssTsssssssT', // 10  THE GLASS KILNS (west)
  'TKKKssssTssHHHHHHssssssssssssssssssssTsssssssT', // 11  the customs house door
  'TsssssssssssssssssssssssssssssssssssssssGGGGsT', // 12  the glasshouse door
  'TsssssssTssGGGGssssssssssGGGGssssssssTssGGGGsT', // 13  the pane ranks
  'TsssssssTssGGGGssssssssssGGGGssssssssTsssssssT', // 14
  'TKKKssssTssssssssssssssssssssssssssssTsssssssT', // 15
  'TKKKssssTss,,,,,,,,,,,,,,,,,,,,ssssssTsssssssT', // 16  a cart way across the flats
  'TsssssssTssssssssssssssssssssssssssssTsssssssT', // 17
  'TsssssssTsssGGGGGGssssssGGGGGGsssssssTsssssssT', // 18
  'TsssssssT,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,', // 19  the way east, to Millharrow
  'TsssssssT,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,', // 20
  'TsssssssTsssGGGGGGssssssGGGGGGsssssssTsssssssT', // 21
  'TsssssssTssssssssssssssssssssssssssssTsssssssT', // 22
  'TsssKKKsTss,,,,,,,,,,,,,,,,,,,,ssssssTsssssssT', // 23
  'TsssKKKsTssssssssssssssssssssssssssssTsssssssT', // 24
  'TssssssssssGGGGssssssssssGGGGssssssssssssssssT', // 25
  'TsssssssTssGGGGssssssssssGGGGssssssssTsGGGGssT', // 26
  'TsssssssTssssssssssssssssssssssssssssTsGGGGssT', // 27
  'TsssssssTccccccccccccccccccccccccccccTsssssssT', // 28  the south quay
  'TsssssssTTTTTTTssTTTTTTTTTTTTTTTTssTTTsssssssT', // 29  the old south scrub, two ways through it
  'TssssssssssssssssssssssssssssssssssssssssssssT', // 30  THE WRECK ON THE SALT: the hull, the bow, the stern broken to the ribs
  'TsssssssssRRRZZZZZZZZZZZZZZZZssssssssssssssssT', // 31
  'TsssssssssRRRZZZZZZZZZZZZZZZsssssssssssssssssT', // 32
  'TssssssssssssssssssssssssssssssssssssssssssssT', // 33
  'TssssssssssssssssssssssssssssssssssssssssssssT', // 34
  'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT', // 35  the scrub
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
      arrive: { x: -98, z: -2 },
    },
    {
      // The Glasshouse. The one warm room on the flats.
      to: 'saltglass_glasshouse',
      x: xOfCol(13.5),
      z: zOfRow(11) + TILE / 2 + 1.4,
      label: 'Into the Glasshouse',
      door: { x: xOfCol(13.5), z: zOfRow(11) + TILE / 2 + 0.05, facesSouth: true, sign: 'foundry', style: 'plank' },
      arrive: { x: 0, z: 14 },
    },
    {
      // The Customs House, chained by the writ it issued. The riot is what opens it.
      to: 'saltglass_customs_house',
      x: xOfCol(30),
      z: zOfRow(10) + TILE / 2 + 1.4,
      label: 'Into the Customs House',
      door: { x: xOfCol(30), z: zOfRow(10) + TILE / 2 + 0.05, facesSouth: true, sign: 'toll', style: 'iron' },
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
      // Crabs round the wreck, gulls on the pans.
      { kind: 'crab', x: -20, z: 66, roam: 4, count: 3 },
      { kind: 'gull', x: 0, z: -58, roam: 22, count: 4 },
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

      // Salt raked into heaps on the sea bank.
      { kind: 'spoilheap', x: -62, z: -62 },
      { kind: 'spoilheap', x: 10, z: -62 },
      { kind: 'spoilheap', x: 46, z: -62 },
      // The kilns' driftwood and their cullet.
      { kind: 'logpile', x: -82, z: -34 },
      { kind: 'spoilheap', x: -84, z: 30 },
      { kind: 'barrel', x: -70, z: 18 },
      { kind: 'barrel', x: 70, z: -10 },
      // What the wreck carried, spilled on the salt; its mast.
      { kind: 'deadfall', x: -10, z: 64 },
      { kind: 'barrel', x: -30, z: 50 },
      { kind: 'barrel', x: 6, z: 66 },
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
      { text: 'ONE SHEET OF PAPER', wallX: xOfCol(28.5), wallZ: zOfRow(10) + TILE / 2 + 0.05, dx: 0, facesSouth: true, tint: '#a4543a' },
    ],
    waterRows: WATER_ROWS,
    horizon: 'treeline',
    /**
     * The Glass-Pickers: along the pans' middle bund by day, a man on the wreck's bow at night,
     * sweeping the salt round it, and a crew over the kilns' cullet after dark.
     */
    packs: [
      {
        encounterId: 'pack_glass_pickers',
        id: 'pans',
        x: 0,
        z: -50,
        roam: 6,
        hours: 'day',
        band: 'pans',
        behaviour: 'beat',
        route: [
          { x: -80, z: -50 },
          { x: 60, z: -50 },
        ],
      },
      {
        encounterId: 'pack_glass_pickers',
        id: 'wreck',
        x: 36,
        z: 56,
        roam: 4,
        hours: 'night',
        band: 'wreck',
        behaviour: 'sentry',
        // Facing west down the hull, and round to the salt either side of it.
        sweep: [-2.2, -0.9],
      },
      { encounterId: 'pack_glass_pickers', id: 'kilns', x: -78, z: -2, roam: 6, hours: 'night', band: 'kilns' },
    ],
    /** The light on the headland, still lit, sweeping a sea with no boats on it. */
    landmarks: [{ kind: 'lighthouse', x: 76, z: -56 }],
    vignettes: [{ id: 'ruined_camp', x: -60, z: 66 }],
  },
});
