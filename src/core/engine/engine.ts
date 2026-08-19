/**
 * The engine's single entry point.
 *
 * applyCommand(state, command) -> { state, events }
 *
 * It is a synchronous reducer: it clones, validates, resolves the command completely
 * (including every cascade and death it triggers), and returns the new state alongside
 * the ordered event batch the sequencer will animate.
 */

import type { Coord, TargetRef } from '../../contract/ids.js';
import type { Command } from '../types/commands.js';
import { IllegalCommandError } from '../types/commands.js';
import type { GameState, StepResult } from '../types/state.js';
import type { Unit } from '../types/units.js';
import type { CardDef, CardPlayContext, ChosenTarget } from '../types/cards.js';
import type { Ctx } from './context.js';
import { emit, makeCtx, newCause } from './context.js';
import { deepClone } from '../util/clone.js';
import { CARDS } from '../data/cards/index.js';
import { canAfford, effectiveCost, resolvePlayedCard, spendResources } from './deck.js';
import { executeEffect } from './effects.js';
import { canAct, canAttack, canMove, findMove, setAnchor } from './movement.js';
import { legalAttacks, legalCardTargets } from './targeting.js';
import { dealDamage, healCommander } from './damage.js';
import { applyStatusTo } from './status.js';
import { killEntity, checkLethal } from './death.js';
import { getEntity, refOf } from './board.js';
import { resonanceLimit, toCardSnapshot } from './views.js';
import { endTurn } from './turn.js';
import { cellsOf, footprintDistance } from '../util/grid.js';
import { coordEq } from '../../contract/ids.js';
import { spawnHazard } from './reactions.js';
import { resonanceFor } from '../data/resonance.js';
import { declareIntents } from './intents.js';
import { isSealed } from './subjugation.js';

export function applyCommand(prev: GameState, command: Command): StepResult {
  const state = deepClone(prev);
  const ctx = makeCtx(state);

  if (state.result) {
    throw new IllegalCommandError('combat is already over');
  }
  if (state.phase !== 'action' && command.type !== 'endTurn' && command.type !== 'declareIntents') {
    throw new IllegalCommandError(`cannot act during phase "${state.phase}"`);
  }

  runCommand(ctx, command);

  // Every command ends with a lethal check so no path can miss a win condition.
  checkLethal(ctx);
  // The chain-cancel flag is scoped to one action.
  state.encounter.chainCancelled = false;

  return { state, events: ctx.events };
}

/**
 * Runs a command against a context that already exists, without cloning.
 *
 * Used by anything that acts from inside the engine's own turn — the wildlife, an
 * encounter script — so those get the real rules (exhaustion, Counter, collisions)
 * rather than a second, drifting implementation of each action.
 */
export function runCommand(ctx: Ctx, command: Command): void {
  switch (command.type) {
    case 'playCard':
      playCard(ctx, command.card, command.target);
      break;
    case 'moveUnit':
      moveUnit(ctx, command.unit, command.to);
      break;
    case 'attack':
      attack(ctx, command.attacker, command.target);
      break;
    case 'attackTile':
      attackTile(ctx, command.attacker, command.at);
      break;
    case 'sacrifice':
      sacrifice(ctx, command.unit);
      break;
    case 'channel':
      channel(ctx, command.unit);
      break;
    case 'declareIntents':
      declareIntents(ctx, command.plan, command.telegraph);
      break;
    case 'endTurn':
      endTurn(ctx);
      break;
  }
}

// ------------------------------------------------------------------------ commands

function playCard(ctx: Ctx, cardId: string, target: ChosenTarget): void {
  const side = ctx.state.activeSide;
  const cmd = ctx.state.players[side];

  if (!cmd.hand.includes(cardId)) {
    throw new IllegalCommandError(`card ${cardId} is not in hand`);
  }
  const inst = cmd.cards[cardId];
  const def = inst ? CARDS[inst.defId] : undefined;
  if (!inst || !def) throw new IllegalCommandError(`unknown card ${cardId}`);

  const price = effectiveCost(ctx.state, side, def);
  if (!canAfford(ctx.state, side, price)) {
    throw new IllegalCommandError(`cannot afford ${def.name} (${price})`);
  }

  // Validate the chosen target before spending anything. Without this a summon onto an
  // occupied tile would consume the card and its Pips and quietly do nothing.
  const legal = legalCardTargets(ctx.state, side, def.id);
  if (!legal.some((t) => sameTarget(t, target))) {
    throw new IllegalCommandError(`illegal target for ${def.name}`);
  }

  const snapshot = toCardSnapshot(ctx.state, side, cardId);
  spendResources(ctx, side, price);

  emit(ctx, {
    t: 'cardPlayed',
    side,
    card: snapshot,
    ...(target.kind === 'tile' ? { at: target.at } : {}),
  });

  // Remove from hand before resolving, so effects that draw cannot redraw this card.
  resolvePlayedCard(ctx, side, cardId);

  const casterAnchor = casterAnchorFor(ctx, def, side, target);
  const play: CardPlayContext = {
    side,
    chosen: target,
    ...(casterAnchor ? { casterAnchor } : {}),
  };

  newCause(ctx);
  executeEffect(ctx, def.effect, play);

  // Resonance resolves after the card, so a Companion summon can be caught by its own
  // Companion's passive lane the same turn it lands.
  if (def.source === 'companion') triggerResonance(ctx, side);
}

