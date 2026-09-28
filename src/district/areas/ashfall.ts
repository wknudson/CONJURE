/**
 * Ashfall Ward — the hub, as one grid of characters.
 *
 * Everything here was `map.ts` until the wildlands needed a grid of their own. The content
 * moved and the machinery stayed; see `../map.ts` for what an area *is*.
 *
 * Fifty-four by fifty, grown evenly on every side from thirty by twenty-eight so that nothing
 * already standing moved, and the growth is four quarters round the old ward rather than more
 * of the same street:
 *
 * - **Across the canal, the far bank.** The bonded warehouses with their backs to the edge and
 *   dead-end lanes between them, a customs square, a barge slip and the coal staithes, reached
 *   by the Ash Bridge in the middle and the tanners' footbridge at the east end.
 * - **West, the timber wharf and the Ropewalk.** The crane on the quay, the boat shed, and the
 *   long sheds the ward's rope is walked out in, with the ropemaker and the tar shed beside them.
 * - **East, off the cross-street, Tannery Row.** The tanneries round their pit yard, the Tannery
 *   itself (a room), and the Rookeries behind -- tenements, a court, lanes one tile wide. A
 *   second Warden walks the pits.
 * - **South, through the old wall, Chapel Hill and Ash Gardens.** The bell tower over the
 *   churchyard, the ossuary, the sexton; the allotments and their well; and the south road on
 *   down between them to the ward wall and the gate to Lamprow, which moved out with the edge.
 *
 * The old ward in the middle is as it was. North to south: the canal and its wharf, with the
 * Toll House at the west end; the Magistracy's sealed yard and the Counting House inside it;
 * the two yards -- the warehouse yard the Warden walks and the back alley -- either side of the
 * north walkway; the cross-street with its four trades, each a room; the plaza with the board,
 * a market corner and the well; and below it the Chapel of the Quiet Flame with its graves on
 * one side and the Cinder Cup with its yard on the other, the south road between them.
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
 * And the new quarters':
 *
 *   f  flagstone           — the customs square, the hide steps, the Ash Bridge
 *   e  planking            — the tanners' footbridge
 *   l  the Row's mud       — Tannery Row's lanes, and what is in them
 *   z  coal dust           — the staithes on the far bank
 *   h  churchyard turf     — Chapel Hill
 *   g  allotment beds      — Ash Gardens
 *   p  tanning pits        — impassable; sunk in the pit yard
 *   D  bonded warehouse    — impassable; brick, the Magistracy's seal on every door
 *   H  tannery             — impassable; timber, a chimney more often than not
 *   A  the Tannery         — impassable; the one with a door you can use
 *   R  tenement            — impassable; the Rookeries, timber and tall
 *   Q  the Ropewalk        — impassable; long, low sheds
 *   k  cottage             — impassable; the ropemaker, the sexton, the sheds
 *   O  the ossuary         — impassable; stone, windowless, full
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
    solid: { style: 'terrace', minHeight: 4.8, maxHeight: 7.0, inset: 0.3, depthInset: 0.3, chimneyChance: 0.4, split: true },
  },
  V: {
    tex: 'cobble',
    safe: false,
    walk: false,
    // The Magistracy's seal across the yard: low, unbroken, and taken whole rather than
    // split — a wall with a skyline would read as a row of sheds.
    solid: { style: 'wall', minHeight: 3.2, maxHeight: 3.2, inset: 0.1, depthInset: 1.6, chimneyChance: 0, split: false },
  },
  T: {
    tex: 'cobble',
    safe: false,
    walk: false,
    solid: { style: 'terrace', minHeight: 5.6, maxHeight: 5.6, inset: 0.3, depthInset: 0.3, chimneyChance: 1, split: false },
  },
  C: {
    tex: 'cobble',
    safe: false,
    walk: false,
    solid: { style: 'hall', minHeight: 7.6, maxHeight: 7.6, inset: 0.3, depthInset: 0.3, chimneyChance: 0, split: false, wall: 'stone' },
  },
  K: {
    tex: 'cobble',
    safe: false,
    walk: false,
    solid: { style: 'hall', minHeight: 6.8, maxHeight: 6.8, inset: 0.2, depthInset: 0.2, chimneyChance: 0, split: false, wall: 'stone' },
  },
  U: {
    tex: 'cobble',
    safe: false,
    walk: false,
    solid: { style: 'shopfront', minHeight: 5.4, maxHeight: 5.4, inset: 0.3, depthInset: 0.3, chimneyChance: 1, split: false, wall: 'timber' },
  },
  f: { tex: 'flagstone', safe: false, walk: true },
  e: { tex: 'planks', safe: false, walk: true },
  l: { tex: 'litter', safe: false, walk: true },
  z: { tex: 'slag', safe: false, walk: true },
  h: { tex: 'heath', safe: false, walk: true },
  g: { tex: 'field', safe: false, walk: true },
  p: { tex: 'water', safe: false, walk: false },
  D: {
    tex: 'cobble',
    safe: false,
    walk: false,
    solid: { style: 'warehouse', minHeight: 5.2, maxHeight: 6.6, inset: 0.3, depthInset: 0.3, chimneyChance: 0.1, split: true },
  },
  H: {
    tex: 'litter',
    safe: false,
    walk: false,
    solid: { style: 'warehouse', minHeight: 4.4, maxHeight: 5.4, inset: 0.3, depthInset: 0.3, chimneyChance: 0.7, split: true, wall: 'timber' },
  },
  A: {
    tex: 'litter',
    safe: false,
    walk: false,
    solid: { style: 'warehouse', minHeight: 5.4, maxHeight: 5.4, inset: 0.3, depthInset: 0.3, chimneyChance: 1, split: false, wall: 'timber' },
  },
  R: {
    tex: 'litter',
    safe: false,
    walk: false,
    solid: { style: 'terrace', minHeight: 5.4, maxHeight: 6.8, inset: 0.3, depthInset: 0.3, chimneyChance: 0.5, split: true, wall: 'timber' },
  },
  Q: {
    tex: 'weeds',
    safe: false,
    walk: false,
    solid: { style: 'warehouse', minHeight: 3.2, maxHeight: 3.6, inset: 0.3, depthInset: 0.3, chimneyChance: 0, split: true, wall: 'timber' },
  },
  k: {
    tex: 'grass',
    safe: false,
    walk: false,
    solid: { style: 'cottage', minHeight: 3.8, maxHeight: 4.4, inset: 0.3, depthInset: 0.3, chimneyChance: 0.9, split: true, wall: 'plaster' },
  },
  O: {
    tex: 'heath',
    safe: false,
    walk: false,
    solid: { style: 'hall', minHeight: 4.2, maxHeight: 4.2, inset: 0.2, depthInset: 0.2, chimneyChance: 0, split: false, wall: 'stone' },
  },
};

/**
 * Two tiles of canal, with the far bank above them now rather than the edge of the world: the
 * canal is a band from row eleven, and the Ash Bridge and the tanners' footbridge cross it.
 */
