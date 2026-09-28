/**
 * The Chalk Verge — the first stretch of open ground past the ward gate.
 *
 * Ashfall teaches Sidewalk Immunity by giving you pavement to stand on. This place teaches
 * the opposite lesson by having none: `safety: 'none'`, so the zone chip and the danger
 * vignette are hidden entirely rather than pinned to EXPOSED for as long as you are here.
 * Out here nothing is watching you because nothing needs to be — the things on this road do
 * not require a warrant.
 *
 * Deliberately **oblong** (46 × 30, grown evenly from 30 × 20). Ashfall is square and every
 * grid routine assumed that silently until `extractRects` was taught otherwise; an oblong second
 * area is the thing that keeps the assumption from creeping back.
 *
 * Its shape is a road: a broad east–west cut of chalk and scrub between spoil heaps, with the
 * ward gate at the south-east and the track running away west toward the Rimefields. There is
 * no water and no city ring — the horizon is a treeline, and the light comes from the packs
 * and a banked fire at the trailhead rather than from gas lamps, because gas lamps *are* the
 * safe zone and there is no safe zone here.
 *
 * Nobody lives here, and a test says so. But somebody used to: a shepherd's bothy stands on
 * the north track with its door unbarred, and what is in it is what the last person to sleep
 * there left. It is the one roof between the ward gate and Millharrow, and it belongs to
 * whoever is under it.
 *
 * What the growth added is the country round the road. North, up through the treeline, **the
 * downs**: two sheepfolds and, cut into the turf between them, a chalk horse older than the
 * ward. West, the road runs on past a dew pond to the Chalk Road. East, through the treeline,
 * **the lime kiln** and its spilled lime. South, down through the treeline, **the quarry**: a
 * chalk pit with its faces, a trial pit, and the quarrymen's hut -- and a crew of scavengers who
 * work it by day, a band of their own well clear of the three on the road.
 */

import { TILE, defineArea, type AreaDef, type TileDef } from '../map.js';

/**
 * The verge's legend.
 *
 *   ,  chalk track      — open going
 *   #  scrub            — open going
 *   .  spoil            — open going, broken underfoot
 *   R  rock outcrop     — impassable, low and lumpy
 *   T  thicket          — impassable, tall
 *   B  the bothy        — impassable; drystone, one stack
 *   F  a sheepfold      — impassable; drystone, knee high
 *   P  the dew pond     — impassable
 *   K  the lime kiln    — impassable; stone, always smoking
 *   H  the quarry hut   — impassable; timber
 *
 * No `S`. Nothing here is safe ground, and the absence is the point rather than an oversight
 * — `safety: 'none'` below says so out loud so the HUD does not have to guess.
 */
const VERGE_LEGEND: Record<string, TileDef> = {
  ',': { tex: 'chalk', safe: false, walk: true },
  '#': { tex: 'grass', safe: false, walk: true },
  '.': { tex: 'weeds', safe: false, walk: true },
  R: {
    tex: 'cobble',
    safe: false,
    walk: false,
    // Lumpy and low. Taken whole rather than split: an outcrop with a skyline reads as
    // masonry, which is exactly what this place is not.
    solid: { style: 'rock', minHeight: 2.2, maxHeight: 3.6, inset: 0.5, depthInset: 0.5, chimneyChance: 0, split: false },
  },
  T: {
    tex: 'grass',
    safe: false,
    walk: false,
    // Tall enough to break a sightline, so the packs can come round it.
    solid: { style: 'foliage', minHeight: 4.0, maxHeight: 5.4, inset: 0.7, depthInset: 0.7, chimneyChance: 0, split: true },
  },
  B: {
    tex: 'chalk',
    safe: false,
    walk: false,
    solid: { style: 'cottage', minHeight: 3.4, maxHeight: 3.4, inset: 0.3, depthInset: 0.3, chimneyChance: 1, split: false, wall: 'stone' },
  },
  F: {
    tex: 'grass',
    safe: false,
    walk: false,
    solid: { style: 'wall', minHeight: 1.2, maxHeight: 1.4, inset: 0.4, depthInset: 1.4, chimneyChance: 0, split: false, wall: 'stone' },
  },
  P: { tex: 'water', safe: false, walk: false },
  K: {
    tex: 'weeds',
    safe: false,
    walk: false,
    solid: { style: 'cottage', minHeight: 3.8, maxHeight: 3.8, inset: 0.3, depthInset: 0.3, chimneyChance: 1, split: false, wall: 'stone' },
  },
  H: {
    tex: 'chalk',
    safe: false,
    walk: false,
    solid: { style: 'cottage', minHeight: 3.4, maxHeight: 3.6, inset: 0.3, depthInset: 0.3, chimneyChance: 0.6, split: false, wall: 'timber' },
  },
};

