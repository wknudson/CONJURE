/**
 * The Ashwood — deep timber, and the largest area in the world.
 *
 * Sixty-four columns by fifty-six rows of standing wood with clearings cut into it. The clearings
 * are the layout: they are what you navigate between, and the trunks between them are close
 * enough together that you are usually in one or heading for the next.
 *
 * It reads as the opposite of the Caldera, which is one open floor inside a wall. Here the
 * boundary and the obstacles are the same timber, so the wood has no visible edge — you find out
 * where it ends by running out of clearings. That is deliberately the same trick Weeping Stile
 * plays at a fifth of the size, because this is what that hollow is a corner of.
 *
 * Grown evenly from thirty-four by thirty, and the old wood is the heart of a bigger one now: its
 * edge still stands, the trunks closer there than anywhere, with eleven ways through it. Round it
 * is the wood that grew up after. North, **the charcoal burners' clearing**, their clamps still
 * breathing under the turf and a hut at either end; north-east, **the Great Ash**, dead on its feet
 * in the clearing it made by dying; west, **the woodcutters' ruins**, two cottages down to their
 * walls and a sawpit gone to rainwater; east, **the hunting stand**, and the clearing round it cut
 * for the sightline; south, either side of the ride, two more clearings with a poachers' hide in
 * each, and a third hide back at the ruins.
 *
 * The Ashwood Pack prowls all of it, and keeps one of its own under the Great Ash. The Poacher
 * Band walks between the hides, down the west of the wood and along the south and back, and keeps
 * a man at the hunting stand.
 */

import { TILE, defineArea, type AreaDef, type TileDef } from '../map.js';

/**
 * The wood's legend.
 *
 *   w  leaf litter  — the floor, under the canopy
 *   #  clearing     — grass, where light gets down
 *   .  weeds        — the edges of a clearing going over
 *   ,  chalk track  — the ride south, out to the Levels
 *   T  timber       — impassable
 *   l  leaf litter — the floor under the canopy; bare ground is the clearings
 *   h  a burners' hut — timber, a chimney on most
 *   X  a ruined wall  — impassable; the woodcutters' cottages, down to their footings
 *   p  the sawpit     — gone to rainwater; impassable
 *   S  the hunting stand — a timber tower on one tile
 *   P  a poachers' hide — brush over a frame, low, on one tile
 *
 * `T` is tall and split. Split matters here more than anywhere: a run of unsplit timber would be
 * a fence, and the whole point of a wood is that the trunks are at different heights and do not
 * line up.
 */
const WOOD_LEGEND: Record<string, TileDef> = {
  l: { tex: 'litter', safe: false, walk: true },
  w: { tex: 'forest', safe: false, walk: true },
  '#': { tex: 'grass', safe: false, walk: true },
  '.': { tex: 'weeds', safe: false, walk: true },
  ',': { tex: 'chalk', safe: false, walk: true },
  T: {
    tex: 'forest',
    safe: false,
    walk: false,
    solid: { style: 'forest', minHeight: 6.0, maxHeight: 9.5, inset: 1.0, depthInset: 1.0, chimneyChance: 0, split: true },
  },
  h: {
    tex: 'grass',
    safe: false,
    walk: false,
    solid: { style: 'cottage', minHeight: 3.4, maxHeight: 3.8, inset: 0.3, depthInset: 0.3, chimneyChance: 0.8, split: false, wall: 'timber' },
  },
  X: {
    tex: 'grass',
    safe: false,
    walk: false,
    solid: { style: 'wall', minHeight: 1.0, maxHeight: 2.0, inset: 0.3, depthInset: 1.2, chimneyChance: 0, split: true, wall: 'stone' },
  },
  p: { tex: 'water', safe: false, walk: false },
  S: {
    tex: 'grass',
    safe: false,
    walk: false,
    solid: { style: 'tower', minHeight: 5.0, maxHeight: 5.0, inset: 0.6, depthInset: 0.6, chimneyChance: 0, split: false, wall: 'timber' },
  },
  P: {
    tex: 'grass',
    safe: false,
    walk: false,
    solid: { style: 'cottage', minHeight: 2.6, maxHeight: 2.6, inset: 0.5, depthInset: 0.5, chimneyChance: 0, split: false, wall: 'timber' },
  },
  /** The cave mouth: rock, taken whole, with a door in the south face of it. */
  K: {
    tex: 'litter',
    safe: false,
    walk: false,
    solid: { style: 'rock', minHeight: 5.5, maxHeight: 5.5, inset: 0.3, depthInset: 0.3, chimneyChance: 0, split: false, wall: 'rock', bare: true },
  },
};

