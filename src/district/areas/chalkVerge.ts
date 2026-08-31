/**
 * The Chalk Verge — the first stretch of open ground past the ward gate.
 *
 * Ashfall teaches Sidewalk Immunity by giving you pavement to stand on. This place teaches
 * the opposite lesson by having none: `safety: 'none'`, so the zone chip and the danger
 * vignette are hidden entirely rather than pinned to EXPOSED for as long as you are here.
 * Out here nothing is watching you because nothing needs to be — the things on this road do
 * not require a warrant.
 *
 * Deliberately **oblong** (24 × 16). Ashfall is square and every grid routine assumed that
 * silently until `extractRects` was taught otherwise; an oblong second area is the thing that
 * keeps the assumption from creeping back.
 *
 * Its shape is a road: a broad east–west cut of chalk and scrub between spoil heaps, with the
 * ward gate at the south-east and the track running away west toward the Rimefields. There is
 * no water and no city ring — the horizon is a treeline, and the light comes from the packs
 * and a banked fire at the trailhead rather than from gas lamps, because gas lamps *are* the
 * safe zone and there is no safe zone here.
 */

import { defineArea, type AreaDef, type TileDef } from '../map.js';

/**
 * The verge's legend.
 *
 *   ,  chalk track      — open going
 *   #  scrub            — open going
 *   .  spoil            — open going, broken underfoot
 *   R  rock outcrop     — impassable, low and lumpy
 *   T  thicket          — impassable, tall
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
    solid: { minHeight: 2.2, maxHeight: 3.6, inset: 0.5, depthInset: 0.5, chimneyChance: 0, split: false },
  },
  T: {
    tex: 'grass',
    safe: false,
    walk: false,
    // Tall enough to break a sightline, so the packs can come round it.
    solid: { minHeight: 4.0, maxHeight: 5.4, inset: 0.7, depthInset: 0.7, chimneyChance: 0, split: true },
  },
};

/**
 * 24 wide, 16 deep. The gate is bottom-right; the road runs west.
 *
 * Open enough to roam — 300-odd walkable tiles with three broad pockets the packs beat around
 * — and broken enough that you can put a rock between yourself and something you would rather
 * not meet yet.
 */
const GRID: readonly string[] = [
  'TTTTTTTTTTTTTTTTTTTTTTTT', //  0  the treeline, north
  'TT####..####..####..##TT', //  1
  'T#,,,,,,,,,,,,,,,,,,,,#T', //  2  the north track
  'T#,,,,RR,,,,,,,,RR,,,,#T', //  3
  'T#,,,,RR,,,,,,,,RR,,,,#T', //  4
  ',#,,,,,,,,,,,,,,,,,,,,#T', //  5  the west cut, out onto the Chalk Road
  ',#..,,,,,,TT,,,,,,,,..#T', //  6  the middle thicket
  'T#..,,,,,,TT,,,,,,,,..#T', //  7
  'T#,,,,,,,,,,,,,,,,,,,,#T', //  8
  'T#,,,,RR,,,,,,,,RR,,,,#T', //  9
  'T#,,,,RR,,,,,,,,RR,,,,#T', // 10
  'T#,,,,,,,,,,,,,,,,,,,,#T', // 11  the south track
  'T#....,,,,,,,,,,,,....#T', // 12
  'TT####..####..####..,,TT', // 13  the gate approach, bottom-right
  'TTTTTTTTTTTTTTTTTTTT,,TT', // 14  the cut back to the ward
  'TTTTTTTTTTTTTTTTTTTTTTTT', // 15
];

export const CHALK_VERGE_ID = 'chalk_verge';

export const CHALK_VERGE: AreaDef = defineArea({
  id: CHALK_VERGE_ID,
  name: 'The Chalk Verge',
  grid: GRID,
  legend: VERGE_LEGEND,
  /** The trailhead, just inside the cut. Where a lost fight puts you back. */
  spawn: { x: 34, z: 22 },
  safety: 'none',
  exits: [
    {
      to: 'ashfall_ward',
      x: 34,
      z: 26,
      label: 'Back through the gate',
      // South of Ashfall's gate hotspot, a stride clear so the prompt does not re-raise.
      arrive: { x: 4, z: -12.4 },
    },
    {
      // West, deeper out. No gate and no wall: the Verge *is* the road's first wild stretch,
      // so the two are the same ground and the join is only where the fields start.
      to: 'chalk_road',
      x: -46,
      z: -8,
      label: 'Follow the road west',
      arrive: { x: 56, z: 2 },
    },
  ],
  props: {
    /** The first ground outside the ward, and it shows: hares, and a verge that flowers. */
    sky: 'pollen',
    wildlife: [
      { kind: 'hare', x: -22, z: -26, roam: 8 },
      { kind: 'hare', x: 38, z: -6, roam: 8 },
      { kind: 'rook', x: -46, z: -30, roam: 24, count: 3 },
    ],
    /** Spoil and abandoned kit, and the first waystones the road puts up. */
    dressing: [
      { kind: 'spoilheap', x: -38, z: -26 },
      { kind: 'spoilheap', x: -10, z: -22 },
      { kind: 'spoilheap', x: 30, z: -18 },
      { kind: 'spoilheap', x: -22, z: -10 },
      { kind: 'spoilheap', x: 42, z: -6 },
      { kind: 'spoilheap', x: 38, z: 2 },
      { kind: 'spoilheap', x: 42, z: 10 },
      { kind: 'spoilheap', x: -2, z: 18 },
      { kind: 'cairn', x: -34, z: -26 },
      { kind: 'cairn', x: 26, z: -22 },
      { kind: 'cairn', x: 30, z: -14 },
      { kind: 'cairn', x: -42, z: -2 },
      { kind: 'cairn', x: 30, z: 6 },
      { kind: 'cairn', x: -34, z: 18 },
      { kind: 'waystone', x: -30, z: -26, text: 'THE WARD ENDS HERE' },
      { kind: 'waystone', x: 34, z: -18, text: 'NO WRIT PAST THIS STONE' },
      { kind: 'waystone', x: -38, z: -2, text: 'THE WARD ENDS HERE' },
      { kind: 'waystone', x: -38, z: 14, text: 'NO WRIT PAST THIS STONE' },
      { kind: 'fence', x: -26, z: -26, yaw: 0 },
      { kind: 'fence', x: 38, z: -18, yaw: 0 },
      { kind: 'fence', x: -34, z: -2, yaw: 0 },
      { kind: 'fence', x: -34, z: 14, yaw: 0 },
      { kind: 'wildflowers', x: -22, z: -26 },
      { kind: 'wildflowers', x: 14, z: -22 },
      { kind: 'wildflowers', x: -2, z: -14 },
      { kind: 'wildflowers', x: 38, z: -6 },
      { kind: 'wildflowers', x: -26, z: 6 },
      { kind: 'wildflowers', x: -30, z: 18 },
      { kind: 'bramble', x: -18, z: -26 },
      { kind: 'bramble', x: 10, z: -18 },
      { kind: 'bramble', x: 42, z: 6 },
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
      { x: -40, z: -24 },
      { x: -14, z: -26 },
      { x: 18, z: -26 },
      { x: 40, z: -20 },
      { x: -40, z: 20 },
      { x: 40, z: 8 },
    ],
    horizon: 'treeline',
  },
});