/**
 * 46 wide, 30 deep. The gate is in the old treeline, bottom-right of the old verge; the road
 * runs west to the new edge; the bothy is on the north track under the treeline, and the downs,
 * the kiln and the quarry are through gaps in it.
 *
 * Open enough to roam — 400-odd walkable tiles with three broad pockets the packs beat around
 * — and broken enough that you can put a rock between yourself and something you would rather
 * not meet yet.
 */
const GRID: readonly string[] = [
  'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT', //  0  the far treeline
  '###FFFFFF##########,,,,,,,,,,,,,,#####FFFFFF##', //  1  THE DOWNS: the sheepfolds (west and east), and the chalk horse cut into the turf between
  '###F####F########,,############,,,,###F####F##', //  2
  '###FF##FF##########,,,,,,,,,,,,##,####FF##FF##', //  3
  '##################,##,######,##,##############', //  4
  'T#######TTTT##TTTTTTTTTTTTTTTTT##TTTTT#######T', //  5  the old treeline, with two ways up through it
  'T#######TT####..####..####..##BBB###TT#######T', //  6  THE BOTHY, under the trees
  'T##TTT##T#,,,,,,,,,,,,,,,,,,,,BBB,,,#T#######T', //  7
  'T##TTT##T#,,,,,,,,,,,,,,,,,,,,,,,,,,#T#######T', //  8  the north track; the bothy door
  'T#######T#,,,,RR,,,,,,,,,,RR,,,,,,,,####KKK##T', //  9  the lime kiln (east)
  'T#######T#,,,,RR,,,,,,,,,,RR,,,,,,,,#T##KKK##T', // 10
  'T#######T#,,,,,,,,,,,,,,,,,,,,,,,,,,#T##KKK##T', // 11
  ',,,,,,,,,#..,,,,,,,,,,,,,,,,,,,,,..,#T#######T', // 12  the road, on west to the Chalk Road
  ',,,,,,,,,#..,,,,,,,,,TT,,,,,,,,,,..,#T#......T', // 13  the middle thicket
  'T#######T#,,,,,,,,,,,TT,,,,,,,,,,,,,#T#......T', // 14
  'T#######T#,,,,,,,,,,,,,,,,,,,,,,,,,,#T#......T', // 15
  'T#PPPP##T#,,,,RR,,,,,,,,,,RR,,,,,,,,#T#######T', // 16  the dew pond (west)                                           the lime (east)
  'T#PPPP##T#,,,,RR,,,,,,,,,,RR,,,,,,,,#T#######T', // 17
  'T#PPPP##T#,,,,,,,,,,,,,,,,,,,,,,,,,,#T###RRR#T', // 18  the south track
  'T#######T#....,,,,,,,,,,,,,,,,,,....#####RRR#T', // 19
  'T#######T#....,,,,,,,,,,,,,,,,,,....#T###RRR#T', // 20
  'TTTT####TT####..####..####..####,,##TT#######T', // 21  the gate approach, bottom-right
  'TTTT####TTTTTTTTTTTTTTTTTTTTTTTT,,TTTT#######T', // 22  the cut back to the ward
  'TTTT####TTTTTTTTTTTTTTTTTTTTTTTT,,TTTT#######T', // 23
  'T#######TTTT,,TTTTTT,,TTTTTTTTTTTTTTTT#######T', // 24  the old south treeline, with two ways down through it
  'T,,,R,,,,,,,,,,,,,,,,,,,,,,R,,,,,,,,,,,,,,,,,T', // 25  THE QUARRY: the pit, its faces, and the quarrymen's hut
  'T,,,R,,,,,,,,,,,,,,,,,,,,,,R,,HHH,,,,,,,,,,,,T', // 26
  'T,,,R,,,,,,,,,,,,,,,,,,,,,,R,,HHH,,,,,,,,,,,,T', // 27
  'T,,,RRRRRRRRRRRRRRRRRRRRRRRR,,,,,,,,,,,,,,,,,T', // 28
  'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT', // 29  the treeline
];

