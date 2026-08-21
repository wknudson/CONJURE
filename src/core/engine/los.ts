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
import { portraitRow } from '../types/state.js';
import { allEntities } from './board.js';
import { cellsOf } from '../util/grid.js';
import { isUnit } from '../types/units.js';

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
 * Cells that block sight. Excludes the shooter and the intended target.
 *
 * `viewer` is who is doing the looking, when anyone is. It matters only for smoke: a side
 * that ignores fog reads the cloud as empty air, and everything solid still stops them.
 * Omitting it means "nobody in particular", which is the strictest reading and therefore
 * the safe default for a caller that has not thought about it.
 */
export function occluderCells(
  state: GameState,
  ignoreIds: UnitId[] = [],
  viewer?: Side,
): Set<string> {
  const set = new Set<string>();
  for (const e of allEntities(state)) {
    if (ignoreIds.includes(e.id)) continue;
    // A Behemoth's bulk is geometry and blocks for everyone. A Guardian is a *posture* —
    // a body deliberately interposing — and that is the half a piercing eye can read
    // around. Trench plate does not make a 2x2 transparent.
    const screens = isUnit(e) && e.keywords.includes('Guardian') && e.footprint !== 2;
    const pierced = screens && viewer !== undefined && state.players[viewer].ignoresGuardians;
    const blocks = !isUnit(e) || e.footprint === 2 || (screens && !pierced);
    if (!blocks) continue;
    for (const c of cellsOf(e)) set.add(coordKey(c));
  }

  // Steam fog occludes exactly like a cover screen: you cannot shoot through the cloud,
  // but a unit standing inside it is still a legal target. Smoked glass and a tight seal
  // are what get you out of that — and only out of *that*: a Guardian is still a Guardian
  // to somebody wearing goggles.
  const seesThroughSmoke = viewer !== undefined && state.players[viewer].ignoresFog;
  if (!seesThroughSmoke) {
    for (const [key, hazard] of Object.entries(state.hazards)) {
      if (hazard.kind === 'steam_fog') set.add(key);
    }
  }

  return set;
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
  // `occluderCells` documents the default explicitly: a body standing in steam is still a
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
        const hidden = allEntities(state).find(
          (e) => isUnit(e) && cellsOf(e).some((c) => c.x === to.x && c.y === to.y),
        );
        if (hidden && state.players[(hidden as { side: Side }).side].fogConceals) return false;
      }
    }
  }

  const blockers = occluderCells(state, ignoreIds, viewer);
  return supercoverLine(from, to).every((c) => !blockers.has(coordKey(c)));
}

/**
 * Can `from` see the enemy commander's portrait?
 *
 * The portrait sits on a virtual row past the board edge. A ranged attacker needs a clear
 * straight or diagonal vector to it; Guardians and Barricades are what deny this.
 */
export function hasLoSToPortrait(
  state: GameState,
  from: Coord,
  targetSide: Side,
  ignoreIds: UnitId[] = [],
  viewer?: Side,
): boolean {
  const row = portraitRow(state, targetSide);
  const candidates: Coord[] = [
    { x: from.x, y: row },
    { x: from.x - 1, y: row },
    { x: from.x + 1, y: row },
  ];
  return candidates.some((c) => hasLoS(state, from, c, ignoreIds, viewer));
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
