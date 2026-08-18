/**
 * The Harpoon Protocol.
 *
 * A cornered Alpha will not be killed and will not submit. At a quarter of its strength
 * it seals itself in wild magic, and the fight stops being a damage race: the Whisperer
 * drives a tether into one of their own units and that unit has to stand there, unable
 * to move or strike, while the beast spends everything it has trying to tear it down.
 *
 * Deliberately generic. Nothing here names Ignis or reads an encounter id — a boss opts
 * in by calling `beginSubjugation` from its own script, which is the same seam the phase
 * gates already use. The rules of the tether belong to the engine; which beast has one
 * belongs to the encounter.
 */

import type { TargetRef, UnitId } from '../../contract/ids.js';
import type { Ctx } from './context.js';
import { emit, newCause } from './context.js';
import type { GameState } from '../types/state.js';
import { SUBJUGATION_ROUNDS } from '../types/state.js';
import type { Unit } from '../types/units.js';
import { CARDS } from '../data/cards/index.js';
import { toCardSnapshot } from './views.js';
import { finish } from './death.js';

/** The card the protocol deals. Kept here so the encounter never has to name it. */
export const RITE_CARD_DEF = 'rite_of_subjugation';

/**
 * Statuses the seal burns off.
 *
 * Listed rather than derived: `aetherPlated` and `anchor` are also statuses, and a rule
 * that stripped "everything" would strip the seal in the act of applying it.
 */
const PURGED = ['burn', 'toxin', 'chill', 'freeze', 'entangle', 'stun', 'brittle'] as const;

/** The Alpha's body on the grid, which is the enemy Companion's. */
export function bossUnitOf(state: GameState): Unit | undefined {
  const id = state.players.enemy.companionUnitId;
  return id ? state.units[id] : undefined;
}

export function isAnchor(state: GameState, unitId: UnitId): boolean {
  return state.encounter.subjugation.anchorUnitId === unitId;
}

/** Whether this unit is sealed against harm. */
export function isAetherPlated(unit: Unit): boolean {
  return (unit.statuses.aetherPlated ?? 0) > 0;
}

/**
 * Whether a damage request is aimed at something the seal protects.
 *
 * Both routes to the beast are covered, and they are genuinely two routes: the Alpha's
 * body is a Bound Form, so a blow against it is redirected onto the enemy pool, while a
 * ranged shot at the portrait targets that pool directly. Sealing one and not the other
 * would leave the phase winnable by shooting past the beast at the thing behind it.
 */
export function isSealed(state: GameState, target: TargetRef): boolean {
  if (!state.encounter.subjugation.sealed) return false;

  // The enemy pool, however it is reached. Both routes matter and they are genuinely
  // two: the Alpha's body is a Bound Form, so a blow against it is redirected onto the
  // pool, while a ranged shot at the portrait targets the pool directly. Sealing one and
  // not the other would leave the phase winnable by shooting past the beast.
  if (target.kind === 'portrait') return target.side === 'enemy';
  if (target.kind !== 'unit') return false;
  return state.units[target.id]?.side === 'enemy' && isAetherPlated(state.units[target.id]!);
}

/**
 * The enrage: seal the beast, purge what was hurting it, and deal the Rite.
 *
 * Idempotent by way of the seal itself — a second call finds the plating already on and
 * does nothing, so the caller may check its own threshold as loosely as it likes.
 */
export function beginSubjugation(ctx: Ctx): void {
  const state = ctx.state;
  if (state.encounter.subjugation.sealed) return;

  newCause(ctx);
  state.encounter.subjugation.sealed = true;

  // The status on the body is the visible half of the same fact: it is what puts a mark
  // on the model and in the unit tooltip. The flag above is the rule, so a bodiless boss
  // seals correctly and a wipe cannot undo it.
  const boss = bossUnitOf(state);
  if (boss) {
    boss.statuses.aetherPlated = 1;
    for (const status of PURGED) delete boss.statuses[status];
  }

  emit(ctx, { t: 'subjugationBegan', ...(boss ? { bossUnitId: boss.id } : {}) });
  if (boss) {
    emit(ctx, { t: 'statusApplied', unitId: boss.id, status: 'aetherPlated', stacks: 1 });
  }

  dealTheRite(ctx);
}

