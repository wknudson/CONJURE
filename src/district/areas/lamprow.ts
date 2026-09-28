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
 * and both roam circles reach the kerb — so a cone goes out the moment you step up onto the
 * flags, and comes back on the moment you step down.
 *
 * Forty-eight by forty, grown evenly from thirty-two by twenty-six, and the High Street runs
 * on to both new edges. North of the street: the cut and its quay, the bonded warehouse, the
 * Lamp-oil House the row is lit from, the lighters' yard the Warden walks with the Lighters'
 * Hall at the back of it, and the Tithe Office -- sealed until the tithe has been collected --
 * with its door on the flags. South of it: the Sink and its tenements, one of which has a hatch
 * down to the cellars where the count is kept; the south lane; and a quarter of lighters'
 * cottages with their gardens running to the verge.
 *
 * What the growth added: **across the cut, the gasworks** -- the retort house, the coal, the
 * holder yard with its gasholder, the purifiers and their spent lime -- which the Magistracy is
 * building so the High Street can be lit without lighters, and which the Wick-Thieves work at
 * night. **West, the chandlers**, round a yard a second Warden walks, and more cottages with
 * their gardens and allotments below them. **East, the lamp stores, and the ditches** where the
 * Sink drains: cuts across the ground, each open at one end or crossed by a board, running on
 * under the verge to the south edge, with the eel-catchers' sheds among them.
 *
 * The lamps are all on walkway tiles, as they are in the ward. That is not decoration: the
 * light *is* the safe zone, and a lamp standing on danger ground would be the map telling a
 * lie the rules do not back.
 */

import { TILE, defineArea, type AreaDef, type TileDef } from '../map.js';

/**
 * Lamprow's legend — Ashfall's, with two named buildings.
 *
 *   S  sanctioned walkway  — SAFE, no Warden may see you here
 *   c  cobbles             — danger
 *   .  broken cobbles      — danger, weeds through the joints
 *   #  scrub verge         — danger
 *   W  the lighters' cut   — impassable
 *   B  building footprint  — impassable, tall
 *   V  yard wall           — impassable, low
 *   O  the Lamp-oil House  — impassable; timber, a stack always going
 *   X  the Tithe Office    — impassable; dressed stone, like every Magistracy counter
 *   G  the gasworks        — impassable; brick, tall, and a stack on every roof
 *   k  cottage             — impassable; the lighters', the office, the sheds
 *   f  flagstone           — the holder yard, and the lighters' bridge
 *   z  coal                — the works' heap
 *   g  garden              — the cottage plots and the allotments
 *   d  drain               — impassable; the ditches the Sink runs out through
 *   e  a board             — over a drain, where somebody laid one
 *
 * Deliberately Ashfall's materials rather than a dialect of them. Two Jolrek wards should
 * be built out of the same stone; what differs between them is the plan.
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
    solid: { style: 'terrace', minHeight: 4.8, maxHeight: 7.0, inset: 0.3, depthInset: 0.3, chimneyChance: 0.4, split: true },
  },
  V: {
    tex: 'cobble',
    safe: false,
    walk: false,
    solid: { style: 'wall', minHeight: 3.2, maxHeight: 3.2, inset: 0.1, depthInset: 1.6, chimneyChance: 0, split: false },
  },
  O: {
    tex: 'cobble',
    safe: false,
    walk: false,
    solid: { style: 'warehouse', minHeight: 5.2, maxHeight: 5.2, inset: 0.3, depthInset: 0.3, chimneyChance: 1, split: false, wall: 'timber' },
  },
  X: {
    tex: 'cobble',
    safe: false,
    walk: false,
    solid: { style: 'hall', minHeight: 7.2, maxHeight: 7.2, inset: 0.3, depthInset: 0.3, chimneyChance: 0, split: false, wall: 'stone' },
  },
  G: {
    tex: 'cobble',
    safe: false,
    walk: false,
    solid: { style: 'warehouse', minHeight: 6.0, maxHeight: 6.8, inset: 0.3, depthInset: 0.3, chimneyChance: 1, split: true },
  },
  k: {
    tex: 'grass',
    safe: false,
    walk: false,
    solid: { style: 'cottage', minHeight: 3.8, maxHeight: 4.4, inset: 0.3, depthInset: 0.3, chimneyChance: 0.8, split: true, wall: 'brick' },
  },
  f: { tex: 'flagstone', safe: false, walk: true },
  z: { tex: 'slag', safe: false, walk: true },
  g: { tex: 'field', safe: false, walk: true },
  d: { tex: 'water', safe: false, walk: false },
  e: { tex: 'planks', safe: false, walk: true },
};

/** Two tiles of the cut, as the ward has its canal -- with the gasworks on the far side of it now. */
const WATER_ROWS = 2;
const WATER_ROW0 = 7;


