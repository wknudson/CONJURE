/**
 * Highcourt & the Spire — the one district in Jolrek that was surveyed before it was built.
 *
 * Everywhere else in the capital grew and was paved afterwards. This was drawn first, and it
 * shows: the ground is cut stone laid to a line, the balustrades are symmetrical, and the whole
 * ward is one processional running north to the Spire's footing.
 *
 * The shape is deliberately the opposite of the Bonemarket's. There are no dead ends and
 * nothing to go around — you can see the far end of it from the near end, and the only thing
 * the layout asks of you is how long the walk is. Thirty rows against twenty-eight columns
 * keeps it the deepest map in the game, and that is the entire architectural argument: Vane
 * taxed the ground, so the Magistracy spent its money on height and on distance.
 *
 * Three doors now, and the campaign's last six sites are behind them. The Spire's footing has
 * a lobby, and the doors the Summons opens are at the far end of it. The Smoke-Eater's Rest is
 * the tavern on the service end where the wager duel is fought over the tables. And under the
 * service end is the Undercroft, where the relocation train forms up, the census is taken on
 * the stair, and the floor below is found to be a floor.
 *
 * Forty-two by forty-six now, grown evenly from twenty-eight by thirty, and still deeper than it
 * is wide. Everything the growth added is mirrored about the processional, because nothing here
 * was ever allowed not to be. North, up through the old range, **the beacon court**: the
 * Spire's beacon on the axis, a garden of statues either side of it, the Archive to the west and
 * its Annexe to the east. Either side of the court, **the colonnades**, a pillar every other row
 * and an aisle each side of the pillars; the way down to Lamprow crosses the west one. South,
 * down through the old range, **the bailiffs' yard**: the Night Bailiffs' barracks, one each
 * side, and the court's stables on the axis.
 *
 * The Night Bailiffs walk the colonnades after dark, one crew down each, the one beat the mirror
 * of the other.
 */

import { TILE, defineArea, type AreaDef, type TileDef } from '../map.js';

/**
 * The court's legend.
 *
 *   p  dressed stone — the processional
 *   c  cobbles       — the service lanes at the south end, where the money ran out
 *   .  weeds         — and where it ran out entirely
 *   P  the Spire     — impassable, and the tallest thing anybody has built
 *   V  balustrade    — impassable, low, symmetrical
 *   R  the Smoke-Eater's Rest — impassable; timber, on the service end
 *   U  the Undercroft — impassable; the stone stair-head over what is under the court
 *   B  the court     — impassable, the ranges either side
 *   A  the Archive and the Annexe — impassable; stone, windowless where it matters
 *   I  a colonnade pillar — impassable, tall and narrow
 *   N  the bailiffs' barracks — impassable; brick
 *   S  the stables   — impassable; timber
 *
 * `P` is 16 units and taken whole. Nothing else in the game goes past nine, which is the point:
 * from the south end of the processional the footing should fill the sky and you should still
 * have most of the ward to walk before you reach it.
 */
const COURT_LEGEND: Record<string, TileDef> = {
  p: { tex: 'flagstone', safe: false, walk: true },
  c: { tex: 'cobble', safe: false, walk: true },
  '.': { tex: 'weeds', safe: false, walk: true },
  P: {
    tex: 'flagstone',
    safe: false,
    walk: false,
    solid: { style: 'tower', minHeight: 16, maxHeight: 16, inset: 0.1, depthInset: 0.1, chimneyChance: 0, split: false, wall: 'stone' },
  },
  V: {
    tex: 'flagstone',
    safe: false,
    walk: false,
    solid: { style: 'wall', minHeight: 1.6, maxHeight: 1.6, inset: 0.35, depthInset: 1.5, chimneyChance: 0, split: false },
  },
  R: {
    tex: 'cobble',
    safe: false,
    walk: false,
    solid: { style: 'shopfront', minHeight: 5.6, maxHeight: 5.6, inset: 0.3, depthInset: 0.3, chimneyChance: 1, split: false, wall: 'timber' },
  },
  U: {
    tex: 'cobble',
    safe: false,
    walk: false,
    solid: { style: 'hall', minHeight: 4.2, maxHeight: 4.2, inset: 0.3, depthInset: 0.3, chimneyChance: 0, split: false, wall: 'stone' },
  },
  B: {
    tex: 'flagstone',
    safe: false,
    walk: false,
    solid: { style: 'hall', minHeight: 7.0, maxHeight: 9.5, inset: 0.4, depthInset: 0.4, chimneyChance: 0, split: false },
  },
  A: {
    tex: 'flagstone',
    safe: false,
    walk: false,
    solid: { style: 'hall', minHeight: 6.4, maxHeight: 6.4, inset: 0.3, depthInset: 0.3, chimneyChance: 0, split: false, wall: 'stone' },
  },
  I: {
    tex: 'flagstone',
    safe: false,
    walk: false,
    solid: { style: 'wall', minHeight: 5.8, maxHeight: 5.8, inset: 1.3, depthInset: 1.3, chimneyChance: 0, split: false },
  },
  N: {
    tex: 'cobble',
    safe: false,
    walk: false,
    solid: { style: 'hall', minHeight: 5.2, maxHeight: 5.2, inset: 0.3, depthInset: 0.3, chimneyChance: 0.6, split: false },
  },
  S: {
    tex: 'cobble',
    safe: false,
    walk: false,
    solid: { style: 'cottage', minHeight: 3.8, maxHeight: 4.2, inset: 0.3, depthInset: 0.3, chimneyChance: 0.2, split: false, wall: 'timber' },
  },
};


