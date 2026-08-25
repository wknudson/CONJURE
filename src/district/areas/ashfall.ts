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
  '####################', // 19
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
  ],
  props: {
    doors: DOORS,
    /** The bounty board, on the plaza between the spawn and the cross-street. */
    board: { x: 12, z: 29 },
    /** The Dispatcher, close enough to the spawn to be the obvious first thing. */
    npcs: [{ id: 'vex', x: -2, z: 27 }],
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
      // approach once one exists, and ideally only appear late-campaign — the world does
      // not read campaign state yet.
      { text: "DON'T CARRY IT IN", wallX: EAST_X, wallZ: 15.95, dx: -3.2, facesSouth: false, tint: '#a4543a' },
    ],
    waterRows: WATER_ROWS,
    horizon: 'city',
  },
});
