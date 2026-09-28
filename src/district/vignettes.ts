/**
 * Little scenes, composed once and stamped wherever they belong.
 *
 * `place-dressing.ts` put the furniture down by searching for somewhere legal at an even stride,
 * and the atlas says what that produced: nothing is composed -- no barrels beside a stall, no cart
 * against a wall, no fire with anybody's things round it. A vignette is the composition: a cart
 * with its load spilled and a wheel off, a drovers' camp round a dead fire, a well with its trough
 * and a bucket on the stones -- props at offsets from a centre, placed as one by an area with a
 * position and a turn. The idea is Cataclysm-DDA's nested mapgen chunks (CC-BY-SA; ideas only):
 * a small authored arrangement that a larger map is assembled from.
 *
 * Expanded by `allDressing`, so every rule a prop obeys -- walkable ground, clear of doors and
 * prompts, inside the reachability flood -- a vignette's props obey too, with no second list.
 */

import type { DressingId } from './dressing.js';
import { DRESSING } from './dressing.js';
import type { DressingSpec } from './map.js';

export type VignetteId =
  | 'broken_cart'
  | 'drovers_camp'
  | 'market_corner'
  | 'well_yard'
  | 'washing_court'
  | 'wayside_shrine'
  | 'grave_plot'
  | 'smithy_yard'
  | 'charcoal_camp'
  | 'battlefield'
  | 'hay_yard'
  | 'fish_racks'
  | 'dig_site'
  | 'ruined_camp';

export interface VignettePiece {
  readonly kind: DressingId;
  readonly dx: number;
  readonly dz: number;
  /** A turn of its own, for the kinds that have a front. Added to the vignette's. */
  readonly yaw?: number;
  readonly size?: number;
}

export interface VignetteDef {
  readonly note: string;
  readonly pieces: readonly VignettePiece[];
}

/** Where an area stamps one: its centre and its turn, in radians, zero facing south. */
export interface VignetteSpec {
  readonly id: VignetteId;
  readonly x: number;
  readonly z: number;
  readonly yaw?: number;
}

