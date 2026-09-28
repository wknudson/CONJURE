/**
 * Millharrow — the Ring's crossroads, and the reason the Chalk Road goes anywhere.
 *
 * Four ways out, one from each edge, and the town is simply what grew where they met. The plan
 * is the plan of every crossroads settlement: a cross of streets, buildings pressed against
 * both sides of it, and ploughed strips beginning the moment the last roof does.
 *
 * It is deliberately the most *legible* place in the world. Jolrek's wards are things you learn
 * by walking into their dead ends; this one you can read from the middle in one turn on the
 * spot. That is what a hub has to be — the four roads out of it are the point, and a town that
 * hid them would be a town you got stuck in.
 *
 * Sixty by fifty-two now, grown evenly from thirty-two by twenty-eight, and still readable from
 * the middle: the cross runs on to the east and west edges and the two roads to the north and
 * south ones, and the town has a quarter at the head of each. The Mill stands north of the cross
 * with the race running past it and, now, its wheel turning in it; the low granary the race
 * drowned is south of the race with its door onto the cross, where the `drowned_granary`
 * contract is fought.
 *
 * What the growth added, round the old hedge: north, **the North End** at the head of the
 * Levels road, **the millpond** that feeds the race by a leat, and **windmill hill** out in the
 * strips; west, **the granary yards**, the threshing floor and the tithe barn; east, **the East
 * End**, cottages, a smithy yard and the crossroads chapel with its graves; south, **the
 * orchards** and their cider press, and **the fair green** with its stalls and, at its head, the
 * Crossroads Arms -- an inn, and a room.
 *
 * The town itself is left quiet at night. The fields are not: the Scarecrow Men stand the field
 * edges after dark, one crew round windmill hill and one along the foot of the orchards.
 */

import { TILE, defineArea, type AreaDef, type TileDef } from '../map.js';

/**
 * The town's legend.
 *
 *   ,  chalk street  — the crossroads themselves, and the four roads out
 *   c  cobbles       — the yards and frontages either side
 *   f  ploughed strip
 *   #  grass
 *   .  weeds
 *   W  the mill race — impassable, and below you
 *   B  town building — impassable
 *   M  the Mill      — impassable; timber, the stack going
 *   G  the granary   — impassable; low stone, the water line on it
 *   T  hedgerow      — impassable, the town's edge
 *   h  cottage       — impassable; the road-heads, the East End, the cider press
 *   g  garden        — the East End's
 *   b  the leat bridge — planks over the leat
 *   K  the chapel    — impassable; stone
 *   I  the Crossroads Arms — impassable; timber, the stack going
 *   Y  a fair stall  — impassable, low
 *
 * The streets are chalk rather than cobble on purpose: they are the Chalk Road, still, running
 * through a place that happens to be built on it.
 */
