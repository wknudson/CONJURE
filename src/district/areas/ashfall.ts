/**
 * Ashfall Ward — the hub, as one grid of characters.
 *
 * Everything here was `map.ts` until the wildlands needed a grid of their own. The content
 * moved and the machinery stayed; see `../map.ts` for what an area *is*.
 *
 * The four trades sit on the cross-street (rows 12–13), two facing north and two facing
 * south, so a new Commander can walk the entire guided lap without once stepping off the
 * pavement. Leaving it is a choice they make, which is the only way the rule teaches.
 */

import { TILE, defineArea, type AreaDef, type DoorSpec, type TileDef } from '../map.js';

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
 *
 * `B` and `V` carry their own heights now. They were literals in `world.ts`, which made two
 * characters magic in a builder that otherwise reads the grid generically.
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
};

/** Two tiles of canal along the north edge. */
const WATER_ROWS = 2;

const GRID: readonly string[] = [
  'WWWWWWWWWWWWWWWWWWWW', //  0  the canal
  'WWWWWWWWWWWWWWWWWWWW', //  1
  '##cccccccccccccccc##', //  2  quay
  '##cccc......cccccc##', //  3  the sealed yard
  '##cccccccccccccccc##', //  4
  '##VVVVVVVVVVVVVVVV##', //  5  yard wall — now a gate, and the road past it
  '#cccccccccSSccccccc#', //  6
  '#ccBBBBBBcSScBBBBBB#', //  7
  '#cc......cSSc......#', //  8  west: warehouse yard (the Warden)   east: back alley
  '#cc......cSSc......#', //  9
  '#cc......cSSc......#', // 10
  '#ccBBBBBBcSScBBBBBB#', // 11  ARTIFICER (west)          FIELD JOURNAL (east)
  '#SSSSSSSSSSSSSSSSSS#', // 12  the cross-street
  '#SSSSSSSSSSSSSSSSSS#', // 13
  '#ccBBBBBBcSScBBBBBB#', // 14  APOTHECARY (west)         VIVARIUM (east)
  '#ccBBBBBBcSScBBBBBB#', // 15
  '#ccccccccSSSScccccc#', // 16
  '##cccccSSSSSSSScccc#', // 17  the plaza
  '###ccccSSSSSSSScc###', // 18
  '###VVVVVVVVVVVV#ccVV', // 19  the south wall, and the gate to Lamprow
];

/** Half the ward's span, for writing positions in world units below. */
const HALF = (GRID.length * TILE) / 2;
const xOfCol = (col: number): number => col * TILE - HALF + TILE / 2;
const zOfRow = (row: number): number => row * TILE - HALF + TILE / 2;

const WEST_X = xOfCol(5); // -18, the middle of both west blocks
const EAST_X = xOfCol(15); // 22, the middle of both east blocks

/**
 * North-side doors sit at the south face of the row-11 buildings (z = 8); south-side doors
 * at the north face of the row-14 buildings (z = 16). The player stands a stride into the
 * street from each.
 */
const DOORS: readonly DoorSpec[] = [
  { key: 'artificer', name: 'The Ironworks Artificer', x: WEST_X, z: 9.4, signX: WEST_X, signZ: 8.05, returnZ: 10.8 },
  { key: 'journal', name: 'The Field Journal', x: EAST_X, z: 9.4, signX: EAST_X, signZ: 8.05, returnZ: 10.8 },
  { key: 'apothecary', name: 'The Apothecary', x: WEST_X, z: 14.6, signX: WEST_X, signZ: 15.95, returnZ: 13.2 },
  { key: 'vivarium', name: 'The Vivarium', x: EAST_X, z: 14.6, signX: EAST_X, signZ: 15.95, returnZ: 13.2 },
];

/** The gate in the yard wall. The player stands south of it to read the prompt. */
export const GATE_POS = { x: 4, z: zOfRow(5) } as const;

export const ASHFALL_ID = 'ashfall_ward';