/** Fires the Companion's school passive, once per turn. */
function triggerResonance(ctx: Ctx, side: 'player' | 'enemy'): void {
  const cmd = ctx.state.players[side];
  if (cmd.resonancesThisTurn >= resonanceLimit(cmd)) return;
  const def = resonanceFor(cmd.companionSchool);
  if (!def) return;

  cmd.resonancesThisTurn += 1;
  newCause(ctx);
  emit(ctx, { t: 'resonanceTriggered', side, name: def.name, column: cmd.companionColumn });
  def.apply(ctx, side, cmd.companionColumn);
}

function sameTarget(a: ChosenTarget, b: ChosenTarget): boolean {
  if (a.kind !== b.kind) return false;
  switch (a.kind) {
    case 'none':
    case 'global':
      return true;
    case 'tile':
      return b.kind === 'tile' && a.at.x === b.at.x && a.at.y === b.at.y;
    case 'line':
      return (
        b.kind === 'line' &&
        a.from.x === b.from.x &&
        a.from.y === b.from.y &&
        a.dir.x === b.dir.x &&
        a.dir.y === b.dir.y
      );
    case 'entity':
      if (b.kind !== 'entity' || a.ref.kind !== b.ref.kind) return false;
      return a.ref.kind === 'portrait'
        ? b.ref.kind === 'portrait' && a.ref.side === b.ref.side
        : 'id' in b.ref && a.ref.id === b.ref.id;
  }
}

/**
 * Where a card's effects consider themselves to originate, which decides which way a
 * shove throws its victim.
 *
 * Line spells carry their own origin. A Companion card is thrown by the Companion, so it
 * pushes away from wherever that is actually standing. A Hero card is cast from off the
 * board and has no position, so displacement.ts falls back to shoving away from the
 * caster's own side.
 */
function casterAnchorFor(
  ctx: Ctx,
  def: CardDef,
  side: 'player' | 'enemy',
  target: ChosenTarget,
): { x: number; y: number } | undefined {
  if (target.kind === 'line') return { ...target.from };
  if (def.source === 'companion') {
    const id = ctx.state.players[side].companionUnitId;
    const body = id ? ctx.state.units[id] : undefined;
    if (body) return { ...body.anchor };
  }
  return undefined;
}

function moveUnit(ctx: Ctx, unitId: string, to: { x: number; y: number }): void {
  const unit = ctx.state.units[unitId];
  if (!unit) throw new IllegalCommandError(`no unit ${unitId}`);
  if (unit.side !== ctx.state.activeSide) throw new IllegalCommandError('not your unit');
  if (!canMove(unit)) throw new IllegalCommandError(`${unit.name} cannot move`);

  const option = findMove(ctx.state, unit, to);
  if (!option) throw new IllegalCommandError('illegal destination');

  // Read before the move: for a 2x2 body these are two tiles, and after `setAnchor` there
  // is no way to know which ones they were.
  const leaving = unit.trail ? cellsOf(unit) : [];

  setAnchor(ctx.state, unitId, to);
  unit.movedThisTurn = true;

  emit(ctx, { t: 'unitMoved', unitId, path: option.path.map((c) => ({ ...c })) });

  if (unit.trail) layTrail(ctx, unit, leaving);
}

/**
 * Wrecks the ground a heavy thing has just walked off.
 *
 * Only the tiles it actually left: a 2x2 body stepping one square still stands on half of
 * where it was, and burying its own feet would be both wrong and a way to immobilise it.
 *
 * Rubble is permanent and costs 2 MOV to cross, so a Titan with 1 MOV can never step back
 * over its own trail. That is the creature, not an oversight — it commits to a direction
 * and the arena is different afterwards.
 */
