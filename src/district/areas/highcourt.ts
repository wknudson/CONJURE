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
};

const P26 = 'p'.repeat(26);
const C26 = 'c'.repeat(26);

/**
 * 28 wide by 30 deep.
 *
 * Column 0 opens at rows 14 and 15 — west, down onto Lamprow's High Street. The two wards
 * share a lamp string and nothing else.
 */
const GRID: readonly string[] = [
  'BBBBBBBBBBBBBBBBBBBBBBBBBBBB', //  0
  `B${P26}B`, //  1  the head of the processional
  'BppppppPPPPPPPPPPPPPPppppppB', //  2  the Spire's footing, and THE LOBBY under it
  'BppppppPPPPPPPPPPPPPPppppppB', //  3
  'BppppppPPPPPPPPPPPPPPppppppB', //  4
  'BppppppPPPPPPPPPPPPPPppppppB', //  5
  `B${P26}B`, //  6  the lobby doors, onto the processional
  'BppVVppppppppppppppppppVVppB', //  7
  `B${P26}B`, //  8
  'BppppppppppppppppppppppppccB', //  9
  'BccppppppppppppppppppppppppB', // 10
  `B${P26}B`, // 11
  'BppVVVVppppppppppppppVVVVppB', // 12
  `B${P26}B`, // 13
  `c${P26}B`, // 14  the way down to Lamprow
  `c${P26}B`, // 15
  `B${P26}B`, // 16
  'BppVVVVppppppppppppppVVVVppB', // 17
  `B${P26}B`, // 18
  'BccppppppppppppppppppppppppB', // 19
  `B${C26}B`, // 20  the service end; the Rest's door
  'BccRRRRRRcccccccBBBBBBBccccB', // 21  THE SMOKE-EATER'S REST, west; the service terrace, east
  'BccRRRRRRcccccccBBBBBBBccccB', // 22
  `B${C26}B`, // 23
  'Bcc.ccccccccccccccccccc.cccB', // 24  the Undercroft's door
  'BccUUUUUUcccccccccccccccc.cB', // 25  THE UNDERCROFT's stair-head
  'BccUUUUUUcccccccccccccccc.cB', // 26
  `B${C26}B`, // 27
  'Bcc.ccccccccccccccccccc.cccB', // 28
  'BBBBBBBBBBBBBBBBBBBBBBBBBBBB', // 29
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
      z: zOfRow(5) + TILE / 2 + 1.4,
      label: 'Into the Spire',
      door: { x: 0, z: zOfRow(5) + TILE / 2 + 0.05, facesSouth: true, sign: 'spire', style: 'arch' },
      arrive: { x: 0, z: 20 },
    },
    {
      // The Rest, on the service end, with its door onto the service lane.
      to: 'highcourt_smoke_eaters',
      x: xOfCol(5.5),
      z: zOfRow(21) - TILE / 2 - 1.4,
      label: "Into the Smoke-Eater's Rest",
      door: { x: xOfCol(5.5), z: zOfRow(21) - TILE / 2 - 0.05, facesSouth: false, sign: 'tavern' },
      arrive: { x: 0, z: -20 },
    },
    {
      // The stair-head over the Undercroft. Where the convoy forms up, and where the census is
      // taken, and where the floor below is.
      to: 'highcourt_undercroft',
      x: xOfCol(5.5),
      z: zOfRow(25) - TILE / 2 - 1.4,
      label: 'Down into the Undercroft',
      door: { x: xOfCol(5.5), z: zOfRow(25) - TILE / 2 - 0.05, facesSouth: false, sign: 'undercroft', style: 'iron' },
      arrive: { x: 0, z: -24 },
    },
  ],
  props: {
    /** Rooks over the Spire and nothing at ground level. Nothing lives on dressed stone. */
    sky: 'drizzle',
    wildlife: [
      { kind: 'rook', x: -34, z: -54, roam: 26, count: 5 },
      { kind: 'rook', x: 34, z: 2, roam: 26, count: 5 },
      { kind: 'rat', x: 42, z: 46, roam: 4, count: 2 },
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
      { id: 'highcourt_scribe', x: -14, z: -14, art: 'scribe_scholar', label: 'Talk to the court scribe' },
      { id: 'highcourt_noblewoman', x: 14, z: -22, art: 'noblewoman', label: 'Talk to the lady of the court' },
      { id: 'highcourt_crier', x: -14, z: -2, art: 'town_crier', label: 'Talk to the crier' },
      { id: 'highcourt_herald', x: 6, z: -30, art: 'herald', label: 'Talk to the herald' },
      { id: 'highcourt_tailor', x: 22, z: -30, art: 'taylor', label: 'Talk to the court tailor' },
      { id: 'highcourt_musician', x: 22, z: -6, art: 'bard', label: 'Talk to the court musician' },
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
        wallZ: zOfRow(21) - TILE / 2 - 0.05,
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
        wallX: xOfCol(5.5),
        wallZ: zOfRow(25) - TILE / 2 - 0.05,
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
        wallZ: zOfRow(29) - TILE / 2 - 0.05,
        dx: 0,
        facesSouth: false,
        tint: '#8c93a6',
        gate: { after: ['the_quiet_below'] },
      },
    ],
    horizon: 'city',
  },
});
