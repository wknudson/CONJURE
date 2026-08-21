/**
 * Status ticks and growth, resolved at the start of the active side's turn.
 *
 * Module 1 pins the order exactly: Toxin -> Burn -> Freeze/Entangle check -> tile
 * hazards -> growth. The last step fires even while a unit is Frozen or Stunned, and it
 * covers both clocks: the enemy's `Growth` keyword and the player's Elemental Auras. Both
 * live in `growth.ts`.
 */

import type { Side, StatusKind, UnitId } from '../../contract/ids.js';
import { coordKey } from '../../contract/ids.js';
import { cellsOf } from '../util/grid.js';
import type { Ctx } from './context.js';
import { emit } from './context.js';
import type { Unit } from '../types/units.js';
import { unitsOf } from './board.js';
import { dealDamage } from './damage.js';
import { tickHazards } from './reactions.js';
import { CARDS } from '../data/cards/index.js';
import { PLATERS, growUnit, plateUnit, tickAura } from './growth.js';
import { STAT_SCALE } from '../scale.js';

/**
 * Whether a record holds nothing, without building an array to find out.
 *
 * `Object.keys(x).length === 0` is the idiomatic spelling and allocates a throwaway array
 * every call. This runs per turn per side inside the AI's lookahead, where that adds up
 * to real planning time.
 */
function isEmpty(record: Record<string, unknown>): boolean {
  for (const _ in record) return false;
  return true;
}

