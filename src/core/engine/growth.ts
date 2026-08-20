/**
 * Two ways a body gets bigger, and they belong to different sides of the board.
 *
 * **`Growth`** is the enemy's clock — the old `Escalate`, renamed and fenced. A threat that
 * survives keeps getting worse, which is what makes a long fight frightening rather than
 * merely slow.
 *
 * **Auras** are the player's, and they are the opposite shape: cast rather than innate,
 * and hard-stopped at three stacks. See `src/core/data/auras.ts` for why.
 *
 * They live in one file because they occupy the same slot in the turn and answer the same
 * question — "what does surviving a round do to this unit?" — and keeping the two answers
 * next to each other is what stops a future edit teaching one of them the other's habits.
 */

import type { Ctx } from './context.js';
import { emit } from './context.js';
import type { Unit } from '../types/units.js';
import { CARDS } from '../data/cards/index.js';
import { auraDef, AURA_LAST_PAYING_STACK } from '../data/auras.js';
import { dealDamage } from './damage.js';

/** A 1x1 enemy's ceiling, unchanged. */
export const GROWTH_CAP = 3;

/**
 * A Behemoth's ceiling.
 *
 * Was `Infinity`, which was both a balance claim nobody meant literally and a real bug:
 * `Infinity` is not JSON, so a saved fight reloaded with the ceiling replaced by `null`.
 * 99 is unreachable in any fight that ends, and it survives a round trip.
 */
export const GROWTH_CAP_BEHEMOTH = 99;

export function growthCapFor(footprint: 1 | 2): number {
  return footprint === 2 ? GROWTH_CAP_BEHEMOTH : GROWTH_CAP;
}

/**
 * The enemy's clock, one tick.
 *
 * Fires at the start of the owner's turn for units that lived through the opposing round,
 * and fires even on Frozen or Stunned units — being held down does not stop something
 * growing.
 */