const HALF_X = (GRID[0]!.length * TILE) / 2;
const HALF_Z = (GRID.length * TILE) / 2;
const xOfCol = (col: number): number => col * TILE - HALF_X + TILE / 2;
const zOfRow = (row: number): number => row * TILE - HALF_Z + TILE / 2;

export const CHALK_VERGE_ID = 'chalk_verge';

export const CHALK_VERGE: AreaDef = defineArea({
  id: CHALK_VERGE_ID,
  name: 'The Chalk Verge',
  grid: GRID,
  legend: VERGE_LEGEND,
  /** The trailhead, just inside the cut. Where a lost fight puts you back. */
  spawn: { x: 40, z: 22 },
  safety: 'none',
  exits: [
    {
      to: 'ashfall_ward',
      x: 40,
      z: 34,
      label: 'Back through the gate',
      // South of Ashfall's gate hotspot, a stride clear so the prompt does not re-raise.
      arrive: { x: 0, z: -24.6 },
    },
    {
      // West, deeper out. No gate and no wall: the Verge *is* the road's first wild stretch,
      // so the two are the same ground and the join is only where the fields start.
      to: 'chalk_road',
      x: -HALF_X + 2,
      z: -6,
      label: 'Follow the road west',
      arrive: { x: 64, z: 2 },
    },
    {
      // The shepherd's bothy. Unbarred, because there is nobody left to bar it.
      to: 'chalk_verge_bothy',
      x: xOfCol(31),
      z: zOfRow(7) + TILE / 2 + 1.4,
      label: 'Into the bothy',
      door: { x: xOfCol(31), z: zOfRow(7) + TILE / 2 + 0.05, facesSouth: true, style: 'plank' },
      arrive: { x: 0, z: 14 },
    },
  ],
  props: {
    /** The first ground outside the ward, and it shows: hares, and a verge that flowers. */
    sky: 'pollen',
    wildlife: [
      { kind: 'hare', x: -26, z: -34, roam: 8 },
      { kind: 'hare', x: 42, z: -6, roam: 8 },
      { kind: 'rook', x: -50, z: -34, roam: 24, count: 3 },
      // Sheep in the folds, hares on the downs.
      { kind: 'sheep', x: -68, z: -50, roam: 2, count: 3 },
      { kind: 'sheep', x: 72, z: -50, roam: 2, count: 2 },
      { kind: 'hare', x: -20, z: -42, roam: 8 },
    ],
    /** Spoil and abandoned kit, and the first waystones the road puts up. */
    dressing: [
      { kind: 'spoilheap', x: -46, z: -30 },
      { kind: 'spoilheap', x: -14, z: -30 },
      { kind: 'spoilheap', x: 26, z: -22 },
      { kind: 'spoilheap', x: -26, z: -10 },
      { kind: 'spoilheap', x: 46, z: -6 },
      { kind: 'spoilheap', x: 42, z: 2 },
      { kind: 'spoilheap', x: 46, z: 10 },
      { kind: 'spoilheap', x: -2, z: 22 },
      { kind: 'cairn', x: -42, z: -30 },
      { kind: 'cairn', x: 22, z: -30 },
      { kind: 'cairn', x: 34, z: -18 },
      { kind: 'cairn', x: -50, z: -2 },
      { kind: 'cairn', x: 34, z: 10 },
      { kind: 'cairn', x: -42, z: 22 },
      { kind: 'waystone', x: -38, z: -30, text: 'THE WARD ENDS HERE' },
      { kind: 'waystone', x: 38, z: -22, text: 'NO WRIT PAST THIS STONE' },
      { kind: 'waystone', x: -46, z: -2, text: 'THE WARD ENDS HERE' },
      { kind: 'waystone', x: -42, z: 18, text: 'NO WRIT PAST THIS STONE' },
      { kind: 'fence', x: -34, z: -30, yaw: 0 },
      { kind: 'fence', x: 42, z: -22, yaw: 0 },
      { kind: 'fence', x: -42, z: -2, yaw: 0 },
      { kind: 'fence', x: -42, z: 14, yaw: 0 },
      { kind: 'wildflowers', x: -30, z: -30 },
      { kind: 'wildflowers', x: 10, z: -30 },
      { kind: 'wildflowers', x: -6, z: -18 },
      { kind: 'wildflowers', x: 46, z: -10 },
      { kind: 'wildflowers', x: -34, z: 2 },
      { kind: 'wildflowers', x: -38, z: 18 },
      { kind: 'bramble', x: -22, z: -30 },
      { kind: 'bramble', x: 6, z: -22 },
      { kind: 'bramble', x: 46, z: 2 },
      // The shepherd's things, outside the door: a pen with nothing in it, and the woodpile.
      { kind: 'pens', x: 46, z: -30 },
      { kind: 'logpile', x: 26, z: -30 },
      // The downs: fodder by the west fold.
      { kind: 'haybale', x: -52, z: -50 },
      { kind: 'trough', x: -52, z: -44 },
      // The dew pond's reeds.
      { kind: 'reeds', x: -66, z: 10 },
      { kind: 'reeds', x: -86, z: 2 },
      // The kiln: lime, the fuel for it, a barrel of water for the slaking.
      { kind: 'spoilheap', x: 84, z: -4 },
      { kind: 'barrel', x: 64, z: -20 },
      { kind: 'logpile', x: 84, z: -20 },
      // The quarry.
      { kind: 'spoilheap', x: -60, z: 44 },
      { kind: 'spoilheap', x: 0, z: 44 },
      { kind: 'cart', x: 8, z: 42 },
      { kind: 'barrel', x: 44, z: 46 },
    ],
    /**
     * Three packs, working one shared stretch of road.
     *
     * The circles **overlap deliberately**, and they used to be spread precisely so they
     * could not: two packs converging on one player was a fight nothing modelled, and the
     * contact handler was first-come. The Combat Ring is what models it — walk into one
     * here and the circle it opens can reach a second, which arrives on round two and is
     * paid for with a Bone and a card. Capped at two, so the road can be unkind without
     * being unsurvivable.
     *
     * Homes are on open chalk with better than four fifths of each circle walkable, and no
     * pair is further apart than their roam radii sum to — which is what makes a pull
     * something that actually happens rather than something that theoretically could.
     */
    packs: [
      // The scavengers live here and are out whenever you are -- the verge is the first ground
      // outside the ward and it is never entirely safe, which is the lesson it exists to teach.
      { encounterId: 'pack_chalk_scavengers', x: -10, z: 0, roam: 9 },
      // The other two keep hours. Dogs range at night; whatever is in the spoil heaps does not
      // come out into the light at all.
      { encounterId: 'pack_verge_stray_dogs', x: 0, z: 8, roam: 9, hours: 'night' },
      { encounterId: 'pack_spoil_heap_hollows', x: 6, z: -4, roam: 9, hours: 'night' },
      // The quarry's own, by day: a band of their own, down through the treeline, where no ring
      // opened on the road can reach them.
      { encounterId: 'pack_chalk_scavengers', id: 'quarry', x: -30, z: 46, roam: 6, hours: 'day', band: 'quarry' },
    ],
    /** The notices, nailed to a post where the road forks. */
    huntSignpost: { x: 26, z: 14 },

    /** Spoil and abandoned kit along the track. */
    crates: [
      { x: -10, z: 6 },
      { x: 12, z: -6 },
      { x: -4, z: -18 },
    ],
    trees: [
      { x: -50, z: -30 },
      { x: -18, z: -30 },
      { x: 18, z: -30 },
      { x: 50, z: -22 },
      { x: -50, z: 22 },
      { x: 50, z: 10 },
    ],
    horizon: 'treeline',
    /** The gibbet in the middle of the open chalk, where everything on the road can see it. */
    landmarks: [{ kind: 'gibbet', x: -20, z: 10 }],
    vignettes: [{ id: 'dig_site', x: -40, z: 46 }],
  },
});
