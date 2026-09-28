/**
 * The Caldera — the crater the Cinderworks is downwind of.
 *
 * A floor of cooled slag ringed by rock, with a skirt of fallen ash where the walls meet it and
 * vents standing up through the middle. The only way in is the cut east, which is the same cut
 * the ward's smoke comes out of — Jolrek's foundry ward and this place are the same event at two
 * distances.
 *
 * Nothing is built here and nothing needs to be. The layout is entirely the rock: an unbroken
 * wall on all four sides, buttresses pushing in at the corners, and vents scattered across the
 * floor so that crossing it is never quite a straight line. It is the first area in the world
 * with no made ground on it at all.
 *
 * Sixty by fifty-two now, grown evenly from thirty-two by twenty-eight, and the old crater is the
 * inner basin of a bigger one: its wall still stands, broken through in six places, and a second
 * wall rings the whole of it at the new edges. Between the two, north, **the obsidian fields**,
 * the floor set to glass with spires of it standing up; west, **the fumaroles**, the ground
 * breathing through vent after vent in its own sulphur; south, **the survey camp** somebody pitched
 * once and the line of cairns it staked across the floor; east, on the outer wall, **the lava
 * fall**, running since before the Cinderworks, and the cut out to the works running past it.
 *
 * The Magma Brood roam the inner basin and keep one of their own at the foot of the fall, and
 * something bigger prowls the whole Caldera: nobody lives here to be kept clear of.
 */

import { TILE, defineArea, type AreaDef, type TileDef } from '../map.js';

/**
 * The crater's legend.
 *
 *   s  cooled slag — the floor
 *   a  fallen ash  — the skirt, where the walls shed
 *   R  rock face   — impassable, and the whole boundary
 *   V  vent        — impassable, low and taken whole
 *   c  cooled crust — the floor where it set in sheets rather than shattering
 *   f  sulphur     — the bloom a vent leaves on the ash it breathes on
 *   o  obsidian    — the outer floor, set to glass
 *   O  an obsidian spire — impassable
 *   X  the survey hut — impassable; what is left of its walls
 *
 * Four characters, two of them solid. `R` is the tallest unsplit solid outside the Spire: a
 * crater wall chunked into two- and three-tile pieces would read as a row of buildings, and the
 * one thing this place must not look like is a street.
 */
const CALDERA_LEGEND: Record<string, TileDef> = {
  c: { tex: 'crust', safe: false, walk: true },
  f: { tex: 'sulphur', safe: false, walk: true },
  s: { tex: 'slag', safe: false, walk: true },
  a: { tex: 'ash', safe: false, walk: true },
  R: {
    tex: 'ash',
    safe: false,
    walk: false,
    solid: { style: 'rock', minHeight: 9.0, maxHeight: 13.0, inset: 0.05, depthInset: 0.05, chimneyChance: 0, split: false },
  },
  V: {
    tex: 'slag',
    safe: false,
    walk: false,
    solid: { style: 'rock', minHeight: 2.0, maxHeight: 3.6, inset: 1.1, depthInset: 1.1, chimneyChance: 0.8, split: false },
  },
  o: { tex: 'blasted', safe: false, walk: true },
  O: {
    tex: 'blasted',
    safe: false,
    walk: false,
    solid: { style: 'rock', minHeight: 2.6, maxHeight: 4.6, inset: 0.9, depthInset: 0.9, chimneyChance: 0, split: false },
  },
  X: {
    tex: 'slag',
    safe: false,
    walk: false,
    solid: { style: 'wall', minHeight: 1.0, maxHeight: 2.2, inset: 0.3, depthInset: 1.2, chimneyChance: 0, split: true, wall: 'timber' },
  },
  /** The cave mouth: rock, taken whole, with a door in the south face of it. */
  K: {
    tex: 'ash',
    safe: false,
    walk: false,
    solid: { style: 'rock', minHeight: 5.5, maxHeight: 5.5, inset: 0.3, depthInset: 0.3, chimneyChance: 0, split: false, wall: 'rock', bare: true },
  },
};

/**
 * 60 wide by 52 deep.
 *
 * Column 27 opens at rows 11 and 12 — the cut east to the Cinderworks, and the only gap in the
 * ring. The buttresses at rows 2/3 and 19/20 push the floor into a rough oval rather than
 * leaving it a rectangle, which is most of what makes it read as a crater.
 */
