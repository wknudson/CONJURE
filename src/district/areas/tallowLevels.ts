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
 * Fifty-two by forty now, grown evenly from thirty-four by twenty-six, with the pump house still
 * standing on the middle bank: chained shut since the north field went over, because the farm
 * girl is right that it did not spread like blight, and the tanner knows where it came out. The
 * chain comes off when the field is answered for.
 *
 * What the growth added is the rest of the drainage, and what it failed to save. North, up the
 * ride, **the reed beds**, grown where the cuts silted. West, **the main drain**, straight as a
 * rule, with the causeway to the Bone Bastion crossing it between **the sluice gates** and the
 * keeper's hut beside them. East, **the new drain** between its dykes, and the pumping engine
 * that empties the Levels into it a bucket at a stroke, its beam rocking on the wall-top. South,
 * on the road to Millharrow, **the half-sunk village**: cottages lived in upstairs, the chapel's
 * west end in the water, the ones that went under standing out of it.
 *
 * The Dyke Wardens walk the dyke top by day and fine anybody else who does. At night a crew of
 * them works the reed beds, which is where the wardens go when they are not wardens.
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
 *   k  the causeway  — cobbled, raised over the drains
 *   S  a sluice gate — impassable; timber on iron screws
 *   h  cottage       — impassable; the keeper's hut, the half-sunk village
 *   X  a sunk cottage — impassable; walls standing out of the water
 *   K  the chapel    — impassable; its west end in the water
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
    solid: { style: 'hall', minHeight: 5.0, maxHeight: 5.0, inset: 0.3, depthInset: 0.3, chimneyChance: 1, split: false, wall: 'stone' },
  },
  T: {
    tex: 'grass',
    safe: false,
    walk: false,
    solid: { style: 'foliage', minHeight: 3.2, maxHeight: 4.8, inset: 0.75, depthInset: 0.75, chimneyChance: 0, split: true },
  },
  k: { tex: 'cobble', safe: false, walk: true },
  S: {
    tex: 'water',
    safe: false,
    walk: false,
    solid: { style: 'wall', minHeight: 2.0, maxHeight: 2.0, inset: 0.3, depthInset: 1.2, chimneyChance: 0, split: false, wall: 'timber' },
  },
  h: {
    tex: 'marsh',
    safe: false,
    walk: false,
    solid: { style: 'cottage', minHeight: 3.6, maxHeight: 4.2, inset: 0.3, depthInset: 0.3, chimneyChance: 0.7, split: true, wall: 'plaster' },
  },
  X: {
    tex: 'marsh',
    safe: false,
    walk: false,
    solid: { style: 'wall', minHeight: 1.2, maxHeight: 2.6, inset: 0.3, depthInset: 1.0, chimneyChance: 0, split: true },
  },
  K: {
    tex: 'marsh',
    safe: false,
    walk: false,
    solid: { style: 'hall', minHeight: 5.0, maxHeight: 5.0, inset: 0.3, depthInset: 0.3, chimneyChance: 0, split: false, wall: 'stone' },
  },
};


/**
 * 34 wide by 26 deep.
 *
 * Three ranks of cuts, and the gap in each is offset from the gap in the last — rows 9 and 15
 * open in the middle, rows 3/4 and 19/20 open at the ends. Walking north to south is therefore
 * a zigzag rather than a straight line, which is the whole of the design.
 */
