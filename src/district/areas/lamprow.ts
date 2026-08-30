/**
 * Lamprow — the lighters' ward, where the lamps are lit and the tax is on the light.
 *
 * The first ward the campaign fights in (`lamprow_tithe`, `lamplighter_escort`,
 * `debt_collected_minor` are all set here) and the first place in the world where the two
 * halves of the street rule are visible at once: it keeps Ashfall's sanctioned pavement
 * *and* it has things roaming the ground either side of it.
 *
 * That combination is the reason the ward exists as walkable ground. Ashfall has a Warden
 * and no packs; the Verge has packs and no pavement; neither shows what the walkway is
 * actually worth. Here the High Street runs the width of the map with the Sink below it,
 * and both roam circles reach the curb — so a cone goes out the moment you step up onto the
 * flags, and comes back on the moment you step down.
 *
 * The lamps are all on walkway tiles, as they are in the ward. That is not decoration: the
 * light *is* the safe zone, and a lamp standing on danger ground would be the map telling a
 * lie the rules do not back.
 */

import { defineArea, type AreaDef, type TileDef } from '../map.js';

/**
 * Lamprow's legend — Ashfall's, unchanged.
 *
 *   S  sanctioned walkway  — SAFE, no Warden may see you here
 *   c  cobbles             — danger
 *   .  broken cobbles      — danger, weeds through the joints
 *   #  scrub verge         — danger
 *   W  the lighters' cut   — impassable
 *   B  building footprint  — impassable, tall
 *   V  yard wall           — impassable, low
 *
 * Deliberately identical to the ward's rather than a dialect of it. Two Jolrek wards should
 * be built out of the same materials; what differs between them is the plan, not the stone.
 */
const LAMPROW_LEGEND: Record<string, TileDef> = {
  S: { tex: 'sidewalk', safe: true, walk: true },
  c: { tex: 'cobble', safe: false, walk: true },
  '.': { tex: 'weeds', safe: false, walk: true },
  '#': { tex: 'grass', safe: false, walk: true },
  W: { tex: 'water', safe: false, walk: false },
  B: {
    tex: 'cobble',
    safe: false,
    walk: false,
    solid: { minHeight: 4.8, maxHeight: 7.0, inset: 0.3, depthInset: 0.3, chimneyChance: 0.4, split: true },
  },
  V: {
    tex: 'cobble',
    safe: false,
    walk: false,
    solid: { minHeight: 3.2, maxHeight: 3.2, inset: 0.1, depthInset: 1.6, chimneyChance: 0, split: false },
  },
};

/** Two tiles of the cut along the north edge, as the ward has its canal. */
const WATER_ROWS = 2;

/**
 * 22 wide by 20 deep — a little oblong, on purpose.
 *
 * The extra pair of columns is what lets the High Street run the full width with a mouth at
 * each end and still leave the Sink room to hold two roam circles that overlap.
 */
const GRID: readonly string[] = [
  'WWWWWWWWWWWWWWWWWWWWWW', //  0  the lighters' cut
  'WWWWWWWWWWWWWWWWWWWWWW', //  1
  '##cccccccccccccccccc##', //  2  the quay
  '#cccccccccccccccccccc#', //  3  the wharf lane
  '#ccBBBBBBBcccccccccc.#', //  4  west: the bonded warehouse   east: the lighters' yard
  '#ccBBBBBBBcccccccccc.#', //  5
  '#ccBBBBBBBcccccccccc.#', //  6
  '#cc.......cccccccccVV#', //  7  yard wall on the east corner
  '#cc......ccccBBBBBB..#', //  8  the back lane
  '#ccccccccccccBBBBBB..#', //  9
  'SSSSSSSSSSSSSSSSSSSSS#', // 10  THE HIGH STREET — lit, sanctioned, and open at both ends
  'SSSSSSSSSSSSSSSSSSSSS#', // 11
  '#cccccccccccccccccccc#', // 12  the step down
  '#ccBBBBB........BBBB.#', // 13  the Sink
  '#ccBBBBB........BBBB.#', // 14
  '#ccBBBBB.............#', // 15
  '#cc..................#', // 16
  '#cccccccccccccccccccc#', // 17  the south lane
  '##cccccccccccccccccc##', // 18
  '######################', // 19
];

export const LAMPROW_ID = 'lamprow';