/**
 * Puts the Rite on top of the draw pile rather than into the hand.
 *
 * The doc's wording, and the better rule: a hand that is already full would otherwise
 * need the Rite smuggled in as an overlay outside the limit, and the player would get it
 * without having spent the turn it costs to draw. On top of the deck it is guaranteed
 * and still has to be picked up.
 */
export function dealTheRite(ctx: Ctx): void {
  const state = ctx.state;
  const cmd = state.players.player;
  const instanceId = `rite${state.nextId++}`;

  cmd.cards[instanceId] = { instanceId, defId: RITE_CARD_DEF };
  cmd.deck.unshift(instanceId);

  emit(ctx, {
    t: 'cardInjected',
    side: 'player',
    card: toCardSnapshot(state, 'player', instanceId),
  });
}

/**
 * The Rite lands. From here the beast has three rounds to break the tether.
 *
 * The anchor keeps its own statuses and armor: everything the player can stack onto it
 * before the storm arrives is the whole of the puzzle, so nothing is cleared here.
 */
export function setAnchor(ctx: Ctx, unit: Unit): void {
  const sub = ctx.state.encounter.subjugation;
  sub.active = true;
  sub.anchorUnitId = unit.id;
  sub.turnsSurvived = 0;

  unit.statuses.anchor = 1;
  // Standing still is not resting. Whatever it had planned this turn is over.
  unit.movedThisTurn = true;
  unit.attackedThisTurn = true;

  newCause(ctx);
  emit(ctx, { t: 'anchorSet', unitId: unit.id, at: { ...unit.anchor } });
  emit(ctx, { t: 'statusApplied', unitId: unit.id, status: 'anchor', stacks: 1 });
}

/**
 * One round endured, counted at the close of the beast's turn.
 *
 * The anchor being alive is checked here rather than trusted: a unit can leave the board
 * without dying — shoved off by a current, or removed by an effect — and the tether
 * should not keep counting for something that is no longer standing there.
 */
export function tickSubjugation(ctx: Ctx): void {
  const state = ctx.state;
  const sub = state.encounter.subjugation;
  if (!sub.active || state.result) return;

  const anchor = sub.anchorUnitId ? state.units[sub.anchorUnitId] : undefined;
  if (!anchor) return;

  sub.turnsSurvived += 1;
  newCause(ctx);
  emit(ctx, {
    t: 'subjugationProgress',
    turnsSurvived: sub.turnsSurvived,
    of: SUBJUGATION_ROUNDS,
  });

  if (sub.turnsSurvived >= SUBJUGATION_ROUNDS) {
    sub.active = false;
    finish(ctx, 'bound');
  }
}

/**
 * The tether snaps.
 *
 * The beast keeps its plating: it is still sealed, still unkillable, and now one stack
 * stronger. The only way out remains the Rite, which the player must cycle their deck to
 * find again — the card goes back through the discard by the ordinary route, since the
 * unit that carried it is dead and the card was spent when it was cast.
 */
export function onAnchorDied(ctx: Ctx, unit: Unit): void {
  const sub = ctx.state.encounter.subjugation;
  if (!sub.active || sub.anchorUnitId !== unit.id) return;

  sub.active = false;
  sub.anchorUnitId = null;
  sub.turnsSurvived = 0;

  newCause(ctx);
  emit(ctx, { t: 'tetherSnapped', unitId: unit.id, at: { ...unit.anchor } });

  enrageBoss(ctx);
  dealTheRite(ctx);
}

/**
 * One punitive Escalation stack on the Alpha.
 *
 * Deliberately not `escalateUnit`: that one refuses a Bound Form on the grounds that its
 * power belongs to a Pact which does not grow, and the Alpha's body is a Bound Form. This
 * growth is not the Escalate keyword rewarding survival, it is the beast getting angrier
 * because something tried to cage it, so it is written directly.
 */
function enrageBoss(ctx: Ctx): void {
  const boss = bossUnitOf(ctx.state);
  if (!boss) return;

  const bonus = CARDS[boss.defId]?.unit?.escalationBonus ?? { atk: 1, hp: 0 };
  boss.escalation += 1;
  boss.atk += bonus.atk;
  boss.maxHp += bonus.hp;
  boss.hp += bonus.hp;

  emit(ctx, {
    t: 'escalated',
    unitId: boss.id,
    stacks: boss.escalation,
    atk: boss.atk,
    hp: boss.hp,
  });
}