const GRID: readonly string[] = [
  'TTTTTTTTTTTTTTTTTT,,TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT', //  0  the far thicket
  'ggWWWWWWWggggggggg,,ggWWWWWWWWggggggggggggggWWWWWWgg', //  1  THE REED BEDS, and the ride north into the Ashwood
  'ggWWWWWWWggggggggg,,ggWWWWWWWWggggggggggggggWWWWWWgg', //  2
  'ggWWWWWWWggggggggg,,ggggggggggggggggggggggggWWWWWWgg', //  3
  'ggggggggggWWWWWWgg,,gggggggggggggWWWWWWWWggggggggggg', //  4
  'ggggggggggWWWWWWgg,,gggggggggggggWWWWWWWWggggggggggg', //  5
  'ggggggggggWWWWWWgg,,gggggggggggggggggggggggggggggggg', //  6
  'TggWWggggTTTTTTTTT,,TTTTTTTTTTggTTTTggTTTTTg#W#ggggT', //  7  the old north thicket, with ways through it
  'TggWWggggTffffffffffffffffffffffffffffffffTg#W#ggggT', //  8
  'TggWWggggTffffffffffffffffffffffffffffffffTg#W#ggggT', //  9  THE MAIN DRAIN (west)                                                THE NEW DRAIN, its dykes (east)
  'TggWWghhgTffffWWWWWfffffffffffWWWWWfffffffTg#W#ggggT', // 10  the sluice-keeper's hut
  'TggWWghhgTggggWWWWWgggggggggggWWWWWgggggggTg#W#ggggT', // 11
  'TggWWggggTgggggggggggggggggggggggggggggggggg#W#ggggT', // 12  the north field
  'TggWWggggTgg##gggggggggggggggggggPPPggggggTg#W#ggggT', // 13  THE PUMP HOUSE, on the middle bank
  'TggWWggggTgggggggggggggggggggggggPPPggggggTg#W#ggggT', // 14  the pumping engine, on its ground by the new drain
  'TggWWggggTggggggggggggggggggggggggggggggggTg#W#ggggT', // 15  the pump house door
  'TggWWggggTWWWWWWWgggggggggggggggWWWWWWWWWWTg#W#ggggT', // 16  through the middle
  'TggSSggggTggggggggggggggggggggggggggggggggTg#W#ggggT', // 17  the sluice gates
  'kkkkkkkkkgggggggggggggggggggggggggggggggggTg#k#ggggT', // 18  THE CAUSEWAY — west to the Bone Bastion
  'kkkkkkkkkgggggggggggggggggggggggggggggggggTg#k#ggggT', // 19
  'TggSSggggTgg##gggggggWWWWggggggg##ggggggggTg#W#ggggT', // 20
  'TggWWggggTggggggggggggggggggggggggggggggggTg#W#ggggT', // 21
  'TggWWggggTWWWWWWWWWgggggggggggggWWWWWWWWWWTg#W#ggggT', // 22  through the middle again, but narrower
  'TggWWggggTggggggggggggggggggggggggggggggggTg#W#ggggT', // 23
  'TggWWggggTgg##ggggggggggggggg##ggggggggggggg#W#ggggT', // 24
  'TggWWggggTggggggggggggggggggggggggggggggggTg#W#ggggT', // 25
  'TggWWggggTggggWWWWWgggggggggggWWWWWgggggggTg#W#ggggT', // 26
  'TggWWggggTffffWWWWWfffffffffffWWWWWfffffffTg#W#ggggT', // 27
  'TggWWggggTffffffffffffffffffffffffffffffffTg#W#ggggT', // 28  the rendering yard
  'TggWWggggTffffffffffffffffffffffffffffffffTg#W#ggggT', // 29
  'TggWWggggTffffffffffffffffffffffffffffffffTg#W#ggggT', // 30
  'TggWWggggTffffffffffffffffffffffffffffffffTg#W#ggggT', // 31
  'TggWWggggTggTTTTTTTTTTTTT,,TTTTTTTTTTTggTTTg#W#ggggT', // 32  the old south thicket, with ways through it
  'Tgggggggggggggggggggggggg,,ggggggggggggggggggggggggT', // 33  THE HALF-SUNK VILLAGE
  'Tggghhhggghhhgggggggggggg,,ggghhhggghhhggggggggggggT', // 34  the cottages still standing
  'Tggghhhggghhhgggggggggggg,,ggghhhggghhhggggggggggggT', // 35
  'TgWWWWWWWWWWWgWKKKKgggggg,,ggggWWWWWWWggWWXXXXWWWWgT', // 36  where the ground went under: the chapel, and the ones that are not standing
  'TgWWWXXXXWWWWgWKKKKgggggg,,ggggWXXXXWWggWWWWWWWWWWgT', // 37
  'TgWWWWWWWWWWWgWKKKKgggggg,,ggggWWWWWWWgggggggggggggT', // 38
  'TTTTTTTTTTTTTTTTTTTTTTTTT,,TTTTTTTTTTTTTTTTTTTTTTTTT', // 39  the far thicket; south, to Millharrow
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
      // South down the road, through the half-sunk village, to the new edge.
      to: 'millharrow',
      x: -2,
      z: zOfRow(38),
      label: 'South, down to Millharrow',
      // Onto Millharrow's north road, a stride inside its exit at the new north edge.
      arrive: { x: -2, z: -86 },
    },
    {
      // North up the ride, through the reed beds, to the new edge.
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
      x: xOfCol(34),
      z: zOfRow(14) + TILE / 2 + 1.4,
      label: 'Into the pump house',
      door: { x: xOfCol(34), z: zOfRow(14) + TILE / 2 + 0.05, facesSouth: true, sign: 'cistern', style: 'iron' },
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
      // Herons in the reed beds and the sunk village, rats on the dykes.
      { kind: 'heron', x: -64, z: -70, roam: 6 },
      { kind: 'heron', x: 78, z: 74, roam: 5 },
      { kind: 'rat', x: 94, z: 30, roam: 4, count: 2 },
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

      // The reed beds.
      { kind: 'reeds', x: -74, z: -56 },
      { kind: 'reeds', x: -38, z: -60 },
      { kind: 'reeds', x: 30, z: -70 },
      { kind: 'reeds', x: 62, z: -58 },
      { kind: 'reeds', x: -100, z: -66 },
      // The sluices: the winch, the keeper's wood.
      { kind: 'workbench', x: -82, z: -14 },
      { kind: 'logpile', x: -74, z: -26 },
      // The engine's coal and water.
      { kind: 'logpile', x: 96, z: -24 },
      { kind: 'barrel', x: 96, z: -8 },
      // The half-sunk village.
      { kind: 'washing', x: -74, z: 56, yaw: 0 },
      { kind: 'barrel', x: -48, z: 54 },
      { kind: 'gravestone', x: -26, z: 56 },
      { kind: 'gravestone', x: -22, z: 60 },
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
    /**
     * The Dyke Wardens: one crew on the dyke top by day, end to end of the new drain, and one in
     * the reed beds at night, where the wardens go when they are not being wardens.
     */
    packs: [
      {
        encounterId: 'pack_dyke_wardens',
        id: 'dyke',
        x: 82,
        z: 0,
        roam: 6,
        hours: 'day',
        band: 'dyke',
        behaviour: 'beat',
        route: [
          { x: 82, z: -48 },
          { x: 82, z: 48 },
        ],
      },
      { encounterId: 'pack_dyke_wardens', id: 'reed_beds', x: -40, z: -66, roam: 7, hours: 'night', band: 'reeds' },
    ],
    /** The pumping engine by the new drain, its beam rocking on the wall-top. */
    landmarks: [{ kind: 'beam_engine', x: 88, z: -16 }],
    vignettes: [{ id: 'fish_racks', x: 60, z: 56 }],
  },
});
