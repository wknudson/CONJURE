/**
 * Ashfall Ward — the hub, as one grid of characters.
 *
 * Everything here was `map.ts` until the wildlands needed a grid of their own. The content
 * moved and the machinery stayed; see `../map.ts` for what an area *is*.
 *
 * Thirty by twenty-eight now, up from twenty square, and the growth is quarters rather than
 * more of the same street. North to south: the canal and its wharf, with the Toll House at
 * the west end; the Magistracy's sealed yard and the Counting House inside it; the two yards
 * -- the warehouse yard the Warden walks and the back alley -- either side of the north
 * walkway; the cross-street with its four trades, each a room now; the plaza with the board,
 * a market corner and the well; and below it the Chapel of the Quiet Flame with its graves
 * on one side and the Cinder Cup with its yard on the other, the south road between them
 * running down to the Lamprow gate.
 *
 * The four trades still sit on the cross-street, two facing north and two facing south, so a
 * new Commander can walk the entire guided lap without once stepping off the pavement --
 * into every room and back out again. Leaving the flags is a choice they make, which is the
 * only way the rule teaches.
 */

import { TILE, defineArea, type AreaDef, type TileDef } from '../map.js';

/**
 * The ward's legend.
 *
 *   S  sanctioned walkway  — SAFE, no Warden may see you here
 *   c  cobbles             — danger
 *   .  broken cobbles      — danger, weeds through the joints
 *   #  scrub verge         — danger
 *   W  canal               — impassable
 *   B  building footprint  — impassable, tall
 *   V  yard wall           — impassable, low
 *   T  the Toll House      — impassable; brick, a stack
 *   C  the Counting House  — impassable; dressed stone, taller than its neighbours
 *   K  the chapel          — impassable; stone, one unbroken mass
 *   U  the Cinder Cup      — impassable; timber over plaster, a chimney always going
 *
 * `B` and `V` carry their own heights, and so do the four named buildings: a chapel that was
 * split into two-tile pieces would read as a row of sheds, and a tavern with the terrace's
 * brick would not read as a tavern from the plaza.
 */
const WARD_LEGEND: Record<string, TileDef> = {
  S: { tex: 'sidewalk', safe: true, walk: true },
  c: { tex: 'cobble', safe: false, walk: true },
  '.': { tex: 'weeds', safe: false, walk: true },
  '#': { tex: 'grass', safe: false, walk: true },
  W: { tex: 'water', safe: false, walk: false },
  B: {
    tex: 'cobble',
    safe: false,
    walk: false,
    // A terrace, split into two- and three-tile pieces so the skyline has a silhouette.
    solid: { minHeight: 4.8, maxHeight: 7.0, inset: 0.3, depthInset: 0.3, chimneyChance: 0.4, split: true },
  },
  V: {
    tex: 'cobble',
    safe: false,
    walk: false,
    // The Magistracy's seal across the yard: low, unbroken, and taken whole rather than
    // split — a wall with a skyline would read as a row of sheds.
    solid: { minHeight: 3.2, maxHeight: 3.2, inset: 0.1, depthInset: 1.6, chimneyChance: 0, split: false },
  },
  T: {
    tex: 'cobble',
    safe: false,
    walk: false,
    solid: { minHeight: 5.6, maxHeight: 5.6, inset: 0.3, depthInset: 0.3, chimneyChance: 1, split: false },
  },
  C: {
    tex: 'cobble',
    safe: false,
    walk: false,
    solid: { minHeight: 7.6, maxHeight: 7.6, inset: 0.3, depthInset: 0.3, chimneyChance: 0, split: false, wall: 'stone' },
  },
  K: {
    tex: 'cobble',
    safe: false,
    walk: false,
    solid: { minHeight: 6.8, maxHeight: 6.8, inset: 0.2, depthInset: 0.2, chimneyChance: 0, split: false, wall: 'stone' },
  },
  U: {
    tex: 'cobble',
    safe: false,
    walk: false,
    solid: { minHeight: 5.4, maxHeight: 5.4, inset: 0.3, depthInset: 0.3, chimneyChance: 1, split: false, wall: 'timber' },
  },
};

/** Two tiles of canal along the north edge. */
const WATER_ROWS = 2;

const C13 = 'c'.repeat(13);

