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

// ---------------------------------------------------------------- progression

/**
 * What one Vanguard body has earned, across every run it has ever fought in.
 *
 * Keyed by `defId` rather than by a per-copy instance id, and that is a design decision
 * rather than a shortcut: a warband holding two Footmen holds two of *the same* Footman.
 * They train together, they level together, and a player who had to remember which of two
 * identical bodies was the good one would be playing a spreadsheet.
 *
 * Progress outlives the run, the dungeon and the Pact. It is the one thing on the
 * character that a knockout genuinely cannot touch.
 */
export interface VanguardProgress {
  level: number;
  xp: number;
}

/** Where every body starts, the moment it is unlocked. */
export const VANGUARD_START_LEVEL = 1;

/** Attack a level buys. Two points of a stretched stat -- a fifth of an old one. */
export const VANGUARD_ATK_PER_LEVEL = 2;

/** Ceiling a level buys. One old point of health, expressed in stretched units. */
export const VANGUARD_MAX_HP_PER_LEVEL = 10;

/**
 * What a level is worth, in stats.
 *
 * Linear, and deliberately small. This is the payoff the Stat Stretch was built for: at
 * the old scale the smallest expressible raise was a whole point of attack, which on a
 * 3-attack body is a **33% buff per level** and unshippable. Two points out of thirty is
 * a raise you feel over a campaign rather than over one contract.
 *
 * Level 1 is the baseline and pays nothing, so a freshly unlocked body fights at exactly
 * the numbers printed on its card.
 */
export function vanguardBonus(level: number): { atk: number; maxHp: number } {
  const steps = Math.max(0, Math.floor(level) - VANGUARD_START_LEVEL);
  return { atk: steps * VANGUARD_ATK_PER_LEVEL, maxHp: steps * VANGUARD_MAX_HP_PER_LEVEL };
}

/** What level this body fights at. Anything unheard-of is level 1, never level zero. */
export function vanguardLevelOf(
  progress: Record<string, VanguardProgress> | undefined,
  defId: string,
): number {
  return Math.max(VANGUARD_START_LEVEL, progress?.[defId]?.level ?? VANGUARD_START_LEVEL);
}

/**
 * Starts a body's record, if it does not already have one.
 *
 * **Idempotent, and that is the whole contract.** Unlocking is the only event that creates
 * a record, and a second unlock of something already owned must not quietly reset it to
 * level 1 -- which is exactly what would happen if a Companion re-granted its bodies on
 * every taming. Returns the same object when there is nothing to do, so a caller can use
 * identity to decide whether anything changed.
 */
export function unlockVanguard(
  progress: Record<string, VanguardProgress>,
  defId: string,
): Record<string, VanguardProgress> {
  if (progress[defId]) return progress;
  if (!CARDS[defId] || !isRosterEligible(CARDS[defId]!)) return progress;
  return { ...progress, [defId]: { level: VANGUARD_START_LEVEL, xp: 0 } };
}

/**
 * Every body's level, flattened for the engine.
 *
 * The engine is handed a plain `defId -> level` map and never learns that XP exists, the
 * same translation `carryFor` performs on relics and knacks. It is also what keeps the
 * levelling curve -- whenever there is one -- entirely outside the reducer.
 */
// ---------------------------------------------------------------- survival XP

/**
 * What a body earns for walking off the field alive.
 *
 * Survival, not kills. A Vanguard unit is a soldier rather than a scoreboard, and paying
 * for kills would make the Behemoth that finishes everything the only body worth levelling
 * while the Guardian that spent four turns keeping it alive earned nothing.
 */
export const VANGUARD_XP_SURVIVED = 30;

/**
 * What it earns for having been there at all, having fallen.
 *
 * Not zero, deliberately. A body that dies has still fought, and a warband that only ever
 * levels when nothing goes wrong is a warband a player stops committing. Small enough that
 * losing bodies is never the *efficient* way to train them.
 */
export const VANGUARD_XP_FELL = 10;

/** Paid to every body that was on the field, on top of the above, when the fight is won. */
export const VANGUARD_XP_VICTORY = 20;

/**
 * XP to leave a given level behind.
 *
 * Linear in the level rather than exponential. A Vanguard unit is not the long campaign
 * sink -- the Companion is -- and a curve that doubled would mean a body that reached
 * level 5 could never realistically reach 6, which is a progression bar that stops meaning
 * anything the moment a player can see the end of it.
 */
export const VANGUARD_XP_PER_LEVEL = 100;

export function xpForNextLevel(level: number): number {
  return Math.max(1, level) * VANGUARD_XP_PER_LEVEL;
}

/** What one fight was worth to the bodies that fought it. */
export interface FightRecord {
  /** Def ids still standing at the bell. */
  survivors: readonly string[];
  /** Def ids that fell. Duplicated ids are counted twice: two Footmen fell, not one. */
  fallen: readonly string[];
  won: boolean;
}

/**
 * Folds a fight into a character's Vanguard record.
 *
 * Pure, and returns a new map: progression lives in the save, and the save is written by
 * one caller that knows when to persist. Rolling a level over is done in a loop rather
 * than by division, so a body that earned three levels' worth in one fight gets all three
 * and its leftover XP -- the alternative silently caps a good night at one level.
 *
 * A body with no record is *not* enrolled here. Earning XP is not how a unit joins the
 * roster; unlocking it is (`unlockVanguard`), and a fight that quietly created records
 * would let a body the player never bought start accumulating a career.
 */
export function awardVanguardXp(
  progress: Record<string, VanguardProgress>,
  fight: FightRecord,
): Record<string, VanguardProgress> {
  const earned = new Map<string, number>();
  const add = (defId: string, xp: number): void => {
    earned.set(defId, (earned.get(defId) ?? 0) + xp + (fight.won ? VANGUARD_XP_VICTORY : 0));
  };

  for (const defId of fight.survivors) add(defId, VANGUARD_XP_SURVIVED);
  for (const defId of fight.fallen) add(defId, VANGUARD_XP_FELL);
  if (earned.size === 0) return progress;

  const out = { ...progress };
  for (const [defId, xp] of earned) {
    const before = out[defId];
    if (!before) continue;

    let { level, xp: total } = { level: before.level, xp: before.xp + xp };
    while (total >= xpForNextLevel(level)) {
      total -= xpForNextLevel(level);
      level += 1;
    }
    out[defId] = { level, xp: total };
  }
  return out;
}

export function vanguardLevels(
  progress: Record<string, VanguardProgress> | undefined,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [defId, p] of Object.entries(progress ?? {})) {
    if (p.level > VANGUARD_START_LEVEL) out[defId] = p.level;
  }
  return out;
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
