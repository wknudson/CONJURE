/**
 * Line of sight.
 *
 * Uses a supercover line (every cell the ideal segment touches, not Bresenham's
 * corner-clipped subset) so an occluder can never be "shot past" through a corner.
 * Occluders are obstacles, Guardians, and 2x2 Behemoths — exactly the doc's shadow-cone
 * casters. On a 5x5 board this is exact and costs nothing.
 */

import type { Coord, Side, UnitId } from '../../contract/ids.js';
import { coordKey } from '../../contract/ids.js';
import type { GameState } from '../types/state.js';
import { occupies } from '../util/grid.js';
import type { Unit } from '../types/units.js';

/**
 * All cells strictly between a and b that the segment passes through.
 *
 * An exact corner crossing (a true 45-degree diagonal) steps diagonally and counts only
 * the cell it enters, not the two flanking cells. That keeps clean diagonal vectors
 * usable — the docs explicitly allow ranged attacks along "a straight or diagonal
 * vector", and counting flankers would block nearly every diagonal on a 5x5 board.
 * Blocking therefore requires an occluder genuinely on the line.
 */
export function supercoverLine(a: Coord, b: Coord): Coord[] {
  const out: Coord[] = [];
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const nx = Math.abs(dx);
  const ny = Math.abs(dy);
  const signX = Math.sign(dx);
  const signY = Math.sign(dy);

  let x = a.x;
  let y = a.y;
  let ix = 0;
  let iy = 0;

  while (ix < nx || iy < ny) {
    // Compare fractional progress along each axis without floating point.
    const cmp = (1 + 2 * ix) * ny - (1 + 2 * iy) * nx;
    if (cmp === 0) {
      x += signX;
      y += signY;
      ix++;
      iy++;
    } else if (cmp < 0) {
      x += signX;
      ix++;
    } else {
      y += signY;
      iy++;
    }
    pushIfBetween(out, { x, y }, a, b);
  }

  return out;
}

function pushIfBetween(out: Coord[], c: Coord, a: Coord, b: Coord): void {
  if ((c.x === a.x && c.y === a.y) || (c.x === b.x && c.y === b.y)) return;
  if (out.some((o) => o.x === c.x && o.y === c.y)) return;
  out.push(c);
}

/**
 * Whether a body stops sight. The rule, written once.
 *
 * `viewer` is who is doing the looking, when anyone is. Omitting it means "nobody in
 * particular", which is the strictest reading and therefore the safe default for a caller
 * that has not thought about it.
 *
 * A Behemoth's bulk is geometry and blocks for everyone. A Guardian is a *posture* — a body
 * deliberately interposing — and that is the half a piercing eye can read around. Trench
 * plate does not make a 2x2 transparent.
 *
 * Obstacles are not asked: every obstacle blocks sight, cover included, which is what makes
 * cover cover. Only units have a say.
 */
function unitBlocks(state: GameState, u: Unit, viewer?: Side): boolean {
  if (u.footprint === 2) return true;
  if (!u.keywords.includes('Guardian')) return false;
  return viewer === undefined || !state.players[viewer].ignoresGuardians;
}

/** Whether this side reads a steam cloud as empty air. */
function seesThroughSmoke(state: GameState, viewer?: Side): boolean {
  return viewer !== undefined && state.players[viewer].ignoresFog;
}

/**
 * Whether one cell stops sight. Excludes the shooter and the intended target, via
 * `ignoreIds`.
 *
 * This replaced `occluderCells`, which answered the same question for the *whole board* and
 * was what `hasLoS` used to call — once per call. It built every entity's `cellsOf` array, a
 * `coordKey` string per occupied cell, a `Set` insertion each, and an `Object.entries` over
 * the hazards, and then asked about the two or three cells actually on the line. On a board
 * where `hasLoS` runs hundreds of times a turn that is an enormous amount of string and Set
 * churn to answer a question about a handful of tiles, and a CPU profile put it at 6.7% of
 * all engine time.
 *
 * Steam fog occludes exactly like a cover screen: you cannot shoot through the cloud, but a
 * unit standing inside it is still a legal target. Smoked glass and a tight seal are what get
 * you out of that — and only out of *that*: a Guardian is still a Guardian to somebody
 * wearing goggles.
 *
 * Same rule, same answers, in integer comparisons.
 */
function cellOccludes(
  state: GameState,
  c: Coord,
  ignoreIds: UnitId[],
  viewer: Side | undefined,
  smokeBlocks: boolean,
): boolean {
  // Cheapest first: one string only where somebody has actually laid a cloud.
  if (smokeBlocks && state.hazards[coordKey(c)]?.kind === 'steam_fog') return true;

  // Every obstacle blocks, cover included. Membership, not a rule.
  for (const id in state.obstacles) {
    const o = state.obstacles[id]!;
    if (!occupies(o, c)) continue;
    if (ignoreIds.includes(o.id)) continue;
    return true;
  }

  for (const id in state.units) {
    const u = state.units[id]!;
    if (!occupies(u, c)) continue;
    if (ignoreIds.includes(u.id)) continue;
    if (unitBlocks(state, u, viewer)) return true;
  }

  return false;
}

export function hasLoS(
  state: GameState,
  from: Coord,
  to: Coord,
  ignoreIds: UnitId[] = [],
  viewer?: Side,
): boolean {
  // Fog-Stalker, and the one rule that looks at the *destination* rather than the path.
  //
  // `cellOccludes` documents the default explicitly: a body standing in steam is still a
  // legal target. This side is the exception — it melts into the cloud instead of merely
  // hiding behind it. Goggles beat it, so `ignoresFog` and this remain an answer to each
  // other rather than stacking into "nobody can shoot anybody".
  //
  // Ordered cheapest-first on purpose. `hasLoS` is one of the hottest functions in the
  // game — the Adept's threat map calls it hundreds of times per turn — so the first
  // question has to be two boolean reads and no allocation. Only a fight where somebody
  // actually brought the knack pays for a `coordKey`, and only a shot *into* a fogged
  // tile pays for the entity scan.
  if (state.players.player.fogConceals || state.players.enemy.fogConceals) {
    if (viewer === undefined || !state.players[viewer].ignoresFog) {
      if (state.hazards[coordKey(to)]?.kind === 'steam_fog') {
        // Units only, and without building a thing: same reason as `cellOccludes`. This was
        // the last `allEntities` sweep in the file.
        for (const id in state.units) {
          const u = state.units[id]!;
          if (!occupies(u, to)) continue;
          if (state.players[u.side].fogConceals) return false;
          break;
        }
      }
    }
  }

  const between = supercoverLine(from, to);
  // Adjacent, or the same tile. There is nothing in between, so nothing can be in the way —
  // and this is the common case: melee reach, adjacency checks, and every step of a threat
  // map's inner loop. The old shape built the board's whole occluder set before discovering
  // it had no cells to test it against, which was the single most wasteful thing here.
  if (between.length === 0) return true;

  const smokeBlocks = !seesThroughSmoke(state, viewer);
  for (const c of between) {
    if (cellOccludes(state, c, ignoreIds, viewer, smokeBlocks)) return false;
  }
  return true;
}

/** Tiles the given origin cannot see — the renderer's shadow-cone fog. */
export function occludedTiles(state: GameState, from: Coord, viewer?: Side): Coord[] {
  const out: Coord[] = [];
  for (let y = 0; y < state.height; y++) {
    for (let x = 0; x < state.width; x++) {
      const c = { x, y };
      if (c.x === from.x && c.y === from.y) continue;
      if (!hasLoS(state, from, c, [], viewer)) out.push(c);
    }
  }
  return out;
}
