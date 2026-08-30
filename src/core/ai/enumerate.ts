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
import { ATTACK_BONE_COST, channelYieldFor } from '../data/economy.js';
import { affordable, canAfford } from '../engine/deck.js';
import { legalCardTargets, legalAttacks, titheCandidates } from '../engine/targeting.js';
import { legalMoves, canMove } from '../engine/movement.js';
import { unitsOf } from '../engine/board.js';
import { CHANNEL_MARROW, channelRefusal } from '../engine/engine.js';

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
  //
  // Filtered by what the side can pay. A swing costs a Bone now, and an unaffordable one
  // throws `IllegalCommandError` out of `applyCommand` — which `session.ts` swallows and the
  // playout harness treats as the end of the plan. Enumerating attacks the commander cannot
  // fund therefore did not merely waste a candidate, it truncated the turn.
  //
  // Every body that could channel is collected rather than only the first idle one. That was
  // right when Channel was a consolation for having nothing to hit; it is wrong now that
  // giving up a swing is the thing that pays for somebody else's.
  const canPayForAttack = cmd.bones >= ATTACK_BONE_COST;
  const channelCandidates: UnitId[] = [];
  for (const unit of mine) {
    const targets = canPayForAttack ? legalAttacks(state, unit) : [];
    for (const target of targets) {
      out.push({ type: 'attack', attacker: unit.id, target });
    }
    if (channelRefusal(state, unit.id) === null) channelCandidates.push(unit.id);
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

  // 4. Tithes — only worth enumerating when there is something to spend marrow on.
  //
  // Two questions, asked in one sweep: is anything out of reach at all, and would one
  // more Marrow specifically bring something into reach. The second cannot be derived
  // from a cheapest-cost number any more — with a strict Marrow component a dearer card
  // may be the one a single Marrow unlocks, while a cheaper one stays impossible — so it
  // is asked directly of each card.
  let hasExpensiveCard = false;
  let marrowWouldUnlock = false;
  for (const id of cmd.hand) {
    const def = CARDS[cmd.cards[id]?.defId ?? ''];
    if (!def || canAfford(state, side, def.cost)) continue;
    hasExpensiveCard = true;
    if (affordable(cmd.bones, cmd.marrow + CHANNEL_MARROW, def.cost)) marrowWouldUnlock = true;
  }
  if (hasExpensiveCard) {
    for (const unit of titheCandidates(state, side)) {
      out.push({ type: 'bloodTithe', unit: unit.id });
    }
  }

  // 5. Channels.
  //
  // The old gate was "does this Marrow, right now, make an unaffordable card affordable",
  // and it was correct for what Channel used to be: Marrow expires at end of turn, so
  // extracting it and leaving it unspent was worse than standing still. **Bones bank.** Under
  // the Bone economy that reasoning inverts — a body that channels has funded a swing that can
  // be taken this turn or next, so channelling is at worst weakly correct and the AI must be
  // allowed to consider it whenever it has a body to sit down.
  //
  // Bounded by *class* rather than by unit. Every melee body yields the same Bone, so which one
  // channels is not a decision worth searching — but a melee, a ranged and an elite yield three
  // different things, and that difference is the whole point of the ladder. At most one
  // candidate per distinct yield keeps the branching factor at three where offering every idle
  // body would have quadrupled the AI's hottest path, which is the cost the old comment was
  // right to be afraid of.
  const offered = new Set<string>();
  for (const id of channelCandidates) {
    const def = CARDS[state.units[id]?.defId ?? ''];
    const yielded = def ? channelYieldFor(def) : null;
    if (!yielded) continue;
    const shape = `${yielded.bones}/${yielded.marrow}/${yielded.draw}`;
    if (offered.has(shape)) continue;
    offered.add(shape);
    out.push({ type: 'channel', unit: id });
  }
  void marrowWouldUnlock;

  return out;
}