const GRID: readonly string[] = [
  'VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV', //  0  THE GASWORKS: the works wall along the edge
  'ccGGGGGGGGGGGGcccckkkkccccffffffffffccGGGGGGGGcc', //  1  the retort house (west)   the office   the holder yard   the purifiers (east)
  'ccGGGGGGGGGGGGccccccccccccffffffffffccGGGGGGGGcc', //  2
  'ccGGGGGGGGGGGGccccccccccccffffffffffccGGGGGGGGcc', //  3
  'cczzzzzzzzzzzzccccccccccccffffffffffcc........cc', //  4  the coal                                                 the spent lime
  'cczzzzzzzzzzzzccccccccccccffffffffffcc........cc', //  5
  'cccccccccccccccccccccccccccccccccccccccccccccccc', //  6  the works quay
  'WWWWWWWWWWWWWWWWWWWWWWWWffWWWWWWWWWWWWWWWWWWWWWW', //  7  the lighters' cut -- the lighters' bridge across it
  'WWWWWWWWWWWWWWWWWWWWWWWWffWWWWWWWWWWWWWWWWWWWWWW', //  8
  'cccccccc#cccccccccccccccccccccccccccccc#cccccccc', //  9  the quay
  'cccccccc#cccccccccccccccccccccccccccccc#cccccccc', // 10  the wharf lane
  '#BBBBBB##cBBBBBBBBccOOOOccccccccBBBBBBc##BBBBBB#', // 11  the chandlers (west)   bonded warehouse   LAMP-OIL HOUSE   the yard   the Lighters' Hall   the lamp stores (east)
  '#BBBBBB##cBBBBBBBBccOOOOccccccccBBBBBBc##BBBBBB#', // 12
  '........#cBBBBBBBBcccccccccccccccccccVc##BBBBBB#', // 13  the chandlers' yard (the second Warden)   the lighters' yard (the Warden)
  '........#cc.......ccccccccccccccccccVVc#........', // 14
  '........#cc.......cccccccccccc........c#........', // 15  the back lane
  '#BBBBBB##cBBBBBBBBccXXXXXXccBBBBBBBBBBc##BBBBBB#', // 16  the north terraces, and THE TITHE OFFICE
  '#BBBBBB##cBBBBBBBBccXXXXXXccBBBBBBBBBBc##BBBBBB#', // 17
  'SSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSS', // 18  THE HIGH STREET — lit, sanctioned, and run on to both edges
  'SSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSS', // 19
  'cccccccc#cccccccccccccccccccccccccccccc#cccccccc', // 20  the step down
  '#kkk#kkk#cBBBBBB..............BBBBBBccc#........', // 21  cottages (west)   the Sink, and its tenements; the cellar hatch on the west one   THE DITCHES (east)
  '#kkk#kkk#cBBBBBB..............BBBBBBcccdddddddd.', // 22
  '#gggggg##cc...........................c#........', // 23
  '#gggggg##cc...........................cd.ddddddd', // 24
  'cccccccc#cccccccccccccccccccccccccccccc#........', // 25  the south lane
  '#kkkkkk##cccBBBBBBBBcccccccccBBBBBBBBccdddddddd.', // 26  the lighters' cottages
  '#kkkkkk##cccBBBBBBBBcccccccccBBBBBBBBcc#........', // 27
  '#gggggg##c...........cccccc...........cd.ddedddd', // 28  their gardens
  '#gggggg##c...........cccccc...........c#........', // 29
  'cccccccc#ccccccccccccccccccccccccccccccddddddd..', // 30
  '########################################........', // 31  the verge
  '#######################################d..dddddd', // 32
  '#####################...........................', // 33  the verge
  '#gggg#gggg#gggg#kkkkdd.ddddddd.ddddddd.ddddddd.d', // 34  the allotments and the potting shed (west)             where the Sink drains (east)
  '#gggg#gggg#gggg#kkkk#.......................kkk.', // 35
  '####################dddddd.ddddddd.dddeddd.ddddd', // 36
  '#gggg#gggg#gggg#gggg#..kkk......................', // 37
  '#gggg#gggg#gggg#ggggd.dddddddd.dddddddd.ddddddd.', // 38
  '#####################...........................', // 39
];