export const VIGNETTES: Readonly<Record<VignetteId, VignetteDef>> = {
  broken_cart: {
    note: 'A cart off the road with a wheel gone, its load spilled beside it.',
    pieces: [
      { kind: 'cart', dx: 0, dz: 0 },
      { kind: 'sacks', dx: 1.8, dz: 0.9 },
      { kind: 'barrel', dx: -1.6, dz: 1.2 },
      { kind: 'scorch', dx: 0.6, dz: 1.9, size: 1.2 },
    ],
  },
  drovers_camp: {
    note: 'A dead fire ringed with somebody\'s things: a log to sit on, a sack, a bale for the beasts.',
    pieces: [
      { kind: 'scorch', dx: 0, dz: 0, size: 1.6 },
      { kind: 'logpile', dx: -2.2, dz: 0.4 },
      { kind: 'sacks', dx: 2.0, dz: -0.6 },
      { kind: 'haybale', dx: 1.4, dz: 2.1 },
    ],
  },
  market_corner: {
    note: 'A counter under an awning, the stock beside it in barrels and sacks.',
    pieces: [
      { kind: 'counter', dx: 0, dz: 0 },
      { kind: 'awning', dx: 0, dz: -0.8 },
      { kind: 'barrel', dx: -2.0, dz: 0.3 },
      { kind: 'sacks', dx: 2.1, dz: 0.5 },
    ],
  },
  well_yard: {
    note: 'A well, its trough, and the bollards the carts are tied to while they drink.',
    pieces: [
      { kind: 'well', dx: 0, dz: 0 },
      { kind: 'trough', dx: 2.4, dz: 0.2 },
      { kind: 'bollard', dx: -2.2, dz: 1.2 },
      { kind: 'bollard', dx: -2.2, dz: -1.2 },
    ],
  },
  washing_court: {
    note: 'Washing across a yard, a tub under it, a barrel of rainwater.',
    pieces: [
      { kind: 'washing', dx: 0, dz: 0 },
      { kind: 'trough', dx: -1.6, dz: 1.6 },
      { kind: 'barrel', dx: 1.9, dz: 1.4 },
    ],
  },
  wayside_shrine: {
    note: 'A cairn with an urn on it, flowers left, mushrooms taking the flowers.',
    pieces: [
      { kind: 'cairn', dx: 0, dz: 0 },
      { kind: 'urn', dx: 0.9, dz: 1.1 },
      { kind: 'wildflowers', dx: -1.2, dz: 1.2 },
      { kind: 'mushrooms', dx: 1.5, dz: -0.8 },
    ],
  },
  grave_plot: {
    note: 'Three stones in a row, one of them new, flowers on the old ones.',
    pieces: [
      { kind: 'gravestone', dx: -2.2, dz: 0 },
      { kind: 'gravestone', dx: 0, dz: 0 },
      { kind: 'gravestone', dx: 2.2, dz: 0 },
      { kind: 'wildflowers', dx: -1.1, dz: 1.2 },
      { kind: 'urn', dx: 1.2, dz: 1.3 },
    ],
  },
  smithy_yard: {
    note: 'An anvil in the open, the bench it is worked from, the fire, the wood for the fire.',
    pieces: [
      { kind: 'anvil', dx: 0, dz: 0 },
      { kind: 'workbench', dx: 2.4, dz: -0.4 },
      { kind: 'brazier', dx: -2.0, dz: -0.6 },
      { kind: 'logpile', dx: -2.2, dz: 1.8 },
    ],
  },
  charcoal_camp: {
    note: 'A clamp still breathing under its turf, the stacked wood waiting, the ground black round it.',
    pieces: [
      { kind: 'embervent', dx: 0, dz: 0 },
      { kind: 'scorch', dx: 0, dz: 0, size: 2.4 },
      { kind: 'logpile', dx: 2.6, dz: 0.3 },
      { kind: 'logpile', dx: -2.5, dz: -0.6 },
      { kind: 'deadfall', dx: 0.4, dz: -2.6 },
    ],
  },
  battlefield: {
    note: 'Bones in the grass where nobody came back for them, and the ground burnt in patches.',
    pieces: [
      { kind: 'bonepile', dx: 0, dz: 0 },
      { kind: 'bonepile', dx: 2.8, dz: 1.4 },
      { kind: 'scorch', dx: -1.8, dz: 1.2, size: 1.5 },
      { kind: 'scorch', dx: 1.4, dz: -1.8, size: 1.2 },
      { kind: 'deadfall', dx: -2.6, dz: -1.4 },
    ],
  },
  hay_yard: {
    note: 'Bales stacked by a pen, the cart that brought them.',
    pieces: [
      { kind: 'haybale', dx: -1.1, dz: 0 },
      { kind: 'haybale', dx: 1.1, dz: 0 },
      { kind: 'haybale', dx: 0, dz: 1.8 },
      { kind: 'pens', dx: 3.2, dz: -0.4 },
    ],
  },
  fish_racks: {
    note: 'Drying racks by the water, a barrel of salt, the reeds grown up round the posts.',
    pieces: [
      { kind: 'rack', dx: -1.3, dz: 0 },
      { kind: 'rack', dx: 1.3, dz: 0 },
      { kind: 'barrel', dx: 0, dz: 1.8 },
      { kind: 'reeds', dx: 2.6, dz: 1.2 },
    ],
  },
  dig_site: {
    note: 'A trial pit into the seam, its spoil heaped, props waiting to go in.',
    pieces: [
      { kind: 'orevein', dx: 0, dz: 0 },
      { kind: 'spoilheap', dx: 2.6, dz: 0.8 },
      { kind: 'logpile', dx: -2.3, dz: 0.6 },
      { kind: 'bollard', dx: 0.2, dz: 2.2 },
    ],
  },
  ruined_camp: {
    note: 'Somebody camped here and did not strike camp. The fire, a sack, a bone, the mushrooms.',
    pieces: [
      { kind: 'scorch', dx: 0, dz: 0, size: 1.4 },
      { kind: 'sacks', dx: 1.7, dz: 0.8 },
      { kind: 'bonepile', dx: -1.9, dz: 0.9 },
      { kind: 'mushrooms', dx: 0.3, dz: -1.9 },
      { kind: 'deadfall', dx: -2.2, dz: -1.6 },
    ],
  },
};

export const VIGNETTE_IDS = Object.keys(VIGNETTES) as readonly VignetteId[];

/**
 * A stamped vignette as the props it is made of, turned and placed. A prop that faces somewhere
 * (a panel, a box) takes the vignette's turn on top of its own; one that turns to the camera
 * (a billboard) or lies flat and round (a decal) is only moved, never given a yaw it would ignore.
 */
export function expandVignette(v: VignetteSpec): DressingSpec[] {
  const def = VIGNETTES[v.id];
  const yaw = v.yaw ?? 0;
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  return def.pieces.map((p) => {
    // Turned the way a prop's yaw turns it: zero faces south, positive turns toward the east.
    const x = v.x + p.dx * c + p.dz * s;
    const z = v.z - p.dx * s + p.dz * c;
    const form = DRESSING[p.kind].form;
    const turned = form === 'panel' || form === 'box';
    const spec: DressingSpec = {
      kind: p.kind,
      x: Math.round(x * 100) / 100,
      z: Math.round(z * 100) / 100,
      ...(turned && (p.yaw ?? 0) + yaw !== 0 ? { yaw: (p.yaw ?? 0) + yaw } : {}),
      ...(p.size ? { size: p.size } : {}),
    };
    return spec;
  });
}
