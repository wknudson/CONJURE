/**
 * Legal target enumeration. One implementation serves both the UI (tile highlighting)
 * and the AI (action enumeration), so they can never disagree about what is playable.
 */

import type { Coord, Side, TargetRef } from '../../contract/ids.js';
import type { ChosenTarget } from '../types/cards.js';
import type { GameState } from '../types/state.js';
import type { Unit } from '../types/units.js';
import { CARDS } from '../data/cards/index.js';
import {
  allEntities,
  emptyTiles,
  entityAt,
  getEntity,
  opposite,
  refOf,
  summonSpots,
  unitsOf,
} from './board.js';
import { canAttack, canAct } from './movement.js';
import { hasLoS, hasLoSToPortrait } from './los.js';
import { DIRS_8, cellsOf, footprintDistance } from '../util/grid.js';
import { inBounds } from '../types/state.js';

/** Every legal way to play this card right now. Empty means it is unplayable. */
export function legalCardTargets(state: GameState, side: Side, defId: string): ChosenTarget[] {
  const def = CARDS[defId];
  if (!def) return [];

  switch (def.target.kind) {
    case 'none':
      return [{ kind: 'none' }];

    case 'global':
      // A board-wide detonation with nothing to detonate would silently burn its whole
      // cost, so treat it as having no legal target rather than letting it be wasted.
      if (def.effect.op === 'detonateAllRunes' && !allEntities(state).some((e) => e.rune)) {
        return [];
      }
      return [{ kind: 'global' }];

    case 'emptyTile': {
      const tiles =
        def.target.zone === 'ownTerritory'
          ? summonSpots(state, side, def.target.footprint)
          : emptyTiles(state);
      return tiles.map((at) => ({ kind: 'tile' as const, at }));
    }

    case 'entity': {
      const spec = def.target;
      const out: ChosenTarget[] = [];
      for (const e of allEntities(state)) {
        const isUnitEntity = 'atk' in e;
        if (!spec.includeObstacles && !isUnitEntity) continue;
        if (spec.side === 'ally' && e.side !== side) continue;
        if (spec.side === 'enemy' && e.side === side) continue;
        if (spec.requireUnexhausted && isUnitEntity && !canAct(e as Unit)) continue;
        out.push({ kind: 'entity', ref: refOf(e) });
      }
      return out;
    }

    case 'adjacentEnemy': {
      const out: ChosenTarget[] = [];
      for (const foe of unitsOf(state, opposite(side))) {
        out.push({ kind: 'entity', ref: { kind: 'unit', id: foe.id } });
      }
      return out;
    }

    case 'line': {
      const out: ChosenTarget[] = [];
      const length = def.target.length;
      for (let y = 0; y < state.height; y++) {
        for (let x = 0; x < state.width; x++) {
          const from = { x, y };
          for (const dir of DIRS_8) {
            // Only offer lines that actually cover at least one entity.
            if (!lineCovers(state, from, dir, length).some((c) => entityAt(state, c))) continue;
            out.push({ kind: 'line', from, dir });
          }
        }
      }
      return out;
    }

    case 'unitOrPortrait': {
      const out: ChosenTarget[] = [
        { kind: 'entity', ref: { kind: 'portrait', side } },
      ];
      for (const u of unitsOf(state, side)) {
        out.push({ kind: 'entity', ref: { kind: 'unit', id: u.id } });
      }
      return out;
    }
  }
}

export function lineCovers(state: GameState, from: Coord, dir: Coord, length: number): Coord[] {
  const out: Coord[] = [];
  let cur = { ...from };
  for (let i = 0; i < length; i++) {
    if (!inBounds(state, cur)) break;
    out.push({ ...cur });
    cur = { x: cur.x + dir.x, y: cur.y + dir.y };
  }
  return out;
}

/**
 * Everything a unit may attack: enemy entities in range with line of sight, plus the
 * enemy portrait when reachable.
 *
 * Melee (range 1-2) must stand in the opponent's two home rows to strike the portrait.
 * Ranged (3+) needs a clear straight or diagonal vector to it.
 */
export function legalAttacks(state: GameState, unit: Unit): TargetRef[] {
  if (!canAttack(unit)) return [];

  const out: TargetRef[] = [];
  const foeSide = opposite(unit.side);

  for (const e of allEntities(state)) {
    if (e.id === unit.id) continue;
    // Obstacles are terrain, not allies: either side may break a pillar to open a lane,
    // regardless of who conjured it.
    const isObstacle = !('atk' in e);
    if (!isObstacle && e.side === unit.side) continue;
    const dist = footprintDistance(unit, e);
    if (dist < unit.rangeMin || dist > unit.rangeMax) continue;
    // Ranged attacks need sight; adjacent melee never does.
    if (dist > 1 && !cellsOf(unit).some((from) => cellsOf(e).some((to) => hasLoS(state, from, to, [unit.id, e.id])))) {
      continue;
    }
    out.push(refOf(e));
  }

  if (canHitPortrait(state, unit, foeSide)) {
    out.push({ kind: 'portrait', side: foeSide });
  }

  return out;
}

export function canHitPortrait(state: GameState, unit: Unit, targetSide: Side): boolean {
  const cells = cellsOf(unit);

  if (unit.rangeMax <= 2) {
    // Melee (Draft 7 §5.2): reaching the enemy's front or back row is the whole
    // requirement — standing in their territory is what puts the portrait in reach.
    const homeRows =
      targetSide === 'player' ? [state.height - 1, state.height - 2] : [0, 1];
    return cells.some((c) => homeRows.includes(c.y));
  }

  // Ranged: needs a clear vector to the off-grid portrait.
  return cells.some((c) => hasLoSToPortrait(state, c, targetSide, [unit.id]));
}

/** Units the given side may sacrifice for Sparks right now. */
export function sacrificeCandidates(state: GameState, side: Side): Unit[] {
  return unitsOf(state, side).filter((u) => canAct(u) && u.sacrificeValue > 0);
}

/** Resolves an entity reference to its board anchor, for previews and AI heuristics. */
export function anchorOf(state: GameState, ref: TargetRef): Coord | undefined {
  if (ref.kind === 'portrait') return undefined;
  return getEntity(state, ref.id)?.anchor;
}
