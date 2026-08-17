/**
 * Utility scoring, per Module 5's function:
 *
 *   U(a) = w_kill*S_kill + w_face*S_face + w_threat*S_threat
 *        + w_pos*S_pos + w_eff*S_eff - w_risk*S_risk
 *
 * Scores are read off the SIMULATED EVENT BATCH rather than re-derived from the rules.
 * Counting `collision` and `unitDied` events is both simpler and impossible to get out
 * of sync with what the engine actually did.
 */

import type { Side } from '../../contract/ids.js';
import type { GameEvent } from '../../contract/events.js';
import type { GameState } from '../types/state.js';
import type { Command } from '../types/commands.js';
import { applyCommand } from '../engine/engine.js';
import { unitsOf } from '../engine/board.js';
import { opposite } from '../engine/board.js';
import { threatMap } from '../engine/threat.js';
import { coordKey } from '../../contract/ids.js';

export interface UtilityWeights {
  kill: number;
  killPerEscalation: number;
  face: number;
  faceDampenedByEscalation: number;
  runeHolderKill: number;
  guardianKill: number;
  collision: number;
  sparkEfficiency: number;
  /** Banking a Spark by channelling. Deferred value, so priced under spending one. */
  channelValue: number;
  counterRisk: number;
  friendlyCollateral: number;
  advance: number;
  /** Board development: getting bodies onto the grid is how pressure is built. */
  developAtk: number;
  developHp: number;
  armorValue: number;
  runeSetup: number;
  /**
   * Per point of incoming damage dodged when a unit that has already attacked steps out
   * of reach. Keep it well under `face` so pressing an advantage still wins out.
   */
  retreat: number;
  /**
   * Fraction of `kill` credited when a withdrawal takes a unit out of lethal range.
   * Below 1 so the AI still trades a minion for a better opportunity.
   */
  retreatSurvival: number;
  /** Per point of HP knocked off an enemy unit without killing it. */
  unitDamage: number;
}

export const NOVICE_WEIGHTS: UtilityWeights = {
  kill: 50,
  killPerEscalation: 10,
  face: 15,
  faceDampenedByEscalation: 0.2,
  runeHolderKill: 40,
  guardianKill: 60,
  // A Novice duelist "ignores collision damage" — it does not seek out shoves.
  collision: 0,
  sparkEfficiency: 10,
  // Above the pass threshold so an idle unit channels rather than standing there, but
  // well under a kill or a face hit so it never competes with actually fighting.
  channelValue: 6,
  counterRisk: 12,
  friendlyCollateral: 15,
  advance: 3,
  developAtk: 4,
  developHp: 1.5,
  armorValue: 1.5,
  runeSetup: 12,
  // Modest for a Novice: it will pull a wounded attacker back, but will not turtle.
  retreat: 2.5,
  retreatSurvival: 0.5,
  unitDamage: 2,
};

/**
 * Adept (Module 5 §3): the same value system, but it sees collisions.
 *
 * A Novice "ignores collision damage"; an Adept deliberately shoves units into walls and
 * into each other, which on a board with a Runic Boundary is a whole extra damage source
 * — and, since Phase B, the way to Shatter a frozen target.
 */
export const ADEPT_WEIGHTS: UtilityWeights = {
  ...NOVICE_WEIGHTS,
  collision: 45,
  // Slightly more willing to preserve a unit, since it can plan the withdrawal.
  retreat: 3.5,
};

/** Overwhelms every other term, so a lethal line is always taken. */
export const LETHAL_SCORE = 10_000;

/**
 * Damage the opposing side could land on each tile next turn, for retreat scoring.
 *
 * Reuses the same projection that draws the player's danger zone, so the AI is reading
 * exactly the board the player can see — no hidden information.
 */
function incomingDamageAt(state: GameState, side: Side): Map<string, number> {
  return threatMap(state, side).damageByTile;
}

export interface ScoredAction {
  command: Command;
  utility: number;
  next: GameState;
  events: GameEvent[];
}

