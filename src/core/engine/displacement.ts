/**
 * Displacement and collision physics (Draft 7 §5.1).
 *
 *   Hits wall / arena border   -> pushed unit takes 30
 *   Hits obstructing unit      -> pushed unit takes 30, blocker takes 20 collateral
 *   Hits destructible obstacle -> pushed unit takes 30, obstacle takes 30
 *
 * Mass Invariance: the numbers do not change when a 2x2 is involved, in either role.
 * Draft 7 states this explicitly and Module 8's competing mass-crush rule is not used.
 */

import type { Coord } from '../../contract/ids.js';
import type { Ctx } from './context.js';
import { emit } from './context.js';
import type { Entity, Unit } from '../types/units.js';
import { isUnit } from '../types/units.js';
import { canPlace, entityAt, refOf } from './board.js';
import { dealDamage } from './damage.js';
import { cellsAt, add } from '../util/grid.js';
import { inBounds } from '../types/state.js';
import type { GameState } from '../types/state.js';
import { climaxTraitOf } from './growth.js';

export const COLLISION_TARGET_DAMAGE = 30;
export const COLLISION_BLOCKER_DAMAGE = 20;
export const COLLISION_OBSTACLE_DAMAGE = 30;

/**
 * What a collision actually costs a given body, after its side's plate.
 *
 * Applied here rather than inside `dealDamage` so it stays a rule about *collisions*
 * specifically. Trench plate is bracing for an impact, not damage reduction — a Vaporize
 * still burns exactly as much through it.
 *
 * Obstacles and walls are unmoved by it: scenery has no commander to have bought plate,
 * and a barricade that got tougher because the shover's owner wore boots would be a rule
 * nobody could see. Floored at zero, never negative.
 */
function braced(state: GameState, entity: Entity | undefined, amount: number): number {
  if (!entity || !isUnit(entity)) return amount;
  return Math.max(0, amount - state.players[entity.side].collisionResist);
}

export interface DisplacementResult {
  path: Coord[];
  collision?: {
    at: Coord;
    against: 'wall' | 'unit' | 'obstacle';
  };
}

/**
 * Pushes a unit `distance` tiles along `dir`, resolving collisions.
 * Movement stops at the first obstruction; the unit stays on the last valid tile.
 */
/** Whether this body refuses to be moved by anything but its own legs. */
function isGrounded(ctx: Ctx, unit: Unit): boolean {
  // Heavy Footprint. Nothing moves it that it did not decide to move for — a shove, a
  // pull, an Overload, a current. Checked here rather than in each of them because this is
  // the one chokepoint every displacement in the game passes through.
  //
  // It cuts both ways, deliberately: your own repositioning tools stop working on it too,
  // so a Petrifying Mantle host is where it is until it walks.
  if (climaxTraitOf(unit) === 'heavyFootprint') return true;
  return unit.keywords.includes('BoundForm') && ctx.state.players[unit.side].boundFormGrounded;
}

export function pushUnit(
  ctx: Ctx,
  unit: Unit,
  dir: Coord,
  distance: number,
  /**
   * Depth this shove inherits, if it is itself a link in a cascade.
   *
   * Zero for the ordinary cases — a card's shove, a current at the round boundary — which
   * genuinely are the start of a chain. Overload passes its own depth, because a reaction
   * throwing a body into a wall that kills a rune-holder is the exact shape the ceiling
   * exists to bound.
   */
  chainDepth = 0,
): DisplacementResult {
  const path: Coord[] = [{ ...unit.anchor }];

  // Rooted where it stands. Checked at the one chokepoint every displacement goes
  // through, so a shove, a pull, an Overload and a current are all refused by one line —
  // and refused *silently*, with no collision: nothing hit anything, it simply did not
  // move. A zero-length path is what a blocked displacement already reports.
  if (isGrounded(ctx, unit)) return { path };

  for (let step = 0; step < distance; step++) {
    const nextAnchor = add(unit.anchor, dir);
    const cells = cellsAt(nextAnchor, unit.footprint);

    // Cells the unit is vacating do not obstruct itself.
    const blockingCells = cells.filter(
      (c) => !cellsAt(unit.anchor, unit.footprint).some((o) => o.x === c.x && o.y === c.y),
    );

    const offBoard = cells.some((c) => !inBounds(ctx.state, c));
    if (offBoard) {
      applyWallCollision(ctx, unit, chainDepth);
      return { path, collision: { at: { ...unit.anchor }, against: 'wall' } };
    }

    let blocker;
    for (const c of blockingCells) {
      const occ = entityAt(ctx.state, c);
      if (occ && occ.id !== unit.id) {
        blocker = occ;
        break;
      }
    }

    if (blocker) {
      const against = isUnit(blocker) ? 'unit' : 'obstacle';
      emit(ctx, {
        t: 'collision',
        unitId: unit.id,
        at: { ...unit.anchor },
        against,
        blockerId: blocker.id,
      });

      dealDamage(ctx, {
        target: { kind: 'unit', id: unit.id },
        amount: braced(ctx.state, unit, COLLISION_TARGET_DAMAGE),
        dtype: 'impact',
        cause: 'collision',
        chainDepth,
      });

      // The blocker may already be gone if the pushed unit's rune detonated.
      const stillThere = ctx.state.units[blocker.id] ?? ctx.state.obstacles[blocker.id];
      if (stillThere) {
        dealDamage(ctx, {
          target: refOf(stillThere),
          amount: braced(
            ctx.state,
            stillThere,
            against === 'obstacle' ? COLLISION_OBSTACLE_DAMAGE : COLLISION_BLOCKER_DAMAGE,
          ),
          dtype: 'impact',
          cause: 'collision',
          chainDepth,
        });
      }

      return { path, collision: { at: { ...unit.anchor }, against } };
    }

    if (!canPlace(ctx.state, nextAnchor, unit.footprint, unit.id)) {
      applyWallCollision(ctx, unit, chainDepth);
      return { path, collision: { at: { ...unit.anchor }, against: 'wall' } };
    }

    const from = { ...unit.anchor };
    unit.anchor = { ...nextAnchor };
    path.push({ ...nextAnchor });
    emit(ctx, { t: 'unitDisplaced', unitId: unit.id, from, to: { ...nextAnchor } });

    // A unit can die mid-push (e.g. its own rune cascaded); stop moving a corpse.
    if (!ctx.state.units[unit.id]) return { path };
  }

  return { path };
}

function applyWallCollision(ctx: Ctx, unit: Unit, chainDepth: number): void {
  emit(ctx, {
    t: 'collision',
    unitId: unit.id,
    at: { ...unit.anchor },
    against: 'wall',
  });
  dealDamage(ctx, {
    target: { kind: 'unit', id: unit.id },
    amount: braced(ctx.state, unit, COLLISION_TARGET_DAMAGE),
    dtype: 'impact',
    cause: 'collision',
    chainDepth,
  });
}
