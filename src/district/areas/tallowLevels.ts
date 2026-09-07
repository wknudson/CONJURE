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
 *
 * Thirty-four by twenty-six now, with the pump house standing on the middle bank: the engine
 * that was supposed to keep the Levels drained, chained shut since the north field went over,
 * because the farm girl is right that it did not spread like blight, and the tanner knows
 * where it came out. The chain comes off when the field is answered for.
 */

import { TILE, defineArea, type AreaDef, type TileDef } from '../map.js';

/**
 * The Levels' legend.
 *
 *   g  soaked ground — walkable, and most of the map
 *   W  drainage cut  — impassable
 *   f  ploughed strip
 *   #  grass
 *   ,  chalk track   — the road south, and nothing else
 *   P  the pump house — impassable; stone, the stack cold
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
  P: {
    tex: 'marsh',
    safe: false,
    walk: false,
    solid: { minHeight: 5.0, maxHeight: 5.0, inset: 0.3, depthInset: 0.3, chimneyChance: 1, split: false, wall: 'stone' },
  },
  T: {
    tex: 'grass',
    safe: false,
    walk: false,
    solid: { minHeight: 3.2, maxHeight: 4.8, inset: 0.75, depthInset: 0.75, chimneyChance: 0, split: true },
  },
};

const OPEN = `T${'g'.repeat(32)}T`;
const STRIP = `T${'f'.repeat(32)}T`;
const CUT_ENDS_F = 'TffffWWWWWfffffffffffWWWWWfffffffT';
const CUT_ENDS_G = 'TggggWWWWWgggggggggggWWWWWgggggggT';

/**
 * 34 wide by 26 deep.
 *
 * Three ranks of cuts, and the gap in each is offset from the gap in the last — rows 9 and 15
 * open in the middle, rows 3/4 and 19/20 open at the ends. Walking north to south is therefore
 * a zigzag rather than a straight line, which is the whole of the design.
 */
const GRID: readonly string[] = [
  `${'T'.repeat(9)},,${'T'.repeat(23)}`, //  0  north, up into the Ashwood
  STRIP, //  1
  STRIP, //  2
  CUT_ENDS_F, //  3
  CUT_ENDS_G, //  4
  OPEN, //  5  the north field
  `Tgg##${'g'.repeat(19)}PPP${'g'.repeat(6)}T`, //  6  THE PUMP HOUSE, on the middle bank
  `T${'g'.repeat(23)}PPP${'g'.repeat(6)}T`, //  7
  OPEN, //  8  the pump house door
  `T${'W'.repeat(7)}${'g'.repeat(15)}${'W'.repeat(10)}T`, //  9  through the middle
  OPEN, // 10
  `g${'g'.repeat(32)}T`, // 11  and west, out to the Bone Bastion
  `g${'g'.repeat(32)}T`, // 12
  `Tgg##gggggggWWWWggggggg##ggggggggT`, // 13
  OPEN, // 14
  `T${'W'.repeat(9)}${'g'.repeat(13)}${'W'.repeat(10)}T`, // 15  through the middle again, but narrower
  OPEN, // 16
  `Tgg##${'g'.repeat(15)}##${'g'.repeat(11)}T`, // 17
  OPEN, // 18
  CUT_ENDS_G, // 19
  CUT_ENDS_F, // 20
  STRIP, // 21  the rendering yard
  STRIP, // 22
  STRIP, // 23
  STRIP, // 24
  `${'T'.repeat(16)},,${'T'.repeat(16)}`, // 25  south, down to Millharrow
];

const HALF_X = (GRID[0]!.length * TILE) / 2;
const HALF_Z = (GRID.length * TILE) / 2;
const xOfCol = (col: number): number => col * TILE - HALF_X + TILE / 2;
const zOfRow = (row: number): number => row * TILE - HALF_Z + TILE / 2;

export const TALLOW_LEVELS_ID = 'tallow_levels';