export function scoreAction(
  state: GameState,
  side: Side,
  command: Command,
  weights: UtilityWeights,
): ScoredAction | undefined {
  let result;
  try {
    result = applyCommand(state, command);
  } catch {
    return undefined; // Illegal in practice; drop it silently.
  }

  const { state: next, events } = result;
  const foe = opposite(side);

  if (next.result) {
    // 'victory' means the player won; 'bound' means the player bound the companion.
    const playerWon = next.result === 'victory' || next.result === 'bound';
    const weWon = side === 'player' ? playerWon : !playerWon;

    // Taking lethal dominates every other term; Lethal Veto kills self-defeating lines.
    return {
      command,
      utility: weWon ? LETHAL_SCORE : Number.NEGATIVE_INFINITY,
      next,
      events,
    };
  }

  let utility = 0;

  // --- Kills and threat removal ---
  for (const e of events) {
    if (e.t !== 'unitDied') continue;
    const victim = state.units[e.unitId];
    if (!victim) continue;

    if (victim.side === foe) {
      utility += weights.kill;
      utility += weights.killPerEscalation * victim.escalation;
      if (victim.rune) utility += weights.runeHolderKill;
      if (victim.keywords.includes('Guardian')) utility += weights.guardianKill;
    } else {
      // Losing our own units is a cost, not a benefit — unless we sacrificed on purpose.
      const deliberate = command.type === 'sacrifice' || command.type === 'playCard';
      utility -= deliberate ? weights.kill * 0.4 : weights.friendlyCollateral;
    }
  }

  // --- Chip damage on units ---
  // Without this, a hit that fails to kill scores nothing and the AI declines free
  // swings entirely, softening enemies only by accident.
  for (const e of events) {
    if (e.t !== 'damageDealt' || e.target.kind !== 'unit' || e.hpLoss <= 0) continue;
    const victim = state.units[e.target.id] ?? next.units[e.target.id];
    if (!victim) continue;
    utility += (victim.side === foe ? weights.unitDamage : -weights.unitDamage) * e.hpLoss;
  }

  // --- Face damage ---
  // Chipping the commander matters less while the opponent has escalating minions that
  // must be answered first.
  const enemyHasEscalators = unitsOf(state, foe).some((u) => u.escalation > 0);
  const faceWeight = enemyHasEscalators
    ? weights.face * weights.faceDampenedByEscalation
    : weights.face;

  for (const e of events) {
    if (e.t !== 'damageDealt') continue;
    if (e.target.kind !== 'portrait') continue;
    if (e.target.side === foe) utility += faceWeight * e.hpLoss;
    else utility -= weights.face * e.hpLoss;
  }

    // --- Position ---
  utility += weights.collision * events.filter((e) => e.t === 'collision').length;

  if (command.type === 'moveUnit') {
    const unit = state.units[command.unit];
    if (unit) {
      const forward = side === 'player' ? -1 : 1;
      const progress = (command.to.y - unit.anchor.y) * forward;
      utility += weights.advance * progress;

      // Strike and withdraw. Independent actions let a unit attack and then step out of
      // reach, so a unit that has already swung this turn values safety instead of
      // ground. Deliberately weighted below the face-damage term: the AI should still
      // prefer pressing an advantage over preserving a minion.
      if (unit.attackedThisTurn && weights.retreat > 0) {
        const danger = incomingDamageAt(state, side);
        const effective = unit.hp + unit.armor;
        // Damage that would actually land, not raw threat: anything past the unit's
        // health is wasted on it either way.
        const here = Math.min(danger.get(coordKey(unit.anchor)) ?? 0, effective);
        const there = Math.min(danger.get(coordKey(command.to)) ?? 0, effective);

        if (here > there) {
          utility += weights.retreat * (here - there);
          // Stepping out of *lethal* range is worth far more than the damage figure
          // suggests — it is the difference between keeping the unit and losing it, so
          // price it at what the opponent would have gained by killing it.
          const wouldDie = here >= effective;
          const nowSurvives = there < effective;
          if (wouldDie && nowSurvives) utility += weights.kill * weights.retreatSurvival;
        }
      }
    }
  }

  // --- Board development ---
  // Without this, summoning scores exactly zero and the AI never builds a board.
  for (const e of events) {
    if (e.t === 'unitSummoned' && e.unit.side === side) {
      utility += weights.developAtk * e.unit.atk + weights.developHp * e.unit.hp;
    }
    if (e.t === 'armorGained') {
      const mine =
        (e.target.kind === 'portrait' && e.target.side === side) ||
        (e.target.kind === 'unit' && state.units[e.target.id]?.side === side) ||
        (e.target.kind === 'unit' && next.units[e.target.id]?.side === side);
      if (mine) utility += weights.armorValue * e.amount;
    }
    if (e.t === 'runeAttached') {
      const host = next.units[e.hostId] ?? next.obstacles[e.hostId];
      // Offensive runes go on enemies; Soul Splinter is set up on our own units.
      utility += weights.runeSetup * (host && host.side !== side ? 1 : 0.5);
    }
  }

  // --- Efficiency ---
  const before = state.players[side];
  const after = next.players[side];
  const sparksSpent = Math.max(0, before.sparks - after.sparks);
  utility += weights.sparkEfficiency * sparksSpent;

  // Channelling banks a Spark instead of swinging. Worth less than spending one, because
  // the Spark still has to find a use before end of turn — but worth more than the zero
  // it would otherwise score, which would mean the AI never channelled at all.
  for (const e of events) {
    if (e.t === 'unitChannelled') utility += weights.channelValue * e.sparks;
  }

  // --- Risk ---
  for (const e of events) {
    if (e.t !== 'damageDealt') continue;
    if (e.cause !== 'counter') continue;
    if (e.target.kind === 'unit' && state.units[e.target.id]?.side === side) {
      utility -= weights.counterRisk * e.hpLoss;
    }
  }

  return { command, utility, next, events };
}
