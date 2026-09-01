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
import { entityAt, isCover } from './board.js';
import { isUnit } from '../types/units.js';
import { inBounds, visionClamp } from '../types/state.js';
import { climaxTraitOf } from './growth.js';
import { hasLoS } from './los.js';
import { DIRS_8, add, cellsAt } from '../util/grid.js';

/**
 * What a particular body is allowed to walk through.
 *
 * Two Climax traits bend the placement rule, and they bend it in different directions, so
 * the licence is two independent flags rather than one "is special" boolean.
 */
export interface MoveLicense {
  /** Overload: bodies do not stop it. It still may not *end* its move inside one. */
  throughUnits: boolean;
  /** Heavy Footprint: destructible terrain does not stop it, and it may stand where it stood. */
  throughObstacles: boolean;
}

const PLAIN: MoveLicense = { throughUnits: false, throughObstacles: false };

/** The licence this unit's Climax trait grants it, if any. */
export function licenseFor(unit: Unit): MoveLicense {
  switch (climaxTraitOf(unit)) {
    case 'overload':
      return { throughUnits: true, throughObstacles: false };
    case 'heavyFootprint':
      return { throughUnits: false, throughObstacles: true };
    default:
      return PLAIN;
  }
}

/**
 * Whether this body may occupy an anchor, given what it is licensed to ignore.
 *
 * The generalisation of `canPlace`, which remains the answer for everything that has no
 * licence — and is still what decides where a move may *end*, because passing through a
 * body is not the same as standing in one.
 */
export function canTraverse(
  state: GameState,
  anchor: Coord,
  unit: Unit,
  license: MoveLicense,
): boolean {
  for (const cell of cellsAt(anchor, unit.footprint)) {
    if (!inBounds(state, cell)) return false;
    const occ = entityAt(state, cell);
    if (!occ || occ.id === unit.id) continue;
    // Cover is low terrain: everything walks onto it, licence or not.
    if (isCover(occ)) continue;
    if (isUnit(occ)) {
      if (license.throughUnits) continue;
      return false;
    }
    if (license.throughObstacles && occ.destructible) continue;
    return false;
  }
  return true;
}

/**
 * Where a move may finish.
 *
 * A licence to walk *through* bodies is deliberately not a licence to stop inside one —
 * two units on a tile is a state the whole engine assumes cannot happen. Shattering
 * terrain is different: Heavy Footprint takes the tile it broke, so its obstacle licence
 * carries all the way to the destination.
 */
function canFinish(state: GameState, anchor: Coord, unit: Unit, license: MoveLicense): boolean {
  return canTraverse(state, anchor, unit, {
    throughUnits: false,
    throughObstacles: license.throughObstacles,
  });
}

export interface MoveOption {
  to: Coord;
  path: Coord[];
  cost: number;
}

/**
 * A unit's reach this turn, Fleet included.
 *
 * Read here rather than written onto `mov` so the bonus can expire without anything having
 * to remember what the base was.
 */
export function movementRange(unit: Unit): number {
  return unit.mov + (unit.statuses.fleet ?? 0);
}

/** All anchors the unit can legally reach this turn, with the path taken to each. */
export function legalMoves(state: GameState, unit: Unit): MoveOption[] {
  // canMove is the single source of truth the command validator uses too — checking a
  // subset here would let the UI offer moves that the engine then rejects.
  if (!canMove(unit)) return [];

  const license = licenseFor(unit);
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
        if (!canTraverse(state, anchor, unit, license)) continue;

        const cost = cur.cost + stepCost(state, unit, anchor);
        if (cost > movementRange(unit)) continue;
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
  // Reachable is not the same as standable. Overload paths straight through bodies but may
  // not stop inside one, so the destinations are filtered here rather than during the
  // search — a tile it must cross to get anywhere is still a tile it may not end on.
  const walked = [...best.values()].filter((m) => canFinish(state, m.to, unit, license));

  if (climaxTraitOf(unit) !== 'blink') return walked;
  return [...walked, ...blinkMoves(state, unit, license, best)];
}

