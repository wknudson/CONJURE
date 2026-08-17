/**
 * Wildlife.
 *
 * Feral creatures belong to no one. They sit in a side's unit record because the engine
 * has two sides and no third, but nothing commands them: the AI does not plan their
 * turns, and neither does the player. They are driven from here, by rules simple enough
 * to be predictable — a beast you cannot read is just noise, while one you can read is a
 * hazard you can steer an enemy into.
 *
 * Every decision breaks ties by position, so a replay of the same game moves them the
 * same way.
 */

import type { Coord, UnitId } from '../../contract/ids.js';
import type { Ctx } from './context.js';
import { emit, newCause } from './context.js';
import type { Unit } from '../types/units.js';
import { legalAttacks } from './targeting.js';
import { legalMoves, canAttack, canMove } from './movement.js';
import { runCommand } from './engine.js';

/** Distance between two points, counting diagonals as one step. */
function chebyshev(a: Coord, b: Coord): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

/** Deterministic ordering: nearest first, then by row, then by column. */
function nearest(from: Coord, options: { at: Coord }[]): { at: Coord } | undefined {
  return [...options].sort(
    (a, b) =>
      chebyshev(from, a.at) - chebyshev(from, b.at) ||
      a.at.y - b.at.y ||
      a.at.x - b.at.x,
  )[0];
}

/** Everything on the board a beast might want to bite: anything that is not itself Feral. */
function prey(ctx: Ctx, self: Unit): Unit[] {
  return Object.values(ctx.state.units).filter(
    (u) => u.id !== self.id && !u.keywords.includes('Feral'),
  );
}

/**
 * A beast's turn: go for whatever is closest, on either side, and bite it.
 *
 * "Hostile to both" is not a special rule here — it falls out of picking the nearest
 * target without consulting sides at all. Which is what makes shoving an enemy into a
 * wolf's path a real tactic rather than a coincidence.
 */
export function feralAggressStep(ctx: Ctx, unitId: UnitId): void {
  const self = ctx.state.units[unitId];
  if (!self || !self.keywords.includes('Feral')) return;

  // Bite first if something is already in reach, so a beast never walks away from a meal.
  if (strikeNearest(ctx, unitId)) return;

  if (canMove(self)) {
    const targets = prey(ctx, self);
    if (targets.length > 0) {
      const moves = legalMoves(ctx.state, self);
      // The step that ends closest to the nearest living thing.
      let best: { to: Coord; score: number } | undefined;
      for (const move of moves) {
        const closest = Math.min(...targets.map((t) => chebyshev(move.to, t.anchor)));
        const score = closest * 100 + move.to.y + move.to.x / 100;
        if (!best || score < best.score) best = { to: move.to, score };
      }
      if (best) {
        newCause(ctx);
        runCommand(ctx, { type: 'moveUnit', unit: unitId, to: best.to });
      }
    }
  }

  strikeNearest(ctx, unitId);
}

/** Swings at the nearest thing in reach. Returns whether it found one. */
function strikeNearest(ctx: Ctx, unitId: UnitId): boolean {
  const self = ctx.state.units[unitId];
  if (!self || !canAttack(self)) return false;

  const options = legalAttacks(ctx.state, self)
    .flatMap((ref) => {
      if (ref.kind !== 'unit') return [];
      const victim = ctx.state.units[ref.id];
      if (!victim || victim.keywords.includes('Feral')) return [];
      return [{ ref, at: victim.anchor }];
    });

  const pick = nearest(self.anchor, options) as { ref: { kind: 'unit'; id: UnitId }; at: Coord } | undefined;
  if (!pick) return false;

  newCause(ctx);
  runCommand(ctx, { type: 'attack', attacker: unitId, target: pick.ref });
  return true;
}

/**
 * A scavenger's turn: run for the edge and never fight.
 *
 * It is carrying something worth having, so the pressure it applies is entirely on the
 * player's attention — every turn spent chasing it is a turn not spent on the battle.
 */
export function feralFleeStep(ctx: Ctx, unitId: UnitId): void {
  const self = ctx.state.units[unitId];
  if (!self || !canMove(self)) return;

  const { width, height } = ctx.state;
  const distanceToEdge = (at: Coord): number =>
    Math.min(at.x, at.y, width - 1 - at.x, height - 1 - at.y);

  let best: { to: Coord; score: number } | undefined;
  for (const move of legalMoves(ctx.state, self)) {
    const score = distanceToEdge(move.to) * 100 + move.to.y + move.to.x / 100;
    if (!best || score < best.score) best = { to: move.to, score };
  }
  if (!best) return;
  if (distanceToEdge(best.to) >= distanceToEdge(self.anchor)) return;

  newCause(ctx);
  runCommand(ctx, { type: 'moveUnit', unit: unitId, to: best.to });
}

/** Whether a fleeing creature has reached the edge and can slip away. */
export function atBoardEdge(ctx: Ctx, unitId: UnitId): boolean {
  const self = ctx.state.units[unitId];
  if (!self) return false;
  const { width, height } = ctx.state;
  const { x, y } = self.anchor;
  return x === 0 || y === 0 || x === width - 1 || y === height - 1;
}

/** Removes a creature that got away. Not a death: nothing killed it, and nobody scores. */
export function escape(ctx: Ctx, unitId: UnitId): void {
  const self = ctx.state.units[unitId];
  if (!self) return;
  const at = { ...self.anchor };
  delete ctx.state.units[unitId];
  newCause(ctx);
  emit(ctx, { t: 'unitEscaped', unitId, at });
}