export function growUnit(ctx: Ctx, unit: Unit): void {
  // A Bound Form is bound: its power is the Pact's, and the Pact does not grow. Belt to
  // the suspenders of its card carrying no keyword, so a future effect that granted Growth
  // to everything still could not move it.
  if (unit.keywords.includes('BoundForm')) return;
  // Enemy-side only. The player's units grow through Auras, which cap at three — a player
  // body that also carried this keyword would be growing on two clocks at once, and the
  // uncapped one would win. The gate is here rather than in the card data so that an enemy
  // fielding a body the player can also field still gets its clock.
  if (unit.side !== 'enemy') return;
  if (!unit.keywords.includes('Growth')) return;
  if (unit.freshlySummoned) {
    // It has now survived a full round, so it grows from next turn onward.
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

// ---------------------------------------------------------------------------- Auras

/** Whether this unit's Aura has reached its cap. */
export function isClimaxed(unit: Unit): boolean {
  const def = unit.aura ? auraDef(unit.aura.defId) : undefined;
  return !!def && !!unit.aura && unit.aura.stacks >= def.maxStacks;
}

/**
 * The Climax trait this unit actively possesses, or undefined.
 *
 * The single query every future Climax behaviour hangs off — none of the five are
 * implemented yet, by design: this phase builds the system and marks the trait.
 */
export function climaxTraitOf(unit: Unit): string | undefined {
  if (!isClimaxed(unit)) return undefined;
  return auraDef(unit.aura!.defId)?.climaxTrait;
}

/**
 * Applies or removes one Aura's worth of stat, `sign` being +1 or -1.
 *
 * One function for both directions so a grant and its reversal can never drift: an Aura
 * that gave +3 ATK over its life has to take exactly +3 back when it is replaced or spent,
 * or stacking and re-casting becomes a way to launder permanent stats.
 */
function applyAuraStat(unit: Unit, defId: string, steps: number, sign: 1 | -1): void {
  const def = auraDef(defId);
  if (!def || steps <= 0) return;
  const stat = def.passiveStat;
  const n = steps * sign;

  if (stat.atk) unit.atk = Math.max(0, unit.atk + stat.atk * n);
  if (stat.mov) unit.mov = Math.max(0, unit.mov + stat.mov * n);
  if (stat.armor) unit.armor = Math.max(0, unit.armor + stat.armor * n);
  if (stat.maxHp) {
    unit.maxHp = Math.max(1, unit.maxHp + stat.maxHp * n);
    if (sign === 1) unit.hp += stat.maxHp * steps;
    // Taking a ceiling away must not leave a unit above it. Clamping rather than
    // subtracting so a wounded body does not pay the loss twice.
    unit.hp = Math.min(unit.hp, unit.maxHp);
    if (unit.hp < 1) unit.hp = 1;
  }
}

/** How many stacks of this Aura have actually been paid out as stats. */
function paidStacks(stacks: number): number {
  return Math.min(stacks, AURA_LAST_PAYING_STACK);
}

/**
 * Puts an Aura on a unit, replacing whatever it was wearing.
 *
 * Recasting resets to a single stack, and the outgoing Aura's stats are handed back first
 * — otherwise growing Pyre to three and then casting Bloom would keep the ATK and add the
 * health, which is a way to wear every Aura at once for the price of the last one.
 */
export function attachAura(ctx: Ctx, unit: Unit, defId: string): void {
  const def = auraDef(defId);
  if (!def) return;
  // The Bound Form is the Pact's body. Nothing that grows a unit may touch it.
  if (unit.keywords.includes('BoundForm')) return;

  if (unit.aura) removeAura(unit);

  unit.aura = { defId, stacks: 1 };
  applyAuraStat(unit, defId, 1, 1);

  emit(ctx, {
    t: 'auraAttached',
    unitId: unit.id,
    aura: defId,
    name: def.name,
    stacks: 1,
    atk: unit.atk,
    hp: unit.hp,
  });
}

/**
 * Strips an Aura and hands back every stat it paid.
 *
 * Used by both replacement and detonation, so the two can never disagree about what an
 * Aura leaves behind — which is nothing.
 */
export function removeAura(unit: Unit): string | undefined {
  const held = unit.aura;
  if (!held) return undefined;
  applyAuraStat(unit, held.defId, paidStacks(held.stacks), -1);
  delete unit.aura;
  return held.defId;
}

/**
 * One turn of an Aura: the toll first, then the growth.
 *
 * Order matters and is deliberate. The upkeep is charged before the stack is taken, so a
 * Marrow Siphon that finally kills its host does not also hand out a stack on the way out
 * — and the wound is what the player is watching, so it should land first.
 */
export function tickAura(ctx: Ctx, unit: Unit): void {
  const held = unit.aura;
  if (!held) return;
  const def = auraDef(held.defId);
  if (!def) return;

  // 1. The toll, charged every turn the Aura lives — including after it has Climaxed,
  //    which is what keeps a Hollow host permanently one turn closer to dying.
  if (def.upkeep) {
    const cmd = ctx.state.players[unit.side];
    if (def.upkeep.marrow) {
      cmd.marrow += def.upkeep.marrow;
      emit(ctx, {
        t: 'resourcesChanged',
        side: unit.side,
        pips: cmd.pips,
        marrow: cmd.marrow,
      });
    }
    if (def.upkeep.selfDamage) {
      // `true` damage: an upkeep armour could absorb would be an upkeep a Bulwark deck
      // simply does not pay.
      dealDamage(ctx, {
        target: { kind: 'unit', id: unit.id },
        amount: def.upkeep.selfDamage,
        dtype: 'true',
        cause: 'status',
      });
      // It may have just bled out. Everything below wants a body.
      if (!ctx.state.units[unit.id]) return;
    }
  }

  // 2. Not on the turn it landed. Reusing the unit's own `freshlySummoned` gate rather
  //    than adding a per-Aura one: a body that has not yet stood a round is not growing on
  //    any clock, and `growUnit` clears the flag for the enemy's.
  if (unit.freshlySummoned) return;
  if (held.stacks >= def.maxStacks) return;

  held.stacks += 1;

  // Stacks 1 and 2 pay a stat; arriving at 3 pays nothing and unlocks the Climax instead.
  // A fully-grown Aura is therefore worth two steps of its stat and one trait.
  if (held.stacks <= AURA_LAST_PAYING_STACK) {
    applyAuraStat(unit, held.defId, 1, 1);
  }

  emit(ctx, {
    t: 'auraStacked',
    unitId: unit.id,
    aura: held.defId,
    stacks: held.stacks,
    atk: unit.atk,
    hp: unit.hp,
  });

  if (held.stacks >= def.maxStacks) {
    emit(ctx, {
      t: 'auraClimaxed',
      unitId: unit.id,
      aura: held.defId,
      trait: def.climaxTrait,
      atk: unit.atk,
      hp: unit.hp,
    });
  }
}
