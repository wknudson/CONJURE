/**
 * The Bone Bastion — barrow country, and the wall somebody built through the middle of it.
 *
 * The mounds came first and there are a great many of them, set in pairs across the whole map.
 * The bastion wall is the boundary, and it is the tallest unbroken thing in the world after the
 * Spire — which is the joke of the place: an enormous fortification around ground whose only
 * occupants have been dead for a very long time.
 *
 * Walking it is a matter of threading between mounds, and the mounds are laid out in ranks that
 * do not quite align, so the route through is never the same twice and never quite straight. The
 * one made thing is the causeway east, which runs dead level across the middle because whoever
 * cut it was not going to walk round them.
 */

import { TILE, defineArea, type AreaDef, type TileDef } from '../map.js';

/**
 * The Bastion's legend.
 *
 *   o  bone dust    — the ground, and what it is made of
 *   #  scrub        — the little that grows
 *   ,  causeway     — chalk, and the only cut ground here
 *   M  barrow mound — impassable, low and wide
 *   X  bastion wall — impassable, and enormous
 *   t  turf        — grass over a mound, going grey where the barrow surfaces
 *
 * `M` is unsplit and barely inset: a mound is one heaped mass, and chunking it would turn a
 * barrow into a terrace of huts.
 */
const BASTION_LEGEND: Record<string, TileDef> = {
  t: { tex: 'barrow', safe: false, walk: true },
  o: { tex: 'bone', safe: false, walk: true },
  '#': { tex: 'grass', safe: false, walk: true },
  ',': { tex: 'chalk', safe: false, walk: true },
  M: {
    tex: 'bone',
    safe: false,
    walk: false,
    solid: { style: 'mound', minHeight: 2.6, maxHeight: 4.0, inset: 0.1, depthInset: 0.1, chimneyChance: 0, split: false },
  },
  X: {
    tex: 'bone',
    safe: false,
    walk: false,
    solid: { style: 'wall', minHeight: 12.0, maxHeight: 14.0, inset: 0.05, depthInset: 0.05, chimneyChance: 0, split: false },
  },
  /** The cave mouth: rock, taken whole, with a door in the south face of it. */
  K: {
    tex: 'bone',
    safe: false,
    walk: false,
    solid: { style: 'rock', minHeight: 5.5, maxHeight: 5.5, inset: 0.3, depthInset: 0.3, chimneyChance: 0, split: false, wall: 'rock', bare: true },
  },
};

/**
 * 24 wide by 26 deep.
 *
 * Column 23 opens at rows 12 and 13 — the causeway east, out to the Tallow Levels, and the only
 * gap in the wall. The mound ranks above and below it are offset by two columns from each other
 * so that no straight line north to south exists.
 */
const GRID: readonly string[] = [
  'XXXXXXXXXXXXXXXXXXXXXXXXXXXX', //  0
  'XtttttttttttttttKKKKtttttttX', //  1
  'XtttttttttttttttKKKKtttttttX', //  2
  'XttttttttttooottttttttooottX', //  3
  'XttttttttttooottttttttooottX', //  4
  'XttttMMMMttooottMMMMttooottX', //  5
  'XttttMMMMtttttttMMMMttooottX', //  6
  'XtttttttttttttttttttttooottX', //  7
  'XttttttttMMMMMMtttttttooottX', //  8
  'XttttttttMMMMMMtttttooooottX', //  9
  'XtttttttttttttttttttooooottX', // 10
  'XttttMMMMtttttMMMMttoooo#ttX', // 11
  'XttttMMMMttottMMMMttoooo#ttX', // 12
  'XttttttttttottttttttooooottX', // 13
  'Xtt,,,,,,,,,,,,,,,,,,,,,,tt,', // 14
  'Xtt,,,,,,,,,,,,,,,,,,,,,,tt,', // 15
  'XttttttttttottttttttooooottX', // 16
  'XttttMMMMttottMMMMttoooo#ttX', // 17
  'XttttMMMMtttttMMMMttoooo#ttX', // 18
  'XtttttttttttttttttttooooottX', // 19
  'XttttttttMMMMMMtttttooooottX', // 20
  'XttttttttMMMMMMtttttttooottX', // 21
  'XtttttttttttttttttttttooottX', // 22
  'XttttMMMMtttttttMMMMttooottX', // 23
  'XttttMMMMttooottMMMMttooottX', // 24
  'XttttttttttooottttttttooottX', // 25
  'XttttttttttooottttttttooottX', // 26
  'XttttttttttttttttttttttttttX', // 27
  'XttttttttttttttttttttttttttX', // 28
  'XttXXXXXXXXXXXXXXXXXXXXXXttX', // 29
];

const HALF_X = (GRID[0]!.length * TILE) / 2;
const HALF_Z = (GRID.length * TILE) / 2;
const xOfCol = (col: number): number => col * TILE - HALF_X + TILE / 2;
const zOfRow = (row: number): number => row * TILE - HALF_Z + TILE / 2;

export const BONE_BASTION_ID = 'bone_bastion';

