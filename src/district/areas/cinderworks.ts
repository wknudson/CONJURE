/**
 * The Cinderworks — the foundry ward, and the reason Ashfall is called Ashfall.
 *
 * Ranges of furnace houses at the top and bottom of the ward, a casting floor between them
 * with the Foundry Hall standing over it, and the spoil from all of it piled in the middle
 * where nobody could be bothered to cart it further. The heaps are the layout: they are the
 * only thing here you have to go *around*, and walking the ward is a matter of picking which
 * side of them to take.
 *
 * Thirty-four by twenty-six now. The Hall is the building the works were always implied to
 * have -- the flats the contract names are its casting floor -- and the bill fence the poster
 * pastes has a shed behind it with a press in it. South of the furnace houses a rail spur runs
 * the width of the ward, and past it the slag terraces, where the ground is still warm enough
 * to vent and there is ore in the seam if you work it.
 *
 * The ground tells the story in bands. Clinker on the casting floor, where it cooled hard;
 * ash in the yards, where it fell, with two cooling ponds cut into it; cobbles only in the
 * lanes the carts use. Nothing here is swept — the ward exists to make things, and the mess is
 * the making.
 */

import { TILE, defineArea, type AreaDef, type TileDef } from '../map.js';

/**
 * The works' legend.
 *
 *   s  casting floor — clinker, vitrified where it ran
 *   a  ash yard      — what falls, and stays fallen
 *   .  slag terrace  — broken ground past the spur, still warm
 *   c  cart lane     — cobbles, the only maintained ground
 *   W  cooling pond  — impassable
 *   F  furnace house — impassable, tall, and chimneyed almost every time
 *   Y  the Foundry Hall — impassable; dressed stone over the casting floor, stacked
 *   P  the poster's shed — impassable; timber, one storey
 *   H  slag heap     — impassable, low and broad, taken whole
 *   B  the ranges    — impassable, the ward wall
 *
 * `F` carries `chimneyChance: 0.9` rather than the ward's 0.4. A furnace without a stack is
 * a shed, and the skyline is most of what says this place burns.
 */
const WORKS_LEGEND: Record<string, TileDef> = {
  s: { tex: 'slag', safe: false, walk: true },
  a: { tex: 'ash', safe: false, walk: true },
  '.': { tex: 'crust', safe: false, walk: true },
  c: { tex: 'cobble', safe: false, walk: true },
  W: { tex: 'water', safe: false, walk: false },
  F: {
    tex: 'slag',
    safe: false,
    walk: false,
    solid: { style: 'hall', minHeight: 5.6, maxHeight: 8.2, inset: 0.35, depthInset: 0.35, chimneyChance: 0.9, split: true },
  },
  Y: {
    tex: 'slag',
    safe: false,
    walk: false,
    solid: { style: 'hall', minHeight: 8.6, maxHeight: 8.6, inset: 0.3, depthInset: 0.3, chimneyChance: 1, split: false, wall: 'stone' },
  },
  P: {
    tex: 'cobble',
    safe: false,
    walk: false,
    solid: { style: 'cottage', minHeight: 4.6, maxHeight: 4.6, inset: 0.3, depthInset: 0.3, chimneyChance: 0.5, split: false, wall: 'timber' },
  },
  H: {
    tex: 'ash',
    safe: false,
    walk: false,
    // Low, wide and unsplit: a spoil heap is one mass that was tipped, not a row of anything.
    solid: { style: 'rock', minHeight: 2.4, maxHeight: 3.4, inset: 0.15, depthInset: 0.15, chimneyChance: 0, split: false },
  },
  B: {
    tex: 'cobble',
    safe: false,
    walk: false,
    solid: { style: 'terrace', minHeight: 4.6, maxHeight: 6.8, inset: 0.3, depthInset: 0.3, chimneyChance: 0.3, split: true },
  },
};

const C32 = 'c'.repeat(32);
const S32 = 's'.repeat(32);
const A32 = 'a'.repeat(32);

/**
 * 34 wide by 26 deep.
 *
 * Column 33 opens at rows 12 and 13 — the cart lane east, up to Ashfall — and the same two
 * rows run clean through to column 0, which is the way west into the Caldera. The works sit
 * on the line between the two, which is the point of them.
 */