export const ASHFALL: AreaDef = defineArea({
  id: ASHFALL_ID,
  name: 'Ashfall Ward',
  grid: GRID,
  legend: WARD_LEGEND,
  /** The plaza, in sight of the Dispatcher. */
  spawn: { x: 4, z: 30 },
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
      // South out of the plaza, into Lamprow. A second sealed crossing rather than an open
      // one: this is still the Magistracy's ground on both sides, and the wall it is cut
      // through is the same argument the yard wall makes.
      to: 'lamprow',
      x: 26,
      z: 35.6,
      label: 'Through the south gate to Lamprow',
      // The wall on row 19, south of where you stand to read it — the orientation the gate
      // mesh is built for.
      gate: { x: 26, z: 38 },
      // Onto Lamprow's High Street, a stride clear of its own way back.
      arrive: { x: -36, z: 4 },
    },
    {
      // East, off the cross-street into the Bonemarket. Gateless, like every crossing inside
      // the city: a gate is the Magistracy sealing something, and it does not seal a market.
      to: 'bonemarket',
      x: 38,
      z: 10,
      label: 'East into the Bonemarket',
      arrive: { x: -38, z: 2 },
    },
    {
      // West, down the cart lane to the works. The ward is named for what blows back up it.
      to: 'cinderworks',
      x: -38,
      z: -2,
      label: 'West, down to the Cinderworks',
      arrive: { x: 42, z: 2 },
    },
    {
      // West again, further south. Two ways off the same edge, because Ward Seven is not
      // somewhere the ward would put on the same road as its foundry.
      to: 'ward_seven',
      x: -38,
      z: 26,
      label: 'West into Ward Seven',
      arrive: { x: 34, z: 6 },
    },
  ],
  props: {
    /** The hub, kept working: stores in the yard, washing over the terraces, a fire on the cross-street. */
    dressing: [
      { kind: 'barrel', x: -38, z: -30 },
      { kind: 'barrel', x: 10, z: -30 },
      { kind: 'barrel', x: -22, z: -26 },
      { kind: 'barrel', x: 22, z: -26 },
      { kind: 'barrel', x: -10, z: -22 },
      { kind: 'barrel', x: 38, z: -22 },
      { kind: 'barrel', x: -10, z: -14 },
      { kind: 'washing', x: -38, z: -38, yaw: 0 },
      { kind: 'washing', x: -18, z: -30, yaw: 0 },
      { kind: 'washing', x: 22, z: -22, yaw: 0 },
      { kind: 'washing', x: -14, z: -10, yaw: 0 },
      { kind: 'washing', x: -2, z: 2, yaw: 0 },
      { kind: 'washing', x: 6, z: 14, yaw: 0 },
      { kind: 'washing', x: 18, z: 26, yaw: 0 },
      { kind: 'brazier', x: -14, z: -14 },
      { kind: 'brazier', x: -2, z: -10 },
      { kind: 'brazier', x: 14, z: -6 },
      { kind: 'brazier', x: 14, z: -2 },
      { kind: 'cart', x: -34, z: -30 },
      { kind: 'cart', x: -34, z: -26 },
      { kind: 'cart', x: -30, z: -22 },
      { kind: 'cart', x: -38, z: -14 },
    ],
    doors: DOORS,
    /** The bounty board, on the plaza between the spawn and the cross-street. */
    board: { x: 12, z: 29 },
    /** The Dispatcher, close enough to the spawn to be the obvious first thing. */
    /**
     * The Dispatcher, and the sentry on the south gate.
     *
     * Vex is first and unchanged — no `art`, no `label`, no `says`, which is what the screen
     * reads as "this one is the Dispatcher" and draws from the hero bearings. The sentry is
     * on the last flagstone before the gate to Lamprow, and on pavement, because everybody in
     * Ashfall's guided lap is.
     */
    npcs: [
      { id: 'vex', x: -2, z: 27 },
      {
        id: 'ashfall_gate_guard',
        x: 18,
        z: 34,
        art: 'town_guard',
        label: 'Talk to the gate sentry',
      },
      { id: 'ashfall_smith', x: 2, z: 22, art: 'blacksmith', label: 'Talk to the smith' },
      { id: 'ashfall_cobbler', x: -2, z: 34, art: 'cobbler', label: 'Talk to the cobbler' },
    ],
    /** The Warden's beat, clockwise around the open warehouse yard. */
    patrols: [
      [
        { x: -24, z: -6 },
        { x: -8, z: -6 },
        { x: -8, z: 2 },
        { x: -24, z: 2 },
      ],
    ],
    /** Crates and clutter, kept clear of the Warden's patrol rectangle so it never snags. */
    crates: [
      { x: 19.5, z: -6.5 },
      { x: 25, z: 1.5 },
      { x: -6, z: -2 },
      { x: -26, z: -2 },
    ],
    /** Gas lamps, all on walkway tiles — the light *is* the safe zone, so it has to line up. */
    lamps: [
      { x: 0.7, z: -13 },
      { x: 7.3, z: -13 },
      { x: 0.7, z: -1 },
      { x: 7.3, z: -1 },
      { x: -16, z: 12.7 },
      { x: 16, z: 12.7 },
      { x: -4, z: 12.7 },
      { x: 28, z: 12.7 },
      { x: -8, z: 30 },
      { x: 16, z: 30 },
    ],
    /** Darkened trees along the canal bank. */
    trees: [
      { x: -30, z: -26 },
      { x: -24, z: -30 },
      { x: 26, z: -28 },
      { x: 32, z: -24 },
      { x: -34, z: -20 },
      { x: 34, z: -20 },
    ],
    /**
     * What the ward writes on its own walls.
     *
     * Anchored to explicit positions rather than to a door's index in `DOORS`. The old form
     * carried a `door: number` into `world.ts` and skipped silently when the index missed,
     * so a reordered door list would have quietly erased the graffiti rather than moved it.
     */
    graffiti: [
      { text: 'THE ENGINES EAT OUR MARROW', wallX: WEST_X, wallZ: 8.05, dx: 3.2, facesSouth: true, tint: '#b7ae9d' },
      { text: 'THE CENSUS COUNTS DOWN', wallX: EAST_X, wallZ: 8.05, dx: -3.4, facesSouth: true, tint: '#a46a4a' },
      { text: "VANE'S LIGHT IS OUR DARK", wallX: WEST_X, wallZ: 15.95, dx: 3.0, facesSouth: false, tint: '#b7ae9d' },
      // The last line before the Spire, per the doc: fresh paint on the wall nearest the
      // board that posts The Summons. TODO(worldbuild): should live on the Highcourt
      // approach — which exists now, `areas/highcourt.ts`, so that half of the wait is over
      // — and ideally only appear late-campaign, which is still blocked: the world does not
      // read campaign state.
      { text: "DON'T CARRY IT IN", wallX: EAST_X, wallZ: 15.95, dx: -3.2, facesSouth: false, tint: '#a4543a' },
    ],
    waterRows: WATER_ROWS,
    horizon: 'city',
  },
});
