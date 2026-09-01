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
import { auraDef, AURA_LAST_PAYING_STACK, type AuraDef } from '../data/auras.js';
import { dealDamage } from './damage.js';
import { STAT_SCALE } from '../scale.js';

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
/**
 * Ceiling on self-plating, and it is the Aura cap wearing a different hat.
 *
 * Player-side `Escalate` was removed on purpose: unbounded growth on a body that never
 * leaves the board is the exact thing Auras replaced, and they stop at three stacks. A
 * Guardian that welds plate onto itself is the Bulwark school's version of the same idea
 * and it gets the same bound, so one left alone in a corner becomes hard rather than
 * unkillable.
 */
export const PLATE_CAP = 3;

/**
 * Armor a body adds to itself at the start of its owner's turn.
 *
 * In the same slot as `growUnit` and `tickAura`, because it is the third member of that
 * family -- a thing a persistent body does on its own clock -- and because putting it
 * anywhere else would mean a fourth place that has to agree about what "start of turn"
 * means.
 */
/**
 * Def ids that plate themselves, resolved once at module load.
 *
 * The caller checks this before calling, and the reason is the same one guarding the
 * hazard and construct passes: this question is asked of every unit on every turn of every
 * simulated branch the Adept explores, and a `Set.has` on a one-element set is a great deal
 * cheaper than a lookup into the whole card database followed by three optional chains.
 */
export const PLATERS: ReadonlySet<string> = new Set(
  Object.values(CARDS)
    .filter((c) => (c.unit?.platesEachTurn ?? 0) > 0)
    .map((c) => c.id),
);

export function plateUnit(ctx: Ctx, unit: Unit): void {
  const per = CARDS[unit.defId]?.unit?.platesEachTurn ?? 0;
  if (per <= 0) return;
  // The same grace `growUnit` gives: a body plates from the turn *after* it arrives, so
  // summoning one does not hand the player armour it has not stood a round for.
  if (unit.freshlySummoned) return;

  const ceiling = per * PLATE_CAP;
  if (unit.armor >= ceiling) return;

  const amount = Math.min(per, ceiling - unit.armor);
  unit.armor += amount;
  emit(ctx, {
    t: 'armorGained',
    target: { kind: 'unit', id: unit.id },
    amount,
    total: unit.armor,
  });
}

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

  const bonus = CARDS[unit.defId]?.unit?.escalationBonus ?? { atk: STAT_SCALE, hp: 0 };
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
 * The single query every Climax behaviour hangs off, each at its own named seam:
 * `overload` and `heavyFootprint` in movement and displacement, `conflagration` and
 * `hollow` on the attack rider, `overgrowth` on the swing and the corpse, `rimeShell` in
 * the tick below, `blink` in `legalMoves`.
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
        bones: cmd.bones,
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
  if (held.stacks >= def.maxStacks) {
    reformShell(ctx, unit, def);
    return;
  }

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

/**
 * Rime Shell's Climax: the plate re-forms.
 *
 * One step of the Aura's own armour comes back at the start of each of the host's turns,
 * for as long as it holds — frost's whole argument is that it does not die, and the
 * Climax is that argument made permanent. Bounded the way `plateUnit` bounds a Guardian:
 * the ceiling is a full three stacks' worth, so a shell left alone becomes hard rather
 * than unkillable, and a wall of ice standing in a corner does not grow plate forever.
 */
function reformShell(ctx: Ctx, unit: Unit, def: AuraDef): void {
  if (def.climaxTrait !== 'rimeShell') return;
  const step = def.passiveStat.armor ?? 0;
  if (step <= 0) return;

  const ceiling = step * def.maxStacks;
  if (unit.armor >= ceiling) return;

  const amount = Math.min(step, ceiling - unit.armor);
  unit.armor += amount;
  emit(ctx, {
    t: 'armorGained',
    target: { kind: 'unit', id: unit.id },
    amount,
    total: unit.armor,
  });
}
