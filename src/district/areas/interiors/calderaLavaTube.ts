/**
 * The lava tube -- under the Caldera's north wall, where the heat comes from.
 *
 * A tunnel the mountain blew and the drake denned in, before the tap field was cut and the
 * nine went in after it. Crust underfoot, slag where the floor slumped, a vent at the far end
 * that breathes embers, and something living in the dark past it that does not come out into
 * the light -- the same hollows that live in the Verge's spoil, further from the ward and
 * nearer the fire. What the drake hoarded is behind them, once the chimera is answered for.
 */

import { TILE, defineArea, type AreaDef, type TileDef } from '../../map.js';

const LEGEND: Record<string, TileDef> = {
  '#': {
    tex: 'slag',
    safe: false,
    walk: false,
    solid: { minHeight: 5.5, maxHeight: 5.5, inset: 0, depthInset: 0, chimneyChance: 0, split: false, wall: 'rock', bare: true },
  },
  c: { tex: 'crust', safe: false, walk: true },
  s: { tex: 'slag', safe: false, walk: true },
  k: { tex: 'cave', safe: false, walk: true },
};

const GRID: readonly string[] = [
  '############', //  0
  '#kkkkkkkkkk#', //  1  the dark end; the hoard
  '#kkkkkkkkkk#', //  2
  '#kkkkkkkkkk#', //  3  the hollows
  '#kkkkkkkkkk#', //  4
  '#ssssssssss#', //  5
  '#ssssssssss#', //  6
  '#sscccccsss#', //  7
  '#ccccccccсc#'.replace('с', 'c'), //  8  the vent
  '#cccccccccc#', //  9
  '#cccccccccc#', // 10
  '#cccccccccc#', // 11
  '#####cc#####', // 12  the mouth
];

const HALF_X = (GRID[0]!.length * TILE) / 2;
const HALF_Z = (GRID.length * TILE) / 2;
const xOfCol = (col: number): number => col * TILE - HALF_X + TILE / 2;
const zOfRow = (row: number): number => row * TILE - HALF_Z + TILE / 2;

export const CALDERA_LAVA_TUBE_ID = 'caldera_lava_tube';

export const CALDERA_LAVA_TUBE: AreaDef = defineArea({
  id: CALDERA_LAVA_TUBE_ID,
  name: 'The Lava Tube',
  grid: GRID,
  legend: LEGEND,
  spawn: { x: 0, z: zOfRow(9) },
  safety: 'none',
  indoor: { camera: { distance: 20, pitch: 54, fov: 30 } },
  exits: [
    {
      to: 'caldera',
      x: 0,
      z: zOfRow(12),
      label: 'Out onto the ash',
      arrive: { x: 28, z: -41 },
    },
  ],
  props: {
    sky: 'none',
    horizon: 'none',
    dressing: [
      { kind: 'scorch', x: xOfCol(3), z: zOfRow(6) },
      { kind: 'scorch', x: xOfCol(8), z: zOfRow(10) },
      { kind: 'spoilheap', x: xOfCol(10), z: zOfRow(6) },
      { kind: 'cairn', x: xOfCol(1), z: zOfRow(9) },
      { kind: 'brazier', x: xOfCol(10), z: zOfRow(10) },
    ],
    /**
     * The hollows, in the dark end. Short roam: a tube is not a road, and a crew that wandered
     * to the mouth would jump you on the first step in.
     */
    packs: [{ encounterId: 'pack_spoil_heap_hollows', x: 0, z: zOfRow(3), roam: 5 }],
    graffiti: [
      { text: 'NINE WENT IN', wallX: xOfCol(3), wallZ: zOfRow(0) + TILE / 2, dx: 0, facesSouth: true, tint: '#a4543a' },
    ],
  },
});