/**
 * 64 wide by 56 deep.
 *
 * The ride out is the two-column chalk track from row 37 to the south edge, and it is the only made ground in
 * the wood. Everything else is timber and what grows under it.
 */
const GRID: readonly string[] = [
  'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT', //  0  the wood
  'TTTlwTTlTTlwwlTTllllwlTlwwlllwwwTTTllTlllllTlwwwllwwwwlllwwllTTT', //  1
  'TTlwwlllllwwwlTTTllwwllwwllllwwwlTlllwwwlllTlll############wwllT', //  2
  'TTlwwlllwwwwwwTTTl#########################TTTl############wwwwT', //  3  THE CHARCOAL BURNERS' CLEARING, the huts either end              THE GREAT ASH's clearing (east)
  'TTlwwTTlwwwwwwlTTl###hhh#############hhh###TTTl############lllwT', //  4
  'TTllllllwwwlTlllll###hhh#############hhh###lTTT############llllT', //  5
  'TTlllllllwwTTTllll#########################llTl############TlllT', //  6
  'TTTlllllwwwTTTlllw#########################wlTl############TTTlT', //  7
  'TTlwwwwwwwwTTlllTl#########################lTTT############TTTlT', //  8
  'TTlwwwwwwwwlTlllTl#########################lTTT############TTTlT', //  9
  'TllwlwlllllTTTlllllwwwllwwlwwllllllllwTTTllTTTTlwlllllwllTTTTTlT', // 10
  'TwwwwllTlllTTllwwwwwwlllwwwwwllllwlTTlTTTlllTTlwwwllllllwwTTTTTT', // 11
  'TwwwwlTTTllTTTwwwwwwllllwwwwwllllwllTTTTllwlTTlwwwlllTllwwlTTTTT', // 12
  'TllllllllllTTTwTTTTTllTTTTTTTTllTTTTTTTTllTTTTTTTlTTTlllwwwlTTTT', // 13  the old wood, from here to row 42
  'TllllwwllllllllTlllllllllllllllllllKKKllllllllllTTTTTllllllTTTTT', // 14
  'TllTlwwwllwwwllTlllllllllllllllllllKKKllllllllllTTTTTlllllTTTTTT', // 15
  'TlllTwwwwwwwwwlTllllllllllllllllllllllllllllllllTlTTTlwllllllTTT', // 16
  'TTlllwwwwwllllwTlllwTTwwwwwwwlTTwwwwwwwlTTwwwlllTllTlllwlllwwwTT', // 17
  'TllllwwwwwlTTTwlllllwwwwww####wllwwwww####wwwllllwllllwwllwwwwlT', // 18
  'Tl###########llllllwwwwwww####wwwwwwww####wwwllllllllwwllwwllwwT', // 19  THE WOODCUTTERS' RUINS (west): two cottages down to their walls, the sawpit
  'Tl###########llTlllwlwwlwlwwwwwlllwwwllwlwwlllllTllwlwwlTTlllllT', // 20
  'Tl#XXXXX#####wlTllTTlwwlTTwwwwwwTTwwwlTTlwwlTTllTll###########lT', // 21                                                                  THE HUNTING STAND (east)
  'Tl#X###X###P#wlTlllwwwwwllwwwwwwlwlwwwwllwwwllllTTT###########lT', // 22
  'Tw#X###X#####wwTlllw####wwwwwwwwww####wwwwwwwlllTll###########lT', // 23
  'Tw###########wwTlllw####wwwwwwwwww####wwwwwwwlllTll###########lT', // 24
  'Tw#######pp##wwTllllwllwwwlwwwwwwwwllwwwwllwllllTll###########wT', // 25
  'Tl#######pp##llllllwTTlwwwTTlwwwwwwwTTlwwlTTwllllll###########wT', // 26
  'Tl###########llllllllllwwwllwwwwwwwllwlwwllllllllll#####S#####wT', // 27
  'Tl####XXXXX##wlTlllw..wwwwwwww..wwwwwwww..wwwlllTlw###########wT', // 28
  'Tl########X##wlTllllwwwllwlwwwwlllwwwwwlwwwlwlllTll###########wT', // 29
  'Tl########X##wlTllTTlwwlTTlwwwwlTTlwwwTTwwwlTTllTlT###########wT', // 30
  'Tl###########wwTlllwwwwllwwwwwwllwwwwwlllwwlllllTlT###########lT', // 31
  'Tl###########lwTlllw####wwwwwwwwww####wwwwwwwlllTTT###########lT', // 32
  'Tl###########lwTlllw####wwwwwwwwww####wwwwwwwlllTTT###########TT', // 33
  'TllwlTTllwlwlllTlllwwwlwwwwwwlwllwwwwwwllwwwwlllTTlllllTllllTlTT', // 34
  'TwwwwlllwwwwwllTllllTTwwwwwwwlTTlwwwwwwlTTwwwlllTllwllllTTlTTTlT', // 35
  'TwwwwwwwwwwwwllllllwlwlwwwwwwwlwwwwwwwwwwllwwlllTlwwwlllTTTTTTlT', // 36
  'Twwwwwwwllwllwlllllwwwwwwwwwww,,wwwwwwwwwwwwwlllTwlwwwwllTTlTllT', // 37
  'TlwwwllllTTTTllTlllwwwwwwwwwww,,wwwwwwwwwwwwwlllllllwlllllTllllT', // 38
  'TllwwlllTTTTTTwTllllllllllllll,,llllllllllllllllllTTllllllTllllT', // 39
  'TllwwllllTTTllwTllllllllllllllllllllllllllllllllTwlTlwwlllllllwT', // 40
  'TllllwwllTTTTlwTllllllllllllllllllllllllllllllllTwwwwwwwllwlllwT', // 41
  'TwlTlwwwlTTTTllTllTTTTllTTTTTT,,TTTTTTllTTTTTTllTwwwwwwwllwwwwwT', // 42
  'TwwlllwlTTlllTTTllllTTlwwwTTTT,,wwwllllllTTlwwwwwwwwwwlllwwwwwwT', // 43  the ride, on south to the Levels
  'TllllTTllllllllllllTTTlwwwlllT,,wwwllTTTlTTTlwlwwwwwwTTlwwwwwwwT', // 44
  'TllllTTTllllTllwlllTTTllwllllT,,wwllTTTTTTTTlwlwwwwwlTTTwwwwlwwT', // 45
  'TTllTTTT#############TlllllllT,,wwwlTlTTTTTlllwlllwwwTTlwwlllwlT', // 46  the south clearings, a poachers' hide in each
  'TlTTTTTT#############llllwllll,,llllllllll#############llllwwllT', // 47
  'TlTTTTTT####P########llllwllll,,lllwwlllll########P####llllwwllT', // 48
  'TllllTTl#############llllllTTT,,llllllTTll#############lTTlllwwT', // 49
  'Tlwwllll#############lTTTTTTTT,,wwwlllllll#############lllTllllT', // 50
  'Tlwwwwww#############lTTTTTTTT,,wwwlllllTl#############llTTTTllT', // 51
  'Tlwwwwww#############lllTlTTlT,,lwlllTllTl#############lTTTTTllT', // 52
  'TTwwwwwwllTTTTllwlTTwwlTTlllll,,Tllwllwwll#############lTTTlllTT', // 53
  'TTwwwwwwlTTTTlllllllwwlTTTTTll,,TTlwwwwwwllllTTlllllTTTTTTTlwwTT', // 54
  'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTT,,TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT', // 55  the wood
];