/**
 * Blink: once a turn the Written Path's host may step to any empty tile it can see.
 *
 * "Once a turn" is the move action itself — `canMove` already refuses a body that has
 * moved — so the Climax widens *where* a move may end rather than granting a second one.
 * "Can see" is the same sight the rest of the game uses: a clear line from where it
 * stands, and no further than the weather lets anything see. Tiles it could have walked
 * to keep their walked route, so the path the animation follows is the one the body would
 * actually take; only the ground beyond its stride is a step through nothing.
 */
function blinkMoves(
  state: GameState,
  unit: Unit,
  license: MoveLicense,
  walked: Map<string, MoveOption>,
): MoveOption[] {
  const out: MoveOption[] = [];
  const clamp = visionClamp(state);
  const start = unit.anchor;

  for (let y = 0; y < state.height; y++) {
    for (let x = 0; x < state.width; x++) {
      const to = { x, y };
      const key = coordKey(to);
      if (key === coordKey(start) || walked.has(key)) continue;
      if (clamp !== undefined && Math.max(Math.abs(x - start.x), Math.abs(y - start.y)) > clamp) {
        continue;
      }
      if (!canFinish(state, to, unit, license)) continue;
      if (!hasLoS(state, start, to, [unit.id], unit.side)) continue;
      out.push({ to, path: [start, to], cost: 0 });
    }
  }
  return out;
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
    worst = Math.max(worst, tileMoveCost(state, cell, unit));
  }
  return worst;
}

/** What crossing a single tile costs. Broken ground costs double; open ground is free. */
export const RUBBLE_MOVE_COST = 2;

export function tileMoveCost(state: GameState, at: Coord, mover?: Unit): number {
  const hazard = state.hazards[coordKey(at)];
  if (hazard?.kind !== 'rubble') return 1;
  // A Companion that does not quite touch the ground is not slowed by what is on it.
  if (mover && walksFreely(state, mover)) return 1;
  return RUBBLE_MOVE_COST;
}

/** Whether this body ignores what is underfoot. Only ever a Bound Form, and only some. */
export function walksFreely(state: GameState, unit: Unit): boolean {
  return (
    unit.keywords.includes('BoundForm') && state.players[unit.side].boundFormIgnoresHazards
  );
}

export function findMove(state: GameState, unit: Unit, to: Coord): MoveOption | undefined {
  return legalMoves(state, unit).find((m) => m.to.x === to.x && m.to.y === to.y);
}

/**
 * Independent actions, as in Mewgenics: a unit gets one move and one attack per turn and
 * may take them in either order, so striking and then withdrawing is a real option.
 *
 * This deliberately replaces the original Strict Commitment rule, which exhausted a
 * unit the moment it declared an attack. Each action is still once per turn — a unit
 * cannot split its movement around an attack.
 */
export function canAct(unit: Unit): boolean {
  if (unit.statuses.freeze || unit.statuses.stun) return false;
  // Tethered. It is holding a beast in place with its whole body; it does nothing else
  // until the tether resolves. Gating here covers moving, striking and channelling in
  // one place, since all three already ask this question.
  if (unit.statuses.anchor) return false;
  // Bled this turn. Gating here rather than in each command is the same argument the
  // tether makes one line above: moving, striking and channelling all ask this question
  // already, so one answer covers the three rules Exhaustion is defined by.
  if (unit.statuses.exhaust) return false;
  // Dormant and Impact units cannot act on the turn they were deployed. Haste can.
  if (unit.summonedThisTurn && !unit.keywords.includes('Haste')) return false;
  return true;
}

export function canMove(unit: Unit): boolean {
  if (!canAct(unit)) return false;
  // An emplacement never moves. Without this a 0-MOV unit is forever "able to move" and
  // so never counts as spent, and the board draws it as ready long after it has fired.
  //
  // Asked of the *base* stat on purpose, so Fleet cannot mobilise something whose card
  // says "cannot move, ever". Fleetness lengthens a stride; it does not grant one.
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
