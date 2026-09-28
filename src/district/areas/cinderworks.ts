/**
 * The Cinderworks — the foundry ward, and the reason Ashfall is called Ashfall.
 *
 * Ranges of furnace houses at the top and bottom of the ward, a casting floor between them
 * with the Foundry Hall standing over it, and the spoil from all of it piled in the middle
 * where nobody could be bothered to cart it further. The heaps are the layout: they are the
 * only thing here you have to go *around*, and walking the ward is a matter of picking which
 * side of them to take.
 *
 * Fifty-two by forty, grown evenly from thirty-four by twenty-six. The Hall is the building the
 * works were always implied to have -- the flats the contract names are its casting floor --
 * and the bill fence the poster pastes has a shed behind it with a press in it. South of the
 * furnace houses a rail spur runs the width of the ward, and past it the slag terraces, where
 * the ground is still warm enough to vent and there is ore in the seam if you work it.
 *
 * What the growth added is the rest of the works. North, through the range, **the barracks**:
 * back-to-backs for the hands, a lane, a drying green with the one pump. West, **the quench
 * channel** the slag is run into, the height of the map, crossed by the barracks lane, an iron
 * bridge on the road to the Caldera, and the rails; past it the slag bank, still breathing.
 * East, **the scrapyard**, heaps and sorting sheds under the blast furnace's stack. South,
 * through the range, **the rail yard**: three tracks on the ballast, wagons standing on them
 * since the tithe went up, and the engine shed the top track runs into.
 *
 * Night crews since the growth, none of them in the old works: the Slag Rats walk the rail yard
 * and keep a man at the channel bridge, and a scavenging crew works the scrapyard.
 *
 * The ground tells the story in bands. Clinker on the casting floor, where it cooled hard;
 * ash in the yards, where it fell, with two cooling ponds cut into it; cobbles only in the
 * lanes the carts use. Nothing here is swept — the ward exists to make things, and the mess is
 * the making.
 */

import { TILE, defineArea, type AreaDef, type TileDef } from '../map.js';

/**
 * The works' legend.
 *
 *   s  casting floor — clinker, vitrified where it ran
 *   a  ash yard      — what falls, and stays fallen
 *   .  slag terrace  — broken ground past the spur, still warm
 *   c  cart lane     — cobbles, the only maintained ground
 *   W  cooling pond  — impassable
 *   F  furnace house — impassable, tall, and chimneyed almost every time
 *   Y  the Foundry Hall — impassable; dressed stone over the casting floor, stacked
 *   P  the poster's shed — impassable; timber, one storey
 *   H  slag heap     — impassable, low and broad, taken whole
 *   B  the ranges    — impassable, the ward wall
 *   b  the barracks  — impassable; plaster back-to-backs
 *   q  the quench channel — impassable
 *   f  an iron bridge — over the channel
 *   r  track         — the rails, on their ties
 *   w  a wagon       — impassable; standing on a track
 *   E  the engine shed — impassable; brick
 *   k  a sorting shed — impassable; timber
 *
 * `F` carries `chimneyChance: 0.9` rather than the ward's 0.4. A furnace without a stack is
 * a shed, and the skyline is most of what says this place burns.
 */