const GRID: readonly string[] = [
  'RRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRR', //  0  the outer wall
  'RRRRaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaRRRR', //  1
  'RRRRooooooooooooooooooooooooooooooooooooooooooooooooOOooaaaR', //  2  THE OBSIDIAN FIELDS, glass standing up out of them
  'RaaaooooOOooooooooooooooOOOoooooooooooooooooooooooooooooaaaR', //  3
  'RaaaooooOOooooooooooooooooooooooooooooooOOooooooooooooooaaaR', //  4
  'RaaaooooooooooooooooooooooooooooooooooooOOooooooooooooooaaaR', //  5
  'RaaaoooooooooooOOoooooooooooooooooooooooooooooooooooooooaaaR', //  6
  'RaaaoooooooooooOOoooooooooooooooooooooooooooooooOOooooooaaaR', //  7
  'RaaaooooooooooooooooooooooooooOOooooooooooooooooOOooooooaaaR', //  8
  'RRRaooooooooooooooooooooooooooOOooooooooooooooooooooooooaaaR', //  9
  'RRRaooooooooooooooooooooooooooooooooooooooooooooooooooooaaaR', // 10
  'RaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaR', // 11
  'RaaaaaaaaaaaaaRRRRRRaaRRRRRRRRRRRRRRRRRRRRRRRRaaaaaaaaaaaaaR', // 12  the old crater wall, the inner basin now: three ways in through it on this side
  'RafffffffffffaRaaaaaaaaaaaaaaaaaaaKKKKaaaaaaaRacccccccccccaR', // 13  THE FUMAROLES (west)                                        the crust towards the fall (east)
  'RafffffffffffaRaaaaaaaaaaaaaaaaaaaKKKKaaaaaaaRacccccccccccaR', // 14
  'RaffVVfffffffaRaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaRacccccccccccaR', // 15
  'RaffVVfffffffaRaaaaaaRRRRaaaaaaaaRRRRaaaaaaaaRaccccccccRRRRR', // 16
  'RafffffffffffaRaaaaaaRRRRaaaaaaaaRRRRaaaaaaaaRaccccccccRRRRR', // 17
  'RafffffffffffaRaaaaaaffffffaaaffffffaaaaaaaaaRaccccccccRRRRR', // 18
  'RafffffffffffaaaaaassssssssssscssssssssssaaaaRacccccccccccaR', // 19
  'RaffffffVVfffaaaaascsssVVsssssssVVssssssssaaaRacccccccccccaR', // 20
  'RafffffffffffaRaaassssssssssssssssssssssssaaaRacccccccccccaR', // 21
  'RafffffffffffaRaaassssssssssssssssssssssssaaaRacccccccccccaR', // 22
  'RafffffffffVVaRaaascsVVVVssssssscVVVVsssssaaaRacccccccccccaR', // 23
  'RafffffffffffaRaaasccsssssssssccccssssssssaaaRacccccccccccaR', // 24
  'RafffffffffffaRaaascccsssssssscccccsssssssaaasssssssssssssss', // 25  the cut, east to the Cinderworks
  'RafVVffffffffaRaaasccccsssssscccccccssssssaaasssssssssssssss', // 26
  'RafVVffffffffaRaaasccVVVVssscccccVVVVsssssaaaRacccccccccccaR', // 27
  'RafffffffffffaRaaasccccccssccccccccccssscsaaaRacccccccccccaR', // 28
  'RafffffffffffaRaaasccccccssccccccccccssscsaaaRacccccccccccaR', // 29
  'RafffffffffffaRaaasccccVVsscccccVVcccssscsaaaRacccccccccccaR', // 30
  'RafffffffVVffaaaaaassssssssscccssssssssssaaaaRacccccccccccaR', // 31
  'RafffffffffffaaaaaaaaffffffaaaffffffaaaaaaaaaRacccccccccaaaR', // 32  THE LAVA FALL, on the east wall
  'RafffffffffffaRaaaaaaRRRRaaaaaaaaRRRRaaaaaaaaaacccccccccaaaR', // 33
  'RafffffffffffaRaaaaaaRRRRaaaaaaaaRRRRaaaaaaaaaacccccccccaaaR', // 34
  'RafffVVffffffaRaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaRacccccccccccaR', // 35
  'RafffVVffffffaRaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaRacccccccccccaR', // 36
  'RafffffffffffaRaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaRacccccccccccaR', // 37
  'RafffffffffffaRaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaRacccccccRRRRRR', // 38
  'RaaaaaaaaaaaaaRaaRRRRRRRaaRRRRRRRRRRRRaaRRRaaRaaaaaaaaRRRRRR', // 39  the old crater wall, its south side
  'RaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaRRRRRR', // 40
  'RaaassssssssssssssssssssssssssssssssssssssssssssssssssssRRRR', // 41  THE SURVEY CAMP: the hut fallen in, the line of markers
  'RaaassssssssssssssssssssssssssssssssssssssssssssssssssssRRRR', // 42
  'RaaassssssssssssssssssssssssssssssssssssssssssssssssssssaaaR', // 43
  'RaaassssssssssssssssXXXXXsssssssssssssssssssssssssssssssaaaR', // 44
  'RaaassssssssssssssssXsssXsssssssssssssssssssssssssssssssaaaR', // 45
  'RaaassssssssssssssssXsssssssssssssssssssssssssssssssssssaaaR', // 46
  'RaaassssssssssssssssssssssssssssssssssssssssssssssssssssaaaR', // 47
  'RRRRssssssssssssssssssssssssssssssssssssssssssssssssssssaaaR', // 48
  'RRRRssssssssssssssssssssssssssssssssssssssssssssssssssssaaaR', // 49
  'RaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaR', // 50
  'RRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRR', // 51  the outer wall
];

