/**
 * The Ironworks Artificer — the inside of it.
 *
 * The first room in the world. Until now the Artificer was a twenty-pixel anvil on a terrace
 * wall and a full-screen menu behind it; this is the forge floor that menu was standing in for,
 * and the bench that opens it stands at the back, past the furnace. See `IndoorSpec` in
 * `../../map.ts` for what a room *is* — an area like any other, with the sky taken off.
 *
 * Laid out as a working shop rather than a hall: iron plate where the heat is, boards where the
 * customers stand, a hearth of blackened stone around the furnace mouth, and one door back to
 * the cross-street. The furnace is a solid block with its own stack, so the chimney the street
 * sees is the chimney this room is under.
 */

import { TILE, defineArea, type AreaDef, type TileDef } from '../../map.js';

const LEGEND: Record<string, TileDef> = {
  // The walls. Bare -- no parapet, no chimney -- because a room's wall is a wall and not a
  // building, and brick because it is the same brick the street is built of.
  '#': {
    tex: 'ironplate',
    safe: false,
    walk: false,
    solid: { minHeight: 5.2, maxHeight: 5.2, inset: 0, depthInset: 0, chimneyChance: 0, split: false, wall: 'brick', bare: true },
  },
  // The furnace. Stone, and the one thing in here with a stack.
  F: {
    tex: 'hearth',
    safe: false,
    walk: false,
    solid: { minHeight: 3.4, maxHeight: 3.4, inset: 0.15, depthInset: 0.15, chimneyChance: 1, split: false, wall: 'stone' },
  },
  i: { tex: 'ironplate', safe: false, walk: true },
  h: { tex: 'hearth', safe: false, walk: true },
  p: { tex: 'planks', safe: false, walk: true },
};

const GRID: readonly string[] = [
  '################', //  0
  '#iiiiiiiiFFiiii#', //  1  the furnace, against the north wall
  '#iiiiiiiiFFiiii#', //  2
  '#iihhhhhhhhhhii#', //  3  the hearth
  '#iiiiiiiiiiiiii#', //  4  the forge floor
  '#iiiiiiiiiiiiii#', //  5
  '#ppppppiiiipppp#', //  6
  '#pppppppppppppp#', //  7  the shop floor
  '#pppppppppppppp#', //  8
  '#pppppppppppppp#', //  9
  '#pppppppppppppp#', // 10
  '#pppppppppppppp#', // 11
  '#pppppppppppppp#', // 12
  '#######pp#######', // 13  the door, back to the cross-street
];

const HALF_X = (GRID[0]!.length * TILE) / 2;
const HALF_Z = (GRID.length * TILE) / 2;
const xOfCol = (col: number): number => col * TILE - HALF_X + TILE / 2;
const zOfRow = (row: number): number => row * TILE - HALF_Z + TILE / 2;

/** The doorway, on the south wall. Where you stand to leave, and where you are put down arriving. */
export const IRONWORKS_DOOR = { x: 0, z: zOfRow(13) } as const;
export const IRONWORKS_ARRIVE = { x: 0, z: zOfRow(12) } as const;

export const ASHFALL_IRONWORKS_ID = 'ashfall_ironworks';

export const ASHFALL_IRONWORKS: AreaDef = defineArea({
  id: ASHFALL_IRONWORKS_ID,
  name: 'The Ironworks Artificer',
  grid: GRID,
  legend: LEGEND,
  spawn: { x: 0, z: zOfRow(11) },
  safety: 'none',
  indoor: { camera: { distance: 19, pitch: 54, fov: 30 } },
  exits: [
    {
      to: 'ashfall_ward',
      x: IRONWORKS_DOOR.x,
      z: IRONWORKS_DOOR.z,
      label: 'Out to the cross-street',
      // Onto the pavement a stride clear of the way back in.
      arrive: { x: -18, z: 12.2 },
    },
  ],
  props: {
    sky: 'none',
    horizon: 'none',
    /** Fire to see by. A forge has no gas lamps; it has the furnace and two baskets of coals. */
    dressing: [
      { kind: 'brazier', x: xOfCol(3), z: zOfRow(4) },
      { kind: 'anvil', x: -2, z: -9.6 },
      { kind: 'brazier', x: xOfCol(12), z: zOfRow(4) },
      { kind: 'barrel', x: xOfCol(1), z: zOfRow(8) },
      { kind: 'barrel', x: xOfCol(1), z: zOfRow(9) },
      { kind: 'rack', x: xOfCol(14), z: zOfRow(7), },
      { kind: 'sacks', x: xOfCol(14), z: zOfRow(11) },
    ],
    /** The tally chalked over the furnace. A shop keeps count of what it has made. */
    graffiti: [
      { text: 'FORTY-ONE STRUCK, THREE SPLIT', wallX: xOfCol(4), wallZ: zOfRow(0) + TILE / 2, dx: 1.0, facesSouth: true, tint: '#d8c8a8' },
    ],
  },
});
