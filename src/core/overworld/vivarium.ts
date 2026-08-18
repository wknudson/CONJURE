/**
 * The Vivarium: what a Companion is worth, and what it costs to make it worth more.
 *
 * A Companion is the one piece of progression that is neither a card nor money — it is
 * the body that fights beside you, and levelling it raises the Pact itself. That makes it
 * the sink with the longest reach: cards change what you can do in a turn, a Companion
 * changes how many turns you survive.
 *
 * Same shape as the Artificer's till, for the same reason: a `*Refusal` that names why in
 * the player's words, and a doer that asks it rather than trusting the button that called
 * it. Nothing is charged for a refusal.
 *
 * Pure, DOM-free, and it never imports the engine — the translation from a Companion's
 * levelled stats into what a fight understands happens in `run.ts`, with everything else
 * that knows both halves.
 */

import type { GlobalGameState, OverworldState } from './state.js';

/**
 * What levelling has bought a Companion so far.
 *
 * The bonuses are stored rather than derived from `level`, so a future level that grants
 * armour instead of health is a change to `levelCompanion` and not to a formula that
 * every reader would have to learn.
 */
export interface CompanionProgress {
  level: number;
  /** Added to the Pact's ceiling while this Companion is the active one. */
  bonusMaxHp: number;
  /** Armor on the Commander at the opening bell. Nothing grants this yet. */
  startingArmor: number;
  /** Added to the starting Pip bank. Nothing grants this yet. */
  bonusPips: number;
}

export function newCompanion(): CompanionProgress {
  return { level: 1, bonusMaxHp: 0, startingArmor: 0, bonusPips: 0 };
}

/** The Pact's ceiling before any Companion is standing beside it. */
export const BASE_PACT_HP = 40;

/** Health a level buys. The whole benefit, for now. */
export const HP_PER_LEVEL = 2;

/**
 * What the next level costs.
 *
 * Scales with the level being left behind, so the first is affordable off a couple of
 * contracts and the fifth is a campaign. Both currencies, deliberately: this is the one
 * sink that competes with *both* halves of the Artificer, which is what stops a player
 * pouring everything into cards and arriving at a Master bounty with a level 1 body.
 */
export function levelCost(progress: CompanionProgress): {
  ducats: number;
  marrowShards: number;
} {
  return { ducats: 150 * progress.level, marrowShards: 2 * progress.level };
}

export type LevelRefusal = 'in-combat' | 'unknown-companion' | 'too-poor' | null;

export function levelRefusal(
  state: GlobalGameState,
  progress: CompanionProgress | undefined,
  ): LevelRefusal {
  // Raising the body a fight is already committed to would change a Pact ceiling the
  // board was built against.
  if (state.combat !== null || state.overworld.activeEncounter !== null) return 'in-combat';
  if (!progress) return 'unknown-companion';

  const cost = levelCost(progress);
  const { economy } = state.overworld;
  if (economy.ducats < cost.ducats || economy.marrowShards < cost.marrowShards) return 'too-poor';
  return null;
}

/**
 * Raises a Companion a level, and reports whether it happened.
 *
 * Mutates the progress in place — it belongs to the save, which holds it by reference —
 * and returns a boolean rather than throwing, for the same reason every other till here
 * does: a click on a stale button is a thing players do.
 *
 * The Pact's ceiling is resynced as part of the same call rather than left to the caller.
 * A level that raised `bonusMaxHp` without raising the gauge beside it would be a purchase
 * with no visible effect until the next fight, which is how a bug hides.
 */
export function levelCompanion(
  state: GlobalGameState,
  progress: CompanionProgress | undefined,
  isActive: boolean,
): boolean {
  if (levelRefusal(state, progress) !== null || !progress) return false;

  const cost = levelCost(progress);
  state.overworld.economy.ducats -= cost.ducats;
  state.overworld.economy.marrowShards -= cost.marrowShards;

  progress.level += 1;
  progress.bonusMaxHp += HP_PER_LEVEL;

  if (isActive) {
    // The level hands over the health it added, rather than only the room to hold it.
    // Buying a bigger gauge and then owing the Clinic six Ducats to fill the new part of
    // it would read as a purchase that did nothing. This is not an exploitable heal: a
    // level costs orders of magnitude more than the points it grants are worth at the
    // Clinic, and it can only ever be bought once per level.
    state.overworld.pact.currentHp += HP_PER_LEVEL;
    syncPactCeiling(state.overworld, progress);
  }
  return true;
}

/**
 * Sets the Pact's ceiling from whoever is standing beside it.
 *
 * `pact.maxHp` stays the single number every clamp in the game already reads — the
 * Clinic's bill, the tonic's cap, the write-back after a fight — so the alternative was
 * threading a Companion through all of them and getting one wrong in silence. Instead the
 * ceiling is recomputed at the only two moments it can change: picking a Companion, and
 * levelling one.
 *
 * Current health is clamped down but never up. Swapping to a lesser Companion costs you
 * the overflow; swapping back does not hand it over as free healing. Growth of your own
 * is the exception, and `levelCompanion` grants that before it calls this.
 */
export function syncPactCeiling(
  overworld: OverworldState,
  progress: CompanionProgress | undefined,
): void {
  overworld.pact.maxHp = BASE_PACT_HP + (progress?.bonusMaxHp ?? 0);
  overworld.pact.currentHp = Math.min(overworld.pact.currentHp, overworld.pact.maxHp);
}
