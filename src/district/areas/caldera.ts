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
 */

import { defineArea, type AreaDef, type TileDef } from '../map.js';

/**
 * The crater's legend.
 *
 *   s  cooled slag — the floor
 *   a  fallen ash  — the skirt, where the walls shed
 *   R  rock face   — impassable, and the whole boundary
 *   V  vent        — impassable, low and taken whole
 *
 * Four characters, two of them solid. `R` is the tallest unsplit solid outside the Spire: a
 * crater wall chunked into two- and three-tile pieces would read as a row of buildings, and the
 * one thing this place must not look like is a street.
 */
const CALDERA_LEGEND: Record<string, TileDef> = {
  s: { tex: 'slag', safe: false, walk: true },
  a: { tex: 'ash', safe: false, walk: true },
  R: {
    tex: 'ash',
    safe: false,
    walk: false,
    solid: { minHeight: 9.0, maxHeight: 13.0, inset: 0.05, depthInset: 0.05, chimneyChance: 0, split: false },
  },
  V: {
    tex: 'slag',
    safe: false,
    walk: false,
    solid: { minHeight: 2.0, maxHeight: 3.6, inset: 1.1, depthInset: 1.1, chimneyChance: 0.8, split: false },
  },
};

/**
 * 28 wide by 24 deep.
 *
 * Column 27 opens at rows 11 and 12 — the cut east to the Cinderworks, and the only gap in the
 * ring. The buttresses at rows 2/3 and 19/20 push the floor into a rough oval rather than
 * leaving it a rectangle, which is most of what makes it read as a crater.
 */
const GRID: readonly string[] = [
  'RRRRRRRRRRRRRRRRRRRRRRRRRRRR', //  0
  'RaaaaaaaaaaaaaaaaaaaaaaaaaaR', //  1  the ash skirt
  'RaaaaRRRRaaaaaaaaRRRRaaaaaaR', //  2  buttresses
  'RaaaaRRRRaaaaaaaaRRRRaaaaaaR', //  3
  'RaaaaaaaaaaaaaaaaaaaaaaaaaaR', //  4
  'RaassssssssssssssssssssssaaR', //  5  the floor
  'RasssssVVsssssssVVssssssssaR', //  6  vents
  'RassssssssssssssssssssssssaR', //  7
  'RassssssssssssssssssssssssaR', //  8
  'RasssVVVVssssssssVVVVsssssaR', //  9
  'RassssssssssssssssssssssssaR', // 10
  'Rassssssssssssssssssssssssas', // 11  the cut east, to the Cinderworks
  'Rassssssssssssssssssssssssas', // 12
  'RasssVVVVssssssssVVVVsssssaR', // 13
  'RassssssssssssssssssssssssaR', // 14
  'RassssssssssssssssssssssssaR', // 15
  'RasssssVVsssssssVVssssssssaR', // 16
  'RaassssssssssssssssssssssaaR', // 17
  'RaaaaaaaaaaaaaaaaaaaaaaaaaaR', // 18
  'RaaaaRRRRaaaaaaaaRRRRaaaaaaR', // 19
  'RaaaaRRRRaaaaaaaaRRRRaaaaaaR', // 20
  'RaaaaaaaaaaaaaaaaaaaaaaaaaaR', // 21
  'RaaaaaaaaaaaaaaaaaaaaaaaaaaR', // 22
  'RRRRRRRRRRRRRRRRRRRRRRRRRRRR', // 23
];

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
      to: 'cinderworks',
      x: 54,
      z: -2,
      label: 'East, out through the cut to the Cinderworks',
      arrive: { x: -42, z: 2 },
    },
  ],
  props: {
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
  },
});
