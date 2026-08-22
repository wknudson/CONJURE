/**
 * Grid geometry. Footprint-aware helpers live here and are used by movement, LoS,
 * displacement, and targeting so the 2x2 Behemoth rules are written exactly once.
 */

import type { Coord } from '../../contract/ids.js';

export interface Footprinted {
  anchor: Coord;
  footprint: 1 | 2;
}

/** The cells an entity occupies. For a 2x2, `anchor` is the top-left cell. */
export function cellsOf(e: Footprinted): Coord[] {
  const { x, y } = e.anchor;
  if (e.footprint === 1) return [{ x, y }];
  return [
    { x, y },
    { x: x + 1, y },
    { x, y: y + 1 },
    { x: x + 1, y: y + 1 },
  ];
}

/** Cells a footprint would occupy at a hypothetical anchor. */
export function cellsAt(anchor: Coord, footprint: 1 | 2): Coord[] {
  return cellsOf({ anchor, footprint });
}

export const add = (a: Coord, b: Coord): Coord => ({ x: a.x + b.x, y: a.y + b.y });
export const sub = (a: Coord, b: Coord): Coord => ({ x: a.x - b.x, y: a.y - b.y });

/** Chebyshev distance: diagonal steps cost the same as orthogonal, matching movement. */
export const chebyshev = (a: Coord, b: Coord): number =>
  Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

/** Manhattan distance, used for the `+` shaped mark blast patterns. */
export const manhattan = (a: Coord, b: Coord): number =>
  Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

/** The 8 movement/attack directions. Order is fixed for deterministic enumeration. */
export const DIRS_8: readonly Coord[] = [
  { x: 0, y: -1 },
  { x: 1, y: -1 },
  { x: 1, y: 0 },
  { x: 1, y: 1 },
  { x: 0, y: 1 },
  { x: -1, y: 1 },
  { x: -1, y: 0 },
  { x: -1, y: -1 },
];

export const DIRS_4: readonly Coord[] = [
  { x: 0, y: -1 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
];

/** Normalises a delta into a unit step direction (-1, 0, or 1 per axis). */
export function toDirection(delta: Coord): Coord {
  return { x: Math.sign(delta.x), y: Math.sign(delta.y) };
}

/**
 * Minimum Chebyshev distance between two footprints — the range check for attacks,
 * so a 2x2 Behemoth threatens from any of its four cells.
 */
export function footprintDistance(a: Footprinted, b: Footprinted): number {
  let best = Infinity;
  for (const ca of cellsOf(a)) {
    for (const cb of cellsOf(b)) {
      const d = chebyshev(ca, cb);
      if (d < best) best = d;
    }
  }
  return best;
}
