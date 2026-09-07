/**
 * Pylon Nine's base -- under the Shelf's north face, where the iron goes into the ground.
 *
 * The warnings on the stones are about the pylons; this is what they are anchored to. An iron
 * floor that hums, the lineman's bench nobody has sat at since Nine was not an accident, and
 * in the works something that has made a nest of the cable runs -- vermin, of the hedgerow
 * kind, further from a hedge than vermin should be. The conductor's box is at the back, and
 * opens once Nine itself has been fought.
 */

import { TILE, defineArea, type AreaDef, type TileDef } from '../../map.js';

const LEGEND: Record<string, TileDef> = {
  '#': {
    tex: 'blasted',
    safe: false,
    walk: false,
    solid: { minHeight: 5.5, maxHeight: 5.5, inset: 0, depthInset: 0, chimneyChance: 0, split: false, wall: 'stone', bare: true },
  },
  i: { tex: 'ironplate', safe: false, walk: true },
  b: { tex: 'blasted', safe: false, walk: true },
};

const GRID: readonly string[] = [
  '############', //  0
  '#iiiiiiiiii#', //  1  the works; the conductor's box
  '#iiiiiiiiii#', //  2
  '#iiiiiiiiii#', //  3  the nest
  '#iiiiiiiiii#', //  4
  '#iiiiiiiiii#', //  5
  '#iiiiiiiiii#', //  6
  '#bbiiiiiibb#', //  7
  '#bbbbbbbbbb#', //  8  the charged seam, west; the lineman's bench
  '#bbbbbbbbbb#', //  9
  '#bbbbbbbbbb#', // 10
  '#bbbbbbbbbb#', // 11
  '#####bb#####', // 12  the door
];

const HALF_X = (GRID[0]!.length * TILE) / 2;
const HALF_Z = (GRID.length * TILE) / 2;
const xOfCol = (col: number): number => col * TILE - HALF_X + TILE / 2;
const zOfRow = (row: number): number => row * TILE - HALF_Z + TILE / 2;

export const STORM_SHELF_PYLON_BASE_ID = 'storm_shelf_pylon_base';

export const STORM_SHELF_PYLON_BASE: AreaDef = defineArea({
  id: STORM_SHELF_PYLON_BASE_ID,
  name: "Pylon Nine's Base",
  grid: GRID,
  legend: LEGEND,
  spawn: { x: 0, z: zOfRow(9) },
  safety: 'none',
  indoor: { camera: { distance: 20, pitch: 54, fov: 30 } },
  exits: [
    {
      to: 'storm_shelf',
      x: 0,
      z: zOfRow(12),
      label: 'Out onto the shelf',
      arrive: { x: -4, z: -39 },
    },
  ],
  props: {
    sky: 'none',
    horizon: 'none',
    dressing: [
      { kind: 'anvil', x: xOfCol(10), z: zOfRow(6) },
      { kind: 'workbench', x: xOfCol(10), z: zOfRow(9) },
      { kind: 'rack', x: xOfCol(1), z: zOfRow(6) },
      { kind: 'rack', x: xOfCol(10), z: zOfRow(10) },
      { kind: 'brazier', x: xOfCol(5.5), z: zOfRow(7) },
      { kind: 'urn', x: xOfCol(1), z: zOfRow(10) },
    ],
    /** The nest in the cable runs. Short roam; the works are not big. */
    packs: [{ encounterId: 'pack_hedgerow_vermin', x: 0, z: zOfRow(4), roam: 5 }],
    graffiti: [
      { text: 'NINE IS STILL LIVE', wallX: xOfCol(3), wallZ: zOfRow(0) + TILE / 2, dx: 0, facesSouth: true, tint: '#b7ae9d' },
    ],
  },
});
