/**
 * Utility scoring. The composite, and every weight below, is documented in
 * `docs/09_ai_and_encounters.md`:
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
import type { Unit } from '../types/units.js';
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
  /** What one banked Bone is worth. See the default for how it is priced. */
  boneValue: number;
  /** What one card drawn is worth. */
  drawValue: number;
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
  /**
   * Per tile closed on the nearest hostile body, for a unit that threatens nothing where
   * it stands.
   *
   * `advance` is a y-gradient — it says "forward", which is the right answer almost every
   * turn and the wrong one at the end of a fight. Two bodies with the board otherwise
   * clear each maximise `advance` by walking to opposite edges, pass each other on the
   * way, and stand there: a stalemate nothing in the matrix knew how to break, because
   * "forward" had run out and nothing said "toward *them*".
   *
   * Priced above `advance` so closing beats the gradient when the two disagree, and under
   * `firingPosition` so a mortar still prefers a tile it can actually shoot from to one
   * step nearer a blind spot.
   */
  pursue: number;
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
  /**
   * Fraction of a point's value credited for stripping **armor** rather than health.
   *
   * Without it the AI cannot fight through armor at all. A blow fully absorbed reports
   * `hpLoss: 0`, scores nothing, and — since zero sits at the pass threshold — is discarded
   * before it is even a candidate. Against a Pact behind a hundred and sixty armor that
   * means the AI declines every swing it has and walks instead, forever, while the armor is
   * topped back up. It is the hole the chip-damage term was added to close, one layer down.
   *
   * Under 1 because armor is not health: it can be replaced, and taking it off wins nothing
   * by itself. Well above 0 because getting through it is the only route to the thing that
   * does.
   */
  armorChip: number;
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
  /**
   * What a body makes by giving up its swing, per Marrow.
   *
   * Was 6, and the comment explaining it named the reason it had to change: "above the pass
   * threshold so an idle unit channels rather than standing there." It was only ever compared
   * against **doing nothing**, because Channel was offered solely to units with no target.
   *
   * Now that a swing costs a Bone and every body is a channel candidate, this competes with
   * attacking — and an ordinary attack is worth about **4** (`unitDamage: 2` against
   * `hpPoints`, so a 20-damage hit scores 2 x 2). At 6 the AI sat down in front of targets it
   * could have hit, and measured attacks fell from 0.63 a turn to 0.27.
   */
  channelValue: 1,
  /**
   * What one banked Bone is worth.
   *
   * A Bone is a means, not an end, and pricing it at what it buys is circular — spending one on
   * an attack becomes value-neutral while making one is pure profit, which is exactly what the
   * first attempt at this did. Scarcity is enforced by the affordability filter in
   * `enumerate.ts`; this only has to make a body with nothing to hit prefer channelling to
   * standing still, and keep a melee channel (1 + 2 = 3) just under an ordinary swing (4).
   */
  boneValue: 2,
  /** A card in hand. Worth a little more than the Bone that pays half of one. */
  drawValue: 3,
  counterRisk: 12,
  friendlyCollateral: 15,
  advance: 3,
  // Must outweigh the two rows of `advance` a mortar gives up by stopping short of its
  // own blind spot, or the archetype walks itself out of the fight every time.
  firingPosition: 8,
  // Double `advance`, so a unit with nothing in reach turns toward the enemy instead of
  // walking to the far edge — and still under `firingPosition`, so a constrained shooter
  // is not talked out of its firing line.
  pursue: 6,
  developAtk: 4,
  developHp: 1.5,
  armorValue: 1.5,
  markSetup: 12,
  // Modest for a Novice: it will pull a wounded attacker back, but will not turtle.
  retreat: 2.5,
  // Half. Enough that chewing through armor always beats standing still, never so much that
  // stripping armor is mistaken for landing the blow behind it.
  armorChip: 0.5,
  retreatSurvival: 0.5,
  unitDamage: 2,
};

/**
 * Adept: the same value system, but it sees collisions.
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
 * Placing the tether, and losing it.
 *
 * The same magnitude as breaking one, because it is the same event seen from the other side:
 * whoever is right about the anchor wins the phase, and no ordinary line on the board can be
 * worth more than that to either of them.
 */
export const TETHER_SCORE = 20_000;

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

/**
 * What the tether is worth to the side that placed it.
 *
 * The mirror of `anchorPressure`, and deliberately much simpler: the anchor is pinned the
 * moment it is set — `setAnchor` spends its move and its attack — so there is no positioning
 * to reward. All the binder can do is not lose it, which makes this a cost term rather than a
 * progress one.
 *
 * Measured on health alone. Armor absorbing a blow meant for the anchor is armor doing its
 * job, not a step toward losing the tether.
 */
function anchorDefence(events: GameEvent[], anchorId: string): number {
  if (events.some((e) => e.t === 'unitDied' && e.unitId === anchorId)) {
    // Losing it costs what taking it would have gained. The beast enrages, the Rite has to
    // be found again, and the rounds already survived are gone.
    return -TETHER_SCORE;
  }

  let score = 0;
  for (const e of events) {
    if (e.t !== 'damageDealt') continue;
    if (e.target.kind !== 'unit' || e.target.id !== anchorId) continue;
    score -= ANCHOR_CHIP * hpPoints(e.hpLoss);
  }
  return score;
}

/** Per point of health taken off the anchor. Well under a kill, well over a face hit. */
const ANCHOR_CHIP = 60;
/** Per tile closed on the anchor, when nothing can reach it yet. */
const ANCHOR_APPROACH = 40;

