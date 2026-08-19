/**
 * The damage pipeline — the choke point every rule passes through.
 *
 * Order of operations: encounter Damage Gate -> armor absorption -> HP loss ->
 * rune trigger evaluation -> death -> lethal check. Nothing else in the engine is
 * allowed to write `hp` directly.
 */

import type { Coord, DamageCause, DamageType, Side, TargetRef, UnitId } from '../../contract/ids.js';
import type { Ctx } from './context.js';
import { emit } from './context.js';
import { prepareReaction, resolveReaction } from './reactions.js';
import { applyStatusTo } from './status.js';
import type { Entity, Unit } from '../types/units.js';
import { isUnit } from '../types/units.js';
import { getEntity, opposite } from './board.js';
import { getEncounterScript } from '../data/encounters/registry.js';
// Circular by design: runes/death call back into dealDamage. ESM hoists function
// declarations, so these resolve correctly at call time.
import { evaluateRuneOnDamage } from './runes.js';
import { killEntity } from './death.js';
import { isSealed } from './subjugation.js';

/**
 * How many links a single cascade may run before the engine stops following it.
 *
 * Lives here, beside the pipeline, because **every** secondary effect is a link: a rune
 * detonating, a reaction splashing, a Counter answering, an Overload shoving a body into
 * a wall, a crystal bursting as it dies. It sat in `runes.ts` while only runes counted it,
 * and the consequence was that `rune -> collision -> rune` restarted the count at one and
 * was bounded by nothing at all.
 *
 * Eight is far above anything a real board produces. It is a backstop against a cycle
 * somebody builds by accident, not a balance number.
 */
export const MAX_CHAIN_DEPTH = 8;

export interface DamageRequest {
  target: TargetRef;
  amount: number;
  dtype: DamageType;
  cause: DamageCause;
  /**
   * How deep in a cascade this hit is. Absent means depth zero — a fresh chain, which is
   * what a card, a swing, a status tick, or a current is.
   *
   * Every secondary hit the pipeline produces carries `nextDepth(req)`, so a chain is
   * counted the same however it is spelled: `MAX_CHAIN_DEPTH` bounds a rune detonating a
   * rune exactly as it bounds a rune shoving a body into a wall that kills a crystal.
   */
  chainDepth?: number;
  /** Attacker, for Counter resolution. */
  sourceUnitId?: UnitId;
}

export interface DamageOutcome {
  absorbedByArmor: number;
  hpLoss: number;
  /**
   * The target was reduced to nothing. For a Bound Form, whose damage is redirected to
   * the Pact, this means the *Pact* is spent and the combat is over -- not that the unit
   * is removed. No caller inspects it on that path today; the lethal check every command
   * runs is what actually ends the game.
   */
  died: boolean;
}

/**
 * Applies damage to a unit, obstacle, or commander portrait.
 * Returns what actually landed, because rune triggers depend on real HP loss.
 */
/** Brittle (Module 1): a frozen-through target takes this much extra from every hit. */
export const BRITTLE_BONUS = 2;

/** The depth a secondary effect of this hit should carry. */
export function nextDepth(req: { chainDepth?: number }): number {
  return (req.chainDepth ?? 0) + 1;
}

/**
 * Whether this hit is too deep to be allowed to cause anything further.
 *
 * Read once, in `damageEntity`, and it gates every secondary at the same place rather
 * than each of them checking separately. The damage itself always lands: a cascade that
 * hits the ceiling stops *spreading*, it does not stop hurting. That is the same courtesy
 * `chainCancelled` extends, and it means a bounded chain and a cancelled one leave the
 * board in shapes a player can tell apart.
 */
export function atChainLimit(req: { chainDepth?: number }): boolean {
  return (req.chainDepth ?? 0) >= MAX_CHAIN_DEPTH;
}

export function dealDamage(ctx: Ctx, req: DamageRequest): DamageOutcome {
  if (ctx.state.result) return { absorbedByArmor: 0, hpLoss: 0, died: false };

  // The seal is checked here, at the top, and not further down beside armor and Brittle.
  // A sealed Alpha's body is a Bound Form, so its damage is redirected to the portrait
  // two lines below and never reaches `damageEntity` at all -- a gate placed there looks
  // right and does nothing. This is the one point every route passes through.
  //
  // It covers `true` damage too. The phase is built on damage having stopped being the
  // answer, and an exception for unblockable damage would leave the Pacifist Lockout as
  // a way to win a subjugation by waiting.
  if (isSealed(ctx.state, req.target)) return { absorbedByArmor: 0, hpLoss: 0, died: false };

  if (req.target.kind === 'portrait') {
    return damagePortrait(ctx, req, req.target.side);
  }

  const entity = getEntity(ctx.state, req.target.id);
  if (!entity) return { absorbedByArmor: 0, hpLoss: 0, died: false };

  // The Bound Form is the Pact's body on the board: it keeps no health of its own, so
  // every blow it takes -- a strike, a spell, a burn tick, a shove into a wall -- lands
  // on the shared pool instead. Its tile travels with the redirect so the hit can still
  // be drawn where it happened rather than only on the portrait.
  //
  // This deliberately bypasses damageEntity, and therefore armor on the unit, Counter,
  // Brittle, elemental reactions, and rune-on-damage. A Bound Form can host none of
  // those meaningfully, so targeting refuses to attach them (see legalCardTargets)
  // rather than letting a card be spent on an effect that would never fire.
  //
  // **On-hit riders are bypassed too**, and they are the one member of that list the
  // redirect cannot enforce by itself: a rider is applied by the attack reducer rather
  // than by this pipeline, so `applyOnHit` carries the refusal instead. Left in, it was
  // the only route in the game from a melee swing to poisoning a portrait -- the status
  // landed on the body, and every tick came back through here to the Pact.
  if (isUnit(entity) && entity.keywords.includes('BoundForm')) {
    return damagePortrait(ctx, req, entity.side, entity.anchor);
  }

  return damageEntity(ctx, entity, req);
}