/** Damage per stack, per tick. */
const TICK_DAMAGE: Partial<Record<StatusKind, { amount: number; dtype: 'true' | 'fire' }>> = {
  // Toxin bypasses armor entirely.
  toxin: { amount: STAT_SCALE, dtype: 'true' },
  burn: { amount: STAT_SCALE, dtype: 'fire' },
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

  // 2b/2c. Ground and constructs, both guarded on the board being empty of them.
  //
  // The guards are not micro-optimisation, they are the difference between a feature and
  // a tax. Both of these run inside *every simulated turn* of the Adept's lookahead, and
  // measured without the guards they cost about a fifth of its planning time -- for two
  // rules that do nothing at all on the great majority of boards, which carry no hazards
  // and no standing constructs. `isEmpty` allocates nothing; `Object.keys(...).length`
  // would have built a throwaway array per turn per side and defeated the point.

  // 2b. Boiling Point: steam somebody else raised is not merely opaque, it is hot.
  //
  // Here rather than in `tickHazards` because this is a damage tick and belongs with the
  // other two, and because `tickHazards` only ever looks at hazards the *active* side
  // owns — the exact opposite of the set that should be scalding anybody.
  if (!isEmpty(ctx.state.hazards)) {
    scaldInSteam(ctx, ids);
    if (ctx.state.result) return;
  }

  // 2c. Constructs that do something other than stand there.
  if (!isEmpty(ctx.state.obstacles)) {
    obstacleUpkeep(ctx, side);
    if (ctx.state.result) return;
  }

  // 3. Freeze / Entangle decay: these gate actions rather than dealing damage.
  for (const id of ids) {
    const unit = ctx.state.units[id];
    if (!unit) continue;
    decay(unit, 'freeze');
    decay(unit, 'entangle');
    decay(unit, 'stun');
    // Exhaustion is spent by the turn it cost. It lands during your turn and clears at the
    // start of your next one, so a tithed body is idle for exactly one enemy round.
    decay(unit, 'exhaust');
    // Fleetness is spent by the turn that granted it: a Rally's +1 MOV is a head start,
    // not a permanent upgrade.
    decay(unit, 'fleet');
    decay(unit, 'chill');
    decay(unit, 'brittle');
    decay(unit, 'charged');
  }

  // 4. Tile hazards age here, per Module 1's order.
  tickHazards(ctx);

  // 5. Growth and Auras — both fire even on Frozen or Stunned units. Being held down
  //    does not stop something growing, and it certainly does not stop it bleeding.
  for (const id of ids) {
    const unit = ctx.state.units[id];
    if (!unit) continue;
    // The enemy's clock first, then the player's Aura. They are mutually exclusive in
    // practice — `growUnit` refuses anything not enemy-side — but the order is fixed so a
    // future unit holding both resolves the same way every time.
    growUnit(ctx, unit);
    if (ctx.state.result) return;
    const plating = ctx.state.units[id];
    if (plating && PLATERS.has(plating.defId)) plateUnit(ctx, plating);
    const live = ctx.state.units[id];
    if (live) tickAura(ctx, live);
    if (ctx.state.result) return;
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

/**
 * Enemy steam burns whoever begins their turn standing in it.
 *
 * "Ending their turn inside" and "beginning their next turn inside" are the same tile in
 * every case that matters, and the start of turn is where every other tick already lives.
 */
function scaldInSteam(ctx: Ctx, ids: UnitId[]): void {
  for (const id of ids) {
    const unit = ctx.state.units[id];
    if (!unit) continue;
    for (const c of cellsOf(unit)) {
      const hazard = ctx.state.hazards[coordKey(c)];
      if (!hazard) continue;

      // Ground still alight. Unlike steam this does **not** check whose fire it was: a
      // burning tile is burning, and a Tortoise that shoved somebody onto one and then
      // walked into it themselves has made an ordinary mistake.
      if (hazard.kind === 'burning') {
        applyStatusTo(ctx, unit, 'burn', 1, hazard.owner);
        break;
      }

      if (hazard.kind !== 'steam_fog') continue;
      // Your own fog does not cook you, and a hazard nobody's side raised collects nothing.
      if (hazard.owner === unit.side) continue;
      const amount = ctx.state.players[hazard.owner].steamBurns;
      if (amount <= 0) continue;
      dealDamage(ctx, {
        target: { kind: 'unit', id: unit.id },
        amount,
        dtype: 'true',
        cause: 'status',
      });
      break;
    }
    if (ctx.state.result) return;
  }
}

/**
 * What the standing constructs do to the side whose turn is beginning.
 *
 * Runs on the *victim's* turn rather than the owner's, which is the reading that makes a
 * Pyre Pillar a threat you have to answer: it costs you something at the moment you were
 * about to act, and walking out of its row before then is the answer.
 *
 * Rows, because that is a shape the board already speaks -- the Companion's column, an
 * enemy's lane -- and because a radius would make every construct an area-denial tool
 * with no clean read from across the table.
 */
function obstacleUpkeep(ctx: Ctx, side: Side): void {
  for (const obstacle of Object.values(ctx.state.obstacles)) {
    const spec = CARDS[obstacle.defId]?.obstacleTurnStart;
    if (!spec) continue;
    // Whoever raised it is not who it burns. An obstacle with no side belongs to the
    // board and does nothing to anybody.
    if (obstacle.side === undefined || obstacle.side === side) continue;

    const rows = new Set(cellsOf(obstacle).map((c) => c.y));
    for (const unit of unitsOf(ctx.state, side)) {
      if (!cellsOf(unit).some((c) => rows.has(c.y))) continue;
      applyStatusTo(ctx, unit, spec.status, spec.stacks, obstacle.side);
      if (ctx.state.result) return;
    }
  }
}

function decay(unit: Unit, status: StatusKind): void {
  const stacks = unit.statuses[status] ?? 0;
  if (stacks <= 0) return;
  const next = stacks - 1;
  if (next > 0) unit.statuses[status] = next;
  else delete unit.statuses[status];
}

/** Clears per-turn action flags for the side about to act. */
/**
 * Chill stacking (Module 1): the third stack does not tick — it freezes the unit solid.
 * Called wherever Chill is applied, so no card has to remember the threshold.
 */
export function applyChill(ctx: Ctx, unit: Unit, stacks: number, source?: Side): void {
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

  // Dense Ice. Resolved here at the moment the ice forms, for the reason `applyStatusTo`
  // documents at length: the decay loop reads a plain number off the unit and has no idea
  // whose cold it was, and by the time it runs the only side available is the wrong one.
  // A second stack is literally a second decay tick, which is what "lasts one more turn"
  // means in a game whose statuses count down once per owner turn.
  const depth = 1 + (source ? ctx.state.players[source].bonusFreezeStacks : 0);
  unit.statuses.freeze = Math.max(unit.statuses.freeze ?? 0, depth);
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
 * Extra Toxin stacks a side folds into everything **it** poisons.
 *
 * Attributed to the `source` the caller names, not to whoever's turn it happens to be.
 * This read `activeSide` once, and the approximation was visible exactly where a Bloom
 * deck lives: a Rot-Root Snare you laid springs on the *enemy's* turn, so the trap you
 * built and paid for poisoned on their clock and collected nothing. The same reading
 * would have handed the bonus to an enemy Plague-Bearer the moment an encounter granted
 * the enemy commander the stat, with no card text saying so.
 *
 * A `source` of `undefined` means nobody's poison — scenery bursting, a crystal
 * shattering. Those are the board's doing and collect nothing, which is the honest answer
 * rather than crediting them to whoever is standing nearby.
 */
function toxinBonus(ctx: Ctx, status: StatusKind, source: Side | undefined): number {
  if (status !== 'toxin' || !source) return 0;
  return ctx.state.players[source].bonusToxinStacks;
}

/**
 * Puts a status on a unit.
 *
 * `source` is who is doing it, and it exists for one reason: the amplified count is
 * resolved **here, at the moment of application**, and then stored. Everything downstream
 * — the tick, the decay, Wildfire's consumption — reads a plain number off the unit and
 * never asks whose poison it was. That is what keeps `tickStatus` side-agnostic, and it
 * is why the bonus cannot be applied at tick time instead: by then the clock has moved
 * and the only side available is the wrong one.
 */
export function applyStatusTo(
  ctx: Ctx,
  unit: Unit,
  status: StatusKind,
  stacks: number,
  source?: Side,
): void {
  if (status === 'chill') {
    applyChill(ctx, unit, stacks, source);
    return;
  }

  unit.statuses[status] =
    (unit.statuses[status] ?? 0) + stacks + toxinBonus(ctx, status, source);
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
