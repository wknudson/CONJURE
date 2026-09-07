/**
 * The Foundry Hall -- the building the Cinderworks was always implied to have.
 *
 * A bank of furnaces along the north wall with the hearth in front of them, iron underfoot,
 * anvils, a bench, and the flats: the open casting floor the `dynamo_flats` contract is fought
 * on, which is a site on this floor now rather than a label on the ash outside. The foreman
 * runs it. The vent by the east wall breathes what the furnaces do not, and the strongbox
 * behind the anvils opens once the flats have been cleared. The door is on the south wall,
 * onto the lane below the casting floor.
 */

import { TILE, defineArea, type AreaDef, type TileDef } from '../../map.js';

const LEGEND: Record<string, TileDef> = {
  '#': {
    tex: 'ironplate',
    safe: false,
    walk: false,
    solid: { minHeight: 6.0, maxHeight: 6.0, inset: 0, depthInset: 0, chimneyChance: 0, split: false, wall: 'stone', bare: true },
  },
  F: {
    tex: 'hearth',
    safe: false,
    walk: false,
    solid: { minHeight: 3.6, maxHeight: 3.6, inset: 0.15, depthInset: 0.15, chimneyChance: 1, split: false, wall: 'stone' },
  },
  i: { tex: 'ironplate', safe: false, walk: true },
  h: { tex: 'hearth', safe: false, walk: true },
};

const GRID: readonly string[] = [
  '################', //  0
  '#iiiiiFFFFiiiii#', //  1  the furnace bank
  '#iiiihhhhhhiiii#', //  2  the hearth
  '#iiiiiiiiiiiiii#', //  3
  '#iiiiiiiiiiiiii#', //  4  the flats
  '#iiiiiiiiiiiiii#', //  5
  '#iiiiiiiiiiiiii#', //  6
  '#iiiiiiiiiiiiii#', //  7
  '#iiiiiiiiiiiiii#', //  8
  '#iiiiiiiiiiiiii#', //  9
  '#iiiiiiiiiiiiii#', // 10
  '#iiiiiiiiiiiiii#', // 11
  '#######ii#######', // 12  the door, onto the lane
];

const HALF_X = (GRID[0]!.length * TILE) / 2;
const HALF_Z = (GRID.length * TILE) / 2;
const xOfCol = (col: number): number => col * TILE - HALF_X + TILE / 2;
const zOfRow = (row: number): number => row * TILE - HALF_Z + TILE / 2;

export const CINDERWORKS_FOUNDRY_ID = 'cinderworks_foundry';

export const CINDERWORKS_FOUNDRY: AreaDef = defineArea({
  id: CINDERWORKS_FOUNDRY_ID,
  name: 'The Foundry Hall',
  grid: GRID,
  legend: LEGEND,
  spawn: { x: 0, z: zOfRow(9) },
  safety: 'none',
  indoor: { camera: { distance: 20, pitch: 54, fov: 30 } },
  exits: [
    {
      to: 'cinderworks',
      x: 0,
      z: zOfRow(12),
      label: 'Out onto the lane',
      arrive: { x: 3.2, z: -30 },
    },
  ],
  props: {
    sky: 'none',
    horizon: 'none',
    dressing: [
      { kind: 'anvil', x: xOfCol(2), z: zOfRow(3) },
      { kind: 'anvil', x: xOfCol(12), z: zOfRow(3) },
      { kind: 'workbench', x: xOfCol(2), z: zOfRow(2) },
      { kind: 'barrel', x: xOfCol(14), z: zOfRow(2) },
      { kind: 'barrel', x: xOfCol(14), z: zOfRow(3) },
      { kind: 'spoilheap', x: xOfCol(14), z: zOfRow(9) },
      { kind: 'brazier', x: xOfCol(1), z: zOfRow(9) },
      { kind: 'cart', x: xOfCol(13), z: zOfRow(11) },
    ],
    npcs: [
      { id: 'cinderworks_foreman', x: xOfCol(2), z: zOfRow(7), art: 'blacksmith', label: 'Talk to the foreman' },
    ],
    graffiti: [
      { text: 'THE STACK NEVER SLEEPS', wallX: xOfCol(2.5), wallZ: zOfRow(0) + TILE / 2, dx: 0, facesSouth: true, tint: '#c2661f' },
    ],
  },
});
