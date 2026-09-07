/**
 * The Smoke-Eater's Rest -- the tavern on Highcourt's service end.
 *
 * Where the court's servants drink, and where the Smoke-Eater holds his bench: the wager duel
 * the `smoke_eaters_rest` contract names is fought over the tables here now, with the duelist
 * standing at his bench inside rather than on a flagstone outside. A publican who brews for
 * the court and sells the rest, a bed upstairs dearer than the Cinder Cup's, a board that
 * says what the herald does not. The door is on the north wall, onto the service lane.
 */

import { TILE, defineArea, type AreaDef, type TileDef } from '../../map.js';

const LEGEND: Record<string, TileDef> = {
  '#': {
    tex: 'planks',
    safe: false,
    walk: false,
    solid: { minHeight: 5.0, maxHeight: 5.0, inset: 0, depthInset: 0, chimneyChance: 0, split: false, wall: 'timber', bare: true },
  },
  p: { tex: 'planks', safe: false, walk: true },
  r: { tex: 'rug', safe: false, walk: true },
  h: { tex: 'hearth', safe: false, walk: true },
};

const GRID: readonly string[] = [
  '######pp######', //  0  the door, from the lane
  '#pppppppppppp#', //  1
  '#pppppppppppp#', //  2
  '#pppppppppppp#', //  3  the tables, and the Smoke-Eater's bench east
  '#pppppppppphh#', //  4  the hearth
  '#pppppppppphh#', //  5
  '#pppppppppppp#', //  6
  '#pppppppppppp#', //  7
  '#pppppppppppp#', //  8
  '#pprrrrrrrppp#', //  9  the bar's runner
  '#pprrrrrrrppp#', // 10
  '#pppppppppppp#', // 11  behind the bar; the stair, east
  '##############', // 12
];

const HALF_X = (GRID[0]!.length * TILE) / 2;
const HALF_Z = (GRID.length * TILE) / 2;
const xOfCol = (col: number): number => col * TILE - HALF_X + TILE / 2;
const zOfRow = (row: number): number => row * TILE - HALF_Z + TILE / 2;

export const HIGHCOURT_SMOKE_EATERS_ID = 'highcourt_smoke_eaters';

export const HIGHCOURT_SMOKE_EATERS: AreaDef = defineArea({
  id: HIGHCOURT_SMOKE_EATERS_ID,
  name: "The Smoke-Eater's Rest",
  grid: GRID,
  legend: LEGEND,
  spawn: { x: 0, z: zOfRow(3) },
  safety: 'none',
  indoor: { camera: { distance: 20, pitch: 54, fov: 30 } },
  exits: [
    {
      to: 'highcourt',
      x: 0,
      z: zOfRow(0),
      label: 'Out onto the service lane',
      arrive: { x: -28.8, z: 22 },
    },
  ],
  props: {
    sky: 'none',
    horizon: 'none',
    dressing: [
      { kind: 'table', x: xOfCol(3), z: zOfRow(2) },
      { kind: 'table', x: xOfCol(3), z: zOfRow(6) },
      { kind: 'table', x: xOfCol(8), z: zOfRow(6) },
      { kind: 'counter', x: xOfCol(6.5), z: zOfRow(10) + 1 },
      { kind: 'brazier', x: xOfCol(11.5), z: zOfRow(4.5) },
      { kind: 'barrel', x: xOfCol(12), z: zOfRow(8) },
      { kind: 'barrel', x: xOfCol(12), z: zOfRow(9) },
      { kind: 'shelves', x: xOfCol(9), z: zOfRow(11) + 1, yaw: 0 },
    ],
    npcs: [
      { id: 'highcourt_smoke_eater', x: xOfCol(2), z: zOfRow(11), art: 'brewer', label: 'Talk to the publican' },
    ],
    graffiti: [
      { text: 'NO COURT ABOVE THIS STAIR', wallX: 0, wallZ: zOfRow(12) - TILE / 2, dx: 0, facesSouth: false, tint: '#9a8a6a' },
    ],
  },
});