const WATER_ROWS = 2;
const WATER_ROW0 = 11;


const GRID: readonly string[] = [
  '#DDDDDDDccDDDDDDDcDDDDDDDDDDDDDDDDDDcDDDDDDDccDDDDDDD#', //  0  THE FAR BANK: the bonded warehouses, backs to the edge, dead-end lanes between
  '#DDDDDDDccDDDDDDDcDDDDDDDDDDDDDDDDDDcDDDDDDDccDDDDDDD#', //  1
  '#DDDDDDDccDDDDDDDcDDDDDDDDDDDDDDDDDDcDDDDDDDccDDDDDDD#', //  2
  '#DDDDDDDccDDDDDDDcDDDDDDDffffDDDDDDDcDDDDDDDccDDDDDDD#', //  3  the customs square, where the Ash Bridge comes over
  'cccccccccccccccccccccccccffffccccccccccccccccccccccccc', //  4  the back lane
  '........ccDDDDDDDcDDDDDDcffffcDDDDDDczzzzzzzcccDDDDDDc', //  5  the barge slip (west)          the bond          the coal staithes (east)
  '........ccDDDDDDDcDDDDDDcffffcDDDDDDczzzzzzzcccDDDDDDc', //  6
  '........ccDDDDDDDcDDDDDDcffffcDDDDDDczzzzzzzcccDDDDDDc', //  7
  '........cccccccccccccccccffffccccccccccccccccccccccccc', //  8  the far quay
  '........cccccccccccccccccffffccccccccccccccccccccccccc', //  9
  '........cccccccccccccccccccccccccccccccccccccccccccccc', // 10
  'WWWWWWWWWWWWWWWWWWWWWWWWWWffWWWWWWWWWWWWWWWWWWeeWWWWWW', // 11  the canal -- the Ash Bridge (middle), the tanners' footbridge (east)
  'WWWWWWWWWWWWWWWWWWWWWWWWWWffWWWWWWWWWWWWWWWWWWeeWWWWWW', // 12
  'cccccccccccc#cccccccccccccccccccccccccccc#cccccccccccc', // 13  the wharf
  '............#cTTTTcc..............ccBBBcc#ffffffffffff', // 14  the timber wharf    TOLL HOUSE   the sealed yard   the boathouse    the hide steps
  '.kkk........#cTTTTcc..............ccBBBcc#ffffffffffff', // 15  the boat shed
  '.kkk........#ccccccc..............ccccccc#llllllllllll', // 16  the quay road, and the Toll House door                  behind the tanneries
  '#############VVVVVVVVVVVVVVVVVVVVVVVVVVVV#HHHlHHHHlHHH', // 17  the yard wall -- a gate in it, and the road to the Verge
  'cccccccccccc#cccccccccccccSSccccccccccccc#HHHlHHHHlHHH', // 18  the cart lane, west to the Cinderworks
  '............#cBBBBBBBBccccSSccccBBBBBBBBc#llllllllllll', // 19  the north blocks                                        TANNERY ROW
  '.QQ.........#c........ccccSScccc........c#HHlppppplAAA', // 20  THE ROPEWALK   the warehouse yard (the Warden)   the back alley   the pits, THE TANNERY
  '.QQ.....kkk.#c.CCCC...ccccSScccc........c#HHlppppplAAA', // 21  the ropemaker   COUNTING HOUSE, inside the yard
  '.QQ.....kkk.#c.CCCC...ccccSScccc........c#HHllllllllll', // 22
  '.QQ.........#c........ccccSScccc........c#RRRlRRRRlRRR', // 23                                                          the tenements
  '.QQ.........#cBBBBBBBBccccSSccccBBBBBBBBc#RRRlRRRRlRRR', // 24  IRONWORKS (west)          RECORDS OFFICE (east)
  '.QQ.........#cBBBBBBBBccccSSccccBBBBBBBBc#llllllllllll', // 25
  '.QQ.........#SSSSSSSSSSSSSSSSSSSSSSSSSSSS#SSSSSSSSSSSS', // 26  the cross-street, on east to the Bonemarket
  '.QQ.........#SSSSSSSSSSSSSSSSSSSSSSSSSSSS#SSSSSSSSSSSS', // 27
  '.QQ.....kkk.#cBBBBBBBBccSSSSSSccBBBBBBBBc#RRRlRRRRlRRR', // 28  the tar shed    APOTHECARY (west)         VIVARIUM (east)    THE ROOKERIES
  '.QQ.....kkk.#cBBBBBBBBccSSSSSSccBBBBBBBBc#RRRlRRRRlRRR', // 29
  '.QQ.........#cccccSSSSSSSSSSSSSSSSSSccccc#lllllllllRRR', // 30  the plaza
  '............#cccccSSSSSSSSSSSSSSSSSSccccc#RRl.....lRRR', // 31                                                          the Rookery court
  'cccccccccccc#cccccSSSSSSSSSSSSSSSSSSccccc#RRl.....llll', // 32  the lane out to Ward Seven
  '#############cccccSSSSSSSSSSSSSSSSSSccccc#RRl.....lRRR', // 33
  '#...........#cccccKKKKKcSSSSSScUUUUUccccc#RRRRlRRRlRRR', // 34  the paupers' ground   THE CHAPEL   the south road   THE CINDER CUP
  '#...........#cccccKKKKKcSSSSSScUUUUUccccc#RRRRlRRRlRRR', // 35
  '#...........#c.........cSSSSSSc.........c#llllllllllll', // 36  the graves                           the tavern yard
  '#...........#c.........cSSSSSSc.........c#RRRRRRlRRRRR', // 37
  '#############VV..VVVVVVVSSSSSSVVVVVV..VVV#######l#####', // 38  the old south wall: the lych gap, the arch the road goes through, the garden gap
  '###############..#######SSSSSS########################', // 39  CHAPEL HILL (west)        the south road        ASH GARDENS (east)
  '#hhOOOOhhhhhhhh..hhhhhh#SSSSSS#ggg#ggg#ggg#ggg#ggg#kk#', // 40  the ossuary                                      the gardeners' shed
  '#hhOOOOhhhhhhhh..hhhhhh#SSSSSS#ggg#ggg#ggg#ggg#ggg#kk#', // 41
  '#hhhhhhhhhhhhhh..hhhhhh#SSSSSS########################', // 42
  '#hhhhhhhhhhhhhh..hhhhhh#SSSSSS#ggg#ggg#...#ggg#ggg#gg#', // 43
  '#.......................SSSSSS#ggg#ggg#...#ggg#ggg#gg#', // 44  the path across the hill
  '#hhhhhhhhhhhhhh..hhhhhh#SSSSSS########################', // 45
  '#hhhhhhhhhhhhhh..hkkkhh#SSSSSS#...#ggg#ggg#ggg#ggg#gg#', // 46  the sexton's cottage
  '#hhhhhhhhhhhhhh..hkkkhh#SSSSSS#...#ggg#ggg#ggg#ggg#gg#', // 47
  '########################SSSSSS########################', // 48
  'VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV', // 49  the ward wall, and the gate to Lamprow in it
];

