/**
 * The Vanguard Roster — point-buy, and the end of the Pip Tax.
 *
 * A minion used to cost Pips out of the same pool as the spell it existed to enable, so
 * buying a board meant not casting anything. Minions are now bought once, before the
 * dungeon, out of a budget that competes with nothing: the deck keeps the spells, and Pips
 * buy magic and only magic.
 *
 * Nothing here is engine vocabulary. The roster resolves to a list of def ids before
 * `createCombat` ever sees it, exactly as a deck does — the reducer has never heard of a
 * "point".
 */

import type { CardDef } from '../types/cards.js';
import { CARDS } from './cards/index.js';
import { cardCostTotal } from '../types/cards.js';

/** Points a warband may spend. Deliberately not divisible into a comfortable answer. */
export const ROSTER_BUDGET = 10;

/** At most one 2x2 body. The 6-point price nearly enforces it; saying it makes it a rule. */
export const MAX_ROSTER_BEHEMOTHS = 1;

/**
 * What a body costs, derived rather than authored.
 *
 * The same discipline `tierOf` keeps on cards, and for the same reason: a minion that
 * shipped without a cost would be a *free* minion on a point-buy system. Deriving it means
 * a new body cannot be added without one.
 *
 * The ladder, in the order it is asked:
 *
 * | | |
 * |---|---|
 * | footprint 2 | **6** — a Behemoth is most of a warband |
 * | total cost >= 4 | **4** — elite. Asked before reach, so a 4-Pip ranged body is elite rather than merely ranged |
 * | reaches past 1 | **3** — ranged |
 * | otherwise | **2** — basic melee |
 */
export function rosterPointsOf(def: CardDef): number {
  const unit = def.unit;
  if (!unit) return 0;
  if (unit.footprint === 2) return 6;
  if (cardCostTotal(def.cost) >= 4) return 4;
  if ((unit.rangeMax ?? 1) > 1) return 3;
  return 2;
}

/** What a whole roster costs. */
export function rosterCost(roster: string[]): number {
  return roster.reduce((sum, id) => {
    const def = CARDS[id];
    return sum + (def ? rosterPointsOf(def) : 0);
  }, 0);
}

/**
 * Every body a roster may hold.
 *
 * Derived from the card database rather than listed, so a new minion joins the pool by
 * existing — and, more importantly, so this can never fall out of step with what the deck
 * rules now refuse. `setupOnly` keeps the Bound Forms, the authored threats and the
 * wildlife out; they were never the player's to field.
 */
export function isRosterEligible(def: CardDef): boolean {
  if (def.kind !== 'minion') return false;
  if (def.setupOnly || def.spliceOnly) return false;
  return true;
}

export function rosterPool(): CardDef[] {
  return Object.values(CARDS).filter(isRosterEligible).sort((a, b) => a.id.localeCompare(b.id));
}

/**
 * Bodies every warband may field without unlocking anything.
 *
 * The floor under a new player: whatever else happens, there is always a line to hold and
 * something quick to hold it with.
 */
export const UNIVERSAL_ROSTER: string[] = ['vanguard_footman', 'scout_imp'];

export type RosterProblem =
  | { code: 'over_budget'; message: string; spent: number; budget: number }
  | { code: 'not_unlocked'; message: string; defId: string }
  | { code: 'too_many_behemoths'; message: string }
  | { code: 'unknown_unit'; message: string; defId: string }
  | { code: 'not_a_minion'; message: string; defId: string };

/**
 * Validates a roster, returning **every** problem rather than the first.
 *
 * The shape `validateDeck` established, so the builder can show a complete list instead of
 * making the player fix one thing at a time.
 *
 * `unlocked` is optional: omitted means every eligible body is available, which is what the
 * tests and the current build want. Passing a list is the seam a Companion-gated unlock
 * hangs off later.
 */
export function validateRoster(roster: string[], unlocked?: string[]): RosterProblem[] {
  const problems: RosterProblem[] = [];
  let behemoths = 0;

  for (const id of roster) {
    const def = CARDS[id];
    if (!def) {
      problems.push({ code: 'unknown_unit', message: `No such unit: ${id}`, defId: id });
      continue;
    }
    if (!isRosterEligible(def)) {
      problems.push({
        code: 'not_a_minion',
        message: `${def.name} cannot be fielded in a Vanguard.`,
        defId: id,
      });
      continue;
    }
    if (unlocked && !unlocked.includes(id)) {
      problems.push({
        code: 'not_unlocked',
        message: `${def.name} is not unlocked yet.`,
        defId: id,
      });
    }
    if (def.unit?.footprint === 2) behemoths += 1;
  }

  if (behemoths > MAX_ROSTER_BEHEMOTHS) {
    problems.push({
      code: 'too_many_behemoths',
      message: `A Vanguard may field at most ${MAX_ROSTER_BEHEMOTHS} Behemoth.`,
    });
  }

  const spent = rosterCost(roster);
  if (spent > ROSTER_BUDGET) {
    problems.push({
      code: 'over_budget',
      message: `That warband costs ${spent} of ${ROSTER_BUDGET} points.`,
      spent,
      budget: ROSTER_BUDGET,
    });
  }

  return problems;
}

/** Points still unspent. Never negative, so a UI can render it without guarding. */
export function pointsRemaining(roster: string[]): number {
  return Math.max(0, ROSTER_BUDGET - rosterCost(roster));
}

/**
 * The warband a new player starts with, and the one legacy callers get by default.
 *
 * Spends the budget exactly: two basics and two ranged specialists is a line with
 * something behind it, which is the shape the deployment phase is most legible with.
 */
export const DEFAULT_ROSTER: string[] = [
  'vanguard_footman',
  'scout_imp',
  'cinder_lobber',
  'longshot_stalker',
];