const WORKS_LEGEND: Record<string, TileDef> = {
  s: { tex: 'slag', safe: false, walk: true },
  a: { tex: 'ash', safe: false, walk: true },
  '.': { tex: 'crust', safe: false, walk: true },
  c: { tex: 'cobble', safe: false, walk: true },
  W: { tex: 'water', safe: false, walk: false },
  F: {
    tex: 'slag',
    safe: false,
    walk: false,
    solid: { style: 'hall', minHeight: 5.6, maxHeight: 8.2, inset: 0.35, depthInset: 0.35, chimneyChance: 0.9, split: true },
  },
  Y: {
    tex: 'slag',
    safe: false,
    walk: false,
    solid: { style: 'hall', minHeight: 8.6, maxHeight: 8.6, inset: 0.3, depthInset: 0.3, chimneyChance: 1, split: false, wall: 'stone' },
  },
  P: {
    tex: 'cobble',
    safe: false,
    walk: false,
    solid: { style: 'cottage', minHeight: 4.6, maxHeight: 4.6, inset: 0.3, depthInset: 0.3, chimneyChance: 0.5, split: false, wall: 'timber' },
  },
  H: {
    tex: 'ash',
    safe: false,
    walk: false,
    // Low, wide and unsplit: a spoil heap is one mass that was tipped, not a row of anything.
    solid: { style: 'rock', minHeight: 2.4, maxHeight: 3.4, inset: 0.15, depthInset: 0.15, chimneyChance: 0, split: false },
  },
  B: {
    tex: 'cobble',
    safe: false,
    walk: false,
    solid: { style: 'terrace', minHeight: 4.6, maxHeight: 6.8, inset: 0.3, depthInset: 0.3, chimneyChance: 0.3, split: true },
  },
  b: {
    tex: 'ash',
    safe: false,
    walk: false,
    solid: { style: 'terrace', minHeight: 4.0, maxHeight: 4.8, inset: 0.3, depthInset: 0.3, chimneyChance: 0.6, split: true, wall: 'plaster' },
  },
  q: { tex: 'water', safe: false, walk: false },
  f: { tex: 'ironplate', safe: false, walk: true },
  r: { tex: 'ironplate', safe: false, walk: true },
  w: {
    tex: 'ironplate',
    safe: false,
    walk: false,
    solid: { style: 'plain', minHeight: 2.4, maxHeight: 2.8, inset: 0.4, depthInset: 0.6, chimneyChance: 0, split: true, wall: 'timber' },
  },
  E: {
    tex: 'ironplate',
    safe: false,
    walk: false,
    solid: { style: 'hall', minHeight: 6.4, maxHeight: 6.4, inset: 0.3, depthInset: 0.3, chimneyChance: 1, split: false },
  },
  k: {
    tex: 'ash',
    safe: false,
    walk: false,
    solid: { style: 'cottage', minHeight: 3.4, maxHeight: 3.8, inset: 0.3, depthInset: 0.3, chimneyChance: 0.2, split: true, wall: 'timber' },
  },
};


/**
 * 52 wide by 40 deep.
 *
 * The east edge opens at rows 19 and 20 — the cart lane, up to Ashfall — and the same two rows
 * run clean through to the west edge over the channel bridge, which is the way into the
 * Caldera. The works sit on the line between the two, which is the point of them.
 */
const GRID: readonly string[] = [
  'BBBqqBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB', //  0  the barracks wall
  'aaaqqabbbbbbbbbbaabbbbbbbbbbbaabbbbbbbbbbaabbbbbbbba', //  1  THE BARRACKS: back-to-backs for the works' hands
  'aaaqqabbbbbbbbbbaabbbbbbbbbbbaabbbbbbbbbbaabbbbbbbba', //  2
  'cccffccccccccccccccccccccccccccccccccccccccccccccccc', //  3  the barracks lane, over the channel
  'aaaqqabbbbbbbaabbbbbbbbbbbaabbbbbbbbbaabbbbbbbbbbbaa', //  4
  'aaaqqabbbbbbbaabbbbbbbbbbbaabbbbbbbbbaabbbbbbbbbbbaa', //  5
  'aaaqqaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', //  6  the drying green, and the pump
  '...qqcc..BBBBBBBBccBBBBBBBBBBBBBBBccBBBBBBBaaaaaaaaa', //  7  the north range, with two ways down through it
  '...qqcc..BccccccccccccccccccccccccccccccccBaaHHHaaaa', //  8  THE QUENCH CHANNEL (west), the slag bank beyond it        THE SCRAPYARD (east)
  '...qqcc..BcFFFFcFFFFcYYYYYYYYYYcFFFFcFFFFcBaaHHHaakk', //  9  furnace houses, and THE FOUNDRY HALL between them
  '...qqcc..BcFFFFcFFFFcYYYYYYYYYYcFFFFcFFFFcBaaHHHaakk', // 10
  '...qqcc..BcccccccccccYYYYYYYYYYcccccccccccBaaaaaaaaa', // 11
  '...qqcc..BccccccccccccccccccccccccccccccccBaaaaaaaaa', // 12  the Hall's door, onto the lane
  '...qqcc..BssssssssssssssssssssssssssssssssBaaaaaHHHa', // 13  the casting floor
  '...qqcc..BsssssaaasssssssssssssssaaassssssBaaaaaHHHa', // 14
  '...qqcc..BssssssssssssssssssssssssssssssssBaaaaaHHHa', // 15
  '...qqcc..BssssssssssssssssssssssssssssssssBaaaaaaaaa', // 16
  '...qqcc..BsssHHHHHHssssssssssssHHHHHHsssssBaaaaaaaaa', // 17  the heaps
  '...qqcc..BsssHHHHHHssssssssssssHHHHHHsssssBaaaaaaaaa', // 18
  'sssffssssssssssssssssssssssssssssssssssssscccccccccc', // 19  west over the channel bridge, out to the Caldera; east, up to the ward
  'sssffssssssssssssssssssssssssssssssssssssscccccccccc', // 20
  '...qqcc..BaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaBaaaaaaaaa', // 21  the ash yards
  '...qqcc..BaaaaaWWWWaaaaHHHHHHaaaaWWWWaaaaaBaHHHaaaaa', // 22  the cooling ponds, and the middle heap
  '...qqcc..BaaaaaWWWWaaaaHHHHHHaaaaWWWWaaaaaBaHHHaaaaa', // 23
  '...qqcc..BaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaBaHHHaaaaa', // 24
  '...qqcc..BccccccccccccccccccccccccccccccccBakkaaaaaa', // 25  the south cart lane
  '...qqcc..BcPPPPcccFFFFccccFFFFccccFFFFccccBakkaaaaaa', // 26  THE POSTER'S SHED, west, and the south furnaces
  '...qqcc..BcPPPPcccFFFFccccFFFFccccFFFFccccBaaaaaHHHa', // 27
  '...qqcc..BccccccccccccccccccccccccccccccccBaaaaaHHHa', // 28  the rail spur
  '...qqcc..B................................BaaaaaHHHa', // 29  the slag terraces
  '...qqcc..Ba...aaaa...aaaaaaaa...aaaa...aaaBaHHaaaaaa', // 30
  '...qqcc..BaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaBaHHaaaaaa', // 31
  '...qqcc..BBBBBBBBBBBaaBBBBBBBBBBBBBBaaBBBBBaaaaaaaaa', // 32  the south range, with two ways down through it
  'aaaqqaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaEEEEEEa', // 33  THE RAIL YARD: ballast, three tracks, the wagons standing, the engine shed (east)
  'rrrrrrrrwwwwwwrrrrrrrrrrrrrrrrwwwwwwrrrrrrrrrEEEEEEr', // 34
  'aaaqqaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaEEEEEEa', // 35
  'rrrrrrrrrrrrrrwwwwwwwwrrrrrrrrrrrrrrrrwwwwwwrrrrrrrr', // 36
  'aaaqqaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', // 37
  'rrrrrrwwwwwwrrrrrrrrrrrrwwwwwwwwrrrrrrrrrrrrrrrrrrrr', // 38
  'aaaqqaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', // 39
];

