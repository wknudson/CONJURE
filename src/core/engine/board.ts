/**
 * Board queries. Occupancy is DERIVED, never stored: every lookup scans entities via
 * cellsOf(). On a 5x5 board with <30 entities this is trivially cheap, and it removes an
 * entire class of "grid array out of sync with entity list" bugs.
 */

import type { Coord, Side, TargetRef, UnitId } from '../../contract/ids.js';
import { coordEq } from '../../contract/ids.js';
import { cellsAt, cellsOf } from '../util/grid.js';
import type { Entity, Obstacle, Unit } from '../types/units.js';
import { isUnit } from '../types/units.js';
import type { GameState } from '../types/state.js';
import { inBounds, startingZone } from '../types/state.js';

export function allUnits(state: GameState): Unit[] {
  return Object.values(state.units);
}

export function allObstacles(state: GameState): Obstacle[] {
  return Object.values(state.obstacles);
}

export function allEntities(state: GameState): Entity[] {
  return [...allUnits(state), ...allObstacles(state)];
}

export function unitsOf(state: GameState, side: Side): Unit[] {
  return allUnits(state).filter((u) => u.side === side);
}

/** The entity occupying a cell, if any. */
/**
 * The entity standing on a tile. Units may share a tile with cover terrain, so a unit
 * always wins the lookup — attacks and displacement should find the body, not the bush.
 */
export function entityAt(state: GameState, c: Coord): Entity | undefined {
  let cover: Entity | undefined;
  for (const e of allEntities(state)) {
    if (!cellsOf(e).some((cell) => coordEq(cell, c))) continue;
    if (isCover(e)) {
      cover ??= e;
      continue;
    }
    return e;
  }
  return cover;
}

export function unitAt(state: GameState, c: Coord): Unit | undefined {
  for (const u of allUnits(state)) {
    if (cellsOf(u).some((cell) => coordEq(cell, c))) return u;
  }
  return undefined;
}

/** The cover terrain on a tile, if any, regardless of who is standing on it. */
export function coverAt(state: GameState, c: Coord): Entity | undefined {
  for (const o of allObstacles(state)) {
    if (isCover(o) && cellsOf(o).some((cell) => coordEq(cell, c))) return o;
  }
  return undefined;
}

export function getEntity(state: GameState, id: UnitId): Entity | undefined {
  return state.units[id] ?? state.obstacles[id];
}

export function refOf(e: Entity): TargetRef {
  return isUnit(e) ? { kind: 'unit', id: e.id } : { kind: 'obstacle', id: e.id };
}

/** True if every cell of a footprint placed at `anchor` is in bounds and free. */
export function canPlace(
  state: GameState,
  anchor: Coord,
  footprint: 1 | 2,
  ignoreId?: UnitId,
): boolean {
  const cells = cellsAt(anchor, footprint);
  for (const c of cells) {
    if (!inBounds(state, c)) return false;
    const occ = entityAt(state, c);
    if (!occ || occ.id === ignoreId) continue;
    // Cover is low terrain — units walk onto it freely. Everything else blocks.
    if (!isCover(occ)) return false;
  }
  return true;
}

/** Low terrain that blocks sight but not movement. Units are never cover. */
export function isCover(e: Entity | undefined): boolean {
  return e !== undefined && !isUnit(e) && e.cover === true;
}

/** Empty tiles in a side's own territory where a footprint fits — the summon zone. */
export function summonSpots(state: GameState, side: Side, footprint: 1 | 2): Coord[] {
  const rows = startingZone(state, side);
  const spots: Coord[] = [];
  for (let y = 0; y < state.height; y++) {
    if (!rows.includes(y)) continue;
    for (let x = 0; x < state.width; x++) {
      const anchor = { x, y };
      if (!canPlace(state, anchor, footprint)) continue;
      // A 2x2 must fit entirely inside friendly territory.
      if (footprint === 2 && !cellsAt(anchor, 2).every((c) => rows.includes(c.y))) continue;
      spots.push(anchor);
    }
  }
  return spots;
}

/** All empty single tiles anywhere on the board (Stone Barricade). */
export function emptyTiles(state: GameState): Coord[] {
  const out: Coord[] = [];
  for (let y = 0; y < state.height; y++) {
    for (let x = 0; x < state.width; x++) {
      if (!entityAt(state, { x, y })) out.push({ x, y });
    }
  }
  return out;
}

export const opposite = (side: Side): Side => (side === 'player' ? 'enemy' : 'player');

/** Lowest-HP enemy unit; ties break deterministically by row then column. */
export function lowestHpEnemy(state: GameState, side: Side): Unit | undefined {
  const foes = unitsOf(state, opposite(side));
  if (foes.length === 0) return undefined;
  return foes.slice().sort((a, b) => {
    if (a.hp !== b.hp) return a.hp - b.hp;
    if (a.anchor.y !== b.anchor.y) return b.anchor.y - a.anchor.y;
    return a.anchor.x - b.anchor.x;
  })[0];
}