/** Half the ward's span, for writing positions in world units below. */
const HALF_X = (GRID[0]!.length * TILE) / 2;
const HALF_Z = (GRID.length * TILE) / 2;
const xOfCol = (col: number): number => col * TILE - HALF_X + TILE / 2;
const zOfRow = (row: number): number => row * TILE - HALF_Z + TILE / 2;

const WEST_X = xOfCol(17.5); // -36, the middle of both west blocks
const EAST_X = xOfCol(35.5); // 36, the middle of both east blocks

/**
 * North-side doors sit at the south face of the row-25 buildings (z = 4); south-side doors
 * at the north face of the row-28 buildings (z = 12). The player stands a stride into the
 * street from each. They are exits into rooms -- see the `door` entries below.
 */
const NORTH_FACE = zOfRow(25) + TILE / 2 + 0.05; // 4.05
const SOUTH_FACE = zOfRow(28) - TILE / 2 - 0.05; // 11.95

/** The gate in the yard wall. The player stands south of it to read the prompt. */
export const GATE_POS = { x: 0, z: zOfRow(17) } as const;
/**
 * The gate to Lamprow, in the ward wall along the south edge. It was in the old south wall at
 * row thirty-eight; the ward grew past it, and the gate went out with the edge, so the road now
 * runs through an arch in the old wall and on past Chapel Hill before it leaves.
 */