const GRID: readonly string[] = [
  'BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB', //  0  the north range
  `B${C32}B`, //  1  the north cart lane
  'BcFFFFcFFFFcYYYYYYYYYYcFFFFcFFFFcB', //  2  furnace houses, and THE FOUNDRY HALL between them
  'BcFFFFcFFFFcYYYYYYYYYYcFFFFcFFFFcB', //  3
  'BcccccccccccYYYYYYYYYYcccccccccccB', //  4
  `B${C32}B`, //  5  the Hall's door, onto the lane
  `B${S32}B`, //  6  the casting floor
  'BsssssaaasssssssssssssssaaassssssB', //  7
  `B${S32}B`, //  8
  `B${S32}B`, //  9
  'BsssHHHHHHssssssssssssHHHHHHsssssB', // 10  the heaps
  'BsssHHHHHHssssssssssssHHHHHHsssssB', // 11
  'sssssssssssssssssssssssssssssssssc', // 12  west, out to the Caldera; east, up to the ward
  'sssssssssssssssssssssssssssssssssc', // 13
  `B${A32}B`, // 14  the ash yards
  'BaaaaaWWWWaaaaHHHHHHaaaaWWWWaaaaaB', // 15  the cooling ponds, and the middle heap
  'BaaaaaWWWWaaaaHHHHHHaaaaWWWWaaaaaB', // 16
  `B${A32}B`, // 17
  `B${C32}B`, // 18  the south cart lane
  'BcPPPPcccFFFFccccFFFFccccFFFFccccB', // 19  THE POSTER'S SHED, west, and the south furnaces
  'BcPPPPcccFFFFccccFFFFccccFFFFccccB', // 20
  `B${C32}B`, // 21  the rail spur
  'B................................B', // 22  the slag terraces
  'Ba...aaaa...aaaaaaaa...aaaa...aaaB', // 23
  `B${A32}B`, // 24
  'BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB', // 25  the south range
];

const HALF_X = (GRID[0]!.length * TILE) / 2;
const HALF_Z = (GRID.length * TILE) / 2;
const xOfCol = (col: number): number => col * TILE - HALF_X + TILE / 2;
const zOfRow = (row: number): number => row * TILE - HALF_Z + TILE / 2;

export const CINDERWORKS_ID = 'cinderworks';

