/**
 * The poster's shed -- behind the bill fence, with the press in it.
 *
 * Somebody pastes fresh bills the length of the fence every morning, and this is where they
 * are printed: a press, a case of type, a rack of drying sheets, and the poster, who is paid
 * in something other than coin. The `poster_work` contract starts at the press. The type case
 * is a cache, and it opens once that work is done. The door is on the north wall, onto the
 * south cart lane.
 */

import { TILE, defineArea, type AreaDef, type TileDef } from '../../map.js';

const LEGEND: Record<string, TileDef> = {
  '#': {
    tex: 'planks',
    safe: false,
    walk: false,
    solid: { minHeight: 4.6, maxHeight: 4.6, inset: 0, depthInset: 0, chimneyChance: 0, split: false, wall: 'timber', bare: true },
  },
  p: { tex: 'planks', safe: false, walk: true },
};

const GRID: readonly string[] = [
  '####pp####', //  0  the door, from the lane
  '#pppppppp#', //  1
  '#pppppppp#', //  2
  '#pppppppp#', //  3
  '#pppppppp#', //  4
  '#pppppppp#', //  5
  '#pppppppp#', //  6
  '#pppppppp#', //  7
  '#pppppppp#', //  8  the press
  '#pppppppp#', //  9
  '##########', // 10
];

const HALF_Z = (GRID.length * TILE) / 2;
const zOfRow = (row: number): number => row * TILE - HALF_Z + TILE / 2;

export const CINDERWORKS_POSTERS_ID = 'cinderworks_posters';

export const CINDERWORKS_POSTERS: AreaDef = defineArea({
  id: CINDERWORKS_POSTERS_ID,
  name: "The Poster's Shed",
  grid: GRID,
  legend: LEGEND,
  spawn: { x: 0, z: zOfRow(2) },
  safety: 'none',
  indoor: { camera: { distance: 17, pitch: 54, fov: 30 } },
  exits: [
    {
      to: 'cinderworks',
      x: 0,
      z: zOfRow(0),
      label: 'Out onto the lane',
      arrive: { x: -48.4, z: 22 },
    },
  ],
  props: {
    sky: 'none',
    horizon: 'none',
    dressing: [
      { kind: 'workbench', x: 6, z: 16 },
      { kind: 'shelves', x: -14, z: 0, yaw: Math.PI / 2 },
      { kind: 'shelves', x: -14, z: 8, yaw: Math.PI / 2 },
      { kind: 'rack', x: 14, z: -8 },
      { kind: 'barrel', x: 14, z: 0 },
    ],
    npcs: [
      { id: 'cinderworks_poster', x: -4, z: 8, art: 'town_crier', label: 'Talk to the poster' },
    ],
    graffiti: [
      { text: 'READ IT BEFORE THEY TAKE IT DOWN', wallX: 0, wallZ: zOfRow(10) - TILE / 2, dx: 0, facesSouth: false, tint: '#a09a82' },
    ],
  },
});