const HALF_X = (GRID[0]!.length * TILE) / 2;
const HALF_Z = (GRID.length * TILE) / 2;
const xOfCol = (col: number): number => col * TILE - HALF_X + TILE / 2;
const zOfRow = (row: number): number => row * TILE - HALF_Z + TILE / 2;

export const CALDERA_ID = 'caldera';

export const CALDERA: AreaDef = defineArea({
  id: CALDERA_ID,
  name: 'The Caldera',
  grid: GRID,
  legend: CALDERA_LEGEND,
  /** In the middle of the floor. There is nowhere else to be. */
  spawn: { x: 0, z: -2 },
  safety: 'none',
  exits: [
    {
      // The lava tube, in the north wall. The drake denned in it before the tap field was cut.
      to: 'caldera_lava_tube',
      x: xOfCol(35.5),
      z: zOfRow(14) + TILE / 2 + 1.4,
      label: 'Into the lava tube',
      door: { x: xOfCol(35.5), z: zOfRow(14) + TILE / 2 + 0.05, facesSouth: true, style: 'cave' },
      arrive: { x: 0, z: 16 },
    },
    {
      to: 'cinderworks',
      x: HALF_X - 2,
      z: -2,
      label: 'East, out through the cut to the Cinderworks',
      arrive: { x: -98, z: 0 },
    },
  ],
  props: {
    /** Moths and nothing else, which is the whole statement. Nothing else could live on it. */
    sky: 'embers',
    wildlife: [
      { kind: 'moth', x: -54, z: -46, roam: 9, count: 3 },
      { kind: 'moth', x: 50, z: -34, roam: 9, count: 3 },
      { kind: 'moth', x: 42, z: -18, roam: 9, count: 3 },
      { kind: 'moth', x: -38, z: 2, roam: 9, count: 3 },
      { kind: 'moth', x: -26, z: 18, roam: 9, count: 3 },
      { kind: 'moth', x: -34, z: 34, roam: 9, count: 3 },
      // Moths at the vents and the fall, the only light out here worth flying to.
      { kind: 'moth', x: -90, z: -10, roam: 8, count: 3 },
      { kind: 'moth', x: 96, z: 20, roam: 8, count: 3 },
      { kind: 'moth', x: 0, z: -78, roam: 10, count: 3 },
    ],
    /** Daubed on the crater wall by whoever last worked the tap field, and left. */
    graffiti: [
      { text: 'THE TAP FIELD TOOK NINE', wallX: -34, wallZ: -32.05, dx: 3.4, facesSouth: true, tint: '#a4543a' },
    ],
    /** The thinnest area in the game had one crate on it. Nothing lives here, so nothing here is built — only left. */
    dressing: [
      { kind: 'scorch', x: 56, z: -48 },
      { kind: 'spoilheap', x: -56, z: -12 },
      { kind: 'cairn', x: 56, z: 12 },
      { kind: 'scorch', x: -56, z: 20 },
      { kind: 'spoilheap', x: 56, z: -20 },
      { kind: 'cairn', x: -56, z: -28 },
      { kind: 'scorch', x: 40, z: -48 },
      { kind: 'cairn', x: -20, z: 48 },
      { kind: 'spoilheap', x: 24, z: 48 },
      { kind: 'scorch', x: -50, z: -42 },
      { kind: 'scorch', x: 6, z: -38 },
      { kind: 'scorch', x: -10, z: -30 },
      { kind: 'scorch', x: 30, z: -26 },
      { kind: 'scorch', x: -18, z: -18 },
      { kind: 'scorch', x: 22, z: -14 },
      { kind: 'scorch', x: -10, z: -6 },
      { kind: 'scorch', x: -42, z: 2 },
      { kind: 'scorch', x: 42, z: 6 },
      { kind: 'scorch', x: -22, z: 14 },
      { kind: 'scorch', x: 34, z: 18 },
      { kind: 'scorch', x: -30, z: 26 },
      { kind: 'scorch', x: 42, z: 30 },
      { kind: 'scorch', x: 10, z: 38 },
      { kind: 'cairn', x: -42, z: -42 },
      { kind: 'cairn', x: 50, z: -38 },
      { kind: 'cairn', x: 46, z: -30 },
      { kind: 'cairn', x: 22, z: -22 },
      { kind: 'cairn', x: -14, z: -14 },
      { kind: 'cairn', x: -30, z: -6 },
      { kind: 'cairn', x: -30, z: 2 },
      { kind: 'cairn', x: -26, z: 10 },
      { kind: 'cairn', x: 42, z: 14 },
      { kind: 'cairn', x: 10, z: 22 },
      { kind: 'cairn', x: -14, z: 30 },
      { kind: 'cairn', x: -6, z: 38 },
      { kind: 'spoilheap', x: -38, z: -42 },
      { kind: 'spoilheap', x: 38, z: -34 },
      { kind: 'spoilheap', x: -46, z: -22 },
      { kind: 'spoilheap', x: -10, z: -14 },
      { kind: 'spoilheap', x: 42, z: -6 },
      { kind: 'spoilheap', x: 2, z: 6 },
      { kind: 'spoilheap', x: 46, z: 14 },
      { kind: 'spoilheap', x: -38, z: 26 },
      { kind: 'spoilheap', x: 50, z: 34 },
      { kind: 'waystone', x: -34, z: -42, text: 'THE TAP FIELD — KEEP OUT' },
      { kind: 'waystone', x: -22, z: 2, text: 'THE TAP FIELD — KEEP OUT' },

      // The fumaroles: the vents that breathe fire, not only steam.
      { kind: 'embervent', x: -96, z: -30 },
      { kind: 'embervent', x: -78, z: -10 },
      { kind: 'embervent', x: -94, z: 6 },
      { kind: 'embervent', x: -86, z: 26 },
      { kind: 'scorch', x: -100, z: -14, size: 1.6 },
      { kind: 'scorch', x: -80, z: 14, size: 1.4 },
      // The survey: its line of cairns across the south floor, its table, its tripod.
      { kind: 'cairn', x: -70, z: 86 },
      { kind: 'cairn', x: -40, z: 86 },
      { kind: 'cairn', x: -10, z: 86 },
      { kind: 'cairn', x: 20, z: 86 },
      { kind: 'cairn', x: 50, z: 86 },
      { kind: 'cairn', x: 80, z: 86 },
      { kind: 'lectern', x: -26, z: 78 },
      { kind: 'deadfall', x: -14, z: 82 },
      // The crust towards the fall, scorched where it spat.
      { kind: 'scorch', x: 100, z: 22, size: 1.8 },
      { kind: 'scorch', x: 88, z: 40, size: 1.4 },
      { kind: 'spoilheap', x: 78, z: -30 },
    ],
    // No lamps. Nothing here has ever been lit by anybody.
    crates: [{ x: 42, z: -2 }],
    /**
     * The horizon is switched off rather than set to a treeline or a skyline.
     *
     * There is nothing beyond the rock and there should be nothing drawn beyond it: the walls
     * are twelve units tall and close the view on their own, and a ring of distant silhouettes
     * behind them would say the crater has an outside.
     */
    horizon: 'none',
    /**
     * The Magma Brood: a clutch roaming the inner basin, one kept at the foot of the lava fall
     * looking out over the crust, and something bigger that prowls the whole Caldera -- the one
     * place near the city with nobody in it to keep a prowler clear of.
     */
    packs: [
      { encounterId: 'pack_magma_brood', id: 'basin', x: 10, z: 30, roam: 8, band: 'basin' },
      {
        encounterId: 'pack_magma_brood',
        id: 'fall',
        x: 96,
        z: 30,
        roam: 4,
        band: 'fall',
        behaviour: 'sentry',
        // Facing west, away from the fall and out over the crust anything would come across.
        sweep: [-2.2, -0.9],
      },
      { encounterId: 'pack_magma_brood', id: 'prowler', x: 0, z: -80, roam: 8, behaviour: 'prowl' },
    ],
    /** The lava fall on the outer wall, the one light the Caldera has and nobody lit. */
    landmarks: [{ kind: 'lava_fall', x: 108, z: 30 }],
    vignettes: [{ id: 'ruined_camp', x: 0, z: 76 }],
  },
});