const MILL_LEGEND: Record<string, TileDef> = {
  ',': { tex: 'chalk', safe: false, walk: true },
  c: { tex: 'cobble', safe: false, walk: true },
  f: { tex: 'field', safe: false, walk: true },
  '#': { tex: 'grass', safe: false, walk: true },
  '.': { tex: 'weeds', safe: false, walk: true },
  W: { tex: 'water', safe: false, walk: false },
  B: {
    tex: 'cobble',
    safe: false,
    walk: false,
    solid: { style: 'terrace', minHeight: 3.6, maxHeight: 5.2, inset: 0.35, depthInset: 0.35, chimneyChance: 0.5, split: true },
  },
  M: {
    tex: 'cobble',
    safe: false,
    walk: false,
    solid: { style: 'hall', minHeight: 6.4, maxHeight: 6.4, inset: 0.3, depthInset: 0.3, chimneyChance: 1, split: false, wall: 'timber' },
  },
  G: {
    tex: 'cobble',
    safe: false,
    walk: false,
    solid: { style: 'warehouse', minHeight: 3.2, maxHeight: 3.2, inset: 0.3, depthInset: 0.3, chimneyChance: 0, split: false, wall: 'stone' },
  },
  T: {
    tex: 'grass',
    safe: false,
    walk: false,
    solid: { style: 'foliage', minHeight: 3.4, maxHeight: 4.6, inset: 0.7, depthInset: 0.7, chimneyChance: 0, split: true },
  },
  h: {
    tex: 'grass',
    safe: false,
    walk: false,
    solid: { style: 'cottage', minHeight: 3.6, maxHeight: 4.4, inset: 0.3, depthInset: 0.3, chimneyChance: 0.8, split: true, wall: 'plaster' },
  },
  g: { tex: 'field', safe: false, walk: true },
  b: { tex: 'planks', safe: false, walk: true },
  K: {
    tex: 'grass',
    safe: false,
    walk: false,
    solid: { style: 'hall', minHeight: 5.6, maxHeight: 5.6, inset: 0.3, depthInset: 0.3, chimneyChance: 0, split: false, wall: 'stone' },
  },
  I: {
    tex: 'grass',
    safe: false,
    walk: false,
    solid: { style: 'shopfront', minHeight: 5.2, maxHeight: 5.2, inset: 0.3, depthInset: 0.3, chimneyChance: 1, split: false, wall: 'timber' },
  },
  Y: {
    tex: 'grass',
    safe: false,
    walk: false,
    solid: { style: 'stall', minHeight: 1.9, maxHeight: 2.3, inset: 0.9, depthInset: 1.1, chimneyChance: 0, split: false },
  },
};


/**
 * 32 wide by 28 deep.
 *
 * The four gaps in the hedge are the four roads: north to the Tallow Levels, south to the
 * Chalk Road, west to Saltglass, east to Bray's Hollow. Everything else is enclosed, so the
 * only decisions the town offers are which of the four you take -- and, now, which of the two
 * doors.
 */