const SOUTH_GATE = { x: 0, z: zOfRow(49) } as const;
/** The Tannery's door, on the south face of the one tannery with a door to use. */
const TANNERY_DOOR = { x: xOfCol(52), z: zOfRow(21) + TILE / 2 } as const;

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
      arrive: { x: 40, z: 30 },
    },
    {
      // South out of the plaza, through the arch in the old wall, down the road past Chapel Hill
      // and into Lamprow. A second sealed crossing rather than an open one: this is still the
      // Magistracy's ground on both sides, and the wall it is cut through is the same argument
      // the yard wall makes.
      to: 'lamprow',
      x: SOUTH_GATE.x,
      z: SOUTH_GATE.z - 2.4,
      label: 'Through the south gate to Lamprow',
      gate: { x: SOUTH_GATE.x, z: SOUTH_GATE.z },
      // Onto Lamprow's High Street, a stride clear of its own way back.
      arrive: { x: -88, z: -4 },
    },
    {
      // East, off the cross-street into the Bonemarket. Gateless, like every crossing inside
      // the city: a gate is the Magistracy sealing something, and it does not seal a market.
      to: 'bonemarket',
      x: HALF_X - 2,
      z: zOfRow(26),
      label: 'East into the Bonemarket',
      arrive: { x: -88, z: -8 },
    },
    {
      // West, down the cart lane along the yard wall to the works. The ward is named for what
      // blows back up it.
      to: 'cinderworks',
      x: -HALF_X + 2,
      z: zOfRow(18),
      label: 'West, down the cart lane to the Cinderworks',
      arrive: { x: 62, z: 0 },
    },
    {
      // West again, off the plaza's lane. Two ways off the same edge, because Ward Seven is not
      // somewhere the ward would put on the same road as its foundry.
      to: 'ward_seven',
      x: -HALF_X + 2,
      z: zOfRow(32),
      label: 'West into Ward Seven',
      arrive: { x: 54, z: -2 },
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
      x: xOfCol(15.5),
      z: zOfRow(15) + TILE / 2 + 1.4,
      label: 'Into the Toll House',
      door: { x: xOfCol(15.5), z: zOfRow(15) + TILE / 2 + 0.05, facesSouth: true, sign: 'toll' },
      arrive: { x: 0, z: 16 },
    },
    {
      // The Counting House, inside the Warden's yard and sealed until the ward has seen you
      // serve a writ. Shown boarded from the first visit: a door you cannot see is a door you
      // cannot learn to come back to.
      to: 'ashfall_counting_house',
      x: xOfCol(16.5),
      z: zOfRow(22) + TILE / 2 + 1.4,
      label: 'Into the Counting House',
      door: { x: xOfCol(16.5), z: zOfRow(22) + TILE / 2 + 0.05, facesSouth: true, sign: 'counting', style: 'iron' },
      when: { after: ['curfew_breakers'] },
      lockedReason: 'Sealed by the Magistracy until a writ has been served in this ward.',
      arrive: { x: 0, z: 16 },
    },
    {
      to: 'ashfall_chapel',
      x: xOfCol(20),
      z: zOfRow(34) - TILE / 2 - 1.4,
      label: 'Into the Chapel of the Quiet Flame',
      door: { x: xOfCol(20), z: zOfRow(34) - TILE / 2 - 0.05, facesSouth: false, sign: 'chapel', style: 'arch' },
      arrive: { x: 0, z: -20 },
    },
    {
      to: 'ashfall_cinder_cup',
      x: xOfCol(33),
      z: zOfRow(34) - TILE / 2 - 1.4,
      label: 'Into the Cinder Cup',
      door: { x: xOfCol(33), z: zOfRow(34) - TILE / 2 - 0.05, facesSouth: false, sign: 'tavern' },
      arrive: { x: 0, z: -20 },
    },
    {
      // Off the Row, through the pit yard's stink, into the one tannery that will have you.
      to: 'ashfall_tannery',
      x: TANNERY_DOOR.x,
      z: TANNERY_DOOR.z + 1.4,
      label: 'Into the Tannery',
      door: { x: TANNERY_DOOR.x, z: TANNERY_DOOR.z + 0.05, facesSouth: true, style: 'plank' },
      arrive: { x: 0, z: 14 },
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
      // The new quarters: rats in the bond and the Rookeries, rooks on the churchyard, and the
      // gulls that follow the barges up the canal to the far bank.
      { kind: 'rat', x: -30, z: -82, roam: 6, count: 2 },
      { kind: 'rat', x: 74, z: 46, roam: 4, count: 2 },
      { kind: 'rook', x: -60, z: 76, roam: 20, count: 4 },
      { kind: 'gull', x: 40, z: -58, roam: 24, count: 3 },
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

      // The far bank: bollards along the quay, freight outside the bond, the staithes' heaps,
      // and a keel laid down on the slip that nobody has come back to plank.
      { kind: 'bollard', x: -62, z: -57 },
      { kind: 'bollard', x: -42, z: -57 },
      { kind: 'bollard', x: -22, z: -57 },
      { kind: 'bollard', x: 18, z: -57 },
      { kind: 'bollard', x: 38, z: -57 },
      { kind: 'bollard', x: 62, z: -57 },
      { kind: 'bollard', x: 96, z: -57 },
      { kind: 'sacks', x: -30, z: -66 },
      { kind: 'barrel', x: -26, z: -66.5 },
      { kind: 'barrel', x: 14, z: -66 },
      { kind: 'sacks', x: 66, z: -66 },
      { kind: 'spoilheap', x: 46, z: -74 },
      { kind: 'spoilheap', x: 58, z: -72 },
      { kind: 'logpile', x: -96, z: -70 },
      { kind: 'deadfall', x: -86, z: -66 },
      { kind: 'workbench', x: -90, z: -74 },
      // The timber wharf and the Ropewalk.
      { kind: 'logpile', x: -94, z: -42 },
      { kind: 'logpile', x: -72, z: -38 },
      { kind: 'workbench', x: -78, z: -14 },
      { kind: 'barrel', x: -74, z: 10 },
      // The paupers' ground, west of the old graves.
      { kind: 'gravestone', x: -94, z: 40 },
      { kind: 'gravestone', x: -86, z: 44 },
      { kind: 'gravestone', x: -76, z: 40 },
      { kind: 'wildflowers', x: -80, z: 46 },
      { kind: 'bramble', x: -100, z: 46 },
      // Tannery Row: hides on the racks down the steps, and nothing left in the lanes the
      // Warden walks round the pits.
      { kind: 'rack', x: 70, z: -40 },
      { kind: 'rack', x: 78, z: -40 },
      { kind: 'rack', x: 90, z: -38 },
      { kind: 'barrel', x: 98, z: -38 },
      { kind: 'brazier', x: 100, z: -22.2 },
      // The Rookeries.
      { kind: 'washing', x: 74, z: 20, yaw: 0 },
      { kind: 'washing', x: 90, z: 46, yaw: 0 },
      { kind: 'barrel', x: 62, z: 46 },
      { kind: 'brazier', x: 66, z: 22 },
      // Chapel Hill.
      { kind: 'gravestone', x: -98, z: 64 },
      { kind: 'gravestone', x: -94, z: 82 },
      { kind: 'gravestone', x: -78, z: 82 },
      { kind: 'gravestone', x: -50, z: 66 },
      { kind: 'gravestone', x: -38, z: 86 },
      { kind: 'urn', x: -54, z: 68 },
      { kind: 'wildflowers', x: -66, z: 62 },
      { kind: 'bramble', x: -100, z: 88 },
      // Ash Gardens, and the gate.
      { kind: 'trough', x: 52, z: 58 },
      { kind: 'barrel', x: 94, z: 66 },
      { kind: 'wildflowers', x: 74, z: 58 },
      { kind: 'noticepost', x: 12, z: 94 },
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
      // At the gate, which went south with the edge; still on the road's pavement.
      { id: 'ashfall_gate_guard', x: 6, z: 92, art: 'town_guard', label: 'Talk to the gate sentry' },
      { id: 'ashfall_lamplighter', x: -2, z: 8, art: 'night_watchman', label: 'Talk to the lamplighter' },
      { id: 'ashfall_cobbler', x: -18, z: 30, art: 'cobbler', label: 'Talk to the cobbler' },
      { id: 'ashfall_crier', x: 18, z: 30, art: 'town_crier', label: 'Hear the crier' },
    ],
    /**
     * The Wardens' beats: clockwise around the warehouse yard and the Counting House in it, and
     * clockwise round Tannery Row's pit yard, down the lanes either side of it.
     */
    patrols: [
      [
        { x: -48, z: -17 },
        { x: -22, z: -17 },
        { x: -22, z: -5 },
        { x: -48, z: -5 },
      ],
      [
        { x: 70, z: -22 },
        { x: 94, z: -22 },
        { x: 94, z: -10 },
        { x: 70, z: -10 },
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
     * Twenty lamps, in the order he lights them: from the south gate up the road past Chapel
     * Hill, across the plaza, up the walkway, along the cross-street west to east and on to the
     * Bonemarket, and up the north walkway to the canal. Magistracy property, lit by a
     * Magistracy man, on the ward that wrote the rule about them — and every one on walkway
     * tiles, because the light *is* the safe zone.
     */
    lamplighter: 'ashfall_lamplighter',
    lamps: [
      { x: -4, z: 92 },
      { x: 4, z: 82 },
      { x: -4, z: 72 },
      { x: 4, z: 60 },
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
      { x: 68, z: 8 },
      { x: 92, z: 8 },
      { x: -1, z: -4 },
      { x: 3, z: -20 },
    ],
    /**
     * Darkened trees: one over the graves, one in the tavern yard, one on the east quay; yews on
     * Chapel Hill, and what was left standing when the gardens were dug.
     */
    trees: [
      { x: -34, z: 51 },
      { x: 22, z: 51 },
      { x: 53, z: -42 },
      { x: -98, z: 72 },
      { x: -62, z: 86 },
      { x: -26, z: 70 },
      { x: -66, z: 36 },
      { x: 58, z: 58 },
      { x: 94, z: 70 },
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
      { text: 'THE BAKER PAYS TWICE', wallX: EAST_X, wallZ: zOfRow(24) - TILE / 2, dx: 0, facesSouth: false, tint: '#8a7a6a' },
      // On the ward wall, facing the gardens and the road, for anyone about to leave.
      { text: 'THE GATE OPENS BOTH WAYS', wallX: 22, wallZ: zOfRow(49) - TILE / 2, dx: 0, facesSouth: false, tint: '#9a8a7a' },
      // The old south wall's back, seen from Chapel Hill.
      { text: 'THE WALL WAS HERE FIRST', wallX: -20, wallZ: zOfRow(38) + TILE / 2, dx: 0, facesSouth: true, tint: '#8a7a6a' },
      // On the bond, facing the customs square: the Magistracy's word for what is in it.
      { text: 'IN BOND', wallX: 2, wallZ: zOfRow(2) + TILE / 2, dx: 0, facesSouth: true, tint: '#a09080' },
    ],
    waterRows: WATER_ROWS,
    waterRow0: WATER_ROW0,
    horizon: 'city',
    /** The bell over Chapel Hill, which the whole south of the ward sets its clock by; the crane on the timber wharf. */
    landmarks: [
      { kind: 'bell_tower', x: -56, z: 74 },
      { kind: 'crane', x: -82, z: -45 },
    ],
    vignettes: [
      { id: 'grave_plot', x: -70, z: 82 },
      { id: 'grave_plot', x: -30, z: 66 },
      { id: 'grave_plot', x: -70, z: 60.5 },
      { id: 'grave_plot', x: -40, z: 60.5 },
      { id: 'grave_plot', x: -86, z: 88.4 },
      { id: 'washing_court', x: 82, z: 30 },
      { id: 'well_yard', x: 62, z: 70 },
      { id: 'broken_cart', x: 54, z: -62 },
      { id: 'market_corner', x: 84, z: 9.6 },
      { id: 'hay_yard', x: -86, z: 0 },
    ],
  },
});