/**
 * Fire gutters in the rain.
 *
 * Applied before armor and before anything else looks at the number, so a Cinder Rune in
 * a downpour is genuinely weaker rather than merely absorbed differently. It can be
 * damped to nothing, which is the point: bringing a Pyre deck to a storm is a decision
 * with a price, and the pre-combat screen exists so it is an informed one.
 */
function dampenFire(ctx: Ctx, req: DamageRequest): number {
  if (req.dtype !== 'fire') return req.amount;
  if (ctx.state.encounter.weather?.kind !== 'rain') return req.amount;
  return Math.max(0, req.amount - RAIN_FIRE_PENALTY);
}

/** How much a downpour takes off every point of fire. */
export const RAIN_FIRE_PENALTY = 1;

function damagePortrait(ctx: Ctx, req: DamageRequest, side: Side, at?: Coord): DamageOutcome {
  const cmd = ctx.state.players[side];
  let amount = dampenFire(ctx, req);

  // Boss Damage Gates clamp incoming damage at phase thresholds and cancel the rest
  // of the current resolution chain.
  const script = getEncounterScript(ctx.state.encounter.id);
  if (script?.onDamageToCommander) {
    amount = script.onDamageToCommander(ctx, side, amount);
  }

  let absorbed = 0;
  if (req.dtype !== 'true' && cmd.armor > 0) {
    absorbed = Math.min(cmd.armor, amount);
    cmd.armor -= absorbed;
    amount -= absorbed;
  }

  const hpLoss = Math.min(cmd.hp, Math.max(0, amount));
  cmd.hp -= hpLoss;
  if (hpLoss > 0) ctx.state.commanderDamagedThisRound = true;

  emit(ctx, {
    t: 'damageDealt',
    target: { kind: 'portrait', side },
    ...(at ? { at: { ...at } } : {}),
    amount: req.amount,
    absorbedByArmor: absorbed,
    hpLoss,
    remainingHp: cmd.hp,
    dtype: req.dtype,
    cause: req.cause,
  });

  if (hpLoss > 0 && script?.onCommanderHpChanged) {
    script.onCommanderHpChanged(ctx, side);
  }

  return { absorbedByArmor: absorbed, hpLoss, died: cmd.hp <= 0 };
}