const GRID: readonly string[] = [
  'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWW', //  0  the canal
  'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWW', //  1
  '#cccccccccccccccccccccccccccc#', //  2  the wharf
  '#cTTTTcc..............ccBBBcc#', //  3  TOLL HOUSE (west)   the sealed yard   the boathouse (east)
  '#cTTTTcc..............ccBBBcc#', //  4
  '#ccccccc..............ccccccc#', //  5  the quay road, and the Toll House door
  '#VVVVVVVVVVVVVVVVVVVVVVVVVVVV#', //  6  the yard wall — a gate in it, and the road to the Verge
  `#${C13}SS${C13}#`, //  7  the cart lane, west to the Cinderworks
  '#cBBBBBBBBccccSSccccBBBBBBBBc#', //  8  the north blocks
  '#c........ccccSScccc........c#', //  9  west: the warehouse yard (the Warden)   east: the back alley
  '#c.CCCC...ccccSScccc........c#', // 10  COUNTING HOUSE, inside the yard
  '#c.CCCC...ccccSScccc........c#', // 11
  '#c........ccccSScccc........c#', // 12
  '#cBBBBBBBBccccSSccccBBBBBBBBc#', // 13  IRONWORKS (west)          RECORDS OFFICE (east)
  '#cBBBBBBBBccccSSccccBBBBBBBBc#', // 14
  '#SSSSSSSSSSSSSSSSSSSSSSSSSSSS#', // 15  the cross-street
  '#SSSSSSSSSSSSSSSSSSSSSSSSSSSS#', // 16
  '#cBBBBBBBBccSSSSSSccBBBBBBBBc#', // 17  APOTHECARY (west)         VIVARIUM (east)
  '#cBBBBBBBBccSSSSSSccBBBBBBBBc#', // 18
  '#cccccSSSSSSSSSSSSSSSSSSccccc#', // 19  the plaza
  '#cccccSSSSSSSSSSSSSSSSSSccccc#', // 20
  '#cccccSSSSSSSSSSSSSSSSSSccccc#', // 21  west lane to Ward Seven
  '#cccccSSSSSSSSSSSSSSSSSSccccc#', // 22
  '#cccccKKKKKcSSSSSScUUUUUccccc#', // 23  THE CHAPEL      the south road      THE CINDER CUP
  '#cccccKKKKKcSSSSSScUUUUUccccc#', // 24
  '#c.........cSSSSSSc.........c#', // 25  the graves                           the tavern yard
  '#c.........cSSSSSSc.........c#', // 26
  '#VVVVVVVVVVVVVVVVVVVVVVVVVVVV#', // 27  the south wall, and the gate to Lamprow
];

/** Half the ward's span, for writing positions in world units below. */
const HALF_X = (GRID[0]!.length * TILE) / 2;
const HALF_Z = (GRID.length * TILE) / 2;
const xOfCol = (col: number): number => col * TILE - HALF_X + TILE / 2;
const zOfRow = (row: number): number => row * TILE - HALF_Z + TILE / 2;

const WEST_X = xOfCol(5.5); // -36, the middle of both west blocks
const EAST_X = xOfCol(23.5); // 36, the middle of both east blocks

/**
 * North-side doors sit at the south face of the row-14 buildings (z = 4); south-side doors
 * at the north face of the row-17 buildings (z = 12). The player stands a stride into the
 * street from each. They are exits into rooms -- see the `door` entries below.
 */
const NORTH_FACE = zOfRow(14) + TILE / 2 + 0.05; // 4.05
const SOUTH_FACE = zOfRow(17) - TILE / 2 - 0.05; // 11.95

/** The gate in the yard wall. The player stands south of it to read the prompt. */
export const GATE_POS = { x: 0, z: zOfRow(6) } as const;
/** The gate in the south wall, to Lamprow. */
const SOUTH_GATE = { x: 0, z: zOfRow(27) } as const;

export const ASHFALL_ID = 'ashfall_ward';

