/**
 * Status ticks and Escalation, resolved at the start of the active side's turn.
 *
 * Module 1 pins the order exactly: Toxin -> Burn -> Freeze/Entangle check -> tile
 * hazards -> Escalation. Escalation fires even while a unit is Frozen or Stunned.
 */

import type { Side, StatusKind } from '../../contract/ids.js';
import type { Ctx } from './context.js';
import { emit } from './context.js';
import type { Unit } from '../types/units.js';
import { unitsOf } from './board.js';
import { dealDamage } from './damage.js';
import { CARDS } from '../data/cards/index.js';
import { tickHazards } from './reactions.js';

/** Damage per stack, per tick. */
const TICK_DAMAGE: Partial<Record<StatusKind, { amount: number; dtype: 'true' | 'fire' }>> = {
  // Toxin bypasses armor entirely.
  toxin: { amount: 1, dtype: 'true' },
  burn: { amount: 1, dtype: 'fire' },
};

export function startOfTurnStatuses(ctx: Ctx, side: Side): void {
  // Snapshot the unit list: ticks can kill, and cascades can remove others.
  const ids = unitsOf(ctx.state, side).map((u) => u.id);

  // 1. Toxin, then 2. Burn — in that order across all units, per Module 1.
  for (const status of ['toxin', 'burn'] as const) {
    for (const id of ids) {
      const unit = ctx.state.units[id];
      if (!unit) continue;
      tickStatus(ctx, unit, status);
      if (ctx.state.result) return;
    }
  }

  // 3. Freeze / Entangle decay: these gate actions rather than dealing damage.
  for (const id of ids) {
    const unit = ctx.state.units[id];
    if (!unit) continue;
    decay(unit, 'freeze');
    decay(unit, 'entangle');
    decay(unit, 'stun');
    decay(unit, 'chill');
    decay(unit, 'brittle');
    decay(unit, 'charged');
  }

  // 4. Tile hazards age here, per Module 1's order.
  tickHazards(ctx);

  // 5. Escalation — fires even on Frozen or Stunned units.
  for (const id of ids) {
    const unit = ctx.state.units[id];
    if (!unit) continue;
    escalate(ctx, unit);
  }
}

function tickStatus(ctx: Ctx, unit: Unit, status: 'toxin' | 'burn'): void {
  const stacks = unit.statuses[status] ?? 0;
  if (stacks <= 0) return;

  // A side that cannot burn does not burn, and a side that cannot be poisoned does not
  // tick: the stacks still come off, so the affliction runs out at the same rate, it
  // simply never costs anything on the way. Clearing them outright would make the
  // immunity a *cleanse*, which is a different and stronger thing — and it would also
  // deny Wildfire the Toxin it consumes, so a Lead-Lined coat would quietly disarm an
  // ally's Bloom deck as well as protecting its wearer.
  const cmd = ctx.state.players[unit.side];
  const immune = status === 'burn' ? cmd.immuneToBurn : cmd.immuneToToxin;
  if (immune) {
    unit.statuses[status] = stacks - 1;
    if (unit.statuses[status]! <= 0) delete unit.statuses[status];
    return;
  }

  const spec = TICK_DAMAGE[status];
  if (!spec) return;

  const damage = spec.amount * stacks;
  emit(ctx, { t: 'statusTicked', unitId: unit.id, status, damage, remaining: stacks - 1 });

  dealDamage(ctx, {
    target: { kind: 'unit', id: unit.id },
    amount: damage,
    dtype: spec.dtype,
    cause: 'status',
  });

  // Stacking magnifies intensity; each tick burns one stack off.
  const live = ctx.state.units[unit.id];
  if (live) {
    const next = (live.statuses[status] ?? 0) - 1;
    if (next > 0) live.statuses[status] = next;
    else delete live.statuses[status];
  }
}

function decay(unit: Unit, status: StatusKind): void {
  const stacks = unit.statuses[status] ?? 0;
  if (stacks <= 0) return;
  const next = stacks - 1;
  if (next > 0) unit.statuses[status] = next;
  else delete unit.statuses[status];
}

