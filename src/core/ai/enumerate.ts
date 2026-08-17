/**
 * Legal action enumeration for the AI.
 *
 * Reuses the same targeting functions the UI uses, so the AI can never consider an
 * action the player could not also take.
 */

import type { Side } from '../../contract/ids.js';
import type { GameState } from '../types/state.js';
import type { Command } from '../types/commands.js';
import { CARDS } from '../data/cards/index.js';
import { canAfford } from '../engine/deck.js';
import { legalCardTargets, legalAttacks, sacrificeCandidates } from '../engine/targeting.js';
import { legalMoves, canMove } from '../engine/movement.js';
import { unitsOf } from '../engine/board.js';

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
  for (const unit of unitsOf(state, side)) {
    for (const target of legalAttacks(state, unit)) {
      out.push({ type: 'attack', attacker: unit.id, target });
    }
  }

  // 3. Moves.
  const forward = side === 'player' ? -1 : 1;
  for (const unit of unitsOf(state, side)) {
    if (!canMove(unit)) continue;
    for (const move of legalMoves(state, unit)) {
      const advances = (move.to.y - unit.anchor.y) * forward > 0;
      const lateral = move.to.y === unit.anchor.y;
      if (!advances && !lateral) continue;
      out.push({ type: 'moveUnit', unit: unit.id, to: move.to });
    }
  }

  // 4. Sacrifices — only worth enumerating when there is something to spend sparks on.
  const hasExpensiveCard = cmd.hand.some((id) => {
    const def = CARDS[cmd.cards[id]?.defId ?? ''];
    return def && !canAfford(state, side, def.cost);
  });
  if (hasExpensiveCard) {
    for (const unit of sacrificeCandidates(state, side)) {
      out.push({ type: 'sacrifice', unit: unit.id });
    }
  }

  return out;
}