export const ASHFALL: AreaDef = defineArea({
  id: ASHFALL_ID,
  name: 'Ashfall Ward',
  grid: GRID,
  legend: WARD_LEGEND,
  /** The plaza, in sight of the Dispatcher. */
  spawn: { x: 0, z: 26 },
  safety: 'sidewalk',
  exits: [
    {
      to: 'chalk_verge',
      x: GATE_POS.x,
      z: GATE_POS.z + 2.4,
      label: 'Take the road past the gate',
      // The yard wall itself, north of where you stand to read it.
      gate: { x: GATE_POS.x, z: GATE_POS.z },
      // Onto the verge's trailhead, north of its own gate hotspot so stepping through does
      // not immediately offer to send you back.
      arrive: { x: 34, z: 22 },
    },
    {
      // South out of the plaza and down the road, into Lamprow. A second sealed crossing rather
      // than an open one: this is still the Magistracy's ground on both sides, and the wall it
      // is cut through is the same argument the yard wall makes.
      to: 'lamprow',
      x: SOUTH_GATE.x,
      z: SOUTH_GATE.z - 2.4,
      label: 'Through the south gate to Lamprow',
      gate: { x: SOUTH_GATE.x, z: SOUTH_GATE.z },
      // Onto Lamprow's High Street, a stride clear of its own way back.
      arrive: { x: -36, z: 4 },
    },
    {
      // East, off the cross-street into the Bonemarket. Gateless, like every crossing inside
      // the city: a gate is the Magistracy sealing something, and it does not seal a market.
      to: 'bonemarket',
      x: HALF_X - 2,
      z: zOfRow(15),
      label: 'East into the Bonemarket',
      arrive: { x: -38, z: 2 },
    },
    {
      // West, down the cart lane along the yard wall to the works. The ward is named for what
      // blows back up it.
      to: 'cinderworks',
      x: -HALF_X + 2,
      z: zOfRow(7),
      label: 'West, down the cart lane to the Cinderworks',
      arrive: { x: 42, z: 2 },
    },
    {
      // West again, off the plaza's lane. Two ways off the same edge, because Ward Seven is not
      // somewhere the ward would put on the same road as its foundry.
      to: 'ward_seven',
      x: -HALF_X + 2,
      z: zOfRow(21),
      label: 'West into Ward Seven',
      arrive: { x: 34, z: 6 },
    },

    /* --- the four doors on the cross-street ---
       Each one opens onto a floor now rather than a menu: the Ironworks and the Records
       Office on the north side, the Apothecary and the Vivarium on the south. The hotspot is
       a stride into the street from the face, and the leaf and the plaque hang on the face
       itself. Every arrival inside is a stride clear of the room's own way back out. */
    {
      to: 'ashfall_ironworks',
      x: WEST_X,
      z: NORTH_FACE + 1.35,
      label: 'Into the Ironworks Artificer',
      door: { x: WEST_X, z: NORTH_FACE, facesSouth: true, sign: 'artificer' },
      arrive: { x: 0, z: 22 },
    },
    {
      to: 'ashfall_records',
      x: EAST_X,
      z: NORTH_FACE + 1.35,
      label: 'Into the Records Office',
      door: { x: EAST_X, z: NORTH_FACE, facesSouth: true, sign: 'records', style: 'arch' },
      arrive: { x: 0, z: 18 },
    },
    {
      to: 'ashfall_apothecary',
      x: WEST_X,
      z: SOUTH_FACE - 1.35,
      label: 'Into the Apothecary',
      door: { x: WEST_X, z: SOUTH_FACE, facesSouth: false, sign: 'apothecary' },
      arrive: { x: -4, z: -18 },
    },
    {
      to: 'ashfall_vivarium',
      x: EAST_X,
      z: SOUTH_FACE - 1.35,
      label: 'Into the Vivarium',
      door: { x: EAST_X, z: SOUTH_FACE, facesSouth: false, sign: 'vivarium', style: 'iron' },
      arrive: { x: -4, z: -18 },
    },

    /* --- the other doors --- */
    {
      // The wharf's toll house, at the west end of the quay road. Not on the pavement: the
      // Magistracy collects its dues on ground it does not warrant.
      to: 'ashfall_toll_house',
      x: xOfCol(3.5),
      z: zOfRow(4) + TILE / 2 + 1.4,
      label: 'Into the Toll House',
      door: { x: xOfCol(3.5), z: zOfRow(4) + TILE / 2 + 0.05, facesSouth: true, sign: 'toll' },
      arrive: { x: 0, z: 16 },
    },
    {
      // The Counting House, inside the Warden's yard and sealed until the ward has seen you
      // serve a writ. Shown boarded from the first visit: a door you cannot see is a door you
      // cannot learn to come back to.
      to: 'ashfall_counting_house',
      x: xOfCol(4.5),
      z: zOfRow(11) + TILE / 2 + 1.4,
      label: 'Into the Counting House',
      door: { x: xOfCol(4.5), z: zOfRow(11) + TILE / 2 + 0.05, facesSouth: true, sign: 'counting', style: 'iron' },
      when: { after: ['curfew_breakers'] },
      lockedReason: 'Sealed by the Magistracy until a writ has been served in this ward.',
      arrive: { x: 0, z: 16 },
    },
    {
      to: 'ashfall_chapel',
      x: xOfCol(8),
      z: zOfRow(23) - TILE / 2 - 1.4,
      label: 'Into the Chapel of the Quiet Flame',
      door: { x: xOfCol(8), z: zOfRow(23) - TILE / 2 - 0.05, facesSouth: false, sign: 'chapel', style: 'arch' },
      arrive: { x: 0, z: -20 },
    },
    {
      to: 'ashfall_cinder_cup',
      x: xOfCol(21),
      z: zOfRow(23) - TILE / 2 - 1.4,
      label: 'Into the Cinder Cup',
      door: { x: xOfCol(21), z: zOfRow(23) - TILE / 2 - 0.05, facesSouth: false, sign: 'tavern' },
      arrive: { x: 0, z: -20 },
    },
  ],
  props: {
    /** The ward is named for what falls on it. Rats in the yards, rooks over the terraces, gulls on the canal. */
    sky: 'ash',
    wildlife: [
      { kind: 'rat', x: -26, z: -8, roam: 5, count: 2 },
      { kind: 'rat', x: 40, z: -12, roam: 5, count: 2 },
      { kind: 'rat', x: -30, z: 50, roam: 4, count: 2 },
      { kind: 'rook', x: -20, z: -36, roam: 24, count: 4 },
      { kind: 'rook', x: 30, z: -30, roam: 22, count: 3 },
      { kind: 'gull', x: 10, z: -50, roam: 20, count: 3 },
    ],
    /**
     * The hub, kept working, and composed rather than scattered: the wharf has its bollards
     * and its freight, the yards have their stores, the plaza has a market corner and a well,
     * the graves have their stones and the tavern has its yard.
     */
    dressing: [
      // The wharf.
      { kind: 'bollard', x: -50, z: -46 },
      { kind: 'bollard', x: -42, z: -46 },
      { kind: 'bollard', x: -34, z: -46 },
      { kind: 'bollard', x: -26, z: -46 },
      { kind: 'bollard', x: 34, z: -46 },
      { kind: 'bollard', x: 42, z: -46 },
      { kind: 'bollard', x: 50, z: -46 },
      { kind: 'barrel', x: -14, z: -46 },
      { kind: 'barrel', x: -10, z: -46 },
      { kind: 'sacks', x: 46, z: -34 },
      { kind: 'rack', x: 54, z: -38 },
      { kind: 'cart', x: -6, z: -42 },
      // The warehouse yard, kept clear of the Warden's beat; the spoil heap in the side lane.
      { kind: 'barrel', x: -30, z: -10 },
      { kind: 'spoilheap', x: -12, z: -10 },
      // The back alley.
      { kind: 'washing', x: 30, z: -14, yaw: 0 },
      { kind: 'washing', x: 46, z: -10, yaw: 0 },
      { kind: 'washing', x: 38, z: -4, yaw: 0 },
      { kind: 'barrel', x: 26, z: -16 },
      { kind: 'barrel', x: 50, z: -16 },
      { kind: 'brazier', x: 34, z: -13 },
      // The cross-street's corners.
      { kind: 'brazier', x: -52, z: 10 },
      { kind: 'brazier', x: 52, z: 10 },
      // The plaza: a market corner by the board, the well, a cart in the west lane.
      { kind: 'awning', x: 16, z: 26.5, yaw: 0 },
      { kind: 'sacks', x: 20, z: 26 },
      { kind: 'barrel', x: 20, z: 30 },
      { kind: 'well', x: 0, z: 33 },
      { kind: 'cart', x: -48, z: 24 },
      // The graves.
      { kind: 'gravestone', x: -54, z: 47 },
      { kind: 'gravestone', x: -50, z: 51 },
      { kind: 'gravestone', x: -42, z: 47 },
      { kind: 'gravestone', x: -22, z: 51 },
      { kind: 'gravestone', x: -26, z: 47 },
      { kind: 'bramble', x: -36, z: 51.5 },
      { kind: 'bramble', x: -19, z: 51 },
      { kind: 'wildflowers', x: -52, z: 49 },
      { kind: 'wildflowers', x: -34, z: 47 },
      { kind: 'wildflowers', x: -24, z: 51.5 },
      // The tavern yard.
      { kind: 'logpile', x: 50, z: 50 },
      { kind: 'trough', x: 26, z: 48 },
      { kind: 'barrel', x: 46, z: 51 },
      { kind: 'barrel', x: 42, z: 51 },
    ],
    /** The bounty board, on the plaza's walkway between the spawn and the cross-street. */
    board: { x: 10, z: 21 },
    /**
     * The Dispatcher, and the people of the street.
     *
     * Vex is first and unchanged — no `art`, no `label`, no `says`, which is what the screen
     * reads as "this one is the Dispatcher" and draws from the hero bearings. Everybody on the
     * street stands on pavement, because everybody in Ashfall's guided lap is; the smith has
     * gone indoors to his forge, where he belongs.
     */
    npcs: [
      { id: 'vex', x: -6, z: 24 },
      { id: 'ashfall_gate_guard', x: 6, z: 48, art: 'town_guard', label: 'Talk to the gate sentry' },
      { id: 'ashfall_lamplighter', x: -2, z: 8, art: 'night_watchman', label: 'Talk to the lamplighter' },
      { id: 'ashfall_cobbler', x: -18, z: 30, art: 'cobbler', label: 'Talk to the cobbler' },
      { id: 'ashfall_crier', x: 18, z: 30, art: 'town_crier', label: 'Hear the crier' },
    ],
    /** The Warden's beat, clockwise around the warehouse yard and the Counting House in it. */
    patrols: [
      [
        { x: -48, z: -17 },
        { x: -22, z: -17 },
        { x: -22, z: -5 },
        { x: -48, z: -5 },
      ],
    ],
    /** Crates and clutter in the alley, clear of the Warden's rectangle so it never snags. */
    crates: [
      { x: 28, z: -6 },
      { x: 50, z: -5 },
    ],
    /**
     * Who walks the row, and the row he walks.
     *
     * Fourteen lamps, in the order he lights them: from the south gate up the road, across the
     * plaza, up the walkway, along the cross-street west to east, and up the north walkway to
     * the canal. Magistracy property, lit by a Magistracy man, on the ward that wrote the rule
     * about them — and every one on walkway tiles, because the light *is* the safe zone.
     */
    lamplighter: 'ashfall_lamplighter',
    lamps: [
      { x: -4, z: 50 },
      { x: 4, z: 42 },
      { x: -10, z: 36 },
      { x: 10, z: 36 },
      { x: -20, z: 22 },
      { x: 20, z: 22 },
      { x: -8, z: 16.7 },
      { x: 8, z: 16.7 },
      { x: -44, z: 8 },
      { x: -20, z: 8 },
      { x: 20, z: 8 },
      { x: 44, z: 8 },
      { x: -1, z: -4 },
      { x: 3, z: -20 },
    ],
    /** Darkened trees: one over the graves, one in the tavern yard, one on the east quay. */
    trees: [
      { x: -34, z: 51 },
      { x: 22, z: 51 },
      { x: 53, z: -42 },
    ],
    /*
     * What the ward writes on its own walls.
     *
     * Each line stands to one side of its door rather than across it: a leaf is drawn there,
     * from the ground to over head height, and text across a door reads as vandalism of the
     * door rather than of the wall. `dx` is the leaf's half-width plus the line's own, kept
     * inside the terrace it hangs on.
     */
    graffiti: [
      { text: 'ENGINES EAT MARROW', wallX: WEST_X, wallZ: NORTH_FACE, dx: 5.9, facesSouth: true, tint: '#b7ae9d' },
      { text: 'THE CENSUS COUNTS DOWN', wallX: EAST_X, wallZ: NORTH_FACE, dx: 7.0, facesSouth: true, tint: '#a46a4a' },
      { text: "VANE'S LIGHT IS OUR DARK", wallX: WEST_X, wallZ: SOUTH_FACE, dx: 7.5, facesSouth: false, tint: '#b7ae9d' },
      { text: 'THE QUOTA IS A NUMBER', wallX: EAST_X, wallZ: SOUTH_FACE, dx: 6.8, facesSouth: false, tint: '#a4543a' },
      // The alley's own opinion, on the back of the Records Office.
      { text: 'THE BAKER PAYS TWICE', wallX: EAST_X, wallZ: zOfRow(13) - TILE / 2, dx: 0, facesSouth: false, tint: '#8a7a6a' },
      // On the south wall, facing the plaza, for anyone about to leave.
      { text: 'THE GATE OPENS BOTH WAYS', wallX: 22, wallZ: zOfRow(27) - TILE / 2, dx: 0, facesSouth: false, tint: '#9a8a7a' },
    ],
    waterRows: WATER_ROWS,
    horizon: 'city',
  },
});
