/**
 * Movement.
 *
 * A cost-relaxing search over 8-directional steps up to MOV. A step is legal only if
 * EVERY cell of the unit's footprint is in bounds and unoccupied at the new anchor —
 * which is what makes "a 2x2 Behemoth cannot squeeze through a 1x1 opening" fall out for
 * free, with no special case: the search simply finds no legal step through the gap.
 *
 * Steps are not all equal. Rough ground costs more to cross than open ground, so the
 * cheapest route to a tile is not always the one with the fewest steps, and a plain
 * breadth-first sweep — which accepts the first arrival at a tile and never revisits —
 * would report a detour around rubble as unreachable when it is merely longer.
 */

import type { Coord, UnitId } from '../../contract/ids.js';
import { coordKey } from '../../contract/ids.js';
import type { GameState } from '../types/state.js';
import type { Unit } from '../types/units.js';
import { canPlace } from './board.js';
import { DIRS_8, add, cellsAt } from '../util/grid.js';

export interface MoveOption {
  to: Coord;
  path: Coord[];
  cost: number;
}

/** All anchors the unit can legally reach this turn, with the path taken to each. */
export function legalMoves(state: GameState, unit: Unit): MoveOption[] {
  // canMove is the single source of truth the command validator uses too — checking a
  // subset here would let the UI offer moves that the engine then rejects.
  if (!canMove(unit)) return [];

  const start = unit.anchor;
  const best = new Map<string, MoveOption>();
  best.set(coordKey(start), { to: start, path: [start], cost: 0 });

  // Relaxation, not a single sweep: a tile already reached may be reached again more
  // cheaply by a longer route, and when it is, everything beyond it is reconsidered too.
  // MOV is small and the board is small, so this settles in a few passes.
  let frontier: MoveOption[] = [{ to: start, path: [start], cost: 0 }];

  while (frontier.length > 0) {
    const next: MoveOption[] = [];
    for (const cur of frontier) {
      for (const dir of DIRS_8) {
        const anchor = add(cur.to, dir);
        const key = coordKey(anchor);
        if (!canPlace(state, anchor, unit.footprint, unit.id)) continue;

        const cost = cur.cost + stepCost(state, unit, anchor);
        if (cost > unit.mov) continue;
        const prior = best.get(key);
        if (prior && prior.cost <= cost) continue;

        const option: MoveOption = { to: anchor, path: [...cur.path, anchor], cost };
        best.set(key, option);
        next.push(option);
      }
    }
    frontier = next;
  }

  best.delete(coordKey(start));
  return [...best.values()];
}

/**
 * What it costs to step onto this anchor.
 *
 * A footprint pays for the worst ground it covers: a Behemoth with one foot in rubble is
 * slowed by it, which is the answer that makes big units feel heavy rather than letting
 * them straddle bad ground for free.
 */
export function stepCost(state: GameState, unit: Unit, anchor: Coord): number {
  let worst = 1;
  for (const cell of cellsAt(anchor, unit.footprint)) {
    worst = Math.max(worst, tileMoveCost(state, cell));
  }
  return worst;
}

/** What crossing a single tile costs. Broken ground costs double; open ground is free. */
export const RUBBLE_MOVE_COST = 2;

export function tileMoveCost(state: GameState, at: Coord): number {
  const hazard = state.hazards[coordKey(at)];
  if (hazard?.kind === 'rubble') return RUBBLE_MOVE_COST;
  return 1;
}

export function findMove(state: GameState, unit: Unit, to: Coord): MoveOption | undefined {
  return legalMoves(state, unit).find((m) => m.to.x === to.x && m.to.y === to.y);
}

/**
 * Independent actions, as in Mewgenics: a unit gets one move and one attack per turn and
 * may take them in either order, so striking and then withdrawing is a real option.
 *
 * This deliberately replaces Draft 7 §4.3's Strict Commitment rule, which exhausted a
 * unit the moment it declared an attack. Each action is still once per turn — a unit
 * cannot split its movement around an attack.
 */
export function canAct(unit: Unit): boolean {
  if (unit.statuses.freeze || unit.statuses.stun) return false;
  // Dormant and Impact units cannot act on the turn they were deployed. Haste can.
  if (unit.summonedThisTurn && !unit.keywords.includes('Haste')) return false;
  return true;
}

export function canMove(unit: Unit): boolean {
  if (!canAct(unit)) return false;
  // An emplacement never moves. Without this a 0-MOV unit is forever "able to move" and
  // so never counts as spent, and the board draws it as ready long after it has fired.
  if (unit.mov <= 0) return false;
  if (unit.statuses.entangle) return false;
  return !unit.movedThisTurn;
}

/** Both actions used, or otherwise unable to do anything further this turn. */
export function isSpent(unit: Unit): boolean {
  return !canMove(unit) && !canAttack(unit);
}

export function canAttack(unit: Unit): boolean {
  return canAct(unit) && !unit.attackedThisTurn;
}

/** Applies a validated move to the state. Does not emit — the caller owns events. */
export function setAnchor(state: GameState, unitId: UnitId, to: Coord): void {
  const unit = state.units[unitId];
  if (!unit) return;
  unit.anchor = { ...to };
}
