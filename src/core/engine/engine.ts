/**
 * The engine's single entry point.
 *
 * applyCommand(state, command) -> { state, events }
 *
 * It is a synchronous reducer: it clones, validates, resolves the command completely
 * (including every cascade and death it triggers), and returns the new state alongside
 * the ordered event batch the sequencer will animate.
 */

import type { TargetRef } from '../../contract/ids.js';
import type { Command } from '../types/commands.js';
import { IllegalCommandError } from '../types/commands.js';
import type { GameState, StepResult } from '../types/state.js';
import type { CardPlayContext, ChosenTarget } from '../types/cards.js';
import type { Ctx } from './context.js';
import { emit, makeCtx, newCause } from './context.js';
import { deepClone } from '../util/clone.js';
import { CARDS } from '../data/cards/index.js';
import { canAfford, resolvePlayedCard, spendResources } from './deck.js';
import { executeEffect } from './effects.js';
import { canAct, canAttack, canMove, findMove, setAnchor } from './movement.js';
import { legalAttacks, legalCardTargets } from './targeting.js';
import { dealDamage } from './damage.js';
import { killEntity, checkLethal } from './death.js';
import { getEntity, refOf } from './board.js';
import { toCardSnapshot } from './views.js';
import { endTurn } from './turn.js';
import { footprintDistance } from '../util/grid.js';
import { resonanceFor } from '../data/resonance.js';
import { declareIntents } from './intents.js';

export function applyCommand(prev: GameState, command: Command): StepResult {
  const state = deepClone(prev);
  const ctx = makeCtx(state);

  if (state.result) {
    throw new IllegalCommandError('combat is already over');
  }
  if (state.phase !== 'action' && command.type !== 'endTurn' && command.type !== 'declareIntents') {
    throw new IllegalCommandError(`cannot act during phase "${state.phase}"`);
  }

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
    case 'declareIntents':
      declareIntents(ctx, command.plan, command.telegraph);
      break;
    case 'endTurn':
      endTurn(ctx);
      break;
  }

  // Every command ends with a lethal check so no path can miss a win condition.
  checkLethal(ctx);
  // The chain-cancel flag is scoped to one action.
  state.encounter.chainCancelled = false;

  return { state, events: ctx.events };
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

  if (!canAfford(ctx.state, side, def.cost)) {
    throw new IllegalCommandError(`cannot afford ${def.name} (${def.cost})`);
  }

  // Validate the chosen target before spending anything. Without this a summon onto an
  // occupied tile would consume the card and its Pips and quietly do nothing.
  const legal = legalCardTargets(ctx.state, side, def.id);
  if (!legal.some((t) => sameTarget(t, target))) {
    throw new IllegalCommandError(`illegal target for ${def.name}`);
  }

  const snapshot = toCardSnapshot(ctx.state, side, cardId);
  spendResources(ctx, side, def.cost);

  emit(ctx, {
    t: 'cardPlayed',
    side,
    card: snapshot,
    ...(target.kind === 'tile' ? { at: target.at } : {}),
  });

  // Remove from hand before resolving, so effects that draw cannot redraw this card.
  resolvePlayedCard(ctx, side, cardId);

  const play: CardPlayContext = {
    side,
    chosen: target,
    ...(casterAnchorFor(ctx, target) ? { casterAnchor: casterAnchorFor(ctx, target) } : {}),
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
  if (cmd.resonanceUsedThisTurn) return;
  const def = resonanceFor(cmd.companionSchool);
  if (!def) return;

  cmd.resonanceUsedThisTurn = true;
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
 * Cards cast from the off-grid portrait have no board origin, so shoves resolve away
 * from the caster's own side. Line spells carry their own origin.
 */
function casterAnchorFor(ctx: Ctx, target: ChosenTarget): { x: number; y: number } | undefined {
  void ctx;
  if (target.kind === 'line') return { ...target.from };
  return undefined;
}

function moveUnit(ctx: Ctx, unitId: string, to: { x: number; y: number }): void {
  const unit = ctx.state.units[unitId];
  if (!unit) throw new IllegalCommandError(`no unit ${unitId}`);
  if (unit.side !== ctx.state.activeSide) throw new IllegalCommandError('not your unit');
  if (!canMove(unit)) throw new IllegalCommandError(`${unit.name} cannot move`);

  const option = findMove(ctx.state, unit, to);
  if (!option) throw new IllegalCommandError('illegal destination');

  setAnchor(ctx.state, unitId, to);
  unit.movedThisTurn = true;

  emit(ctx, { t: 'unitMoved', unitId, path: option.path.map((c) => ({ ...c })) });
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
  dealDamage(ctx, {
    target,
    amount: attacker.atk,
    dtype: 'physical',
    cause: 'attack',
    ...(isMelee ? { sourceUnitId: attackerId } : {}),
  });
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

function sacrifice(ctx: Ctx, unitId: string): void {
  const unit = ctx.state.units[unitId];
  if (!unit) throw new IllegalCommandError(`no unit ${unitId}`);
  if (unit.side !== ctx.state.activeSide) throw new IllegalCommandError('not your unit');
  // "Sacrifice un-exhausted minion" (Draft 7): the offering has to come before the blow.
  if (unit.attackedThisTurn) throw new IllegalCommandError('unit has already attacked');
  if (!canAct(unit)) throw new IllegalCommandError('unit cannot act');

  const side = ctx.state.activeSide;
  const cmd = ctx.state.players[side];
  cmd.sparks += unit.sacrificeValue;

  emit(ctx, { t: 'unitSacrificed', unitId, sparksGained: unit.sacrificeValue });
  emit(ctx, { t: 'resourcesChanged', side, pips: cmd.pips, sparks: cmd.sparks });

  killEntity(ctx, unit, 'spell');
}

export { refOf };