function damageEntity(ctx: Ctx, entity: Entity, req: DamageRequest): DamageOutcome {
  let amount = dampenFire(ctx, req);
  let absorbed = 0;

  // Brittle: frozen-through flesh takes more from everything, before armor is applied.
  if (isUnit(entity) && (entity.statuses.brittle ?? 0) > 0 && req.dtype !== 'true') {
    amount += BRITTLE_BONUS;
  }

  // Elemental reactions resolve around the damage write: the bonus and the status
  // consumption happen now, the outcome once we know the hit actually landed.
  const { bonus, pending } = prepareReaction(ctx, entity, req.dtype);
  amount += bonus;

  // Toxin and other `true` damage bypasses armor entirely.
  if (req.dtype !== 'true' && entity.hp > 0) {
    const armor = 'armor' in entity ? entity.armor : 0;
    if (armor > 0) {
      absorbed = Math.min(armor, amount);
      (entity as Unit).armor = armor - absorbed;
      amount -= absorbed;
    }
  }

  const hpLoss = Math.min(entity.hp, Math.max(0, amount));
  entity.hp -= hpLoss;

  emit(ctx, {
    t: 'damageDealt',
    target: isUnit(entity) ? { kind: 'unit', id: entity.id } : { kind: 'obstacle', id: entity.id },
    at: { ...entity.anchor },
    // Report what actually arrived, including Brittle and any reaction bonus, so the
    // number the player sees on screen matches the HP that vanished.
    amount,
    absorbedByArmor: absorbed,
    hpLoss,
    remainingHp: entity.hp,
    dtype: req.dtype,
    cause: req.cause,
  });

  const died = entity.hp <= 0;

  // A Surge hit leaves residual charge for fire or frost to find later. Applied after
  // the HP write like everything else here, and only to units — scenery holds no charge.
  //
  // Outside the chain gate deliberately: leaving a status is not a cascade link. It causes
  // nothing by itself — `charged` is inert until something else arrives — so a hit at the
  // ceiling should still mark what it hit, and the *reaction* that mark later enables is
  // what the ceiling is there to stop.
  if (isUnit(entity) && req.dtype === 'shock' && entity.hp > 0) {
    // Charge, so the bonus never applies — the source is named anyway rather than
    // left to default, so this line does not become the odd one out later.
    applyStatusTo(ctx, entity, 'charged', 1, req.sourceUnitId ? ctx.state.units[req.sourceUnitId]?.side : undefined);
  }

  // Everything in here *causes something else*, and this is where a cascade is allowed to
  // end. One check in front of all of them rather than one inside each: a rule that has to
  // be remembered at three call sites is a rule that will be missed at the fourth.
  //
  // The damage itself has already landed above. A chain at its ceiling stops *spreading*,
  // not hurting — the same courtesy `chainCancelled` extends, and what keeps a bounded
  // chain and a cancelled one distinguishable from a hit that silently did nothing.
  //
  // Counter is inside despite being limited to one link by its own `cause` test: being
  // unable to recurse is not the same as being free to extend somebody else's chain.
  if (!atChainLimit(req)) {
    // Counter (Riposte): only against melee attacks, and only if the defender survives.
    if (
      !died &&
      isUnit(entity) &&
      entity.keywords.includes('Counter') &&
      req.cause === 'attack' &&
      req.sourceUnitId
    ) {
      const attacker = ctx.state.units[req.sourceUnitId];
      if (attacker && attacker.hp > 0) {
        dealDamage(ctx, {
          target: { kind: 'unit', id: attacker.id },
          amount: entity.atk,
          dtype: 'physical',
          cause: 'counter',
          sourceUnitId: entity.id,
          chainDepth: nextDepth(req),
        });
      }
    }

    // Reactions and runes both resolve after the HP write, so the "at least 1 point of
    // actual HP loss" penetration rule is checked against reality rather than intent.
    // The reaction goes first: Shatter stripping armor should be able to expose a rune.
    if (pending) {
      resolveReaction(ctx, pending, hpLoss, dealDamage as never, nextDepth(req));
    }

    if (entity.rune) {
      evaluateRuneOnDamage(ctx, entity, req, hpLoss, died);
    }
  }

  // Removal is **never** gated. A cascade running out of budget must not leave a body
  // standing at zero health: death is bookkeeping the board cannot be correct without,
  // not a link in a chain. What the death then *causes* — a crystal bursting, a rune on
  // a corpse — inherits the depth and meets the same ceiling one level down.
  if (died && entity.hp <= 0) {
    // The death is a link too: a crystal that bursts as it dies can set off the next.
    killEntity(ctx, entity, req.cause, false, nextDepth(req));
  }

  return { absorbedByArmor: absorbed, hpLoss, died };
}

/** Direct healing / armor grants, kept here so all HP writes live in one file. */
export function grantArmor(ctx: Ctx, target: TargetRef, amount: number): void {
  if (target.kind === 'portrait') {
    const cmd = ctx.state.players[target.side];
    cmd.armor += amount;
    emit(ctx, { t: 'armorGained', target, amount, total: cmd.armor });
    return;
  }
  const entity = getEntity(ctx.state, target.id);
  if (!entity || !isUnit(entity)) return;
  entity.armor += amount;
  emit(ctx, { t: 'armorGained', target, amount, total: entity.armor });
}

/**
 * Puts health back on a Commander, and reports how much actually landed.
 *
 * The first thing in the game that heals. `healed` has been in the event union — and had
 * an animation waiting for it — since long before anything emitted one, so this fills a
 * seam rather than cutting a new one.
 *
 * Clamped at the ceiling and silent when nothing is owed: a Pact already full emits no
 * event, because a floater reading "+0" is worse than no floater at all.
 */
export function healCommander(ctx: Ctx, side: Side, amount: number): number {
  if (amount <= 0 || ctx.state.result) return 0;

  const cmd = ctx.state.players[side];
  const healed = Math.min(amount, cmd.maxHp - cmd.hp);
  if (healed <= 0) return 0;

  cmd.hp += healed;
  emit(ctx, {
    t: 'healed',
    target: { kind: 'portrait', side },
    amount: healed,
    remainingHp: cmd.hp,
  });
  return healed;
}

export function drainCommander(ctx: Ctx, side: Side, amount: number, cause: DamageCause): void {
  dealDamage(ctx, {
    target: { kind: 'portrait', side },
    amount,
    dtype: 'true',
    cause,
  });
}

export const enemyOf = opposite;
