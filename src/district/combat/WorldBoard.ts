/**
 * Where on the road a fight actually fits.
 *
 * The combat grid is laid on real district tiles rather than floated over them, and it can be
 * because the two grids share a pitch: `TILE` world units per district tile, and one combat
 * tile is the same square. That is not a coincidence to be preserved by luck — see `TILE`'s
 * own note on why it is global — but it is what makes this module a rect scan over the area's
 * own ASCII rather than a geometry problem.
 *
 * The rule the search enforces is narrower than "somewhere you can walk". Grass, field, verge
 * and broken cobble are all perfectly good ground to have a fight on, and demanding `walk`
 * would rule out most of the Chalk Road — whose road proper is three rows deep, against
 * encounters that want nine. What actually ruins a board is a building standing in the middle
 * of it or a tile that is open water. So those two are the only disqualifiers, and everything
 * else is arena.
 *
 * Pure: `AreaDef` and tile coordinates in, a transform out. No three.js, no DOM, so the
 * placement rule is testable without a canvas — which matters, because a board that lands
 * inside a warehouse is the one failure of this feature a player cannot look past.
 */

import type { Coord } from '../../contract/ids.js';
import { TILE, xOfCol, zOfRow, type AreaDef, type Rect } from '../map.js';

/** A tile the board may not cover, and why. Reported rather than merely counted. */
export interface Blocker {
  readonly col: number;
  readonly row: number;
  readonly reason: 'solid' | 'water' | 'out-of-bounds';
}

export interface WorldBoard {
  /** The district tile the combat grid's (0,0) sits on. */
  readonly col: number;
  readonly row: number;
  /** The combat grid's own extent, in tiles. */
  readonly w: number;
  readonly h: number;
  /**
   * Whether the search found somewhere genuinely clear.
   *
   * False means every window was compromised and this is the least bad one — the caller is
   * expected to fade what `blockers` names rather than pretend the ground is empty.
   */
  readonly clean: boolean;
  /** What stands inside the footprint anyway. Empty whenever `clean`. */
  readonly blockers: readonly Blocker[];
  /** Combat tile -> the world point at its centre. */
  centreOf(c: Coord): { x: number; z: number };
  /** The world point at the middle of the whole board, for framing the camera. */
  centre(): { x: number; z: number };
}

/**
 * Whether a district tile can have a fight on it.
 *
 * Reads the legend rather than the character, so an area that invents its own rock face gets
 * the right answer without this file learning about it.
 */
function blockerAt(area: AreaDef, col: number, row: number): Blocker | null {
  if (col < 0 || row < 0 || col >= area.cols || row >= area.rows) {
    return { col, row, reason: 'out-of-bounds' };
  }
  const def = area.legend[area.grid[row]![col]!];
  if (!def) return { col, row, reason: 'out-of-bounds' };
  if (def.solid) return { col, row, reason: 'solid' };
  // By texture rather than by `walk`: a canal is the one unwalkable thing that is unwalkable
  // because it is *wet*, and a board half in the water reads as a bug however legal it is.
  if (def.tex === 'water') return { col, row, reason: 'water' };
  return null;
}

/**
 * The best place to put a `w x h` board near `at`.
 *
 * Every window is considered, scored by how far its centre sits from the ambush, and the
 * nearest clear one wins. Exhaustive rather than a spiral outward from the contact tile: the
 * grids are at most a few hundred tiles, this runs once per fight, and "nearest clear window"
 * is a claim a test can check exactly, which a heuristic walk is not.
 *
 * Always returns a board. A fight has already started by the time this is called — the ring
 * has closed and the pulls are settled — so there is no useful failure here, only a worse
 * placement, and `clean` is how the caller tells the difference.
 */
export function placeBoard(
  area: AreaDef,
  at: { x: number; z: number },
  w: number,
  h: number,
): WorldBoard {
  let best: { col: number; row: number; blockers: Blocker[]; score: number } | null = null;

  // Windows are allowed to start outside the grid, so a board wider than the area still
  // centres on the fight instead of being jammed against one edge. Anything off the map comes
  // back as an `out-of-bounds` blocker and is scored accordingly.
  const fromCol = Math.min(0, area.cols - w);
  const fromRow = Math.min(0, area.rows - h);
  const toCol = Math.max(0, area.cols - w);
  const toRow = Math.max(0, area.rows - h);

  for (let row = fromRow; row <= toRow; row++) {
    for (let col = fromCol; col <= toCol; col++) {
      const blockers: Blocker[] = [];
      for (let r = 0; r < h; r++) {
        for (let c = 0; c < w; c++) {
          const b = blockerAt(area, col + c, row + r);
          if (b) blockers.push(b);
        }
      }

      // The centre of the window, in world units, against the point the fight started at.
      const cx = xOfCol(area, col) + ((w - 1) * TILE) / 2;
      const cz = zOfRow(area, row) + ((h - 1) * TILE) / 2;
      const distance = Math.hypot(cx - at.x, cz - at.z);

      // Blockers dominate the score outright, so a clean window ten strides away always beats
      // a compromised one underfoot. Within either group, closest to the fight wins.
      const score = blockers.length * 10_000 + distance;
      if (!best || score < best.score) best = { col, row, blockers, score };
    }
  }

  const chosen = best!;
  return makeBoard(area, chosen.col, chosen.row, w, h, chosen.blockers);
}

/** A board at a stated origin, bypassing the search. For tests and for the dev console. */
export function boardAt(
  area: AreaDef,
  col: number,
  row: number,
  w: number,
  h: number,
): WorldBoard {
  const blockers: Blocker[] = [];
  for (let r = 0; r < h; r++) {
    for (let c = 0; c < w; c++) {
      const b = blockerAt(area, col + c, row + r);
      if (b) blockers.push(b);
    }
  }
  return makeBoard(area, col, row, w, h, blockers);
}

function makeBoard(
  area: AreaDef,
  col: number,
  row: number,
  w: number,
  h: number,
  blockers: Blocker[],
): WorldBoard {
  return {
    col,
    row,
    w,
    h,
    clean: blockers.length === 0,
    blockers,
    // Fractional coordinates pass straight through, which is what the animation handlers
    // need: a body mid-step sits between two tiles and has to be drawn there.
    centreOf: (c: Coord) => ({
      x: xOfCol(area, col) + c.x * TILE,
      z: zOfRow(area, row) + c.y * TILE,
    }),
    centre: () => ({
      x: xOfCol(area, col) + ((w - 1) * TILE) / 2,
      z: zOfRow(area, row) + ((h - 1) * TILE) / 2,
    }),
  };
}

/**
 * The district buildings a board overlaps, as whole rectangles.
 *
 * `blockers` is per-tile and says *that* something is in the way; this says *what*, in the
 * same units `world.ts` extracted the geometry in, so the caller can find the mesh and fade
 * it. Only the solid blockers matter here — there is no mesh to fade for open water.
 */
export function overlappedRects(board: WorldBoard, rects: readonly Rect[]): Rect[] {
  return rects.filter(
    (r) =>
      r.col < board.col + board.w &&
      r.col + r.w > board.col &&
      r.row < board.row + board.h &&
      r.row + r.d > board.row,
  );
}
