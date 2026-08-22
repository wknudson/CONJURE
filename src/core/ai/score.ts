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
import { threatensFrom } from '../engine/targeting.js';
import { coordKey } from '../../contract/ids.js';
import { footprintDistance } from '../util/grid.js';
import { STAT_SCALE } from '../scale.js';

export interface UtilityWeights {
  kill: number;
  killPerEscalation: number;
  face: number;
  faceDampenedByEscalation: number;
  markHolderKill: number;
  guardianKill: number;
  collision: number;
  marrowEfficiency: number;
  /** Extracting Marrow by channelling. Deferred value, so priced under spending it. */
  channelValue: number;
  counterRisk: number;
  friendlyCollateral: number;
  advance: number;
  /**
   * Ending a move somewhere the unit can actually shoot from.
   *
   * Only consulted for units whose best ground is not simply "as far forward as
   * possible" — a mortar with a blind spot, a marksman confined to a firing line. For
   * everything else `advance` already points the right way and this would be noise.
   */
  firingPosition: number;
  /** Board development: getting bodies onto the grid is how pressure is built. */
  developAtk: number;
  developHp: number;
  armorValue: number;
  markSetup: number;
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

/**
 * A stretched health figure in the units this weight table is written in.
 *
 * Every weight below is priced per *old* point of health, and deliberately stays that
 * way. The alternative was to divide the whole table by ten, and that would have made
 * every number in it a decimal fraction of a tile of ground -- unreadable, and impossible
 * to tune by eye against `advance` or `collision`, which did not stretch and never will.
 *
 * So the conversion happens at the seven places health enters the score instead. Left
 * undone, a single swing would outweigh every positional term in the matrix put together
 * and the AI would walk into any trap that let it land one.
 *
 * Not rounded: the utility is a comparison, never a display, and rounding a chip hit down
 * to zero would make two genuinely different lines score identically.
 */
function hpPoints(value: number): number {
  return value / STAT_SCALE;
}

export const NOVICE_WEIGHTS: UtilityWeights = {
  kill: 50,
  killPerEscalation: 10,
  face: 15,
  faceDampenedByEscalation: 0.2,
  markHolderKill: 40,
  guardianKill: 60,
  // A Novice duelist "ignores collision damage" — it does not seek out shoves.
  collision: 0,
  marrowEfficiency: 10,
  // Above the pass threshold so an idle unit channels rather than standing there, but
  // well under a kill or a face hit so it never competes with actually fighting.
  channelValue: 6,
  counterRisk: 12,
  friendlyCollateral: 15,
  advance: 3,
  // Must outweigh the two rows of `advance` a mortar gives up by stopping short of its
  // own blind spot, or the archetype walks itself out of the fight every time.
  firingPosition: 8,
  developAtk: 4,
  developHp: 1.5,
  armorValue: 1.5,
  markSetup: 12,
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
 * Breaking a tether outranks even lethal.
 *
 * A sealed Alpha cannot be killed and cannot be beaten to the punch; the only thing on
 * the board that can end the phase against it is the anchor, so nothing else may score
 * higher. Above LETHAL_SCORE by design rather than by accident.
 */
export const ANCHOR_KILL_SCORE = 20_000;

/**
 * What a line is worth while the tether is live.
 *
 * The beast wants one thing, and the scoring says so in three tiers:
 *
 *  - Killing the anchor ends the phase in the beast's favour, so it is priced above
 *    lethal. Nothing else on the board can be worth more.
 *  - Hurting the anchor is progress toward that, priced per point so a plan that gets it
 *    to one HP beats one that does not touch it.
 *  - Closing on the anchor matters when nothing can reach it yet, which is the ordinary
 *    case on the turn the Rite lands. Measured as reduction in footprint distance, so a
 *    2x2 Alpha is judged by its nearest cell rather than its anchor corner.
 *
 * Everything else the matrix scores still applies underneath, at its usual magnitude —
 * so between two lines that make identical progress on the tether the beast still
 * prefers the one that also kills a blocker. It simply cannot prefer a face hit to the
 * tether, because a face hit cannot win a fight it is sealed out of.
 */
function anchorPressure(
  state: GameState,
  next: GameState,
  events: GameEvent[],
  command: Command,
  anchorId: string,
): number {
  if (events.some((e) => e.t === 'unitDied' && e.unitId === anchorId)) {
    return ANCHOR_KILL_SCORE;
  }

  let score = 0;
  for (const e of events) {
    if (e.t !== 'damageDealt') continue;
    if (e.target.kind !== 'unit' || e.target.id !== anchorId) continue;
    score += ANCHOR_CHIP * hpPoints(e.hpLoss);
  }

  // Closing the distance, judged only for the unit that actually moved.
  if (command.type === 'moveUnit') {
    const before = state.units[command.unit];
    const after = next.units[command.unit];
    const target = state.units[anchorId];
    if (before && after && target) {
      const gained =
        footprintDistance(before, target) - footprintDistance(after, target);
      if (gained > 0) score += ANCHOR_APPROACH * gained;
    }
  }

  return score;
}

/** Per point of health taken off the anchor. Well under a kill, well over a face hit. */
const ANCHOR_CHIP = 60;
/** Per tile closed on the anchor, when nothing can reach it yet. */
const ANCHOR_APPROACH = 40;

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

  // --- The Harpoon Protocol overrides everything ---
  //
  // While a tether is live the beast has exactly one problem. This is expressed as a term
  // rather than as a separate planner because every other part of the matrix still has to
  // work: the AI must still path, still respect reach, still avoid walking into a wall.
  // What changes is only what the board is worth, and that is what scoring is for.
  //
  // It sits above LETHAL_SCORE deliberately. A sealed Alpha cannot be killed and cannot
  // lose, so a line that chips the player's face is not merely worth less than breaking
  // the tether — it is worth nothing at all, and must never outrank it.
  const sub = state.encounter.subjugation;
  if (sub.active && sub.anchorUnitId) {
    utility += anchorPressure(state, next, events, command, sub.anchorUnitId);
  }

  // --- Kills and threat removal ---
  for (const e of events) {
    if (e.t !== 'unitDied') continue;
    const victim = state.units[e.unitId];
    if (!victim) continue;

    if (victim.side === foe) {
      utility += weights.kill;
      utility += weights.killPerEscalation * victim.escalation;
      if (victim.mark) utility += weights.markHolderKill;
      if (victim.keywords.includes('Guardian')) utility += weights.guardianKill;
    } else {
      // Losing our own units is a cost, not a benefit — unless we bled it on purpose.
      const deliberate = command.type === 'bloodTithe' || command.type === 'playCard';
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
    utility +=
      (victim.side === foe ? weights.unitDamage : -weights.unitDamage) * hpPoints(e.hpLoss);
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
    if (e.target.side === foe) utility += faceWeight * hpPoints(e.hpLoss);
    else utility -= weights.face * hpPoints(e.hpLoss);
  }

    // --- Position ---
  utility += weights.collision * events.filter((e) => e.t === 'collision').length;

  if (command.type === 'moveUnit') {
    const unit = state.units[command.unit];
    if (unit) {
      const forward = side === 'player' ? -1 : 1;
      const progress = (command.to.y - unit.anchor.y) * forward;
      utility += weights.advance * progress;

      // `advance` says "forward is better", which is true of almost every unit and false
      // of exactly the ones §3 introduced. A mortar has a blind spot at its feet and a
      // marksman fires only down a line, so for those two the last row of ground gained
      // can be the row that disarms them. Reward standing somewhere they could actually
      // shoot from, and only for units whose reach is genuinely non-monotonic — for
      // everything else closer is never worse, and this would be noise in the scores.
      const constrained = unit.rangeMin > 1 || unit.attackProfile === 'lineOnly';
      if (constrained && weights.firingPosition > 0) {
        const moved = next.units[unit.id];
        if (moved && threatensFrom(next, moved, command.to)) {
          utility += weights.firingPosition;
        }
      }

      // Strike and withdraw. Independent actions let a unit attack and then step out of
      // reach, so a unit that has already swung this turn values safety instead of
      // ground. Deliberately weighted below the face-damage term: the AI should still
      // prefer pressing an advantage over preserving a minion.
      // A Bound Form is judged by a different rule. Its own HP is decorative — the pool
      // it draws on is the Pact — so pricing its safety off `unit.hp` would value a
      // 3-HP Pact at a comfortable 40. And it is worth pulling back whether or not it
      // has swung, because what is at risk is not a minion but the game.
      const isBody = unit.keywords.includes('BoundForm');
      if ((isBody || unit.attackedThisTurn) && weights.retreat > 0) {
        const danger = incomingDamageAt(state, side);
        const effective = isBody
          ? state.players[side].hp + state.players[side].armor
          : unit.hp + unit.armor;
        // Damage that would actually land, not raw threat: anything past the unit's
        // health is wasted on it either way.
        const here = Math.min(danger.get(coordKey(unit.anchor)) ?? 0, effective);
        const there = Math.min(danger.get(coordKey(command.to)) ?? 0, effective);

        if (here > there) {
          utility += weights.retreat * hpPoints(here - there);
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
      utility += weights.developAtk * hpPoints(e.unit.atk) + weights.developHp * hpPoints(e.unit.hp);
    }
    if (e.t === 'armorGained') {
      const mine =
        (e.target.kind === 'portrait' && e.target.side === side) ||
        (e.target.kind === 'unit' && state.units[e.target.id]?.side === side) ||
        (e.target.kind === 'unit' && next.units[e.target.id]?.side === side);
      if (mine) utility += weights.armorValue * hpPoints(e.amount);
    }
    if (e.t === 'markAttached') {
      const host = next.units[e.hostId] ?? next.obstacles[e.hostId];
      // Offensive marks go on enemies; Soul Splinter is set up on our own units.
      utility += weights.markSetup * (host && host.side !== side ? 1 : 0.5);
    }
  }

  // --- Efficiency ---
  const before = state.players[side];
  const after = next.players[side];
  const marrowSpent = Math.max(0, before.marrow - after.marrow);
  utility += weights.marrowEfficiency * marrowSpent;

  // Channelling extracts Marrow instead of swinging. Worth less than spending it, because
  // the Marrow still has to find a use before end of turn — but worth more than the zero
  // it would otherwise score, which would mean the AI never channelled at all.
  for (const e of events) {
    if (e.t === 'unitChannelled') utility += weights.channelValue * e.marrow;
  }

  // --- Risk ---
  for (const e of events) {
    if (e.t !== 'damageDealt') continue;
    if (e.cause !== 'counter') continue;
    if (e.target.kind === 'unit' && state.units[e.target.id]?.side === side) {
      utility -= weights.counterRisk * hpPoints(e.hpLoss);
    }
  }

  return { command, utility, next, events };
}
