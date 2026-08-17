/**
 * Movement.
 *
 * BFS over 8-directional steps up to MOV. A step is legal only if EVERY cell of the
 * unit's footprint is in bounds and unoccupied at the new anchor — which is what makes
 * "a 2x2 Behemoth cannot squeeze through a 1x1 opening" fall out for free, with no
 * special case: the BFS simply finds no legal step through the gap.
 */

import type { Coord, UnitId } from '../../contract/ids.js';
import { coordKey } from '../../contract/ids.js';
import type { GameState } from '../types/state.js';
import type { Unit } from '../types/units.js';
import { canPlace } from './board.js';
import { DIRS_8, add } from '../util/grid.js';

export interface MoveOption {
  to: Coord;
  path: Coord[];
  cost: number;
}

/** All anchors the unit can legally reach this turn, with the path taken to each. */
export function legalMoves(state: GameState, unit: Unit): MoveOption[] {
  // canMove is the single source of truth the command validator uses too — checking a
  // subset here would let the UI offer moves that the engine then rejects.
  if (!canMove(unit) || unit.mov <= 0) return [];

  const start = unit.anchor;
  const seen = new Map<string, MoveOption>();
  seen.set(coordKey(start), { to: start, path: [start], cost: 0 });

  let frontier: MoveOption[] = [{ to: start, path: [start], cost: 0 }];

  while (frontier.length > 0) {
    const next: MoveOption[] = [];
    for (const cur of frontier) {
      if (cur.cost >= unit.mov) continue;
      for (const dir of DIRS_8) {
        const anchor = add(cur.to, dir);
        const key = coordKey(anchor);
        if (seen.has(key)) continue;
        if (!canPlace(state, anchor, unit.footprint, unit.id)) continue;
        const option: MoveOption = {
          to: anchor,
          path: [...cur.path, anchor],
          cost: cur.cost + 1,
        };
        seen.set(key, option);
        next.push(option);
      }
    }
    frontier = next;
  }

  seen.delete(coordKey(start));
  return [...seen.values()];
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