/**
 * The nearest body this unit would want to break.
 *
 * "Hostile" is the same reading `legalAttacks` uses, and it has to be: a Feral beast
 * belongs to nobody and is an enemy of everything that is not also Feral, including the
 * side whose record it sits in. Judged by footprint distance so a 2x2 Behemoth is measured
 * from its nearest cell rather than from its anchor corner.
 */
function nearestFoe(state: GameState, unit: Unit): Unit | undefined {
  const mine = unit.keywords.includes('Feral');
  let best: Unit | undefined;
  let bestDist = Infinity;

  for (const other of Object.values(state.units)) {
    if (other.id === unit.id) continue;
    const theirs = other.keywords.includes('Feral');
    // A beast bites anything that is not a beast; everyone else fights the other side and
    // any beast at all.
    if (mine ? theirs : other.side === unit.side && !theirs) continue;
    const d = footprintDistance(unit, other);
    if (d < bestDist) {
      bestDist = d;
      best = other;
    }
  }

  return best;
}

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
    // Whose tether it is decides which way the term points, and this used to be missing:
    // `anchorPressure` was applied to whoever happened to be planning, so the side that
    // *owns* the anchor was being offered twenty thousand points for destroying it. It went
    // unnoticed because the binder's AI never placed a tether in the first place — the
    // moment it could, it would have blown its own up on the following turn.
    const anchor = state.units[sub.anchorUnitId];
    utility +=
      anchor && anchor.side === side
        ? anchorDefence(events, sub.anchorUnitId)
        : anchorPressure(state, next, events, command, sub.anchorUnitId);
  } else if (sub.sealed && !sub.active && next.encounter.subjugation.active) {
    // Casting the Rite. A sealed beast cannot be damaged and cannot be killed, so the
    // tether is not the best line available — it is the *only* line, and everything else on
    // the board is worth nothing beside it. Priced with the beast's own override so neither
    // side can be talked out of the one move that decides the phase.
    utility += TETHER_SCORE;
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
    if (e.t !== 'damageDealt' || e.target.kind !== 'unit') continue;
    // Armor stripped is progress toward the health behind it: discounted, not ignored.
    const progress = e.hpLoss + e.absorbedByArmor * weights.armorChip;
    if (progress <= 0) continue;
    const victim = state.units[e.target.id] ?? next.units[e.target.id];
    if (!victim) continue;
    utility +=
      (victim.side === foe ? weights.unitDamage : -weights.unitDamage) * hpPoints(progress);
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
    if (e.target.side === foe) {
      // Their armor counts, at a discount: it is the wall in front of the only thing worth
      // hitting, and taking a slice off it is the only progress available until it is gone.
      utility += faceWeight * hpPoints(e.hpLoss + e.absorbedByArmor * weights.armorChip);
    } else {
      // Ours does not. This term protects the Pact's *health*, and armor exists precisely
      // to be spent — treating its loss as a wound to avoid would teach the AI to hoard the
      // one resource whose whole purpose is to be used up.
      utility -= weights.face * hpPoints(e.hpLoss);
    }
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

      // Close on something worth breaking, when nothing is in reach from here.
      //
      // Gated on `threatensFrom` rather than on `legalAttacks` deliberately: the question
      // is whether this tile threatens anything *at all*, not whether this unit still has
      // a swing left. A body that has already attacked still threatens from where it
      // stands, so strike-and-withdraw is left to the retreat term below rather than
      // being turned into strike-and-chase.
      if (weights.pursue > 0 && !threatensFrom(state, unit, unit.anchor)) {
        const moved = next.units[unit.id];
        const quarry = nearestFoe(state, unit);
        if (moved && quarry) {
          const gained = footprintDistance(unit, quarry) - footprintDistance(moved, quarry);
          if (gained > 0) utility += weights.pursue * gained;
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
      // A body that *is* the army cannot afford to hide.
      //
      // Retreat buys time for the rest of your line to do the work. With nothing else on
      // the board there is no rest of the line, so the time buys nothing: a lone Bound
      // Form backing away forever is not defending a plan, it is declining to have one.
      // Left in, it produced fights that were already decided and simply could not finish
      // — a hiding body chipped down over sixty turns, or two of them hovering just out of
      // each other's reach while the clock ran out.
      //
      // Feral bodies do not count as company. A wolf filed under your side belongs to
      // nobody and is as likely to bite you, so a body alone with one is still alone.
      const hasCompany = unitsOf(state, side).some(
        (u) => u.id !== unit.id && !u.keywords.includes('Feral'),
      );
      const mayHide = !isBody || hasCompany;
      if (mayHide && (isBody || unit.attackedThisTurn) && weights.retreat > 0) {
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
    if (e.t !== 'unitChannelled') continue;
    utility += weights.channelValue * e.marrow;
    utility += weights.boneValue * e.bones;
    utility += weights.drawValue * e.draw;
  }

  // No Bone penalty on attacking, deliberately.
  //
  // The obvious move is to subtract `boneValue` per swing, and it double-charges: the
  // affordability filter in `enumerate.ts` has already removed every attack the side cannot
  // fund, so the score would be pricing a constraint that is enforced elsewhere. Measured, it
  // took an ordinary attack from 4 utility to 1 and the AI stopped swinging.
  //
  // The consequence is that the AI attacks while it can afford to and channels when it cannot,
  // rather than weighing the two every turn the way a player does. That is a poorer policy than
  // a person's and a perfectly sane opponent, which is the trade being made.

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
