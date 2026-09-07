/**
 * The Glasshouse -- where the panes are made, on the coldest ground in the Ring.
 *
 * A furnace that has not been let out in thirty years, because letting it out would crack it,
 * and around it the only warmth on the flats: the glassblower, his bench, the cullet he melts
 * back, and the book the recipe is in. The harbour is shut and the salt is not selling, but
 * glass goes out by cart, and the cart still comes. He sells what the furnace makes -- Pyre --
 * to anyone who walks in out of the glare.
 */

import { TILE, defineArea, type AreaDef, type TileDef } from '../../map.js';

const LEGEND: Record<string, TileDef> = {
  '#': {
    tex: 'ironplate',
    safe: false,
    walk: false,
    solid: { minHeight: 5.0, maxHeight: 5.0, inset: 0, depthInset: 0, chimneyChance: 0, split: false, wall: 'timber', bare: true },
  },
  i: { tex: 'ironplate', safe: false, walk: true },
  h: { tex: 'hearth', safe: false, walk: true },
};

const GRID: readonly string[] = [
  '############', //  0
  '#iiiiiiihhh#', //  1  the furnace
  '#iiiiiiihhh#', //  2
  '#iiiiiiiiii#', //  3
  '#iiiiiiiiii#', //  4  the bench
  '#iiiiiiiiii#', //  5
  '#iiiiiiiiii#', //  6
  '#iiiiiiiiii#', //  7
  '#iiiiiiiiii#', //  8  the book
  '#iiiiiiiiii#', //  9
  '#####ii#####', // 10  the door, onto the flats
];

const HALF_X = (GRID[0]!.length * TILE) / 2;
const HALF_Z = (GRID.length * TILE) / 2;
const xOfCol = (col: number): number => col * TILE - HALF_X + TILE / 2;
const zOfRow = (row: number): number => row * TILE - HALF_Z + TILE / 2;

export const SALTGLASS_GLASSHOUSE_ID = 'saltglass_glasshouse';

export const SALTGLASS_GLASSHOUSE: AreaDef = defineArea({
  id: SALTGLASS_GLASSHOUSE_ID,
  name: 'The Glasshouse',
  grid: GRID,
  legend: LEGEND,
  spawn: { x: 0, z: zOfRow(6) },
  safety: 'none',
  indoor: { camera: { distance: 19, pitch: 54, fov: 30 } },
  exits: [
    {
      to: 'saltglass',
      x: 0,
      z: zOfRow(10),
      label: 'Out onto the flats',
      arrive: { x: -32, z: -20.6 },
    },
  ],
  props: {
    sky: 'none',
    horizon: 'none',
    dressing: [
      { kind: 'brazier', x: xOfCol(9), z: zOfRow(1.5) },
      { kind: 'embervent', x: xOfCol(7), z: zOfRow(1) },
      { kind: 'workbench', x: xOfCol(2), z: zOfRow(2) },
      { kind: 'rack', x: xOfCol(1), z: zOfRow(5) },
      { kind: 'urn', x: xOfCol(10), z: zOfRow(5) },
      { kind: 'barrel', x: xOfCol(10), z: zOfRow(8) },
      { kind: 'shelves', x: xOfCol(4), z: zOfRow(0) + TILE / 2 + 0.9, yaw: 0 },
    ],
    npcs: [
      { id: 'saltglass_glassblower', x: xOfCol(5), z: zOfRow(4), art: 'glassblower', label: 'Talk to the glassblower' },
    ],
    graffiti: [
      { text: 'THIRTY YEARS ALIGHT', wallX: xOfCol(2), wallZ: zOfRow(0) + TILE / 2, dx: 0, facesSouth: true, tint: '#c07a3a' },
    ],
  },
});
