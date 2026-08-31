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

import { defineArea, type AreaDef, type TileDef } from '../map.js';

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
    solid: { minHeight: 2.6, maxHeight: 4.0, inset: 0.1, depthInset: 0.1, chimneyChance: 0, split: false },
  },
  X: {
    tex: 'bone',
    safe: false,
    walk: false,
    solid: { minHeight: 12.0, maxHeight: 14.0, inset: 0.05, depthInset: 0.05, chimneyChance: 0, split: false },
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
  'XXXXXXXXXXXXXXXXXXXXXXXX', //  0
  'XttttttttooottttttttoooX', //  1
  'XttttttttooottttttttoooX', //  2
  'XttMMMMttooottMMMMttoooX', //  3  a rank of barrows
  'XttMMMMtttttttMMMMttoooX', //  4
  'XtttttttttttttttttttoooX', //  5
  'XttttttMMMMMMtttttttoooX', //  6
  'XttttttMMMMMMtttttoooooX', //  7
  'XtttttttttttttttttoooooX', //  8
  'XttMMMMtttttMMMMttoooo#X', //  9
  'XttMMMMttottMMMMttoooo#X', // 10
  'XttttttttottttttttoooooX', // 11
  'X,,,,,,,,,,,,,,,,,,,,,,,', // 12  the causeway east, to the Tallow Levels
  'X,,,,,,,,,,,,,,,,,,,,,,,', // 13
  'XttttttttottttttttoooooX', // 14
  'XttMMMMttottMMMMttoooo#X', // 15
  'XttMMMMtttttMMMMttoooo#X', // 16
  'XtttttttttttttttttoooooX', // 17
  'XttttttMMMMMMtttttoooooX', // 18
  'XttttttMMMMMMtttttttoooX', // 19
  'XtttttttttttttttttttoooX', // 20
  'XttMMMMtttttttMMMMttoooX', // 21
  'XttMMMMttooottMMMMttoooX', // 22
  'XttttttttooottttttttoooX', // 23
  'XttttttttooottttttttoooX', // 24
  'XXXXXXXXXXXXXXXXXXXXXXXX', // 25
];

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
      to: 'tallow_levels',
      x: 46,
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