export const LAMPROW: AreaDef = defineArea({
  id: LAMPROW_ID,
  name: 'Lamprow',
  grid: GRID,
  legend: LAMPROW_LEGEND,
  /**
   * On the High Street, and it has to be.
   *
   * A Warden's seizure puts you back at the last pavement you stood on, seeded from the
   * spawn — so an area with a patrol and an unsafe spawn would drop a seized player onto
   * danger ground and let the Warden take them again on the next frame.
   */
  spawn: { x: -26, z: 2 },
  safety: 'sidewalk',
  exits: [
    {
      // West along the High Street, back toward the ward. No gate: the frame `world.ts`
      // builds is an east-west wall, which is the wrong way round for a street running out
      // of the west edge — and a ward boundary you can simply walk is the truer reading
      // anyway. The Magistracy seals the yard, not the road between two of its own wards.
      to: 'ashfall_ward',
      x: -42,
      z: 4,
      label: 'The road back to Ashfall Ward',
      // Onto Ashfall's south plaza, a stride clear of its own gate hotspot.
      arrive: { x: 26, z: 32 },
    },
    {
      // East, up off the far end of the High Street. The lamp string stops at the ward line
      // and the dressed stone starts, which is the whole relationship between the two places.
      to: 'highcourt',
      x: 42,
      z: 2,
      label: 'Up to Highcourt',
      arrive: { x: -30, z: 2 },
    },
  ],
  props: {
    /** The lighting ward. Oil on the quay, a fire below the kerb, washing over the Sink. */
    dressing: [
      { kind: 'barrel', x: -42, z: -30 },
      { kind: 'barrel', x: 14, z: -30 },
      { kind: 'barrel', x: -22, z: -26 },
      { kind: 'barrel', x: 22, z: -26 },
      { kind: 'barrel', x: 14, z: -22 },
      { kind: 'barrel', x: 2, z: -18 },
      { kind: 'barrel', x: -38, z: -14 },
      { kind: 'washing', x: -42, z: -38, yaw: 0 },
      { kind: 'washing', x: -34, z: -26, yaw: 0 },
      { kind: 'washing', x: -22, z: -14, yaw: 0 },
      { kind: 'washing', x: -22, z: -2, yaw: 0 },
      { kind: 'washing', x: 30, z: 14, yaw: 0 },
      { kind: 'washing', x: -30, z: 30, yaw: 0 },
      { kind: 'brazier', x: -42, z: 14 },
      { kind: 'brazier', x: -38, z: 26 },
      { kind: 'brazier', x: -6, z: 30 },
      { kind: 'brazier', x: 18, z: 34 },
      { kind: 'bollard', x: -38, z: -30 },
      { kind: 'bollard', x: 18, z: -30 },
      { kind: 'bollard', x: -18, z: -26 },
      { kind: 'bollard', x: 30, z: -26 },
      { kind: 'bollard', x: 18, z: -22 },
      { kind: 'bollard', x: 10, z: -18 },
      { kind: 'bollard', x: -34, z: -14 },
    ],
    /**
     * The ward, on its own flags.
     *
     * All three stand on the lit High Street rather than in the Sink below it, which is the
     * only honest place to put them: the pavement is the thing Lamprow pays for, and people
     * stand on what they have paid for.
     */
    npcs: [
      { id: 'lamprow_pit_miner', x: -10, z: 2, art: 'miner_b', label: 'Talk to the pit hand' },
      { id: 'lamprow_tithe_clerk', x: 6, z: 2, art: 'tax_collector', label: 'Talk to the tithe clerk' },
      { id: 'lamprow_lamplighter', x: 22, z: 2, art: 'night_watchman', label: 'Talk to the lamplighter' },
      { id: 'lamprow_urchin', x: -14, z: 6, art: 'street_urchin', label: 'Talk to the urchin' },
      { id: 'lamprow_butcher', x: -6, z: 6, art: 'butcher_b', label: 'Talk to the butcher' },
    ],
    /**
     * The Warden's beat, clockwise around the lighters' yard.
     *
     * Every corner is on cobbles rather than on flags. A patrol that walked the walkway
     * would spend its life somewhere it is forbidden to see you, which is a beat with no
     * teeth and no lesson.
     */
    patrols: [
      [
        { x: 2, z: -22 },
        { x: 30, z: -22 },
        { x: 30, z: -14 },
        { x: 2, z: -14 },
      ],
    ],
    /**
     * The Sink's two crews.
     *
     * Homes sit on broken ground below the step, and both roam circles reach up over the
     * curb at z = 8 — which is the whole point of putting packs in a ward that has pavement.
     * Their circles also overlap each other (10.2 apart against 14 of reach), so the ring
     * can pull one into the other's fight.
     */
    packs: [
      { encounterId: 'pack_lamprow_gutter_crew', x: 0, z: 12, roam: 7 },
      { encounterId: 'pack_lamprow_tithe_takers', x: 10, z: 14, roam: 7 },
    ],
    /** The lamps the ward is named for — every one of them on the flags. */
    lamps: [
      { x: -34, z: 6 },
      { x: -22, z: 6 },
      { x: -10, z: 6 },
      { x: 2, z: 6 },
      { x: 14, z: 6 },
      { x: 26, z: 6 },
      { x: 34, z: 6 },
    ],
    /** Spill from the Sink, kept off the line between the spawn and the way out. */
    crates: [
      { x: -6, z: 20 },
      { x: 6, z: 24 },
      { x: 18, z: 20 },
    ],
    /** Along the cut, where the lighters tie up. */
    trees: [
      { x: -30, z: -30 },
      { x: -14, z: -30 },
      { x: 10, z: -30 },
      { x: 26, z: -30 },
    ],
    /** What a ward taxed for its own light writes on the walls of the quarter that pays. */
    graffiti: [
      { text: 'PAY FOR YOUR OWN DARK', wallX: 22, wallZ: 10.05, dx: -3.2, facesSouth: false, tint: '#a46a4a' },
      { text: 'THE LAMPS ARE NOT FOR US', wallX: -22, wallZ: 10.05, dx: 3.0, facesSouth: false, tint: '#b7ae9d' },
    ],
    waterRows: WATER_ROWS,
    horizon: 'city',
  },
});
