/**
 * The Cinderworks — the foundry ward, and the reason Ashfall is called Ashfall.
 *
 * Four ranges of furnace houses at the top and bottom of the ward, a casting floor between
 * them, and the spoil from both piled in the middle where nobody could be bothered to cart it
 * further. The heaps are the layout: they are the only thing here you have to go *around*, and
 * walking the ward is a matter of picking which side of them to take.
 *
 * The ground tells the story in three bands. Clinker on the casting floor, where it cooled
 * hard; ash in the southern yards, where it fell; cobbles only in the lanes the carts use.
 * Nothing here is swept — the ward exists to make things, and the mess is the making.
 */

import { defineArea, type AreaDef, type TileDef } from '../map.js';

/**
 * The works' legend.
 *
 *   s  casting floor — clinker, vitrified where it ran
 *   a  ash yard      — what falls, and stays fallen
 *   c  cart lane     — cobbles, the only maintained ground
 *   F  furnace house — impassable, tall, and chimneyed almost every time
 *   H  slag heap     — impassable, low and broad, taken whole
 *   B  the ranges    — impassable, the ward wall
 *
 * `F` carries `chimneyChance: 0.9` rather than the ward's 0.4. A furnace without a stack is
 * a shed, and the skyline is most of what says this place burns.
 */
const WORKS_LEGEND: Record<string, TileDef> = {
  s: { tex: 'slag', safe: false, walk: true },
  a: { tex: 'ash', safe: false, walk: true },
  c: { tex: 'cobble', safe: false, walk: true },
  F: {
    tex: 'slag',
    safe: false,
    walk: false,
    solid: { minHeight: 5.6, maxHeight: 8.2, inset: 0.35, depthInset: 0.35, chimneyChance: 0.9, split: true },
  },
  H: {
    tex: 'ash',
    safe: false,
    walk: false,
    // Low, wide and unsplit: a spoil heap is one mass that was tipped, not a row of anything.
    solid: { minHeight: 2.4, maxHeight: 3.4, inset: 0.15, depthInset: 0.15, chimneyChance: 0, split: false },
  },
  B: {
    tex: 'cobble',
    safe: false,
    walk: false,
    solid: { minHeight: 4.6, maxHeight: 6.8, inset: 0.3, depthInset: 0.3, chimneyChance: 0.3, split: true },
  },
};

/**
 * 26 wide by 22 deep.
 *
 * Column 25 opens at rows 10 to 12 — the cart lane east, up to Ashfall — and rows 11 and 12
 * run clean through to column 0, which is the way west into the Caldera. The works sit on the
 * line between the two, which is the point of them.
 */
const GRID: readonly string[] = [
  'BBBBBBBBBBBBBBBBBBBBBBBBBB', //  0  the north range
  'BccccccccccccccccccccccccB', //  1  the north cart lane
  'BcFFFFccFFFFccFFFFccFFFFcB', //  2  furnace houses
  'BcFFFFccFFFFccFFFFccFFFFcB', //  3
  'BccccccccccccccccccccccccB', //  4
  'BssssssssssssssssssssssssB', //  5  the casting floor
  'BsssssaaassssssaaasssssssB', //  6
  'BssssssssssssssssssssssssB', //  7
  'BssssssssssssssssssssssssB', //  8
  'BsssHHHHHssssssHHHHHsssssB', //  9  the heaps
  'BsssHHHHHssssssHHHHHsssssc', // 10  the way out, east to the ward
  'sssssssssssssssssssssssssc', // 11  and west, out to the Caldera
  'sssssssssssssssssssssssssc', // 12
  'BaaaaaaaaaaaaaaaaaaaaaaaaB', // 13  the ash yards
  'BaaaHHHHHHaaaaaaHHHHHHaaaB', // 14
  'BaaaHHHHHHaaaaaaHHHHHHaaaB', // 15
  'BaaaaaaaaaaaaaaaaaaaaaaaaB', // 16
  'BccccccccccccccccccccccccB', // 17  the south cart lane
  'BcFFFFccccFFFFccccFFFFcccB', // 18
  'BcFFFFccccFFFFccccFFFFcccB', // 19
  'BccccccccccccccccccccccccB', // 20
  'BBBBBBBBBBBBBBBBBBBBBBBBBB', // 21  the south range
];

export const CINDERWORKS_ID = 'cinderworks';

