/**
 * The Tannery -- the one on Tannery Row with a door you can use.
 *
 * The ward walled the stink off the east end of the cross-street and called what was left a row.
 * Inside is the trade itself: the lime pits and the tan pits sunk along the back wall, the beam
 * the hides are scraped over, the racks, and the bark in its pile for the liquor. The tanner
 * and the boy who stirs. The door is on the south wall, onto the lane below the pit yard.
 */

import { TILE, defineArea, type AreaDef, type TileDef } from '../../map.js';

const LEGEND: Record<string, TileDef> = {
  '#': {
    tex: 'flagstone',
    safe: false,
    walk: false,
    solid: { minHeight: 5.0, maxHeight: 5.0, inset: 0, depthInset: 0, chimneyChance: 0, split: false, wall: 'timber', bare: true },
  },
  '.': { tex: 'flagstone', safe: false, walk: true },
  s: { tex: 'straw', safe: false, walk: true },
  v: { tex: 'water', safe: false, walk: false },
};

const GRID: readonly string[] = [
  '############', //  0
  '#vvv.vv.vvv#', //  1  the pits along the back wall: lime, then the tan liquor, strongest first
  '#..........#', //  2
  '#..........#', //  3
  '#..........#', //  4  the floor, wet
  '#s.........#', //  5  the bark, in its pile
  '#s.........#', //  6
  '#..........#', //  7
  '#..........#', //  8
  '#....ss....#', //  9
  '#....ss....#', // 10  the threshold
  '#####..#####', // 11  the door, onto the lane
];

const HALF_Z = (GRID.length * TILE) / 2;
const zOfRow = (row: number): number => row * TILE - HALF_Z + TILE / 2;

export const ASHFALL_TANNERY_ID = 'ashfall_tannery';

export const ASHFALL_TANNERY: AreaDef = defineArea({
  id: ASHFALL_TANNERY_ID,
  name: 'The Tannery',
  grid: GRID,
  legend: LEGEND,
  spawn: { x: 0, z: zOfRow(9) },
  safety: 'none',
  indoor: { camera: { distance: 17, pitch: 54, fov: 30 } },
  exits: [
    {
      to: 'ashfall_ward',
      x: 0,
      z: zOfRow(11),
      label: 'Out onto the Row',
      // West along the lane from the door, clear of the pit yard's corner and the way back in.
      arrive: { x: 98.6, z: -9.4 },
    },
  ],
  props: {
    sky: 'none',
    horizon: 'none',
    // Against the walls, so the floor is clear enough to fight on: the racks and the beam down
    // the east side, the bark and the liquor barrels down the west.
    dressing: [
      { kind: 'rack', x: 18, z: -6 },
      { kind: 'rack', x: 18, z: 2 },
      { kind: 'workbench', x: 18, z: 10 },
      { kind: 'logpile', x: -18, z: 0 },
      { kind: 'barrel', x: -18, z: -12 },
      { kind: 'barrel', x: 18, z: -14 },
      { kind: 'brazier', x: -18, z: 16 },
    ],
    npcs: [
      { id: 'ashfall_tanner', x: -6, z: -6, art: 'tanner', label: 'Talk to the tanner' },
      { id: 'ashfall_tanners_boy', x: 6, z: -14, art: 'street_urchin', label: 'Talk to the boy at the pits' },
    ],
    graffiti: [
      { text: 'HIDES IN BY SIX', wallX: -8, wallZ: zOfRow(0) + TILE / 2, dx: 0, facesSouth: true, tint: '#7a6a5a' },
    ],
  },
});