function layTrail(ctx: Ctx, unit: Unit, leaving: Coord[]): void {
  if (!unit.trail) return;
  const now = cellsOf(unit);

  for (const cell of leaving) {
    if (now.some((c) => coordEq(c, cell))) continue;
    spawnHazard(ctx, cell, unit.trail, 1, unit.trail === 'rubble');
  }
}

function attack(ctx: Ctx, attackerId: string, target: TargetRef): void {
  const attacker = ctx.state.units[attackerId];
  if (!attacker) throw new IllegalCommandError(`no unit ${attackerId}`);
  if (attacker.side !== ctx.state.activeSide) throw new IllegalCommandError('not your unit');
  if (!canAttack(attacker)) throw new IllegalCommandError(`${attacker.name} cannot attack`);

  const legal = legalAttacks(ctx.state, attacker);
  const ok = legal.some((l) =>
    l.kind === target.kind &&
    (l.kind === 'portrait'
      ? target.kind === 'portrait' && l.side === target.side
      : 'id' in target && l.id === target.id),
  );
  if (!ok) throw new IllegalCommandError('illegal attack target');

  emit(ctx, { t: 'attackDeclared', attackerId, target });

  // Attacking spends only the attack. A unit that has not yet moved may still withdraw
  // afterwards — striking and retreating is the point of independent actions.
  attacker.attackedThisTurn = true;

  const isMelee = target.kind !== 'portrait'
    ? footprintDistance(attacker, getEntity(ctx.state, target.id) ?? attacker) <= 1
    : false;

  newCause(ctx);
  const landed = dealDamage(ctx, {
    target,
    amount: attacker.atk,
    dtype: 'physical',
    cause: 'attack',
    ...(isMelee ? { sourceUnitId: attackerId } : {}),
  });

  applyOnHit(ctx, attackerId, target, landed.hpLoss);
}

/**
 * The rider an attack leaves behind, if it has one.
 *
 * It is applied *after* the damage rather than before, so the blow resolves against the
 * board as it was swung at: charging a target and then hitting it would let a single
 * Bombardier set up and cash in its own Overload.
 *
 * Six things it deliberately does not do, and the first five are all the same rule --
 * **a rider is something a landed blow leaves on a living body.**
 *
 * - It does not brand a corpse. A status on something already removed is bookkeeping
 *   nobody reads, and the kill is the better outcome anyway.
 * - It does not swing from one. The attacker is re-read here rather than captured before
 *   the blow, because `dealDamage` resolves Counter, rune blasts and the lethal check
 *   before returning: an attacker can be dead by the time its own rider would land, and
 *   `killEntity` removes a unit from the map without mutating the object a caller still
 *   holds. Reading `onHit` off that reference is reading a corpse's intentions.
 * - It does not land on a blow that was entirely soaked. `hpLoss` is the same test runes
 *   and three of the five reactions use: armor that stops the hit stops what rode in on
 *   it. Venom still needs a wound.
 * - It does not touch obstacles or portraits, neither of which carries a status field.
 * - It does not mark a **sealed** Alpha. The seal is the point where damage has stopped
 *   being the answer; branding something the damage pipeline refuses to touch would tick
 *   for numbers that are swallowed on arrival, which reads as a bug rather than a rule.
 *   **This check is belt-and-braces and currently unreachable**: `isSealed` is the first
 *   gate in `dealDamage`, so a sealed target always reports zero `hpLoss` and the wound
 *   test above returns first. It is kept because the two say different things — one is
 *   "the blow did nothing", the other is "this thing is not a legal host" — and the day
 *   the wound rule is loosened for some rider that should mark a blocked hit, the seal
 *   must not be loosened with it. Deleting the gates that never fire is how the case they
 *   guard comes back.
 * - It does not touch a **Bound Form**. That body keeps no health of its own, so a
 *   damaging status on it is not an affliction of the body at all -- every tick would be
 *   redirected straight to the Pact, turning a melee rider into the one thing in the game
 *   that poisons a portrait. It joins armor, Counter, Brittle, reactions and
 *   rune-on-damage on the list of things a Bound Form cannot host meaningfully.
 */
function applyOnHit(ctx: Ctx, attackerId: string, target: TargetRef, hpLoss: number): void {
  if (target.kind !== 'unit') return;
  if (ctx.state.result) return;
  if (hpLoss <= 0) return;

  const attacker = ctx.state.units[attackerId];
  if (!attacker?.onHit) return;

  const victim = ctx.state.units[target.id];
  if (!victim || victim.hp <= 0) return;
  if (victim.keywords.includes('BoundForm')) return;
  if (isSealed(ctx.state, target)) return;

  applyStatusTo(ctx, victim, attacker.onHit.status, attacker.onHit.stacks, attacker.side);
}