export const CINDERWORKS: AreaDef = defineArea({
  id: CINDERWORKS_ID,
  name: 'The Cinderworks',
  grid: GRID,
  legend: WORKS_LEGEND,
  /** On the casting floor, east of the heaps. */
  spawn: { x: 30, z: 0 },
  safety: 'none',
  exits: [
    {
      // East, up the cart lane to the ward. The carts come this way, so the ground is the
      // only cobbled thing in the works.
      to: 'ashfall_ward',
      x: HALF_X - 2,
      z: 0,
      label: 'Up the cart lane to Ashfall Ward',
      arrive: { x: -102, z: -26 },
    },
    {
      // West, out of the works and up into the crater it is downwind of. The ward and the
      // Caldera are the same event at two distances.
      to: 'caldera',
      x: -HALF_X + 2,
      z: 0,
      label: 'West, out to the Caldera',
      arrive: { x: 46, z: -2 },
    },
    {
      // The Hall. The flats the contract names are the floor inside.
      to: 'cinderworks_foundry',
      x: 0,
      z: zOfRow(4) + TILE / 2 + 1.4,
      label: 'Into the Foundry Hall',
      door: { x: 0, z: zOfRow(4) + TILE / 2 + 0.05, facesSouth: true, sign: 'foundry', style: 'iron' },
      arrive: { x: 0, z: 20 },
    },
    {
      // The shed behind the bill fence, with the press in it.
      to: 'cinderworks_posters',
      x: xOfCol(3.5),
      z: zOfRow(19) - TILE / 2 - 1.4,
      label: "Into the poster's shed",
      door: { x: xOfCol(3.5), z: zOfRow(19) - TILE / 2 - 0.05, facesSouth: false, sign: 'press' },
      arrive: { x: 0, z: -16 },
    },
  ],
  props: {
    /** Moths at the furnace mouths, which is the one thing that comes *to* a foundry. */
    sky: 'ash',
    wildlife: [
      { kind: 'moth', x: -50, z: -40, roam: 7, count: 3 },
      { kind: 'moth', x: -18, z: -30, roam: 7, count: 3 },
      { kind: 'moth', x: 22, z: -26, roam: 7, count: 3 },
      { kind: 'moth', x: 42, z: 26, roam: 7, count: 3 },
      { kind: 'rat', x: -26, z: -46, roam: 5, count: 2 },
      { kind: 'rat', x: -26, z: 2, roam: 5, count: 2 },
      { kind: 'rook', x: -42, z: -50, roam: 24, count: 3 },
    ],
    /** Foundry belt: what comes out of the furnace, what carries it, and what it leaves on the floor. */
    dressing: [
      { kind: 'spoilheap', x: -46, z: -22 },
      { kind: 'spoilheap', x: -22, z: -14 },
      { kind: 'spoilheap', x: -54, z: 2 },
      { kind: 'spoilheap', x: -34, z: 6 },
      { kind: 'spoilheap', x: 50, z: 10 },
      { kind: 'spoilheap', x: -42, z: 30 },
      { kind: 'spoilheap', x: 22, z: 42 },
      { kind: 'cart', x: -42, z: -46 },
      { kind: 'cart', x: 42, z: -30 },
      { kind: 'cart', x: 10, z: -14 },
      { kind: 'cart', x: -38, z: 0 },
      { kind: 'cart', x: 38, z: 2 },
      { kind: 'cart', x: -2, z: 26 },
      { kind: 'brazier', x: -38, z: -46 },
      { kind: 'brazier', x: 46, z: -30 },
      { kind: 'brazier', x: 14, z: -14 },
      { kind: 'brazier', x: -34, z: 0 },
      { kind: 'brazier', x: 42, z: 2 },
      { kind: 'brazier', x: 18, z: 30 },
      { kind: 'scorch', x: -30, z: -46 },
      { kind: 'scorch', x: -14, z: -22 },
      { kind: 'scorch', x: -14, z: -14 },
      { kind: 'scorch', x: -18, z: -6 },
      { kind: 'scorch', x: -30, z: 2 },
      { kind: 'scorch', x: -18, z: 10 },
      { kind: 'scorch', x: -26, z: 22 },
      { kind: 'scorch', x: 2, z: 26 },
      { kind: 'barrel', x: -22, z: -46 },
      { kind: 'barrel', x: -6, z: -14 },
      { kind: 'barrel', x: 42, z: -2 },
      { kind: 'barrel', x: -22, z: 34 },
      // The rail spur: bollards where the wagons are chocked.
      { kind: 'bollard', x: -50, z: 34 },
      { kind: 'bollard', x: -38, z: 34 },
      { kind: 'bollard', x: -6, z: 34 },
      { kind: 'bollard', x: 6, z: 34 },
      { kind: 'bollard', x: 26, z: 34 },
      { kind: 'bollard', x: 38, z: 34 },
    ],
    /**
     * The foundry's own.
     *
     * The smith and the glassblower work the casting floor at the north end, the potter beside
     * them; the ash-yard hand is on the south lane, which is where the work he describes
     * happens; the carter at the east end of it. The foreman is indoors, in the Hall.
     */
    npcs: [
      { id: 'cinderworks_lamplighter', x: -50, z: -46, art: 'night_watchman', label: 'Talk to the lamplighter' },
      { id: 'cinderworks_smith', x: -30, z: -22, art: 'blacksmith_px', label: 'Talk to the foundry smith' },
      { id: 'cinderworks_glassblower', x: 18, z: -22, art: 'glassblower', label: 'Talk to the glassblower' },
      { id: 'cinderworks_potter', x: 10, z: -26, art: 'potter', label: 'Talk to the potter' },
      { id: 'cinderworks_miner', x: -6, z: 26, art: 'miner_a', label: 'Talk to the ash-yard hand' },
      { id: 'cinderworks_carter', x: 34, z: 22, art: 'carpenter', label: 'Talk to the carter' },
    ],
    /**
     * Who walks the row.
     *
     * The one ward that could light itself and does not: furnace glow is not a street lamp,
     * and the cart lanes and the spur are the only ground here anybody walks after dark.
     */
    lamplighter: 'cinderworks_lamplighter',
    lamps: [
      { x: -34, z: -46 },
      { x: -2, z: -46 },
      { x: 30, z: -46 },
      { x: -34, z: 22 },
      { x: -2, z: 22 },
      { x: 30, z: 22 },
      { x: -18, z: 34 },
      { x: 14, z: 34 },
    ],
    /** Moulds, and what the pig iron travels in. */
    crates: [
      { x: -42, z: -26 },
      { x: 34, z: -26 },
      { x: -42, z: 26 },
      { x: 30, z: 26 },
      { x: -2, z: 0 },
    ],
    graffiti: [
      { text: 'THE LID IS OURS TOO', wallX: -30, wallZ: zOfRow(0) + TILE / 2 + 0.05, dx: 4, facesSouth: true, tint: '#c2661f' },
      { text: 'FED THE FLATS TWICE', wallX: 0, wallZ: zOfRow(4) + TILE / 2 + 0.05, dx: 7, facesSouth: true, tint: '#c2661f' },
      { text: 'PRINTED, NOT POSTED', wallX: -22, wallZ: zOfRow(19) - TILE / 2 - 0.05, dx: 0, facesSouth: false, tint: '#a09a82' },
    ],
    horizon: 'city',
  },
});