export const TALLOW_LEVELS: AreaDef = defineArea({
  id: TALLOW_LEVELS_ID,
  name: 'The Tallow Levels',
  grid: GRID,
  legend: LEVELS_LEGEND,
  /** North of the middle cut, on open ground. */
  spawn: { x: 0, z: -10 },
  safety: 'none',
  exits: [
    {
      to: 'millharrow',
      x: -2,
      z: zOfRow(24),
      label: 'South, down to Millharrow',
      arrive: { x: -2, z: -38 },
    },
    {
      to: 'ashwood',
      x: -26,
      z: zOfRow(1),
      label: 'North, up the ride into the Ashwood',
      arrive: { x: -6, z: 42 },
    },
    {
      to: 'bone_bastion',
      x: -HALF_X + 2,
      z: -6,
      label: 'West, along the causeway to the Bone Bastion',
      arrive: { x: 38, z: -2 },
    },
    {
      // The pump house. Chained, until the north field is answered for.
      to: 'tallow_pump_house',
      x: xOfCol(25),
      z: zOfRow(7) + TILE / 2 + 1.4,
      label: 'Into the pump house',
      door: { x: xOfCol(25), z: zOfRow(7) + TILE / 2 + 0.05, facesSouth: true, sign: 'cistern', style: 'iron' },
      when: { after: ['tallow_blight'] },
      lockedReason: 'Chained. The tanner says the blight came up out of the pump house, and nobody opens it until the north field is answered for.',
      arrive: { x: 0, z: 14 },
    },
  ],
  props: {
    /** Drained country losing the argument. Reeds in the cuts and a heron standing in them. */
    sky: 'drizzle',
    wildlife: [
      { kind: 'heron', x: -38, z: -26, roam: 6 },
      { kind: 'heron', x: -50, z: 2, roam: 6 },
      { kind: 'hare', x: -18, z: -42, roam: 8 },
      { kind: 'hare', x: -42, z: 2, roam: 8 },
      { kind: 'gull', x: -58, z: -42, roam: 22, count: 3 },
    ],
    /** Rendering country. Vats, drying frames, and hurdles keeping stock off the cuts. */
    dressing: [
      { kind: 'waystone', x: -30, z: -22, text: 'NORTH FIELD — CONDEMNED' },
      { kind: 'barrel', x: -54, z: -46 },
      { kind: 'barrel', x: 50, z: -42 },
      { kind: 'barrel', x: 26, z: -30 },
      { kind: 'barrel', x: -14, z: -18 },
      { kind: 'barrel', x: -10, z: -6 },
      { kind: 'barrel', x: 46, z: -2 },
      { kind: 'barrel', x: 10, z: 6 },
      { kind: 'barrel', x: 18, z: 14 },
      { kind: 'barrel', x: -26, z: 22 },
      { kind: 'barrel', x: -50, z: 38 },
      { kind: 'rack', x: -50, z: -46 },
      { kind: 'rack', x: 54, z: -42 },
      { kind: 'rack', x: 30, z: -30 },
      { kind: 'rack', x: -10, z: -18 },
      { kind: 'rack', x: -6, z: -6 },
      { kind: 'rack', x: 50, z: -2 },
      { kind: 'rack', x: 14, z: 6 },
      { kind: 'rack', x: 22, z: 14 },
      { kind: 'rack', x: -22, z: 22 },
      { kind: 'rack', x: -46, z: 38 },
      { kind: 'fence', x: -46, z: -46, yaw: 0 },
      { kind: 'fence', x: 2, z: -30, yaw: 0 },
      { kind: 'fence', x: 14, z: -18, yaw: 0 },
      { kind: 'fence', x: -50, z: -10, yaw: 0 },
      { kind: 'fence', x: 54, z: -2, yaw: 0 },
      { kind: 'fence', x: -22, z: 10, yaw: 0 },
      { kind: 'fence', x: -2, z: 18, yaw: 0 },
      { kind: 'fence', x: 6, z: 26, yaw: 0 },
      { kind: 'haybale', x: -42, z: -46 },
      { kind: 'haybale', x: 38, z: -30 },
      { kind: 'haybale', x: 2, z: -6 },
      { kind: 'haybale', x: 22, z: 6 },
      { kind: 'haybale', x: -14, z: 22 },
      { kind: 'reeds', x: -38, z: -30 },
      { kind: 'reeds', x: -22, z: -30 },
      { kind: 'reeds', x: -30, z: -14 },
      { kind: 'reeds', x: 54, z: -10 },
      { kind: 'reeds', x: -34, z: -2 },
      { kind: 'reeds', x: 50, z: 2 },
      { kind: 'reeds', x: -30, z: 14 },
      { kind: 'reeds', x: 54, z: 18 },
      { kind: 'reeds', x: 50, z: 26 },
      { kind: 'bramble', x: -18, z: -46 },
      { kind: 'bramble', x: -34, z: 2 },
      { kind: 'trough', x: 46, z: -22 },
      { kind: 'pens', x: 14, z: 42 },
    ],
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
      { id: 'tallow_renderer', x: -30, z: 38, art: 'butcher_b', label: 'Talk to the renderer' },
    ],
    /**
     * Who walks the row.
     *
     * Rendering runs late and the yard is the only lit ground on the Levels, so
     * the man who works latest lights it.
     */
    lamplighter: 'tallow_tanner',
    lamps: [
      { x: -34, z: -42 },
      { x: 26, z: -42 },
      { x: -34, z: 42 },
      { x: 26, z: 42 },
    ],
    crates: [
      { x: -46, z: -22 },
      { x: 38, z: 22 },
    ],
    /** Standing in the wet, which is where the alders are and nothing else will grow. */
    trees: [
      { x: -46, z: -18 },
      { x: -2, z: -18 },
      { x: 18, z: -18 },
      { x: -46, z: 18 },
      { x: -14, z: 18 },
      { x: 34, z: 18 },
    ],
    horizon: 'treeline',
  },
});
