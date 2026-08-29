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
 *
 * `M` is unsplit and barely inset: a mound is one heaped mass, and chunking it would turn a
 * barrow into a terrace of huts.
 */
const BASTION_LEGEND: Record<string, TileDef> = {
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
  'XooooooooooooooooooooooX', //  1
  'XooooooooooooooooooooooX', //  2
  'XooMMMMoooooooMMMMoooooX', //  3  a rank of barrows
  'XooMMMMoooooooMMMMoooooX', //  4
  'XooooooooooooooooooooooX', //  5
  'XooooooMMMMMMooooooooooX', //  6
  'XooooooMMMMMMooooooooooX', //  7
  'XooooooooooooooooooooooX', //  8
  'XooMMMMoooooMMMMoooooo#X', //  9
  'XooMMMMoooooMMMMoooooo#X', // 10
  'XooooooooooooooooooooooX', // 11
  'X,,,,,,,,,,,,,,,,,,,,,,,', // 12  the causeway east, to the Tallow Levels
  'X,,,,,,,,,,,,,,,,,,,,,,,', // 13
  'XooooooooooooooooooooooX', // 14
  'XooMMMMoooooMMMMoooooo#X', // 15
  'XooMMMMoooooMMMMoooooo#X', // 16
  'XooooooooooooooooooooooX', // 17
  'XooooooMMMMMMooooooooooX', // 18
  'XooooooMMMMMMooooooooooX', // 19
  'XooooooooooooooooooooooX', // 20
  'XooMMMMoooooooMMMMoooooX', // 21
  'XooMMMMoooooooMMMMoooooX', // 22
  'XooooooooooooooooooooooX', // 23
  'XooooooooooooooooooooooX', // 24
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
    crates: [{ x: 38, z: -2 }],
    /** In the scrub along the east wall, which is the only ground here anything grows on. */
    trees: [
      { x: 42, z: -12 },
      { x: 42, z: 12 },
    ],
    horizon: 'none',
  },
});