/**
 * 42 wide by 46 deep.
 *
 * The west edge opens at rows 22 and 23 — west, across the colonnade and down onto Lamprow's
 * High Street. The two wards share a lamp string and nothing else.
 */
const GRID: readonly string[] = [
  'BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB', //  0  the outer range
  'BpAAAAAAAAAAppppppppppppppppppAAAAAAAAAApB', //  1  THE ARCHIVE (west)        THE BEACON COURT and its statues        THE ANNEXE (east)
  'BpAAAAAAAAAAppppppppppppppppppAAAAAAAAAApB', //  2
  'BpAAAAAAAAAAppppppppppppppppppAAAAAAAAAApB', //  3
  'BpAAAAAAAAAAppppppppppppppppppAAAAAAAAAApB', //  4
  'BppppppppppppppppppppppppppppppppppppppppB', //  5
  'BppppVVVVVVppppppppppppppppppppVVVVVVppppB', //  6  balustrades, mirrored
  'BppppppppppppppppppppppppppppppppppppppppB', //  7
  'BppppppBBppBBBBBBBBBBBBBBBBBBBBppBBppppppB', //  8  the old north range, two ways up through it
  'BppIpppBppppppppppppppppppppppppppBpppIppB', //  9  THE COLONNADES, either side of the court: a pillar every other row
  'BppppppBppppppPPPPPPPPPPPPPPppppppBppppppB', // 10  the Spire's footing, and THE LOBBY under it
  'BppIpppBppppppPPPPPPPPPPPPPPppppppBpppIppB', // 11
  'BppppppBppppppPPPPPPPPPPPPPPppppppBppppppB', // 12
  'BppIpppBppppppPPPPPPPPPPPPPPppppppBpppIppB', // 13
  'BppppppBppppppppppppppppppppppppppBppppppB', // 14  the lobby doors, onto the processional
  'BppIpppBppVVppppppppppppppppppVVppBpppIppB', // 15
  'BppppppBppppppppppppppppppppppppppBppppppB', // 16
  'BppIpppBppppppppppppppppppppppppccBpppIppB', // 17
  'BppppppBccppppppppppppppppppppppppBppppppB', // 18
  'BppIpppBppppppppppppppppppppppppppBpppIppB', // 19
  'BppppppBppVVVVppppppppppppppVVVVppBppppppB', // 20
  'BppppppBppppppppppppppppppppppppppBppppppB', // 21
  'ccccccccppppppppppppppppppppppppppBppppppB', // 22  the way down to Lamprow, across the west colonnade
  'ccccccccppppppppppppppppppppppppppBppppppB', // 23
  'BppppppBppppppppppppppppppppppppppBppppppB', // 24
  'BppIpppBppVVVVppppppppppppppVVVVppBpppIppB', // 25
  'BppppppBppppppppppppppppppppppppppBppppppB', // 26
  'BppIpppBccppppppppppppppppppppppppBpppIppB', // 27
  'BppppppBccccccccccccccccccccccccccBppppppB', // 28  the service end; the Rest's door
  'BppIpppBccRRRRRRcccccccBBBBBBBccccBpppIppB', // 29  THE SMOKE-EATER'S REST, west; the service terrace, east
  'BppppppBccRRRRRRcccccccBBBBBBBccccBppppppB', // 30
  'BppIpppBccccccccccccccccccccccccccBpppIppB', // 31
  'BppppppBcc.ccccccccccccccccccc.cccBppppppB', // 32  the Undercroft's door
  'BppIpppBccUUUUUUcccccccccccccccc.cBpppIppB', // 33  THE UNDERCROFT's stair-head
  'BppppppBccUUUUUUcccccccccccccccc.cBppppppB', // 34
  'BppIpppBccccccccccccccccccccccccccBpppIppB', // 35
  'BppppppBcc.ccccccccccccccccccc.cccBppppppB', // 36
  'BppppppBBBBBccBBBBBBBBBBBBBBccBBBBBppppppB', // 37  the old south range, two ways down through it
  'BccccccccccccccccccccccccccccccccccccccccB', // 38  THE BAILIFFS' YARD
  'BccccccccccccccccccccccccccccccccccccccccB', // 39
  'BccccNNNNNNNNNNccccccccccccNNNNNNNNNNccccB', // 40  the Night Bailiffs' barracks, one each side
  'BccccNNNNNNNNNNccccccccccccNNNNNNNNNNccccB', // 41
  'BccccNNNNNNNNNNccccccccccccNNNNNNNNNNccccB', // 42
  'BccccccccccccccccSSSSSSSSccccccccccccccccB', // 43  the court's stables
  'BccccccccccccccccSSSSSSSSccccccccccccccccB', // 44
  'BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB', // 45  the outer range
];

