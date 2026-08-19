/**
 * Deck, hand, and resource management.
 *
 * Adjudications used here (docs conflict; see the plan's rule table):
 *  - An empty deck reshuffles the discard pile for free, with no fatigue (Draft 7).
 *  - Hand size is 7. Overdrawing BURNS the drawn card and grants 1 Marrow (Module 4).
 *  - Pips bank up to 8, but the cap is enforced only during end-of-turn cleanup, so
 *    in-turn Pip + Marrow totals may freely exceed 8.
 */

import type { CardInstanceId, Side } from '../../contract/ids.js';
import type { Ctx } from './context.js';
import { emit } from './context.js';
import type { GameState } from '../types/state.js';
import { CARDS } from '../data/cards/index.js';
import type { CardCost, CardDef } from '../types/cards.js';
import { shuffle } from '../util/rng.js';
import { toCardSnapshot } from './views.js';

export const PIP_CAP = 8;
export const HAND_LIMIT = 7;
export const DRAW_PER_TURN = 4;
export const OPENING_HAND = 5;

export function drawCards(ctx: Ctx, side: Side, count: number): void {
  for (let i = 0; i < count; i++) drawOne(ctx, side);
}

function drawOne(ctx: Ctx, side: Side): void {
  const cmd = ctx.state.players[side];

  if (cmd.deck.length === 0) {
    if (cmd.discard.length === 0) return; // Nothing left anywhere; drawing does nothing.
    cmd.deck = shuffle(ctx.state.rng, [...cmd.discard]);
    cmd.discard = [];
    emit(ctx, { t: 'deckReshuffled', side, count: cmd.deck.length });
  }

  const id = cmd.deck.shift();
  if (!id) return;

  // Overdraw: the card burns for Marrow rather than entering an overfull hand.
  const nonEphemeral = cmd.hand.filter((h) => !cmd.cards[h]?.ephemeral).length;
  if (nonEphemeral >= cmd.handLimit) {
    cmd.discard.push(id);
    cmd.marrow += 1;
    emit(ctx, { t: 'cardBurned', side, card: toCardSnapshot(ctx.state, side, id) });
    emit(ctx, { t: 'resourcesChanged', side, pips: cmd.pips, marrow: cmd.marrow });
    return;
  }

  cmd.hand.push(id);
  emit(ctx, { t: 'cardDrawn', side, card: toCardSnapshot(ctx.state, side, id) });
}

export function gainPips(ctx: Ctx, side: Side, amount: number): void {
  const cmd = ctx.state.players[side];
  cmd.pips += amount;
  emit(ctx, { t: 'pipGained', side, amount, total: cmd.pips });
}

/**
 * Two demands, settled in a fixed order.
 *
 * `marrow` is strict: Pips cannot cover it at any price, so a card asking for Marrow is
 * asking the player to have opened something up this turn. `pips` is generic energy, and
 * whatever Marrow is left over after the strict cost may still pay it — Marrow first,
 * because it evaporates at end of turn while Pips bank.
 *
 * The consequence worth naming: a card priced `{ pips: 3, marrow: 0 }` is still payable
 * entirely out of a sacrifice, which is what keeps the ramp economy alive. A card priced
 * `{ pips: 1, marrow: 2 }` cannot be bought with patience at any Pip total.
 */
export function spendResources(ctx: Ctx, side: Side, cost: CardCost): boolean {
  const cmd = ctx.state.players[side];
  if (!canAfford(ctx.state, side, cost)) return false;

  const spent = costBreakdown(cmd.marrow, cost);
  cmd.marrow -= spent.marrow;
  cmd.pips -= spent.pips;

  emit(ctx, { t: 'resourcesChanged', side, pips: cmd.pips, marrow: cmd.marrow });
  return true;
}