const HALF_X = (GRID[0]!.length * TILE) / 2;
const HALF_Z = (GRID.length * TILE) / 2;
const xOfCol = (col: number): number => col * TILE - HALF_X + TILE / 2;
const zOfRow = (row: number): number => row * TILE - HALF_Z + TILE / 2;

export const ASHWOOD_ID = 'ashwood';

export const ASHWOOD: AreaDef = defineArea({
  id: ASHWOOD_ID,
  name: 'The Ashwood',
  grid: GRID,
  legend: WOOD_LEGEND,
  /** In a clearing near the middle, which is the only sort of place you can stand and see. */
  spawn: { x: 0, z: 0 },
  safety: 'none',
  exits: [
    {
      // The poacher's hide, under the north edge of the wood, with the ride a long way behind it.
      to: 'ashwood_poachers_hide',
      x: xOfCol(36),
      z: zOfRow(15) + TILE / 2 + 1.4,
      label: 'Into the poacher\'s hide',
      door: { x: xOfCol(36), z: zOfRow(15) + TILE / 2 + 0.05, facesSouth: true, style: 'cave' },
      arrive: { x: 0, z: 16 },
    },
    {
      to: 'tallow_levels',
      x: -6,
      z: HALF_Z - 2,
      label: 'South, down the ride to the Tallow Levels',
      // Onto the ride, a stride inside the Levels' north exit at their new edge.
      arrive: { x: -26, z: -62 },
    },
  ],
  props: {
    /** The largest map and the most alive. Deer in the clearings, wolves between them. */
    sky: 'leaves',
    wildlife: [
      { kind: 'deer', x: -42, z: -46, roam: 10, count: 2 },
      { kind: 'deer', x: -42, z: -14, roam: 10, count: 2 },
      { kind: 'deer', x: -26, z: 18, roam: 10, count: 2 },
      { kind: 'hare', x: -34, z: -46, roam: 8 },
      { kind: 'hare', x: 54, z: -18, roam: 8 },
      { kind: 'hare', x: -14, z: 18, roam: 8 },
      { kind: 'fox', x: -26, z: -46, roam: 10 },
      { kind: 'fox', x: -30, z: 2, roam: 10 },
      { kind: 'wolf', x: -18, z: -46, roam: 12, count: 2 },
      { kind: 'wolf', x: -18, z: 2, roam: 12, count: 2 },
      { kind: 'rook', x: -58, z: -50, roam: 26, count: 4 },
      { kind: 'rook', x: 14, z: 2, roam: 26, count: 4 },
      // The new wood: deer where the burners have cleared, rooks over the Great Ash, hares and a
      // fox in the clearings the poachers are not working.
      { kind: 'deer', x: -6, z: -86, roam: 10, count: 2 },
      { kind: 'deer', x: 100, z: -40, roam: 10, count: 2 },
      { kind: 'rook', x: 92, z: -96, roam: 20, count: 5 },
      { kind: 'hare', x: 48, z: 100, roam: 8 },
      { kind: 'hare', x: -70, z: 94, roam: 8 },
      { kind: 'fox', x: -100, z: 10, roam: 10 },
    ],
    /** Deep timber. Cut wood, and the marks left by whoever cut it. */
    dressing: [
      { kind: 'deadfall', x: -60, z: -20 },
      { kind: 'logpile', x: 60, z: -8 },
      { kind: 'bramble', x: -60, z: 12 },
      { kind: 'mushrooms', x: 60, z: 24 },
      { kind: 'bracken', x: -60, z: 36 },
      { kind: 'cairn', x: 60, z: -36 },
      { kind: 'deadfall', x: 40, z: -52 },
      { kind: 'logpile', x: -30, z: 52 },
      { kind: 'bracken', x: 30, z: 52 },
      { kind: 'waystone', x: -18, z: 18, text: 'THE RIDE — KEEP TO IT' },
      { kind: 'logpile', x: -54, z: -46 },
      { kind: 'logpile', x: -10, z: -42 },
      { kind: 'logpile', x: 42, z: -38 },
      { kind: 'logpile', x: -38, z: -30 },
      { kind: 'logpile', x: 18, z: -26 },
      { kind: 'logpile', x: -46, z: -18 },
      { kind: 'logpile', x: -2, z: -14 },
      { kind: 'logpile', x: 34, z: -10 },
      { kind: 'logpile', x: -14, z: -2 },
      { kind: 'logpile', x: 34, z: 2 },
      { kind: 'logpile', x: -34, z: 10 },
      { kind: 'logpile', x: 30, z: 14 },
      { kind: 'logpile', x: -42, z: 22 },
      { kind: 'logpile', x: -6, z: 26 },
      { kind: 'logpile', x: 50, z: 30 },
      { kind: 'logpile', x: -26, z: 38 },
      { kind: 'logpile', x: 10, z: 42 },
      { kind: 'cairn', x: -50, z: -46 },
      { kind: 'cairn', x: -2, z: -38 },
      { kind: 'cairn', x: 22, z: -30 },
      { kind: 'cairn', x: -22, z: -18 },
      { kind: 'cairn', x: 6, z: -10 },
      { kind: 'cairn', x: -42, z: 2 },
      { kind: 'cairn', x: 14, z: 10 },
      { kind: 'cairn', x: 50, z: 18 },
      { kind: 'cairn', x: -22, z: 30 },
      { kind: 'cairn', x: 22, z: 38 },
      { kind: 'scorch', x: -46, z: -46 },
      { kind: 'scorch', x: 2, z: -38 },
      { kind: 'scorch', x: 26, z: -30 },
      { kind: 'scorch', x: -18, z: -18 },
      { kind: 'scorch', x: 10, z: -10 },
      { kind: 'scorch', x: -38, z: 2 },
      { kind: 'scorch', x: 18, z: 10 },
      { kind: 'scorch', x: 54, z: 18 },
      { kind: 'scorch', x: -18, z: 30 },
      { kind: 'scorch', x: 26, z: 38 },
      { kind: 'fence', x: -38, z: -46, yaw: 0 },
      { kind: 'fence', x: -6, z: -34, yaw: 0 },
      { kind: 'fence', x: 46, z: -22, yaw: 0 },
      { kind: 'fence', x: -14, z: -6, yaw: 0 },
      { kind: 'fence', x: 38, z: 6, yaw: 0 },
      { kind: 'fence', x: -10, z: 22, yaw: 0 },
      { kind: 'fence', x: 38, z: 34, yaw: 0 },
      { kind: 'bracken', x: -42, z: -46 },
      { kind: 'bracken', x: 34, z: -38 },
      { kind: 'bracken', x: -14, z: -26 },
      { kind: 'bracken', x: -42, z: -14 },
      { kind: 'bracken', x: 34, z: -6 },
      { kind: 'bracken', x: -10, z: 6 },
      { kind: 'bracken', x: -26, z: 18 },
      { kind: 'bracken', x: 34, z: 26 },
      { kind: 'bracken', x: -2, z: 38 },
      { kind: 'mushrooms', x: -34, z: -46 },
      { kind: 'mushrooms', x: 6, z: -34 },
      { kind: 'mushrooms', x: 54, z: -22 },
      { kind: 'mushrooms', x: -10, z: -6 },
      { kind: 'mushrooms', x: 34, z: 6 },
      { kind: 'mushrooms', x: -6, z: 22 },
      { kind: 'mushrooms', x: 30, z: 34 },
      { kind: 'deadfall', x: -30, z: -46 },
      { kind: 'deadfall', x: -50, z: -30 },
      { kind: 'deadfall', x: -38, z: -14 },
      { kind: 'deadfall', x: -30, z: 2 },
      { kind: 'deadfall', x: -22, z: 18 },
      { kind: 'deadfall', x: -26, z: 34 },
      { kind: 'bramble', x: -26, z: -46 },
      { kind: 'bramble', x: 38, z: -30 },
      { kind: 'bramble', x: 18, z: -10 },
      { kind: 'bramble', x: 38, z: 10 },
      { kind: 'bramble', x: 2, z: 30 },

      // The burners' clearing: their cut wood waiting, their sacks, their cart at the way down.
      { kind: 'logpile', x: -46, z: -80 },
      { kind: 'logpile', x: 34, z: -80 },
      { kind: 'logpile', x: -8, z: -96 },
      { kind: 'sacks', x: -30, z: -88 },
      { kind: 'cart', x: -2, z: -76 },
      // The Great Ash: its kills, and the limbs it has dropped.
      { kind: 'bonepile', x: 76, z: -92 },
      { kind: 'deadfall', x: 70, z: -98 },
      { kind: 'mushrooms', x: 100, z: -78 },
      // The woodcutters' ruins: the last of their stack, their bench, their well.
      { kind: 'logpile', x: -94, z: -2 },
      { kind: 'workbench', x: -82, z: -2 },
      { kind: 'well', x: -114, z: 6 },
      { kind: 'wildflowers', x: -100, z: 14 },
      // The hunting stand: what was taken, hung up; what was not wanted, thrown down.
      { kind: 'rack', x: 104, z: 6 },
      { kind: 'bonepile', x: 86, z: 10 },
      // The south hides: drying racks, sacks, bones, the poachers' stack.
      { kind: 'rack', x: -70, z: 90 },
      { kind: 'sacks', x: -86, z: 86 },
      { kind: 'rack', x: 66, z: 90 },
      { kind: 'bonepile', x: 84, z: 90 },
      { kind: 'logpile', x: 54, z: 96 },
      // Under the new wood.
      { kind: 'bracken', x: -110, z: -60 },
      { kind: 'deadfall', x: -100, z: -80 },
      { kind: 'bramble', x: 110, z: 50 },
      { kind: 'mushrooms', x: -114, z: 70 },
      { kind: 'bracken', x: 110, z: -60 },
      { kind: 'bramble', x: -60, z: 100 },
      { kind: 'deadfall', x: 20, z: 100 },
      { kind: 'mushrooms', x: 110, z: 90 },
    ],
    // No lamps. Nothing has ever lit a wood.
    crates: [
      { x: -6, z: 42 },
      { x: -38, z: -18 },
      { x: -46, z: -84 },
      { x: 104, z: -10 },
    ],
    /**
     * Standing timber, in the clearings.
     *
     * The `T` tiles are the wood itself; these are the individual trees left inside the open
     * ground, which is what makes a clearing read as a clearing rather than as a room.
     */
    trees: [
      { x: -46, z: -14 },
      { x: 6, z: -14 },
      { x: -46, z: 22 },
      { x: 6, z: 22 },
      { x: -22, z: -42 },
      { x: 26, z: -42 },
      { x: -22, z: 34 },
      { x: 26, z: 6 },
    ],
    horizon: 'treeline',
    /**
     * The Ashwood Pack prowls the whole wood -- nobody lives here to be kept clear of -- and keeps
     * one of its own under the Great Ash, watching the way up from the old wood. The Poacher Band
     * walks between its hides, from the woodcutters' ruins down the west of the wood and along the
     * south clearings, and back the way it came; and keeps a man at the hunting stand, looking out
     * over the clearing that was cut for it.
     */
    packs: [
      { encounterId: 'pack_ashwood_wolves', id: 'prowler', x: 100, z: 50, roam: 8, behaviour: 'prowl' },
      {
        encounterId: 'pack_ashwood_wolves',
        id: 'ash',
        x: 74,
        z: -80,
        roam: 4,
        band: 'ash',
        behaviour: 'sentry',
        // Facing south, down the way into the clearing.
        sweep: [-0.6, 0.6],
      },
      {
        encounterId: 'pack_poacher_band',
        id: 'hides',
        x: -82,
        z: -14,
        roam: 4,
        band: 'hides',
        behaviour: 'beat',
        // Hide to hide and back: the ruins, the west of the wood, the south clearings.
        route: [
          { x: -82, z: -14 },
          { x: -100, z: 40 },
          { x: -78, z: 74 },
          { x: 74, z: 74 },
          { x: -78, z: 74 },
          { x: -100, z: 40 },
        ],
      },
      {
        encounterId: 'pack_poacher_band',
        id: 'stand',
        x: 92,
        z: -2,
        roam: 4,
        band: 'stand',
        behaviour: 'sentry',
        // At the foot of the stand, facing west over the clearing.
        sweep: [-2.2, -0.9],
      },
    ],
    /** The Great Ash, dead on its feet over the canopy: the one thing in the wood you can steer by. */
    landmarks: [{ kind: 'great_tree', x: 84, z: -88 }],
    vignettes: [
      { id: 'charcoal_camp', x: -20, z: -84 },
      { id: 'charcoal_camp', x: 8, z: -84 },
      { id: 'ruined_camp', x: 60, z: 90 },
    ],
  },
});