const GRID: readonly string[] = [
  'TTTTTTTTTTTTTTTTTTTTTTTTTTTT,,TTTTTTTTTTTTTTTTTTTTTTTTTTTTTT', //  0  the far hedge; the north road
  'T#####################cccccc,,ccccccTffffffffffffffffffffffT', //  1  THE MILLPOND (west)   THE NORTH END, cottages either side of the road   WINDMILL HILL (east)
  'T#####WWWWWWWWWWWW####chhhcc,,chhhccTffffffffffffffffffffffT', //  2
  'T###WWWWWWWWWWWWWW####chhhcc,,chhhccTfffffff########fffffffT', //  3
  'T###WWWWWWWWWWWWWW####cccccc,,ccccccTfffffff########fffffffT', //  4
  'T###WWWWWWWWWWWWWW####cccccc,,ccccccffffffff########fffffffT', //  5
  'T###WWWWWWWWWWWWWW####chhhcc,,chhhccTfffffff########fffffffT', //  6
  'T###WWWWWWWWWWWWWW####chhhcc,,chhhccTfffffff########fffffffT', //  7
  'T###WWWWWWWWWWW#######cccccc,,ccccccTfffffff########fffffffT', //  8
  'T##############W######cccccc,,ccccccTffffffffffffffffffffffT', //  9  the leat, down from the pond to the race
  'T##############W######cccccc,,ccccccTffffffffffffffffffffffT', // 10
  'TffffffffffffffWffffffffffff,,fffffffffffffffffffffffffffffT', // 11
  'TTTTTTTTTTTTT#TWTTTTTTTTTTTT,,TTTTTTTTTTTTTTTTTTTTTTTTTTTTTT', // 12  north hedge; north, to the Levels
  'Tcccccccccccc#TW#fffffffffff,,,,fffffffffff##Tc############T', // 13  THE GRANARY YARDS (west)                                            THE EAST END
  'TcGGGGGcGGGGG#TW#fffffffffff,,,,fffffffffff##Tc#hhhhh#hhhh#T', // 14
  'TcGGGGGcGGGGG#TW#fffffffffff,,,,fffffffffff##Tc#hhhhh#hhhh#T', // 15
  'TcGGGGGcGGGGG#TW....#######,,,,,,#######....#Tc#gggggggggg#T', // 16
  'Tcccccccccccc#cbccccccccccc,,,,,,cccccccccccccc#gggggggggg#T', // 17  the leat bridge, and a way through each old hedge
  'Tcccccccccccc#TWBBBBBBccMMMM,,,,,,cBBBBBBBBccTc############T', // 18  the north frontages, and THE MILL
  'TcGGGGGcGGGGG#TWBBBBBBccMMMM,,,,,,cBBBBBBBBccTc##hhhh######T', // 19
  'TcGGGGGcGGGGG#TWcWWWWWWcMMMM,,,,,,cccccccccccTc##hhhh######T', // 20  the mill race
  'TcGGGGGcGGGGG#TWcWWWWWWccccc,,,,cccccccccccccTc##hhhh######T', // 21  the mill door
  'TcGGGGGcGGGGG#TcGGGGGGccBBBBc,,,,cBBBBBBcccccTc############T', // 22  THE LOW GRANARY, drowned
  'Tcccccccccccc#TcGGGGGGccBBBBc,,,,cBBBBBBcccccT#############T', // 23
  ',,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,', // 24  THE CROSS — west to Saltglass, east to Bray's Hollow
  ',,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,', // 25
  'T............#Tcccccccccccc,,,,,,ccccccccccccT#############T', // 26  the threshing floor, and the tithe barn                            the crossroads chapel
  'T............#TcBBBBBccBBBBc,,,,cBBBBBBccBBBcTc############T', // 27  the south frontages
  'T.GGGGGG.....#TcBBBBBccBBBBc,,,,cBBBBBBccBBBcTc############T', // 28
  'T.GGGGGG.....#ccccccccccccc,,,,,,cccccccccccccc###KKKKKK###T', // 29
  'T.GGGGGG.....#TcBBBBBBccBBBB,,,,,,cBBBBBBBBccTc###KKKKKK###T', // 30
  'T.GGGGGG.....#TcBBBBBBccBBBB,,,,,,cBBBBBBBBccTc###KKKKKK###T', // 31
  'T............#Tcccccccccccc,,,,,,ccccccccccccTc###KKKKKK###T', // 32
  'T............#T#....#######,,,,,,#######....#Tc############T', // 33
  'T........GGGG#T##fffffffffff,,,,fffffffffff##Tc#..........#T', // 34
  'T........GGGG#T##fffffffffff,,,,fffffffffff##Tc#..........#T', // 35
  'T........GGGG#T##fffffffffff,,,,fffffffffff##Tc#..........#T', // 36
  'T........GGGG#T##fffffffffff,,,,fffffffffff##Tc#..........#T', // 37
  'T............#T##fffffffffff,,,,fffffffffff##Tc############T', // 38
  'TTTTTTTTTTTTT#TTTTTTTTTTTTTT,,TTTTTTTTTTTTTTTTcTTTTTTTTTTTTT', // 39  south, to the Chalk Road
  'TTTTTTTTTTTTT#TTTTTTTTTTTTT#,,#TTTTTTTTTTTTTTT#TTTTTTTTTTTTT', // 40  THE ORCHARDS (west), the cider press      the south road      THE FAIR GREEN, and THE INN
  'T#########################T#,,####IIIIII###################T', // 41
  'T###################hhhh##T#,,####IIIIII###################T', // 42
  'T###################hhhh##T#,,#############################T', // 43
  'T#########################T#,,##hh#########################T', // 44
  'T#########################T#,,##hh#########################T', // 45
  'T#########################T#,,########YYYYYY###YYYYYY######T', // 46  the fair stalls
  'T#########################T#,,#############################T', // 47
  'T###########################,,#############################T', // 48
  'T#########################T#,,########YYYYYY###YYYYYY######T', // 49
  'T#########################T#,,#############################T', // 50
  'TTTTTTTTTTTTTTTTTTTTTTTTTTTT,,TTTTTTTTTTTTTTTTTTTTTTTTTTTTTT', // 51  the far hedge; south, to the Chalk Road
];

