/**
 * Legal action enumeration for the AI.
 *
 * Reuses the same targeting functions the UI uses, so the AI can never consider an
 * action the player could not also take.
 */

import type { Side, UnitId } from '../../contract/ids.js';
import type { GameState } from '../types/state.js';
import type { Command } from '../types/commands.js';
import { CARDS } from '../data/cards/index.js';
import { canAfford } from '../engine/deck.js';
import { legalCardTargets, legalAttacks, sacrificeCandidates } from '../engine/targeting.js';
import { legalMoves, canMove, canAttack } from '../engine/movement.js';
import { unitsOf } from '../engine/board.js';
import { CHANNEL_MARROW } from '../engine/engine.js';

/**
 * Every command the side could legally issue right now.
 *
 * Movement is pruned: on a 5x5 the full reachable set is small, but we drop moves that
 * retreat away from the enemy commander unless they enable an attack, which keeps the
 * candidate list focused without changing what is legal.
 */
export function enumerateActions(state: GameState, side: Side): Command[] {
  const out: Command[] = [];
  const cmd = state.players[side];
  // Feral beasts sit in a side's unit list for bookkeeping, but nothing commands them —
  // they are driven by the encounter, not by this planner, and offering their moves here
  // would let the AI play the wildlife against itself.
  const mine = unitsOf(state, side).filter((u) => !u.keywords.includes('Feral'));

  // 1. Cards.
  for (const cardId of cmd.hand) {
    const inst = cmd.cards[cardId];
    const def = inst ? CARDS[inst.defId] : undefined;
    if (!inst || !def) continue;
    if (!canAfford(state, side, def.cost)) continue;

    for (const target of legalCardTargets(state, side, def.id)) {
      out.push({ type: 'playCard', card: cardId, target });
    }
  }

  // 2. Attacks — enumerated before moves so equal-utility ties favour acting.
  // The first unit found with nothing to swing at is remembered for the Channel block:
  // legalAttacks is the most expensive call in this function and it is already being
  // made here, so asking it twice would double the cost of the AI's hottest path.
  let idleUnit: UnitId | undefined;
  for (const unit of mine) {
    const targets = legalAttacks(state, unit);
    for (const target of targets) {
      out.push({ type: 'attack', attacker: unit.id, target });
    }
    if (
      targets.length === 0 &&
      idleUnit === undefined &&
      canAttack(unit) &&
      !unit.keywords.includes('BoundForm')
    ) {
      idleUnit = unit.id;
    }
  }

  // 3. Moves. Retreats are pruned to keep the candidate list focused — a minion walking
  // backwards is almost never the best thing to do, and enumerating every such move
  // triples the search for nothing.
  //
  // The Bound Form is the exception, and the exception matters: it is the one unit whose
  // loss is the game, so withdrawing it is frequently the whole turn. Pruned along with
  // everything else, the AI could not defend its own Companion at all — it would walk it
  // forward into range and have no way of walking it back.
  const forward = side === 'player' ? -1 : 1;
  for (const unit of mine) {
    if (!canMove(unit)) continue;
    const mayRetreat = unit.keywords.includes('BoundForm');
    for (const move of legalMoves(state, unit)) {
      if (!mayRetreat) {
        const advances = (move.to.y - unit.anchor.y) * forward > 0;
        const lateral = move.to.y === unit.anchor.y;
        if (!advances && !lateral) continue;
      }
      out.push({ type: 'moveUnit', unit: unit.id, to: move.to });
    }
  }

  // 4. Sacrifices — only worth enumerating when there is something to spend marrow on.
  let cheapestUnaffordable = Infinity;
  for (const id of cmd.hand) {
    const def = CARDS[cmd.cards[id]?.defId ?? ''];
    if (!def || canAfford(state, side, def.cost)) continue;
    cheapestUnaffordable = Math.min(cheapestUnaffordable, def.cost);
  }
  const hasExpensiveCard = cheapestUnaffordable !== Infinity;
  if (hasExpensiveCard) {
    for (const unit of sacrificeCandidates(state, side)) {
      out.push({ type: 'sacrifice', unit: unit.id });
    }
  }

  // 5. Channels — offered only when the Marrow actually completes a purchase this turn.
  //
  // Marrow expires at end of turn, so extracting it only to leave it unspent is worse
  // than doing nothing: the unit gave up its swing for it. The gate is therefore not
  // "could I use Marrow" but "does this Marrow, right now, make an unaffordable card
  // affordable". Without that the AI channels every idle unit until it hits the action
  // cap, hoarding Marrow it cannot spend and quadrupling its own planning time.
  //
  // Only one candidate is offered even so: every idle unit extracts the same Marrow, so
  // the choice of which one is not a decision worth searching.
  const banked = cmd.pips + cmd.marrow;
  if (idleUnit !== undefined && banked + CHANNEL_MARROW >= cheapestUnaffordable) {
    out.push({ type: 'channel', unit: idleUnit });
  }

  return out;
}
