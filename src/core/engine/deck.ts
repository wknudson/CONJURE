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

export function spendResources(ctx: Ctx, side: Side, cost: number): boolean {
  const cmd = ctx.state.players[side];
  if (cmd.pips + cmd.marrow < cost) return false;

  // Spend Marrow first: it evaporates at end of turn, so banking Pips is correct play.
  const fromMarrow = Math.min(cmd.marrow, cost);
  cmd.marrow -= fromMarrow;
  cmd.pips -= cost - fromMarrow;

  emit(ctx, { t: 'resourcesChanged', side, pips: cmd.pips, marrow: cmd.marrow });
  return true;
}

export function canAfford(state: GameState, side: Side, cost: number): boolean {
  const cmd = state.players[side];
  return cmd.pips + cmd.marrow >= cost;
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
    // Ephemeral overlay cards (Rite of Binding) can never be discarded.
    if (inst.ephemeral) continue;
    const def = CARDS[inst.defId];
    if (def?.keywords.includes('Retain')) continue;
    discardCard(ctx, side, id);
  }

  cmd.marrow = 0;
  cmd.pips = Math.min(cmd.pips, PIP_CAP);
  emit(ctx, { t: 'resourcesChanged', side, pips: cmd.pips, marrow: cmd.marrow });
}