const HALF_X = (GRID[0]!.length * TILE) / 2;
const HALF_Z = (GRID.length * TILE) / 2;
const xOfCol = (col: number): number => col * TILE - HALF_X + TILE / 2;
const zOfRow = (row: number): number => row * TILE - HALF_Z + TILE / 2;

export const CINDERWORKS_ID = 'cinderworks';

export const CINDERWORKS: AreaDef = defineArea({
  id: CINDERWORKS_ID,
  name: 'The Cinderworks',
  grid: GRID,
  legend: WORKS_LEGEND,
  /** On the casting floor, east of the heaps. */
  spawn: { x: 30, z: 0 },
  safety: 'none',
  exits: [
    {
      // East, up the cart lane to the ward. The carts come this way, so the ground is the
      // only cobbled thing in the works.
      to: 'ashfall_ward',
      x: HALF_X - 2,
      z: 0,
      label: 'Up the cart lane to Ashfall Ward',
      arrive: { x: -102, z: -26 },
    },
    {
      // West, out of the works and up into the crater it is downwind of. The ward and the
      // Caldera are the same event at two distances.
      to: 'caldera',
      x: -HALF_X + 2,
      z: 0,
      label: 'West, out to the Caldera',
      arrive: { x: 102, z: -2 },
    },
    {
      // The Hall. The flats the contract names are the floor inside.
      to: 'cinderworks_foundry',
      x: 0,
      z: zOfRow(11) + TILE / 2 + 1.4,
      label: 'Into the Foundry Hall',
      door: { x: 0, z: zOfRow(11) + TILE / 2 + 0.05, facesSouth: true, sign: 'foundry', style: 'iron' },
      arrive: { x: 0, z: 20 },
    },
    {
      // The shed behind the bill fence, with the press in it.
      to: 'cinderworks_posters',
      x: xOfCol(12.5),
      z: zOfRow(26) - TILE / 2 - 1.4,
      label: "Into the poster's shed",
      door: { x: xOfCol(12.5), z: zOfRow(26) - TILE / 2 - 0.05, facesSouth: false, sign: 'press' },
      arrive: { x: 0, z: -16 },
    },
  ],
  props: {
    /**
     * Who passes through by day: shifts changing, carters, the barracks going to the works and
     * back.
     */
    passersby: {
      peak: 6,
      folk: ['miner_b', 'scribe', 'baker', 'cobbler', 'seamstress', 'elder'],
      lanes: [
        [{ x: -64, z: 20 }, { x: 63, z: 20 }],
        [{ x: -64, z: -32 }, { x: 39, z: -32 }],
        [{ x: -36, z: -48 }, { x: 63, z: -48 }],
        [{ x: -84, z: -52 }, { x: -84, z: -5 }],
      ],
      barks: [
        "Shift's done. My hands aren't.",
        "Furnace is drawing well today. Hear it?",
        "Don't cut through the rail yard. They've lost three this month.",
        "Quench water's hot enough to shave in.",
      ],
    },
    /** Moths at the furnace mouths, which is the one thing that comes *to* a foundry. */
    sky: 'ash',
    wildlife: [
      { kind: 'moth', x: -50, z: -40, roam: 7, count: 3 },
      { kind: 'moth', x: -18, z: -30, roam: 7, count: 3 },
      { kind: 'moth', x: 22, z: -26, roam: 7, count: 3 },
      { kind: 'moth', x: 42, z: 26, roam: 7, count: 3 },
      { kind: 'rat', x: -26, z: -46, roam: 5, count: 2 },
      { kind: 'rat', x: -26, z: 2, roam: 5, count: 2 },
      { kind: 'rook', x: -42, z: -50, roam: 24, count: 3 },
    ],
    /** Foundry belt: what comes out of the furnace, what carries it, and what it leaves on the floor. */
    dressing: [
      { kind: 'spoilheap', x: -46, z: -22 },
      { kind: 'spoilheap', x: -22, z: -14 },
      { kind: 'spoilheap', x: -54, z: 2 },
      { kind: 'spoilheap', x: -34, z: 6 },
      { kind: 'spoilheap', x: 50, z: 10 },
      { kind: 'spoilheap', x: -42, z: 30 },
      { kind: 'spoilheap', x: 22, z: 42 },
      { kind: 'cart', x: -42, z: -46 },
      { kind: 'cart', x: 42, z: -30 },
      { kind: 'cart', x: 10, z: -14 },
      { kind: 'cart', x: -38, z: 0 },
      { kind: 'cart', x: 38, z: 2 },
      { kind: 'cart', x: -2, z: 26 },
      { kind: 'brazier', x: -38, z: -46 },
      { kind: 'brazier', x: 46, z: -30 },
      { kind: 'brazier', x: 14, z: -14 },
      { kind: 'brazier', x: -34, z: 0 },
      { kind: 'brazier', x: 42, z: 2 },
      { kind: 'brazier', x: 18, z: 30 },
      { kind: 'scorch', x: -30, z: -46 },
      { kind: 'scorch', x: -14, z: -22 },
      { kind: 'scorch', x: -14, z: -14 },
      { kind: 'scorch', x: -18, z: -6 },
      { kind: 'scorch', x: -30, z: 2 },
      { kind: 'scorch', x: -18, z: 10 },
      { kind: 'scorch', x: -26, z: 22 },
      { kind: 'scorch', x: 2, z: 26 },
      { kind: 'barrel', x: -22, z: -46 },
      { kind: 'barrel', x: -6, z: -14 },
      { kind: 'barrel', x: 42, z: -2 },
      { kind: 'barrel', x: -22, z: 34 },
      // The rail spur: bollards where the wagons are chocked.
      { kind: 'bollard', x: -50, z: 34 },
      { kind: 'bollard', x: -38, z: 34 },
      { kind: 'bollard', x: -6, z: 34 },
      { kind: 'bollard', x: 6, z: 34 },
      { kind: 'bollard', x: 26, z: 34 },
      { kind: 'bollard', x: 38, z: 34 },

      // The barracks: the pump on the drying green, the roll board, the washing.
      { kind: 'well', x: -20, z: -54 },
      { kind: 'noticepost', x: -6, z: -54 },
      { kind: 'washing', x: -46, z: -54, yaw: 0 },
      { kind: 'washing', x: 30, z: -54, yaw: 0 },
      { kind: 'barrel', x: 50, z: -54 },
      // The slag bank past the channel, breathing where it cracks; a ladle on the road.
      { kind: 'embervent', x: -100, z: -40 },
      { kind: 'embervent', x: -100, z: -16 },
      { kind: 'embervent', x: -100, z: 20 },
      { kind: 'embervent', x: -98, z: 44 },
      { kind: 'scorch', x: -98, z: -30, size: 1.4 },
      { kind: 'scorch', x: -100, z: 30, size: 1.2 },
      { kind: 'cart', x: -82, z: 30 },
      // The scrapyard.
      { kind: 'cart', x: 70, z: -40 },
      { kind: 'barrel', x: 74, z: -20 },
      { kind: 'barrel', x: 98, z: 16 },
      { kind: 'deadfall', x: 82, z: 30 },
      // The rail yard: buffer stops at the track ends, sleepers stacked, freight on the ballast.
      { kind: 'bollard', x: -102, z: 58 },
      { kind: 'bollard', x: -102, z: 66 },
      { kind: 'bollard', x: -102, z: 74 },
      { kind: 'bollard', x: 102, z: 66 },
      { kind: 'bollard', x: 102, z: 74 },
      { kind: 'logpile', x: -60, z: 54 },
      { kind: 'sacks', x: 40, z: 54 },
      { kind: 'barrel', x: -40, z: 70 },
    ],
    /**
     * The foundry's own.
     *
     * The smith and the glassblower work the casting floor at the north end, the potter beside
     * them; the ash-yard hand is on the south lane, which is where the work he describes
     * happens; the carter at the east end of it. The foreman is indoors, in the Hall.
     */
    npcs: [
      { id: 'cinderworks_lamplighter', x: -50, z: -46, art: 'night_watchman', label: 'Talk to the lamplighter' },
      { id: 'cinderworks_smith', x: -30, z: -22, art: 'blacksmith_px', label: 'Talk to the foundry smith' },
      { id: 'cinderworks_glassblower', x: 18, z: -22, art: 'glassblower', label: 'Talk to the glassblower' },
      { id: 'cinderworks_potter', x: 10, z: -26, art: 'potter', label: 'Talk to the potter' },
      { id: 'cinderworks_miner', x: -6, z: 26, art: 'miner_a', label: 'Talk to the ash-yard hand' },
      { id: 'cinderworks_carter', x: 34, z: 22, art: 'carpenter', label: 'Talk to the carter' },
    ],
    /**
     * Who walks the row.
     *
     * The one ward that could light itself and does not: furnace glow is not a street lamp,
     * and the cart lanes and the spur are the only ground here anybody walks after dark.
     */
    lamplighter: 'cinderworks_lamplighter',
    lamps: [
      { x: -34, z: -46 },
      { x: -2, z: -46 },
      { x: 30, z: -46 },
      { x: -34, z: 22 },
      { x: -2, z: 22 },
      { x: 30, z: 22 },
      { x: -18, z: 34 },
      { x: 14, z: 34 },
    ],
    /** Moulds, and what the pig iron travels in. */
    crates: [
      { x: -42, z: -26 },
      { x: 34, z: -26 },
      { x: -42, z: 26 },
      { x: 30, z: 26 },
      { x: -2, z: 0 },
    ],
    graffiti: [
      { text: 'THE LID IS OURS TOO', wallX: -30, wallZ: zOfRow(7) + TILE / 2 + 0.05, dx: 4, facesSouth: true, tint: '#c2661f' },
      { text: 'FED THE FLATS TWICE', wallX: 0, wallZ: zOfRow(11) + TILE / 2 + 0.05, dx: 7, facesSouth: true, tint: '#c2661f' },
      { text: 'PRINTED, NOT POSTED', wallX: -22, wallZ: zOfRow(26) - TILE / 2 - 0.05, dx: 0, facesSouth: false, tint: '#a09a82' },
    ],
    horizon: 'city',
    /**
     * The works' night: none of it on the old casting floor, all of it on the new ground round
     * it. The Slag Rats walk the rail yard between the tracks and keep a man at the channel
     * bridge on the road west, watching it; a scavenging crew works the scrapyard. Three bands,
     * well apart, so a fight at the bridge never brings the yard down on you.
     */
    packs: [
      {
        encounterId: 'pack_slag_rats',
        id: 'rail_yard',
        x: 0,
        z: 62,
        roam: 6,
        hours: 'night',
        band: 'rail',
        behaviour: 'beat',
        route: [
          { x: -70, z: 62 },
          { x: 70, z: 62 },
        ],
      },
      {
        encounterId: 'pack_slag_rats',
        id: 'channel_bridge',
        x: -82,
        z: -8,
        roam: 4,
        hours: 'night',
        band: 'bridge',
        behaviour: 'sentry',
        // Facing west over the bridge, and round to the road it carries.
        sweep: [-2.2, -0.9],
      },
      { encounterId: 'pack_chalk_scavengers', id: 'scrapyard', x: 86, z: 40, roam: 7, hours: 'night', band: 'scrap' },
    ],
    /** The blast furnace's stack over the scrapyard, its flare the one light that never goes out. */
    landmarks: [{ kind: 'furnace_stack', x: 86, z: -30 }],
    vignettes: [{ id: 'smithy_yard', x: 90, z: 44 }],
  },
});