export const BONE_BASTION: AreaDef = defineArea({
  id: BONE_BASTION_ID,
  name: 'The Bone Bastion',
  grid: GRID,
  legend: BASTION_LEGEND,
  /** On the causeway, with barrows on both sides. */
  spawn: { x: 0, z: -2 },
  safety: 'none',
  exits: [
    {
      // The great barrow, in the north wall. The one mound the rows were laid out from.
      to: 'bone_bastion_barrow',
      x: xOfCol(17.5),
      z: zOfRow(2) + TILE / 2 + 1.4,
      label: 'Into the great barrow',
      door: { x: xOfCol(17.5), z: zOfRow(2) + TILE / 2 + 0.05, facesSouth: true, style: 'cave' },
      arrive: { x: 0, z: 16 },
    },
    {
      to: 'tallow_levels',
      x: HALF_X - 2,
      z: -2,
      label: 'East, along the causeway to the Tallow Levels',
      arrive: { x: -50, z: -6 },
    },
  ],
  props: {
    /** Still air, deliberately. Rooks over the mounds and nothing on the ground under them. */
    sky: 'none',
    wildlife: [
      { kind: 'rook', x: -46, z: -50, roam: 26, count: 4 },
      { kind: 'rook', x: -2, z: -18, roam: 26, count: 4 },
      { kind: 'rook', x: 18, z: 18, roam: 26, count: 4 },
    ],
    /**
     * On the bastion wall, which is the one thing here anybody built.
     *
     * The atlas calls it "an enormous fortification around ground whose only occupants have
     * been dead a very long time". These two lines are somebody having noticed which way it
     * faces.
     */
    graffiti: [
      { text: 'THE WALL FACES IN', wallX: -34, wallZ: 15.95, dx: 3.0, facesSouth: true, tint: '#a46a4a' },
      { text: 'COUNT THEM AGAIN', wallX: 22, wallZ: 39.95, dx: -3.2, facesSouth: true, tint: '#b7ae9d' },
    ],
    /** Barrow country behind an enormous wall. Standing stones, and cairns on the mounds. */
    dressing: [
      { kind: 'cairn', x: 48, z: -52 },
      { kind: 'spoilheap', x: -48, z: -20 },
      { kind: 'cairn', x: 48, z: -8 },
      { kind: 'logpile', x: -48, z: 16 },
      { kind: 'bracken', x: 48, z: 28 },
      { kind: 'cairn', x: -48, z: 40 },
      { kind: 'cairn', x: -20, z: -52 },
      { kind: 'spoilheap', x: 24, z: 52 },
      { kind: 'cairn', x: -28, z: 52 },
      { kind: 'cairn', x: -42, z: -46 },
      { kind: 'cairn', x: -18, z: -42 },
      { kind: 'cairn', x: 38, z: -38 },
      { kind: 'cairn', x: 10, z: -30 },
      { kind: 'cairn', x: -30, z: -22 },
      { kind: 'cairn', x: 22, z: -18 },
      { kind: 'cairn', x: 26, z: -10 },
      { kind: 'cairn', x: -22, z: -2 },
      { kind: 'cairn', x: 30, z: 2 },
      { kind: 'cairn', x: -14, z: 10 },
      { kind: 'cairn', x: -18, z: 18 },
      { kind: 'cairn', x: 30, z: 22 },
      { kind: 'cairn', x: -10, z: 30 },
      { kind: 'cairn', x: -38, z: 38 },
      { kind: 'cairn', x: 18, z: 42 },
      { kind: 'waystone', x: -38, z: -46, text: 'THE BASTION HOLDS' },
      { kind: 'waystone', x: 26, z: -38, text: 'COUNT THE MOUNDS' },
      { kind: 'waystone', x: 30, z: -26, text: 'NOTHING IS BURIED SHALLOW' },
      { kind: 'waystone', x: 38, z: -14, text: 'THE BASTION HOLDS' },
      { kind: 'waystone', x: -34, z: 2, text: 'COUNT THE MOUNDS' },
      { kind: 'waystone', x: -38, z: 14, text: 'NOTHING IS BURIED SHALLOW' },
      { kind: 'waystone', x: -26, z: 26, text: 'THE BASTION HOLDS' },
      { kind: 'waystone', x: -6, z: 38, text: 'COUNT THE MOUNDS' },
      { kind: 'spoilheap', x: -34, z: -46 },
      { kind: 'spoilheap', x: 30, z: -38 },
      { kind: 'spoilheap', x: 34, z: -26 },
      { kind: 'spoilheap', x: -42, z: -10 },
      { kind: 'spoilheap', x: -30, z: 2 },
      { kind: 'spoilheap', x: -18, z: 14 },
      { kind: 'spoilheap', x: -22, z: 26 },
      { kind: 'spoilheap', x: -2, z: 38 },
      { kind: 'logpile', x: -30, z: -46 },
      { kind: 'logpile', x: 18, z: -30 },
      { kind: 'logpile', x: 38, z: -10 },
      { kind: 'logpile', x: -6, z: 10 },
      { kind: 'logpile', x: 2, z: 30 },
      { kind: 'bracken', x: -26, z: -46 },
      { kind: 'bracken', x: 42, z: -26 },
      { kind: 'bracken', x: -22, z: 2 },
      { kind: 'bracken', x: 6, z: 26 },
    ],
    crates: [{ x: 38, z: -2 }],
    /** In the scrub along the east wall, which is the only ground here anything grows on. */
    trees: [
      { x: 42, z: -12 },
      { x: 42, z: 12 },
    ],
    horizon: 'none',
  },
});