const HALF_X = (GRID[0]!.length * TILE) / 2;
const HALF_Z = (GRID.length * TILE) / 2;
const xOfCol = (col: number): number => col * TILE - HALF_X + TILE / 2;
const zOfRow = (row: number): number => row * TILE - HALF_Z + TILE / 2;

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
  spawn: { x: -52, z: -2 },
  safety: 'sidewalk',
  exits: [
    {
      // West along the High Street, back toward the ward. No gate: the frame `world.ts`
      // builds is an east-west wall, which is the wrong way round for a street running out
      // of the west edge — and a ward boundary you can simply walk is the truer reading
      // anyway. The Magistracy seals the yard, not the road between two of its own wards.
      to: 'ashfall_ward',
      x: -HALF_X + 4,
      z: -4,
      label: 'The road back to Ashfall Ward',
      // Onto Ashfall's south road, a stride clear of its own gate hotspot -- in the ward wall on
      // Ashfall's south edge now, past Chapel Hill.
      arrive: { x: 0, z: 92.4 },
    },
    {
      // East, up off the far end of the High Street. The lamp string stops at the ward line
      // and the dressed stone starts, which is the whole relationship between the two places.
      to: 'highcourt',
      x: HALF_X - 4,
      z: -4,
      label: 'Up to Highcourt',
      arrive: { x: -78, z: 0 },
    },
    {
      // The oil store the row is lit from, off the lane behind the quay.
      to: 'lamprow_oil_house',
      x: xOfCol(21.5),
      z: zOfRow(12) + TILE / 2 + 1.4,
      label: 'Into the Lamp-oil House',
      door: { x: xOfCol(21.5), z: zOfRow(12) + TILE / 2 + 0.05, facesSouth: true, sign: 'lamp' },
      arrive: { x: 0, z: 16 },
    },
    {
      // The Tithe Office, on the flags, and sealed until the tithe has been collected: the
      // Magistracy does not open its books to a Whisperer it has not yet paid.
      to: 'lamprow_tithe_office',
      x: xOfCol(22.5),
      z: zOfRow(17) + TILE / 2 + 1.4,
      label: 'Into the Tithe Office',
      door: { x: xOfCol(22.5), z: zOfRow(17) + TILE / 2 + 0.05, facesSouth: true, sign: 'counting', style: 'iron' },
      when: { after: ['lamprow_tithe'] },
      lockedReason: 'The office opens when the tithe has been collected. Ask the clerk which of you that is.',
      arrive: { x: 0, z: 16 },
    },
    {
      // A hatch on the west tenement, down to the cellars the Tithe-Takers count in. Off the
      // flags, below the kerb, and not a door the ward will admit to.
      to: 'lamprow_sink_cellars',
      x: xOfCol(12.5),
      z: zOfRow(22) + TILE / 2 + 1.4,
      label: 'Down the hatch to the Sink cellars',
      door: { x: xOfCol(12.5), z: zOfRow(22) + TILE / 2 + 0.05, facesSouth: true, style: 'hatch' },
      arrive: { x: 0, z: 16 },
    },
  ],
  props: {
    /**
     * Who passes through by day: the High Street and the lanes off it, gasworks shifts, the Sink
     * going up to market.
     */
    passersby: {
      peak: 6,
      folk: ['miner_a', 'tanner', 'seamstress', 'farmer_wife', 'cobbler_b', 'baker'],
      lanes: [
        [{ x: -95, z: -4 }, { x: 95, z: -4 }],
        [{ x: -60, z: 40 }, { x: 59, z: 40 }],
        [{ x: -46, z: 20 }, { x: 45, z: 20 }],
        [{ x: -40, z: -72 }, { x: 55, z: -72 }],
      ],
      barks: [
        "Gas is up again. It's always up.",
        "Keep off the Sink after dark, love.",
        "The tithe man's been round. Hide the good lamp.",
        "Somebody's been at the main again. Smell it?",
      ],
    },
    /** A canal ward. Gulls off the water, rats in the Sink and the gardens, rooks over both. */
    sky: 'ash',
    wildlife: [
      { kind: 'gull', x: -38, z: -46, roam: 22, count: 3 },
      { kind: 'gull', x: 20, z: -46, roam: 22, count: 3 },
      { kind: 'rat', x: -50, z: 14, roam: 5, count: 2 },
      { kind: 'rat', x: 44, z: 34, roam: 5, count: 2 },
      { kind: 'rat', x: -40, z: -18, roam: 4, count: 2 },
      { kind: 'rook', x: -18, z: -44, roam: 24, count: 3 },
      // In the ditches: rats on the banks, and a heron that has found the eel traps.
      { kind: 'rat', x: 80, z: 30, roam: 4, count: 2 },
      { kind: 'heron', x: 40, z: 70, roam: 6, count: 1 },
    ],
    /** The lighting ward. Oil on the quay, fires below the kerb, washing over the Sink. */
    dressing: [
      // The quay.
      { kind: 'bollard', x: -54, z: -42 },
      { kind: 'bollard', x: -42, z: -42 },
      { kind: 'bollard', x: -30, z: -42 },
      { kind: 'bollard', x: -18, z: -42 },
      { kind: 'bollard', x: -6, z: -42 },
      { kind: 'bollard', x: 6, z: -42 },
      { kind: 'bollard', x: 18, z: -42 },
      { kind: 'bollard', x: 30, z: -42 },
      { kind: 'bollard', x: 42, z: -42 },
      { kind: 'bollard', x: 54, z: -42 },
      { kind: 'barrel', x: -48, z: -38 },
      { kind: 'barrel', x: 36, z: -38 },
      { kind: 'barrel', x: 40, z: -38 },
      { kind: 'cart', x: -14, z: -38 },
      { kind: 'rack', x: 50, z: -38 },
      // The yard and the back lane.
      { kind: 'washing', x: -50, z: -18, yaw: 0 },
      { kind: 'washing', x: 40, z: -18, yaw: 0 },
      { kind: 'brazier', x: -36, z: -18 },
      // The High Street's ends.
      { kind: 'brazier', x: -56, z: -6 },
      { kind: 'brazier', x: 56, z: -6 },
      // The Sink.
      { kind: 'barrel', x: -20, z: 10 },
      { kind: 'washing', x: 20, z: 14, yaw: 0 },
      { kind: 'brazier', x: 30, z: 18 },
      // The south lane.
      { kind: 'brazier', x: -48, z: 22 },
      { kind: 'cart', x: 48, z: 22 },
      // The gardens.
      { kind: 'reeds', x: -52, z: 34 },
      { kind: 'reeds', x: -44, z: 38 },
      { kind: 'reeds', x: 52, z: 34 },
      { kind: 'wildflowers', x: -28, z: 36 },
      { kind: 'wildflowers', x: 36, z: 38 },
      { kind: 'haybale', x: 52, z: 38 },
      { kind: 'trough', x: -20, z: 38 },
      { kind: 'logpile', x: 28, z: 34 },

      // The gasworks: the coal heaped by the retorts, tar in barrels, the spent lime, the quay.
      { kind: 'spoilheap', x: -70, z: -60 },
      { kind: 'spoilheap', x: -54, z: -60 },
      { kind: 'cart', x: -30, z: -62 },
      { kind: 'barrel', x: 50, z: -66 },
      { kind: 'barrel', x: 50, z: -62 },
      { kind: 'spoilheap', x: 64, z: -60 },
      { kind: 'spoilheap', x: 80, z: -58 },
      { kind: 'bollard', x: -80, z: -53 },
      { kind: 'bollard', x: -60, z: -53 },
      { kind: 'bollard', x: -40, z: -53 },
      { kind: 'bollard', x: 20, z: -53 },
      { kind: 'bollard', x: 40, z: -53 },
      { kind: 'bollard', x: 60, z: -53 },
      { kind: 'bollard', x: 80, z: -53 },
      // The chandlers' yard, inside the second Warden's beat; the lamp stores' yard.
      { kind: 'workbench', x: -78, z: -22 },
      { kind: 'barrel', x: -84, z: -22 },
      { kind: 'washing', x: 80, z: -20, yaw: 0 },
      { kind: 'barrel', x: 90, z: -18 },
      // The trench for the gas main, dug along the step and not yet filled.
      { kind: 'spoilheap', x: -78, z: 2.2 },
      { kind: 'barrel', x: -70, z: 2 },
      // The ditches: reeds on the banks.
      { kind: 'reeds', x: 70, z: 6 },
      { kind: 'reeds', x: 86, z: 14 },
      { kind: 'reeds', x: 66, z: 30 },
      { kind: 'reeds', x: 90, z: 38 },
      { kind: 'reeds', x: 76, z: 46 },
      { kind: 'reeds', x: 30, z: 62 },
      { kind: 'reeds', x: 84, z: 70 },
      // The allotments.
      { kind: 'trough', x: -54, z: 54 },
      { kind: 'wildflowers', x: -34, z: 66 },
      { kind: 'wildflowers', x: -90, z: 38 },
    ],
    /**
     * The ward, on its own flags.
     *
     * Everybody on the street stands on the lit High Street rather than in the Sink below it,
     * which is the only honest place to put them: the pavement is the thing Lamprow pays for,
     * and people stand on what they have paid for. The oil keeper and the bailiff are indoors.
     */
    npcs: [
      { id: 'lamprow_pit_miner', x: -20, z: -6, art: 'miner_b', label: 'Talk to the pit hand' },
      {
        id: 'lamprow_tithe_clerk', x: 6, z: -6, art: 'tax_collector', label: 'Talk to the tithe clerk',
        // Collects on the High Street in the morning, at the works office in the afternoon, and
        // counts it on the High Street after.
        hours: [
          { from: 9, x: 6, z: -6 },
          { from: 14, x: -28, z: -62 },
          { from: 19, x: 6, z: -6 },
        ],
      },
      { id: 'lamprow_lamplighter', x: 26, z: -6, art: 'night_watchman', label: 'Talk to the lamplighter' },
      { id: 'lamprow_urchin', x: -30, z: -6, art: 'street_urchin', label: 'Talk to the urchin' },
      { id: 'lamprow_butcher', x: -8, z: -2, art: 'butcher_b', label: 'Talk to the butcher' },
      { id: 'lamprow_printer', x: -44, z: -6, art: 'scribe_scholar', label: 'Talk to the printer' },
      { id: 'lamprow_lighter_boy', x: 44, z: -2, art: 'child_beggar', label: "Talk to the lighter's boy" },
    ],
    /**
     * The Warden's beat, clockwise around the lighters' yard, in front of the Hall.
     *
     * Every corner is on cobbles rather than on flags. A patrol that walked the walkway
     * would spend its life somewhere it is forbidden to see you, which is a beat with no
     * teeth and no lesson.
     */
    patrols: [
      [
        { x: 6, z: -25 },
        { x: 30, z: -25 },
        { x: 30, z: -17 },
        { x: 6, z: -17 },
      ],
      // And round the chandlers' yard at the west end, where the ward keeps its wicks.
      [
        { x: -90, z: -26 },
        { x: -68, z: -26 },
        { x: -68, z: -18 },
        { x: -90, z: -18 },
      ],
    ],
    /**
     * The Sink's two crews.
     *
     * Homes sit on broken ground below the step, and both roam circles reach up over the
     * kerb at z = 0 — which is the whole point of putting packs in a ward that has pavement.
     * Their circles also overlap each other (12.6 apart against 14 of reach), so the ring
     * can pull one into the other's fight.
     */
    packs: [
      // Both nocturnal, and for the same reason the ward has a row of lamps: what happens
      // below the kerb happens when the light stops. A crew that worked the Sink at noon would
      // be a crew doing it in front of everybody.
      { encounterId: 'pack_lamprow_gutter_crew', x: -10, z: 6, roam: 7, hours: 'night' },
      { encounterId: 'pack_lamprow_tithe_takers', x: 2, z: 8, roam: 7, hours: 'night' },
      // Across the cut, the Wick-Thieves walk the gasworks yard at night: a band of their own,
      // well out of the Sink's reach, stealing from the thing that will replace the lighters.
      {
        encounterId: 'pack_wick_thieves',
        id: 'wick_thieves',
        x: -16,
        z: -64,
        roam: 7,
        hours: 'night',
        band: 'gasworks',
        behaviour: 'beat',
        route: [
          { x: -36, z: -58 },
          { x: 6, z: -58 },
          { x: 6, z: -70 },
          { x: -36, z: -70 },
        ],
      },
    ],
    /**
     * Who walks the row.
     *
     * The ward is named for the job. His fixed line has always been "Forty-one lamps on the
     * High Street. I light them. I do not own them." — said standing still while they came on
     * by themselves. Now they come on behind him.
     */
    lamplighter: 'lamprow_lamplighter',
    /** The lamps the ward is named for — every one of them on the flags, in one straight row, edge to edge. */
    lamps: [
      { x: -82, z: -2 },
      { x: -70, z: -2 },
      { x: -58, z: -2 },
      { x: -46, z: -2 },
      { x: -34, z: -2 },
      { x: -22, z: -2 },
      { x: -10, z: -2 },
      { x: 2, z: -2 },
      { x: 14, z: -2 },
      { x: 26, z: -2 },
      { x: 38, z: -2 },
      { x: 50, z: -2 },
      { x: 62, z: -2 },
      { x: 74, z: -2 },
      { x: 86, z: -2 },
    ],
    /** Spill: from the yard, and from the Sink. Kept off the line between the spawn and the ways out. */
    crates: [
      { x: -2, z: -26 },
      { x: 34, z: -22 },
      { x: -30, z: 16 },
      { x: 36, z: 16 },
    ],
    /** Along the cut, where the lighters tie up. */
    trees: [
      { x: -58, z: -42 },
      { x: -26, z: -42 },
      { x: 10, z: -42 },
      { x: 46, z: -42 },
    ],
    /** What a ward taxed for its own light writes on the walls of the quarter that pays. */
    graffiti: [
      { text: 'THE LAMPS ARE NOT FOR US', wallX: xOfCol(32.5), wallZ: zOfRow(17) + TILE / 2 + 0.05, dx: 0, facesSouth: true, tint: '#b7ae9d' },
      { text: 'PAY FOR YOUR OWN DARK', wallX: xOfCol(15.5), wallZ: zOfRow(26) - TILE / 2, dx: 0, facesSouth: false, tint: '#a46a4a' },
      { text: 'THE SINK PAYS IN THE DARK', wallX: xOfCol(32.5), wallZ: zOfRow(21) - TILE / 2, dx: 0, facesSouth: false, tint: '#8a7a6a' },
      // Beside the hatch, on the tenement it goes under.
      { text: 'THEY COUNT DOWN HERE', wallX: xOfCol(12.5), wallZ: zOfRow(22) + TILE / 2 + 0.05, dx: 6.5, facesSouth: true, tint: '#a46a4a' },
      // On the retort house, facing the works quay and the ward across the cut.
      { text: 'LIGHT WITHOUT LIGHTERS', wallX: -64, wallZ: zOfRow(3) + TILE / 2, dx: 0, facesSouth: true, tint: '#b7ae9d' },
    ],
    waterRows: WATER_ROWS,
    waterRow0: WATER_ROW0,
    horizon: 'city',
    /** The works' gasholder, its valve lamp the one light in the ward nobody pays tithe on yet. */
    landmarks: [{ kind: 'gasholder', x: 28, z: -66 }],
    vignettes: [
      { id: 'wayside_shrine', x: -74, z: 68.5 },
      { id: 'fish_racks', x: 60, z: 60.5 },
    ],
  },
});