const HALF_X = (GRID[0]!.length * TILE) / 2;
const HALF_Z = (GRID.length * TILE) / 2;
const xOfCol = (col: number): number => col * TILE - HALF_X + TILE / 2;
const zOfRow = (row: number): number => row * TILE - HALF_Z + TILE / 2;

export const MILLHARROW_ID = 'millharrow';

export const MILLHARROW: AreaDef = defineArea({
  id: MILLHARROW_ID,
  name: 'Millharrow',
  grid: GRID,
  legend: MILL_LEGEND,
  /** The middle of the cross, which is the only honest place to put somebody down here. */
  spawn: { x: 0, z: 0 },
  safety: 'none',
  exits: [
    {
      // Down the south road through the new ground to the edge, past the fair green.
      to: 'chalk_road',
      x: -2,
      z: zOfRow(50),
      label: 'South, down onto the Chalk Road',
      arrive: { x: -34, z: -14 },
    },
    {
      // Up the north road through the North End to the edge.
      to: 'tallow_levels',
      x: -2,
      z: zOfRow(1),
      label: 'North, out onto the Tallow Levels',
      // Onto the road through the half-sunk village, a stride inside the Levels' new south exit.
      arrive: { x: -2, z: 58 },
    },
    {
      to: 'saltglass',
      x: -HALF_X + 2,
      z: -2,
      label: 'West, to Saltglass',
      arrive: { x: 82, z: 8 },
    },
    {
      to: 'brays_hollow',
      x: HALF_X - 2,
      z: -2,
      label: "East, into Bray's Hollow",
      arrive: { x: -42, z: 0 },
    },
    {
      // The Mill, with its door on the lane between the race and the cross.
      to: 'millharrow_mill',
      x: xOfCol(25.5),
      z: zOfRow(20) + TILE / 2 + 1.4,
      label: 'Into the Mill',
      door: { x: xOfCol(25.5), z: zOfRow(20) + TILE / 2 + 0.05, facesSouth: true, style: 'plank' },
      arrive: { x: 0, z: 14 },
    },
    {
      // The low granary. The water is in it, and so is what dammed the race.
      to: 'millharrow_granary',
      x: xOfCol(18.5),
      z: zOfRow(23) + TILE / 2 + 1.4,
      label: 'Into the drowned granary',
      door: { x: xOfCol(18.5), z: zOfRow(23) + TILE / 2 + 0.05, facesSouth: true, style: 'plank' },
      arrive: { x: 0, z: 20 },
    },
    {
      // The Crossroads Arms, at the head of the fair green, its door onto the green.
      to: 'millharrow_inn',
      x: xOfCol(36.5),
      z: zOfRow(42) + TILE / 2 + 1.4,
      label: 'Into the Crossroads Arms',
      door: { x: xOfCol(36.5), z: zOfRow(42) + TILE / 2 + 0.05, facesSouth: true, sign: 'tavern' },
      arrive: { x: 0, z: 14 },
    },
  ],
  props: {
    /** A crossroads town in worked country. Stock in the fields, rats at the mill. */
    sky: 'pollen',
    wildlife: [
      { kind: 'sheep', x: -26, z: -46, roam: 7, count: 4 },
      { kind: 'sheep', x: 30, z: -46, roam: 7, count: 4 },
      { kind: 'sheep', x: -30, z: 42, roam: 7, count: 4 },
      { kind: 'goat', x: -14, z: -46, roam: 7, count: 2 },
      { kind: 'goat', x: 34, z: 38, roam: 7, count: 2 },
      { kind: 'rat', x: -26, z: -14, roam: 5, count: 2 },
      { kind: 'rat', x: -6, z: 2, roam: 5, count: 2 },
      { kind: 'rook', x: -54, z: -50, roam: 22, count: 4 },
      // A heron on the millpond, sheep on windmill hill, rooks over the orchards.
      { kind: 'heron', x: -90, z: -62, roam: 6 },
      { kind: 'sheep', x: 72, z: -70, roam: 5, count: 3 },
      { kind: 'rook', x: -70, z: 76, roam: 20, count: 4 },
    ],
    /**
     * The crossroads has opinions about the toll.
     *
     * On the granary and the Mill, where the road into town runs past them — the graffiti in
     * this game is always on the wall of whatever the line is complaining about.
     */
    graffiti: [
      { text: 'THE TOLL IS NOT THE KINGS', wallX: -36, wallZ: zOfRow(23) + TILE / 2 + 0.05, dx: 0, facesSouth: true, tint: '#a46a4a' },
      { text: 'WEIGH IT AT THE MILL', wallX: -10, wallZ: zOfRow(20) + TILE / 2 + 0.05, dx: 0, facesSouth: true, tint: '#b7ae9d' },
    ],
    /** Mill town at the crossroads: grain in, beer out, and a toll on the best road. */
    dressing: [
      { kind: 'sacks', x: -46, z: -46 },
      { kind: 'sacks', x: -42, z: -34 },
      { kind: 'sacks', x: -26, z: -26 },
      { kind: 'sacks', x: 18, z: -18 },
      { kind: 'sacks', x: 14, z: -6 },
      { kind: 'sacks', x: -2, z: 6 },
      { kind: 'sacks', x: -26, z: 14 },
      { kind: 'sacks', x: 46, z: 26 },
      { kind: 'sacks', x: 38, z: 34 },
      { kind: 'haybale', x: -38, z: -46 },
      { kind: 'haybale', x: 18, z: -34 },
      { kind: 'haybale', x: -10, z: -34 },
      { kind: 'haybale', x: -10, z: -6 },
      { kind: 'haybale', x: 42, z: 6 },
      { kind: 'haybale', x: 14, z: 22 },
      { kind: 'haybale', x: -18, z: 34 },
      { kind: 'cart', x: -34, z: -46 },
      { kind: 'cart', x: 18, z: -30 },
      { kind: 'cart', x: -26, z: -10 },
      { kind: 'cart', x: 18, z: 2 },
      { kind: 'cart', x: -10, z: 30 },
      { kind: 'fence', x: -30, z: -46, yaw: 0 },
      { kind: 'fence', x: -30, z: -34, yaw: 0 },
      { kind: 'fence', x: -54, z: -18, yaw: 0 },
      { kind: 'fence', x: -42, z: -2, yaw: 0 },
      { kind: 'fence', x: 2, z: 6, yaw: 0 },
      { kind: 'fence', x: -10, z: 14, yaw: 0 },
      { kind: 'fence', x: -38, z: 30, yaw: 0 },
      { kind: 'fence', x: 46, z: 34, yaw: 0 },
      { kind: 'waystone', x: -26, z: -46, text: 'BY ORDER — TOLL PAYABLE' },
      { kind: 'waystone', x: -26, z: 2, text: 'BY ORDER — TOLL PAYABLE' },
      { kind: 'well', x: -22, z: -46 },
      { kind: 'well', x: -22, z: 2 },
      { kind: 'trough', x: 26, z: -34 },
      { kind: 'pens', x: 42, z: -46 },
      { kind: 'awning', x: 30, z: -18, yaw: 0 },
      { kind: 'wildflowers', x: -18, z: -46 },
      { kind: 'wildflowers', x: 30, z: -30 },
      { kind: 'wildflowers', x: 2, z: -10 },
      { kind: 'wildflowers', x: -42, z: 14 },
      { kind: 'wildflowers', x: 2, z: 30 },
      { kind: 'bramble', x: -14, z: -46 },
      { kind: 'bramble', x: 38, z: -34 },
      { kind: 'bramble', x: -2, z: 30 },

      // The millpond's reeds; the North End's washing and well.
      { kind: 'reeds', x: -90, z: -66 },
      { kind: 'reeds', x: -50, z: -62 },
      { kind: 'well', x: -14, z: -86 },
      { kind: 'washing', x: -14, z: -78, yaw: 0 },
      // Flour off the windmill.
      { kind: 'sacks', x: 62, z: -70 },
      { kind: 'haybale', x: 84, z: -90 },
      // The granary yards and the threshing floor.
      { kind: 'sacks', x: -90, z: -30 },
      { kind: 'cart', x: -78, z: -34 },
      { kind: 'haybale', x: -78, z: 6 },
      { kind: 'haybale', x: -74, z: 14 },
      // The fair green.
      { kind: 'barrel', x: 58, z: 76 },
      { kind: 'noticepost', x: 40, z: 72 },
    ],
    /**
     * The hub, populated as a hub.
     *
     * One on each of three of the four arms of the crossroads, so that whichever road the
     * player arrives on there is somebody on it before the junction.
     */
    npcs: [
      { id: 'millharrow_miller', x: 6, z: -10, art: 'miller', label: 'Talk to the miller' },
      { id: 'millharrow_farmer_wife', x: -10, z: 2, art: 'farmer_wife', label: 'Talk to the farmer' },
      { id: 'millharrow_baker', x: 14, z: 14, art: 'baker', label: 'Talk to the baker' },
      { id: 'millharrow_brewer', x: 2, z: -14, art: 'brewer_b', label: 'Talk to the brewer' },
      { id: 'millharrow_tollman', x: 10, z: -14, art: 'town_guard_b', label: 'Talk to the tollman' },
    ],
    /**
     * Who walks the row.
     *
     * No Magistracy man comes this far out. The tollman keeps the gate on the
     * crossroads and the lamps *are* the crossroads, so he does it himself.
     */
    lamplighter: 'millharrow_tollman',
    lamps: [
      { x: -2, z: -30 },
      { x: -2, z: -10 },
      { x: -2, z: 14 },
      { x: -2, z: 34 },
      { x: -26, z: -2 },
      { x: 22, z: -2 },
      // At each new road-head, so the way out shows after dark.
      { x: -10, z: -88 },
      { x: 6, z: -66 },
      { x: 6, z: 78 },
      { x: -100, z: -10 },
      { x: 100, z: -10 },
    ],
    crates: [
      { x: -26, z: -22 },
      { x: 30, z: -22 },
      { x: -34, z: 26 },
      { x: 30, z: 26 },
    ],
    trees: [
      { x: -50, z: -46 },
      { x: 46, z: -46 },
      { x: -50, z: 46 },
      { x: 46, z: 46 },
      // The orchards, in their rows.
      { x: -110, z: 70 },
      { x: -94, z: 70 },
      { x: -78, z: 70 },
      { x: -62, z: 70 },
      { x: -46, z: 70 },
      { x: -110, z: 82 },
      { x: -94, z: 82 },
      { x: -78, z: 82 },
      { x: -62, z: 82 },
      { x: -46, z: 82 },
    ],
    horizon: 'treeline',
    /**
     * The Scarecrow Men, out on the field edges after dark and never in the town: one crew walks
     * the hedge round windmill hill, the other the foot of the orchards.
     */
    packs: [
      {
        encounterId: 'pack_scarecrow_men',
        id: 'windmill_fields',
        x: 78,
        z: -62,
        roam: 6,
        hours: 'night',
        band: 'fields',
        behaviour: 'beat',
        route: [
          { x: 46, z: -98 },
          { x: 110, z: -98 },
          { x: 110, z: -62 },
          { x: 46, z: -62 },
        ],
      },
      {
        encounterId: 'pack_scarecrow_men',
        id: 'orchard_edge',
        x: -66,
        z: 94,
        roam: 6,
        hours: 'night',
        band: 'orchard',
        behaviour: 'beat',
        route: [
          { x: -110, z: 94 },
          { x: -22, z: 94 },
        ],
      },
    ],
    /** The windmill on its hill out in the strips, and the wheel turning in the race by the Mill. */
    landmarks: [
      { kind: 'windmill', x: 72, z: -80 },
      { kind: 'water_wheel', x: -26, z: -22 },
    ],
    vignettes: [
      { id: 'hay_yard', x: -80, z: 26 },
      { id: 'smithy_yard', x: 94, z: -14 },
      { id: 'grave_plot', x: 90, z: 36 },
      { id: 'market_corner', x: 70, z: 70 },
    ],
  },
});
