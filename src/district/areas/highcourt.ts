/**
 * Highcourt & the Spire — the one district in Jolrek that was surveyed before it was built.
 *
 * Everywhere else in the capital grew and was paved afterwards. This was drawn first, and it
 * shows: the ground is cut stone laid to a line, the balustrades are symmetrical, and the whole
 * ward is one processional running north to the Spire's footing.
 *
 * The shape is deliberately the opposite of the Bonemarket's. There are no dead ends and
 * nothing to go around — you can see the far end of it from the near end, and the only thing
 * the layout asks of you is how long the walk is. Twenty-six rows against twenty columns makes
 * it the deepest map in the game, and that is the entire architectural argument: Vane taxed the
 * ground, so the Magistracy spent its money on height and on distance.
 */

import { defineArea, type AreaDef, type TileDef } from '../map.js';

/**
 * The court's legend.
 *
 *   p  dressed stone — the processional
 *   c  cobbles       — the service lanes at the south end, where the money ran out
 *   .  weeds         — and where it ran out entirely
 *   P  the Spire     — impassable, and the tallest thing anybody has built
 *   V  balustrade    — impassable, low, symmetrical
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
    solid: { minHeight: 16, maxHeight: 16, inset: 0.1, depthInset: 0.1, chimneyChance: 0, split: false },
  },
  V: {
    tex: 'flagstone',
    safe: false,
    walk: false,
    solid: { minHeight: 1.6, maxHeight: 1.6, inset: 0.35, depthInset: 1.5, chimneyChance: 0, split: false },
  },
  B: {
    tex: 'flagstone',
    safe: false,
    walk: false,
    solid: { minHeight: 7.0, maxHeight: 9.5, inset: 0.4, depthInset: 0.4, chimneyChance: 0, split: false },
  },
};

/**
 * 20 wide by 26 deep.
 *
 * Column 0 opens at rows 13 and 14 — west, down onto Lamprow's High Street. The two wards
 * share a lamp string and nothing else.
 */
const GRID: readonly string[] = [
  'BBBBBBBBBBBBBBBBBBBB', //  0
  'BppppppppppppppppppB', //  1  the head of the processional
  'BppppPPPPPPPPPPppppB', //  2  the Spire's footing
  'BppppPPPPPPPPPPppppB', //  3
  'BppppPPPPPPPPPPppppB', //  4
  'BppppppppppppppppppB', //  5
  'BppVVpppppppppppVVpB', //  6
  'BppppppppppppppppppB', //  7
  'BppppppppppppppppccB', //  8
  'BccppppppppppppppppB', //  9
  'BppppppppppppppppppB', // 10
  'BppVVVVpppppppVVVVpB', // 11
  'BppppppppppppppppppB', // 12
  'cppppppppppppppppppB', // 13  the way down to Lamprow
  'cppppppppppppppppppB', // 14
  'BppppppppppppppppppB', // 15
  'BppVVVVpppppppVVVVpB', // 16
  'BppppppppppppppppppB', // 17
  'BccppppppppppppppppB', // 18
  'BccccccccccccccccccB', // 19  the service end
  'BccBBBBBcccccBBBBBcB', // 20
  'BccBBBBBcccccBBBBBcB', // 21
  'BccccccccccccccccccB', // 22
  'Bcc.ccccccccccc.cccB', // 23
  'BccccccccccccccccccB', // 24
  'BBBBBBBBBBBBBBBBBBBB', // 25
];

export const HIGHCOURT_ID = 'highcourt';

export const HIGHCOURT: AreaDef = defineArea({
  id: HIGHCOURT_ID,
  name: 'Highcourt & the Spire',
  grid: GRID,
  legend: COURT_LEGEND,
  /** On the processional, half way up, with the footing ahead of you. */
  spawn: { x: 0, z: 2 },
  safety: 'none',
  exits: [
    {
      to: 'lamprow',
      x: -38,
      z: 2,
      label: 'Down to the High Street',
      arrive: { x: 34, z: 2 },
    },
  ],
  props: {
    /** Dressed stone and rank. Bollards and braziers on the processional; nothing on the service end. */
    dressing: [
      { kind: 'bollard', x: -34, z: -46 },
      { kind: 'bollard', x: -6, z: -46 },
      { kind: 'bollard', x: 26, z: -46 },
      { kind: 'bollard', x: 22, z: -42 },
      { kind: 'bollard', x: 22, z: -38 },
      { kind: 'bollard', x: 30, z: -34 },
      { kind: 'bollard', x: -14, z: -30 },
      { kind: 'bollard', x: 18, z: -30 },
      { kind: 'bollard', x: -14, z: -26 },
      { kind: 'bollard', x: 22, z: -26 },
      { kind: 'bollard', x: -10, z: -22 },
      { kind: 'bollard', x: 22, z: -22 },
      { kind: 'bollard', x: -18, z: -18 },
      { kind: 'bollard', x: 14, z: -18 },
      { kind: 'bollard', x: -30, z: -14 },
      { kind: 'bollard', x: 6, z: -14 },
      { kind: 'brazier', x: -30, z: -46 },
      { kind: 'brazier', x: 30, z: -46 },
      { kind: 'brazier', x: 26, z: -38 },
      { kind: 'brazier', x: -10, z: -30 },
      { kind: 'brazier', x: -10, z: -26 },
      { kind: 'brazier', x: -6, z: -22 },
      { kind: 'brazier', x: -14, z: -18 },
      { kind: 'brazier', x: -26, z: -14 },
      { kind: 'awning', x: -38, z: -50, yaw: 0 },
      { kind: 'awning', x: 38, z: -46, yaw: 0 },
      { kind: 'awning', x: 18, z: -38, yaw: 0 },
      { kind: 'awning', x: 26, z: -30, yaw: 0 },
      { kind: 'awning', x: 38, z: -22, yaw: 0 },
    ],
    /**
     * The court, on the processional.
     *
     * All three north of the Spire footing, on the dressed stone. Deliberately none on the
     * cobbled service end, where the money ran out and the graffiti is: that end of the map
     * exists to be the place the court does not look, and populating it would spend it.
     */
    npcs: [
      { id: 'highcourt_scribe', x: -14, z: -14, art: 'scribe_scholar', label: 'Talk to the court scribe' },
      { id: 'highcourt_noblewoman', x: 14, z: -22, art: 'noblewoman', label: 'Talk to the lady of the court' },
      { id: 'highcourt_crier', x: -14, z: -2, art: 'town_crier', label: 'Talk to the crier' },
      { id: 'highcourt_herald', x: 10, z: -26, art: 'herald', label: 'Talk to the herald' },
      { id: 'highcourt_tailor', x: 18, z: -26, art: 'taylor', label: 'Talk to the court tailor' },
    ],
    /** Paired, because everything here is paired. */
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
      { x: -26, z: 42 },
      { x: 22, z: 42 },
    ],
    graffiti: [
      {
        // On the service end, where the court does not look.
        text: 'HE COUNTS THE FLOORS',
        wallX: -22,
        wallZ: 30,
        dx: 3,
        facesSouth: true,
        tint: '#9e8f5e',
      },
    ],
    horizon: 'city',
  },
});
