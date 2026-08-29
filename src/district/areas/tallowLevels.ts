/**
 * The Tallow Levels — drained country that is losing the argument.
 *
 * Flat, wet, and cut about with drainage channels that have stopped draining. The layout is
 * the water: the cuts run east to west across the map in three broken lines, and crossing the
 * Levels is a matter of finding where each one has silted up enough to walk over. There is
 * always a way through, and it is never in the same place twice.
 *
 * That makes it the first area in the world whose *shape* is a puzzle rather than a corridor or
 * a room — not a hard one, but you do have to look. The strips at the top and bottom are the
 * only ground anybody still works.
 */

import { defineArea, type AreaDef, type TileDef } from '../map.js';

/**
 * The Levels' legend.
 *
 *   g  soaked ground — walkable, and most of the map
 *   W  drainage cut  — impassable
 *   f  ploughed strip
 *   #  grass
 *   ,  chalk track   — the road south, and nothing else
 *   T  thicket       — impassable, the boundary
 *
 * The cuts are `water` rather than a solid: they are below you, not in front of you, and a
 * channel that cast a building's shadow would read as a wall.
 */
const LEVELS_LEGEND: Record<string, TileDef> = {
  g: { tex: 'marsh', safe: false, walk: true },
  W: { tex: 'water', safe: false, walk: false },
  f: { tex: 'field', safe: false, walk: true },
  '#': { tex: 'grass', safe: false, walk: true },
  ',': { tex: 'chalk', safe: false, walk: true },
  T: {
    tex: 'grass',
    safe: false,
    walk: false,
    solid: { minHeight: 3.2, maxHeight: 4.8, inset: 0.75, depthInset: 0.75, chimneyChance: 0, split: true },
  },
};

/**
 * 30 wide by 20 deep.
 *
 * Three ranks of cuts, and the gap in each is offset from the gap in the last — rows 7 and 12
 * open in the middle, rows 2/3 and 16/17 open at the ends. Walking north to south is therefore
 * a zigzag rather than a straight line, which is the whole of the design.
 */
const GRID: readonly string[] = [
  'TTTTTTTT,,TTTTTTTTTTTTTTTTTTTT', //  0  north, up into the Ashwood
  'TffffffffffffffffffffffffffffT', //  1
  'TffffWWWWffffffffWWWWffffffffT', //  2
  'TggggWWWWggggggggWWWWggggggggT', //  3
  'TggggggggggggggggggggggggggggT', //  4
  'Tgg##ggggggggggggggg##gggggg#T', //  5
  'TggggggggggggggggggggggggggggT', //  6
  'TWWWWWWggggggggggggggWWWWWWWWT', //  7  through the middle
  'gggggggggggggggggggggggggggggT', //  8  and west, out to the Bone Bastion
  'gggggggggggggggggggggggggggggT', //  9
  'Tgg##gggggggWWWWggggggg##ggggT', // 10
  'TggggggggggggggggggggggggggggT', // 11
  'TWWWWWWWWggggggggggggWWWWWWWWT', // 12  through the middle again, but narrower
  'TggggggggggggggggggggggggggggT', // 13
  'Tgg##ggggggggggggggg##gggggg#T', // 14
  'TggggggggggggggggggggggggggggT', // 15
  'TggggWWWWggggggggWWWWggggggggT', // 16
  'TffffWWWWffffffffWWWWffffffffT', // 17
  'TffffffffffffffffffffffffffffT', // 18
  'TTTTTTTTTTTTTT,,TTTTTTTTTTTTTT', // 19  south, down to Millharrow
];

export const TALLOW_LEVELS_ID = 'tallow_levels';

export const TALLOW_LEVELS: AreaDef = defineArea({
  id: TALLOW_LEVELS_ID,
  name: 'The Tallow Levels',
  grid: GRID,
  legend: LEVELS_LEGEND,
  /** North of the middle cut, on open ground. */
  spawn: { x: 0, z: 4 },
  safety: 'none',
  exits: [
    {
      to: 'millharrow',
      x: -2,
      z: 38,
      label: 'South, down to Millharrow',
      arrive: { x: -2, z: -38 },
    },
    {
      to: 'ashwood',
      x: -26,
      z: -38,
      label: 'North, up the ride into the Ashwood',
      arrive: { x: -6, z: 42 },
    },
    {
      to: 'bone_bastion',
      x: -58,
      z: -6,
      label: 'West, along the causeway to the Bone Bastion',
      arrive: { x: 38, z: -2 },
    },
  ],
  props: {
    /**
     * Both on the worked strips, which on these Levels is the whole of the siting decision.
     *
     * The middle three ranks are drainage cuts. Standing somebody in them would put them in
     * water, and would also put them somewhere the player cannot walk to in a straight line.
     */
    npcs: [
      { id: 'tallow_farmer_daughter', x: -18, z: -14, art: 'farmer_daughter', label: 'Talk to the farm girl' },
      { id: 'tallow_tanner', x: 10, z: 18, art: 'tanner', label: 'Talk to the tanner' },
      { id: 'tallow_cobbler', x: -22, z: -18, art: 'cobbler_b', label: 'Talk to the cobbler' },
    ],
    /** Nothing lights the Levels. These four are on the worked strips, and stop there. */
    lamps: [
      { x: -34, z: -34 },
      { x: 26, z: -34 },
      { x: -34, z: 34 },
      { x: 26, z: 34 },
    ],
    crates: [
      { x: -46, z: -22 },
      { x: 38, z: 22 },
    ],
    /** Standing in the wet, which is where the alders are and nothing else will grow. */
    trees: [
      { x: -46, z: -18 },
      { x: -14, z: -18 },
      { x: 18, z: -18 },
      { x: -46, z: 18 },
      { x: -14, z: 18 },
      { x: 34, z: 18 },
    ],
    horizon: 'treeline',
  },
});