/**
 * Escalation (Draft 7 §6.4): surviving friendly minions scale at the start of your turn
 * if they lived through the enemy round. Units never escalate on their deploy turn.
 * 1x1 units cap at +3 stacks; Behemoths are uncapped.
 */
function escalate(ctx: Ctx, unit: Unit): void {
  // A Bound Form is bound: its power is the Pact's, and the Pact does not grow. Its
  // card carries no Escalate either, so this is the belt to that suspenders -- it holds
  // even if some future effect grants Escalate to everything you control.
  if (unit.keywords.includes('BoundForm')) return;
  if (!unit.keywords.includes('Escalate')) return;
  if (unit.freshlySummoned) {
    // It has now survived a full round, so it escalates from next turn onward.
    unit.freshlySummoned = false;
    return;
  }
  if (unit.escalation >= unit.escalationCap) return;

  const bonus = CARDS[unit.defId]?.unit?.escalationBonus ?? { atk: 1, hp: 0 };
  unit.escalation += 1;
  unit.atk += bonus.atk;
  unit.maxHp += bonus.hp;
  unit.hp += bonus.hp;

  emit(ctx, {
    t: 'escalated',
    unitId: unit.id,
    stacks: unit.escalation,
    atk: unit.atk,
    hp: unit.hp,
  });
}

/** Clears per-turn action flags for the side about to act. */
/**
 * Chill stacking (Module 1): the third stack does not tick — it freezes the unit solid.
 * Called wherever Chill is applied, so no card has to remember the threshold.
 */
export function applyChill(ctx: Ctx, unit: Unit, stacks: number): void {
  const total = (unit.statuses.chill ?? 0) + stacks;

  if (total < CHILL_TO_FREEZE) {
    unit.statuses.chill = total;
    emit(ctx, { t: 'statusApplied', unitId: unit.id, status: 'chill', stacks: total });
    return;
  }

  // Consume the whole stack into a Freeze, carrying any surplus forward.
  const surplus = total - CHILL_TO_FREEZE;
  if (surplus > 0) unit.statuses.chill = surplus;
  else delete unit.statuses.chill;

  unit.statuses.freeze = Math.max(unit.statuses.freeze ?? 0, 1);
  emit(ctx, { t: 'statusApplied', unitId: unit.id, status: 'freeze', stacks: unit.statuses.freeze });
}

/** Stacks of Chill that convert into a Freeze. */
export const CHILL_TO_FREEZE = 3;

/**
 * Puts a status on a unit, whatever put it there.
 *
 * Chill routes through its own helper because the third stack becomes a Freeze rather
 * than a fourth stack, and nothing applying a status should have to know that threshold.
 * Shared by the card effect interpreter and by scenery that bursts.
 */
/**
 * Extra Toxin stacks the *acting* side folds into everything it poisons.
 *
 * Attributed by `activeSide` rather than by a caster the function is handed, because
 * `applyStatusTo` is given the victim and nothing else — every caller from a card to a
 * rune to an on-hit rider goes through it, and threading a source through all of them to
 * serve one trait would be a wide change for a narrow rule.
 *
 * The approximation is visible in one place: a trap you laid that springs on the enemy's
 * turn is poisoning on *their* clock, so it does not get the bonus. That reads as the
 * roots being spent rather than as a bug, and it errs toward giving less than promised
 * rather than more.
 */
function toxinBonus(ctx: Ctx, status: StatusKind): number {
  if (status !== 'toxin') return 0;
  return ctx.state.players[ctx.state.activeSide].bonusToxinStacks;
}

export function applyStatusTo(
  ctx: Ctx,
  unit: Unit,
  status: StatusKind,
  stacks: number,
): void {
  if (status === 'chill') {
    applyChill(ctx, unit, stacks);
    return;
  }

  unit.statuses[status] = (unit.statuses[status] ?? 0) + stacks + toxinBonus(ctx, status);
  emit(ctx, {
    t: 'statusApplied',
    unitId: unit.id,
    status,
    stacks: unit.statuses[status] ?? 0,
  });
}

export function refreshUnits(ctx: Ctx, side: Side): void {
  for (const unit of unitsOf(ctx.state, side)) {
    unit.movedThisTurn = false;
    unit.attackedThisTurn = false;
    unit.summonedThisTurn = false;
  }
}