export const CINDERWORKS: AreaDef = defineArea({
  id: CINDERWORKS_ID,
  name: 'The Cinderworks',
  grid: GRID,
  legend: WORKS_LEGEND,
  /** On the casting floor, east of the heaps. */
  spawn: { x: 30, z: 2 },
  safety: 'none',
  exits: [
    {
      // East, up the cart lane to the ward. The carts come this way, so the ground is the
      // only cobbled thing in the works.
      to: 'ashfall_ward',
      x: 50,
      z: 2,
      label: 'Up the cart lane to Ashfall Ward',
      arrive: { x: -30, z: -2 },
    },
    {
      // West, out of the works and up into the crater it is downwind of. The ward and the
      // Caldera are the same event at two distances.
      to: 'caldera',
      x: -50,
      z: 2,
      label: 'West, out to the Caldera',
      arrive: { x: 46, z: -2 },
    },
  ],
  props: {
    /** Foundry belt: what comes out of the furnace, what carries it, and what it leaves on the floor. */
    dressing: [
      { kind: 'spoilheap', x: -46, z: -38 },
      { kind: 'spoilheap', x: -22, z: -26 },
      { kind: 'spoilheap', x: -22, z: -18 },
      { kind: 'spoilheap', x: -30, z: -10 },
      { kind: 'spoilheap', x: -42, z: 2 },
      { kind: 'spoilheap', x: -26, z: 10 },
      { kind: 'spoilheap', x: -34, z: 22 },
      { kind: 'spoilheap', x: -18, z: 30 },
      { kind: 'cart', x: -42, z: -38 },
      { kind: 'cart', x: 42, z: -26 },
      { kind: 'cart', x: 10, z: -14 },
      { kind: 'cart', x: -38, z: 2 },
      { kind: 'cart', x: 38, z: 10 },
      { kind: 'cart', x: 2, z: 26 },
      { kind: 'brazier', x: -38, z: -38 },
      { kind: 'brazier', x: 46, z: -26 },
      { kind: 'brazier', x: 14, z: -14 },
      { kind: 'brazier', x: -34, z: 2 },
      { kind: 'brazier', x: 42, z: 10 },
      { kind: 'brazier', x: 10, z: 26 },
      { kind: 'scorch', x: -30, z: -38 },
      { kind: 'scorch', x: -14, z: -26 },
      { kind: 'scorch', x: -14, z: -18 },
      { kind: 'scorch', x: -18, z: -10 },
      { kind: 'scorch', x: -30, z: 2 },
      { kind: 'scorch', x: -18, z: 10 },
      { kind: 'scorch', x: -26, z: 22 },
      { kind: 'scorch', x: 10, z: 30 },
      { kind: 'barrel', x: -22, z: -38 },
      { kind: 'barrel', x: -6, z: -18 },
      { kind: 'barrel', x: 42, z: -2 },
      { kind: 'barrel', x: -18, z: 22 },
    ],
    /**
     * The foundry's own.
     *
     * The smith and the glassblower work the casting floor at the north end; the ash-yard
     * hand is down among the slag heaps, which is where the work he describes happens.
     */
    npcs: [
      { id: 'cinderworks_smith', x: -18, z: -14, art: 'blacksmith_px', label: 'Talk to the foundry smith' },
      { id: 'cinderworks_glassblower', x: 18, z: -18, art: 'glassblower', label: 'Talk to the glassblower' },
      { id: 'cinderworks_miner', x: -2, z: 22, art: 'miner_a', label: 'Talk to the ash-yard hand' },
      { id: 'cinderworks_potter', x: 14, z: -22, art: 'potter', label: 'Talk to the potter' },
    ],
    /** In the lanes only. Nobody hangs a lamp over a floor that glows on its own. */
    lamps: [
      { x: -34, z: -38 },
      { x: 6, z: -38 },
      { x: -34, z: 26 },
      { x: 6, z: 26 },
    ],
    /** Moulds, and what the pig iron travels in. */
    crates: [
      { x: -42, z: -22 },
      { x: 34, z: -22 },
      { x: -42, z: 22 },
      { x: 34, z: 22 },
      { x: -2, z: 2 },
    ],
    graffiti: [
      {
        text: 'THE LID IS OURS TOO',
        wallX: -30,
        wallZ: -42,
        dx: 4,
        facesSouth: true,
        tint: '#c2661f',
      },
    ],
    horizon: 'city',
  },
});
