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
import { getEntity, entityAt, opposite } from './board.js';
import { DIRS_8 } from '../util/grid.js';
import { inBounds } from '../types/state.js';
import { getEncounterScript } from '../data/encounters/registry.js';
// Circular by design: runes/death call back into dealDamage. ESM hoists function
// declarations, so these resolve correctly at call time.
import { evaluateRuneOnDamage } from './runes.js';
import { killEntity } from './death.js';
import { isSealed } from './subjugation.js';

export interface DamageRequest {
  target: TargetRef;
  amount: number;
  dtype: DamageType;
  cause: DamageCause;
  /** Set for cascade bookkeeping; runes detonated by this hit inherit depth + 1. */
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

/** What each arc carries to a neighbour. Deliberately small: it is a bonus, not the spell. */
export const RAIN_ARC_DAMAGE = 1;

/**
 * Rain conduction: a shock that lands in a downpour jumps to everything touching it.
 *
 * There is no queue here, and there does not need to be one. The reducer is synchronous
 * and resolves a command's cascades completely before returning, so a secondary hit is
 * simply an ordered recursive call placed after the primary HP write — the same shape
 * Counter and the reaction outcomes already use a few lines below.
 *
 * Three things keep it deterministic and bounded:
 *   - `DIRS_8` is a fixed row-then-column list, so the arcs always resolve in one order.
 *   - The neighbours are collected into ids *before* any of them are dealt damage. Read
 *     lazily, a death mid-loop would mutate the board being iterated.
 *   - Arcs deal `physical`, not `shock`, so an arc cannot arc. That is what makes the
 *     recursion depth exactly one rather than a chain reaction across the board.
 *
 * `chainCancelled` is honoured, so a boss Damage Gate stops the arcs with everything else.
 */
function conductShock(ctx: Ctx, req: DamageRequest, primary: Entity): void {
  if (req.dtype !== 'shock') return;
  if (ctx.state.encounter.weather?.kind !== 'rain') return;
  if (ctx.state.encounter.chainCancelled) return;

  const struck: UnitId[] = [];
  for (const dir of DIRS_8) {
    const cell = { x: primary.anchor.x + dir.x, y: primary.anchor.y + dir.y };
    if (!inBounds(ctx.state, cell)) continue;
    const neighbour = entityAt(ctx.state, cell);
    // Units only: arcing through scenery would make every wall a lightning rod.
    if (!neighbour || !isUnit(neighbour)) continue;
    // A Behemoth occupies cells adjacent to its own anchor, so it would otherwise
    // arc into itself; identity is by id, never by position.
    if (neighbour.id === primary.id) continue;
    // Every unit touching it, whoever it belongs to. A charge that checked allegiance
    // before jumping would be a spell effect wearing weather's clothes; this is the same
    // indiscriminate rule the volatile crystals already follow, and it is what makes
    // casting into a melee in the rain a decision rather than a free bonus.
    if (struck.includes(neighbour.id)) continue; // a 2x2 touches on several sides
    struck.push(neighbour.id);
  }

  for (const id of struck) {
    if (ctx.state.encounter.chainCancelled) return;
    // Re-read: an earlier arc in this same loop may already have killed it.
    if (!ctx.state.units[id]) continue;
    dealDamage(ctx, {
      target: { kind: 'unit', id },
      amount: RAIN_ARC_DAMAGE,
      dtype: 'physical',
      cause: 'reaction',
      ...(req.sourceUnitId ? { sourceUnitId: req.sourceUnitId } : {}),
    });
  }
}

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
      });
    }
  }

  // Wet ground conducts. Placed with the other secondary hits and for the same reason:
  // after the HP write, so what arcs is a blow that actually landed.
  // A Surge hit leaves residual charge for fire or frost to find later. Applied after
  // the HP write like everything else here, and only to units — scenery holds no charge.
  if (isUnit(entity) && req.dtype === 'shock' && entity.hp > 0) {
    applyStatusTo(ctx, entity, 'charged', 1);
  }

  conductShock(ctx, req, entity);

  // Reactions and runes both resolve after the HP write, so the "at least 1 point of
  // actual HP loss" penetration rule is checked against reality rather than intent.
  // The reaction goes first: Shatter stripping armor should be able to expose a rune.
  if (pending) {
    resolveReaction(ctx, pending, hpLoss, dealDamage as never);
  }

  if (entity.rune) {
    evaluateRuneOnDamage(ctx, entity, req, hpLoss, died);
  }

  if (died && entity.hp <= 0) {
    killEntity(ctx, entity, req.cause);
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

export function drainCommander(ctx: Ctx, side: Side, amount: number, cause: DamageCause): void {
  dealDamage(ctx, {
    target: { kind: 'portrait', side },
    amount,
    dtype: 'true',
    cause,
  });
}

export const enemyOf = opposite;