const HALF_X = (GRID[0]!.length * TILE) / 2;
const HALF_Z = (GRID.length * TILE) / 2;
const xOfCol = (col: number): number => col * TILE - HALF_X + TILE / 2;
const zOfRow = (row: number): number => row * TILE - HALF_Z + TILE / 2;

export const HIGHCOURT_ID = 'highcourt';

export const HIGHCOURT: AreaDef = defineArea({
  id: HIGHCOURT_ID,
  name: 'Highcourt & the Spire',
  grid: GRID,
  legend: COURT_LEGEND,
  /** On the processional, half way up, with the footing ahead of you. */
  spawn: { x: 0, z: 0 },
  safety: 'none',
  exits: [
    {
      to: 'lamprow',
      x: -HALF_X + 2,
      z: 0,
      label: 'Down to the High Street',
      arrive: { x: 88, z: -4 },
    },
    {
      // The lobby under the footing. The doors the Summons opens are at the far end of it.
      to: 'highcourt_spire_lobby',
      x: 0,
      z: zOfRow(13) + TILE / 2 + 1.4,
      label: 'Into the Spire',
      door: { x: 0, z: zOfRow(13) + TILE / 2 + 0.05, facesSouth: true, sign: 'spire', style: 'arch' },
      arrive: { x: 0, z: 20 },
    },
    {
      // The Rest, on the service end, with its door onto the service lane.
      to: 'highcourt_smoke_eaters',
      x: xOfCol(12.5),
      z: zOfRow(29) - TILE / 2 - 1.4,
      label: "Into the Smoke-Eater's Rest",
      door: { x: xOfCol(12.5), z: zOfRow(29) - TILE / 2 - 0.05, facesSouth: false, sign: 'tavern' },
      arrive: { x: 0, z: -20 },
    },
    {
      // The stair-head over the Undercroft. Where the convoy forms up, and where the census is
      // taken, and where the floor below is.
      to: 'highcourt_undercroft',
      x: xOfCol(12.5),
      z: zOfRow(33) - TILE / 2 - 1.4,
      label: 'Down into the Undercroft',
      door: { x: xOfCol(12.5), z: zOfRow(33) - TILE / 2 - 0.05, facesSouth: false, sign: 'undercroft', style: 'iron' },
      arrive: { x: 0, z: -24 },
    },
  ],
  props: {
    /**
     * Who passes through by day: clerks and petitioners, the court at its business, never in a
     * hurry.
     */
    passersby: {
      peak: 6,
      folk: ['scribe', 'tax_collector', 'elder', 'healer', 'jeweler', 'cobbler_b'],
      lanes: [
        [{ x: -83, z: -4 }, { x: 51, z: -4 }],
        [{ x: -80, z: 60 }, { x: 79, z: 60 }],
        [{ x: -68, z: -72 }, { x: -68, z: 87 }],
        [{ x: 64, z: -72 }, { x: 64, z: 87 }],
      ],
      barks: [
        "Mind the robes, if you please.",
        "The Archive closes at five. It closed at four today.",
        "They've moved a statue again. Nobody saw who.",
        "Petitions to the left. Complaints to the river.",
      ],
    },
    /** Rooks over the Spire and nothing at ground level. Nothing lives on dressed stone. */
    sky: 'drizzle',
    wildlife: [
      { kind: 'rook', x: -34, z: -54, roam: 26, count: 5 },
      { kind: 'rook', x: 34, z: 2, roam: 26, count: 5 },
      { kind: 'rat', x: 42, z: 46, roam: 4, count: 2 },
      // Rooks over the statues, which is what statues are for, and rats in the stable straw.
      { kind: 'rook', x: 0, z: -80, roam: 20, count: 4 },
      { kind: 'rat', x: 20, z: 80, roam: 4, count: 2 },
    ],
    /** Dressed stone and rank. Bollards and braziers on the processional; clutter on the service end. */
    dressing: [
      { kind: 'bollard', x: -10, z: -34 },
      { kind: 'bollard', x: 6, z: -34 },
      { kind: 'bollard', x: -10, z: -26 },
      { kind: 'bollard', x: 6, z: -26 },
      { kind: 'bollard', x: -10, z: -18 },
      { kind: 'bollard', x: 6, z: -18 },
      { kind: 'bollard', x: -10, z: 6 },
      { kind: 'bollard', x: 6, z: 6 },
      { kind: 'bollard', x: -10, z: 14 },
      { kind: 'bollard', x: 6, z: 14 },
      { kind: 'brazier', x: -30, z: -30 },
      { kind: 'brazier', x: 26, z: -30 },
      { kind: 'brazier', x: -18, z: -10 },
      { kind: 'brazier', x: 14, z: -10 },
      { kind: 'brazier', x: -18, z: 10 },
      { kind: 'brazier', x: 14, z: 10 },
      { kind: 'awning', x: -38, z: -50, yaw: 0 },
      { kind: 'awning', x: 38, z: -46, yaw: 0 },
      { kind: 'awning', x: 34, z: -22, yaw: 0 },
      { kind: 'awning', x: -38, z: -6, yaw: 0 },
      // The service end, where the money ran out.
      { kind: 'cart', x: -14, z: 30 },
      { kind: 'cart', x: 22, z: 42 },
      { kind: 'barrel', x: 38, z: 26 },
      { kind: 'sacks', x: -46, z: 42 },
      { kind: 'washing', x: -38, z: 34, yaw: 0 },
      { kind: 'washing', x: 30, z: 50, yaw: 0 },
      { kind: 'bramble', x: -46, z: 50 },
      { kind: 'wildflowers', x: 42, z: 50 },

      // The beacon court: its garden of statues, a pair on each rank, and bollards on the axis.
      { kind: 'statue', x: -18, z: -84 },
      { kind: 'statue', x: 18, z: -84 },
      { kind: 'statue', x: -18, z: -74 },
      { kind: 'statue', x: 18, z: -74 },
      { kind: 'statue', x: -18, z: -64 },
      { kind: 'statue', x: 18, z: -64 },
      { kind: 'bollard', x: -8, z: -86 },
      { kind: 'bollard', x: 8, z: -86 },
      { kind: 'bollard', x: -8, z: -66 },
      { kind: 'bollard', x: 8, z: -66 },
      // The bailiffs' yard: their carts, their fodder, the stables' trough.
      { kind: 'cart', x: -10, z: 70 },
      { kind: 'barrel', x: -36, z: 86 },
      { kind: 'barrel', x: 36, z: 86 },
      { kind: 'haybale', x: -22, z: 82 },
      { kind: 'trough', x: 22, z: 82 },
    ],
    /**
     * The court, on the processional, and the two who keep the service end.
     *
     * The court's own all north of the exit, on the dressed stone. The clerk of works and the
     * musician are on the cobbles, which is a change: the end of the map the court does not
     * look at has somebody in it to say so.
     */
    npcs: [
      { id: 'highcourt_lamplighter', x: -34, z: -42, art: 'night_watchman', label: 'Talk to the lamplighter' },
      {
        id: 'highcourt_scribe', x: -14, z: -14, art: 'scribe_scholar', label: 'Talk to the court scribe',
        // Copies at the Archive door while it is open, and in the square when it is not.
        hours: [
          { from: 8, x: -48, z: -62 },
          { from: 18, x: -14, z: -14 },
        ],
      },
      { id: 'highcourt_noblewoman', x: 14, z: -22, art: 'noblewoman', label: 'Talk to the lady of the court' },
      { id: 'highcourt_crier', x: -14, z: -2, art: 'town_crier', label: 'Talk to the crier' },
      { id: 'highcourt_herald', x: 6, z: -30, art: 'herald', label: 'Talk to the herald' },
      { id: 'highcourt_tailor', x: 22, z: -30, art: 'taylor', label: 'Talk to the court tailor' },
      {
        id: 'highcourt_musician', x: 22, z: -6, art: 'bard', label: 'Talk to the court musician',
        // Plays the square by day and the beacon court in the evening, for the statues.
        hours: [
          { from: 10, x: 22, z: -6 },
          { from: 19, x: 0, z: -63 },
        ],
      },
      { id: 'highcourt_clerk_of_works', x: -14, z: 22, art: 'cartographer_b', label: 'Talk to the clerk of works' },
    ],
    /**
     * Who walks the row.
     *
     * Seven, on the processional and one on the service lane. The best-lit street in Azo and
     * the one with the fewest people out on it.
     */
    lamplighter: 'highcourt_lamplighter',
    lamps: [
      { x: -26, z: -34 },
      { x: 22, z: -34 },
      { x: -26, z: -10 },
      { x: 22, z: -10 },
      { x: -26, z: 10 },
      { x: 22, z: 10 },
      { x: -22, z: 38 },
      // Down both colonnades, mirrored, and the way the bailiffs come and go.
      { x: -78, z: -40 },
      { x: 78, z: -40 },
      { x: -78, z: 40 },
      { x: 78, z: 40 },
    ],
    crates: [
      { x: -18, z: 46 },
      { x: 22, z: 46 },
    ],
    graffiti: [
      {
        // On the service end, where the court does not look: the terrace's face.
        text: 'HE COUNTS THE FLOORS',
        wallX: 24,
        wallZ: zOfRow(29) - TILE / 2 - 0.05,
        dx: 0,
        facesSouth: false,
        tint: '#9e8f5e',
      },
      {
        // The last line before the Spire, and the only conditional one in the world.
        //
        // It spent four waves painted on Ashfall's Vivarium wall from turn one, which is where
        // the doc kept objecting to it: a warning about carrying something into the Spire,
        // shown to a player who has not been told the Spire wants them. Here it is beside the
        // Undercroft door, in fresh paint, and it appears only once the Bone Bastion is
        // walked -- which is to say, the week the Summons goes up.
        text: "DON'T CARRY IT IN",
        wallX: xOfCol(12.5),
        wallZ: zOfRow(33) - TILE / 2 - 0.05,
        dx: 5.8,
        facesSouth: false,
        tint: '#a4543a',
        gate: { after: ['bone_bastion'] },
      },
      {
        // The answer, and the last line the world gets.
        //
        // On the south range, the last wall in the ward, because it is what is written once
        // you have been down there and found out: not a rebuttal of the Magistracy but of the
        // dread, which is a quieter and worse thing to have been wrong about. Gated on
        // `the_quiet_below`, the last of the four epilogue contracts, so it cannot be read
        // before it means anything.
        text: 'THE FLOOR IS JUST A FLOOR',
        wallX: 0,
        wallZ: zOfRow(37) - TILE / 2 - 0.05,
        dx: 0,
        facesSouth: false,
        tint: '#8c93a6',
        gate: { after: ['the_quiet_below'] },
      },
    ],
    horizon: 'city',
    /**
     * The Night Bailiffs, after dark, one crew down each colonnade: mirrored beats, because in
     * Highcourt even the bailiffs are symmetrical. The west one crosses the way down to Lamprow,
     * so coming up from the High Street at night is a matter of timing.
     */
    packs: [
      {
        encounterId: 'pack_night_bailiffs',
        id: 'west_colonnade',
        x: -64,
        z: -10,
        roam: 6,
        hours: 'night',
        band: 'west',
        behaviour: 'beat',
        route: [
          { x: -64, z: -56 },
          { x: -64, z: 52 },
        ],
      },
      {
        encounterId: 'pack_night_bailiffs',
        id: 'east_colonnade',
        x: 64,
        z: -10,
        roam: 6,
        hours: 'night',
        band: 'east',
        behaviour: 'beat',
        route: [
          { x: 64, z: -56 },
          { x: 64, z: 52 },
        ],
      },
    ],
    /** The Spire's beacon, on the axis behind the footing, sweeping the whole of Azo at night. */
    landmarks: [{ kind: 'lighthouse', x: 0, z: -76 }],
    vignettes: [{ id: 'well_yard', x: 0, z: 64 }],
  },
});