/**
 * Which pools a cost would actually come out of, given the Marrow on hand.
 *
 * Shared with the play preview, so the numbers the player is shown before committing are
 * produced by the same arithmetic that will run when they do. The preview used to derive
 * its own split, which was harmless while a cost was one fungible number and would not
 * survive a strict Marrow component.
 */
export function costBreakdown(marrowOnHand: number, cost: CardCost): CardCost {
  // The strict cost is Marrow by definition; the generic cost takes what Marrow is left
  // before the Pip bank is touched, since Marrow evaporates and Pips do not.
  const afterStrict = marrowOnHand - cost.marrow;
  const genericFromMarrow = Math.max(0, Math.min(cost.pips, afterStrict));
  return {
    marrow: cost.marrow + genericFromMarrow,
    pips: cost.pips - genericFromMarrow,
  };
}

/** The floor a discount may never take a card below. Free hybrids would be a loop. */
export const MIN_DISCOUNTED_PIPS = 1;

/**
 * What a card actually costs this side, after whatever their gear is doing.
 *
 * The single answer, used by the legality check, by the spend, and by the snapshot the
 * player is looking at — so a card can never read one price and charge another. That is
 * why `toCardSnapshot` already took a `side`: the cost on the face of a card has always
 * been a fact about who is holding it, even while nothing changed it.
 *
 * Marrow is deliberately untouched. It is a strict requirement rather than a price — a
 * card asking for it is asking you to have opened something up this turn, and no amount of
 * gear substitutes for having done that.
 */
export function effectiveCost(state: GameState, side: Side, def: CardDef): CardCost {
  if (!def.spliceOnly || !state.players[side].discountHybrids) return def.cost;
  return {
    pips: Math.max(MIN_DISCOUNTED_PIPS, def.cost.pips - 1),
    marrow: def.cost.marrow,
  };
}

export function canAfford(state: GameState, side: Side, cost: CardCost): boolean {
  const cmd = state.players[side];
  return affordable(cmd.pips, cmd.marrow, cost);
}

/**
 * The affordability rule against explicit pools rather than against a side.
 *
 * Exists so the AI can ask "would one more Marrow buy me anything?" without a second,
 * drifting copy of the two-tier arithmetic — the same reason `canStrike` is one function
 * rather than three.
 */
export function affordable(pips: number, marrow: number, cost: CardCost): boolean {
  // The strict cost first, then the generic cost against everything still standing.
  if (marrow < cost.marrow) return false;
  return pips + (marrow - cost.marrow) >= cost.pips;
}

export function discardCard(ctx: Ctx, side: Side, id: CardInstanceId): void {
  const cmd = ctx.state.players[side];
  const idx = cmd.hand.indexOf(id);
  if (idx === -1) return;
  cmd.hand.splice(idx, 1);
  cmd.discard.push(id);
  emit(ctx, { t: 'cardDiscarded', side, cardId: id });
}

/** Moves a played card from hand to discard, honouring Retain. */
export function resolvePlayedCard(ctx: Ctx, side: Side, id: CardInstanceId): void {
  const cmd = ctx.state.players[side];
  const idx = cmd.hand.indexOf(id);
  if (idx === -1) return;
  cmd.hand.splice(idx, 1);
  cmd.discard.push(id);
}

/** End-of-turn cleanup: discard non-Retain cards, expire Marrow, cap the Pip bank. */
export function endOfTurnCleanup(ctx: Ctx, side: Side): void {
  const cmd = ctx.state.players[side];

  for (const id of [...cmd.hand]) {
    const inst = cmd.cards[id];
    if (!inst) continue;
    // Ephemeral overlay cards can never be discarded.
    if (inst.ephemeral) continue;
    const def = CARDS[inst.defId];
    if (def?.keywords.includes('Retain')) continue;
    discardCard(ctx, side, id);
  }

  cmd.marrow = 0;
  cmd.pips = Math.min(cmd.pips, cmd.pipCap);
  emit(ctx, { t: 'resourcesChanged', side, pips: cmd.pips, marrow: cmd.marrow });
}