/**
 * A declared attack landing on a tile that is now empty.
 *
 * The unit still spends its swing, and nothing takes damage. This is what the player
 * bought by moving the target out of the way, so it has to be visible rather than a
 * silently skipped action.
 */
function attackTile(ctx: Ctx, attackerId: string, at: { x: number; y: number }): void {
  const attacker = ctx.state.units[attackerId];
  if (!attacker) return;
  if (!canAttack(attacker)) return;

  attacker.attackedThisTurn = true;
  newCause(ctx);
  emit(ctx, { t: 'intentWhiffed', attackerId, at: { ...at } });
}

/** Marrow extracted by a unit that spends its swing on the ritual instead of a target. */
export const CHANNEL_MARROW = 1;

/**
 * Channel: give up a unit's attack to extract Marrow.
 *
 * The floor under a bad hand. A turn where nothing is worth attacking and no card is
 * affordable used to be a turn spent passing; now every idle body is worth something,
 * and the choice between striking and channelling is a real one on the margin.
 *
 * Unlike Sacrifice this asks nothing of the unit but its turn — it survives, so there is
 * no offering to be worth anything. The Bound Form is still excluded: extracting Marrow for
 * free with the one unit that cannot be traded away is a turn with no downside at all.
 */
/**
 * Why this unit may not Channel, or null if it may.
 *
 * One rule in one place. The reducer throws whatever this returns, and the UI asks the
 * same question to decide whether to offer the button — so the two can never disagree
 * about what is legal, and the refusal the player reads is the engine's own words.
 *
 * A predicate rather than a boolean-plus-message pair because the caller that needs the
 * reason and the caller that needs the yes/no are the same check either way.
 */
export function channelRefusal(state: GameState, unitId: string): string | null {
  const unit = state.units[unitId];
  if (!unit) return `no unit ${unitId}`;
  if (unit.side !== state.activeSide) return 'not your unit';
  if (unit.attackedThisTurn) return 'unit has already attacked';
  if (!canAct(unit)) return 'unit cannot act';
  if (unit.keywords.includes('BoundForm')) return 'the Bound Form cannot channel';
  return null;
}

function channel(ctx: Ctx, unitId: string): void {
  const refusal = channelRefusal(ctx.state, unitId);
  if (refusal) throw new IllegalCommandError(refusal);
  const unit = ctx.state.units[unitId]!;

  const side = ctx.state.activeSide;
  const cmd = ctx.state.players[side];
  unit.attackedThisTurn = true;
  cmd.marrow += CHANNEL_MARROW;

  newCause(ctx);
  emit(ctx, { t: 'unitChannelled', unitId, side, marrow: CHANNEL_MARROW });
  emit(ctx, { t: 'resourcesChanged', side, pips: cmd.pips, marrow: cmd.marrow });
}

function sacrifice(ctx: Ctx, unitId: string): void {
  const unit = ctx.state.units[unitId];
  if (!unit) throw new IllegalCommandError(`no unit ${unitId}`);
  if (unit.side !== ctx.state.activeSide) throw new IllegalCommandError('not your unit');
  // "Sacrifice un-exhausted minion" (Draft 7): the offering has to come before the blow.
  if (unit.attackedThisTurn) throw new IllegalCommandError('unit has already attacked');
  if (!canAct(unit)) throw new IllegalCommandError('unit cannot act');
  // Some things are not yours to offer. The Bound Form is the Pact itself, and a unit
  // worth no Marrow was never a valid offering -- this command checked neither before,
  // so it would happily consume a unit for nothing.
  if (unit.keywords.includes('BoundForm')) {
    throw new IllegalCommandError('the Bound Form cannot be sacrificed');
  }
  if (unit.sacrificeValue <= 0) throw new IllegalCommandError('unit is worth no marrow');

  const side = ctx.state.activeSide;
  const cmd = ctx.state.players[side];
  // What the body is worth, plus what this commander is willing to take for it.
  const extracted = unit.sacrificeValue + cmd.bonusSacrificeMarrow;
  cmd.marrow += extracted;

  emit(ctx, { t: 'unitSacrificed', unitId, marrowExtracted: extracted });
  // The Pact takes something back from the offering, if this Companion is the sort that
  // does. Zero for everyone else, and `healCommander` says nothing when nothing is owed.
  healCommander(ctx, side, cmd.healOnSacrifice);
  emit(ctx, { t: 'resourcesChanged', side, pips: cmd.pips, marrow: cmd.marrow });

  killEntity(ctx, unit, 'spell');
}

export { refOf };
