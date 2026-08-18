/**
 * Where the overworld and a fight meet.
 *
 * This is the only module that knows about both. `state.ts` never imports the engine and
 * the engine never imports it; everything that has to understand the two together — what
 * a run hands a fight, and what a fight hands back — is here, so the seam is one file
 * rather than a habit.
 */

import type { CombatResult } from '../../contract/events.js';
import type { CombatBoons, CombatCarry } from '../engine/setup.js';
import type { BuffId, GlobalGameState, OverworldState } from './state.js';
import { INVENTORY_LIMIT } from './state.js';
import { nextBountySeed } from '../data/bounties.js';

/**
 * What each brew does to a fight.
 *
 * The translation table, and the reason this module exists. `state.ts` owns which brews
 * a run may carry; saying what one *does* needs the engine's vocabulary, so it is said
 * here — the one file allowed to hold both. Adding a fourth brew is adding a row.
 */
export const BUFF_EFFECTS: Record<BuffId, CombatBoons> = {
  /** Armour to soak the first exchange. */
  ironbrew: { armor: 5 },
  /** Opens on a bigger bank, so a turn-one Power Tier play is briefly possible. */
  kinetic_capacitor: { pips: 2 },
  /** A wider opening hand: more options rather than more power. */
  quicksilver: { extraOpeningCards: 2 },
};

/**
 * What the run hands the next fight.
 *
 * The buff is translated to its effects here and not carried as an id, so the engine is
 * handed armour and pips rather than a word it would have to interpret.
 */
export function carryFor(overworld: OverworldState): CombatCarry {
  const boons = overworld.activeBuff ? BUFF_EFFECTS[overworld.activeBuff] : undefined;
  return {
    startingHp: overworld.pact.currentHp,
    ...(boons ? { boons } : {}),
  };
}

/**
 * What a finished fight tells the run.
 *
 * A named payload rather than the whole `GameState`: the run needs exactly one number
 * out of a fight, and handing it the entire board would invite the overworld to start
 * reading combat internals it has no business knowing about.
 */
export interface CombatOutcome {
  /** The Pact as it stood when the bell rang. */
  pactHp: number;
}

/**
 * Closes a fight and folds it back into the run.
 *
 * Three things happen in a fixed order, and the order matters:
 *
 *  1. The surviving Pact is written back, whatever it is. A defeat writes zero rather
 *     than being suppressed — a player who is down should read as down, and `isDown`
 *     should not need a second flag to agree with the number beside it.
 *  2. The buff clears regardless of outcome, and so does the contract. The brew was
 *     drunk on the way in; losing does not give it back, and a brew that survived a
 *     defeat would make retrying strictly better than winning.
 *  3. Spoils are granted only on a win, and only after the Pact is settled, so a victory
 *     at one health still pays. They are read from the contract the player accepted, not
 *     passed in — the board rerolls after every fight, and paying from the new board
 *     would settle a win against an offer nobody agreed to.
 *  4. The board moves on, win or lose. Declining everything keeps your board; finishing
 *     something changes it.
 *
 * The combat handle is nulled last: `combat === null` is what "we are in the overworld"
 * means, so it flips once everything it was holding has been read out of it.
 */
export function resolveCombat(
  global: GlobalGameState,
  outcome: CombatOutcome,
  result: CombatResult,
): void {
  const { overworld } = global;

  // Read the contract before closing it: the payout was fixed when the bounty was
  // accepted, and clearing first would settle every win at nothing.
  const spoils = overworld.activeEncounter?.spoils ?? {};

  overworld.pact.currentHp = Math.max(0, Math.min(overworld.pact.maxHp, outcome.pactHp));

  overworld.activeBuff = null;
  // The fight is answered for, so the contract closes. Whoever calls this owns writing it
  // to disk — a cleared contract that never reaches storage would forfeit a fight the
  // player actually finished.
  overworld.activeEncounter = null;

  // 'bound' is a win: the companion was subjugated rather than the enemy killed.
  if (result === 'victory' || result === 'bound') {
    overworld.economy.ducats += spoils.ducats ?? 0;
    overworld.economy.marrowShards += spoils.marrowShards ?? 0;
  }

  overworld.bountySeed = nextBountySeed(overworld.bountySeed);
  global.combat = null;
}

/** Why a consumable could not be used, or null if it can. */
export type ConsumableRefusal =
  | 'in-combat'
  | 'no-such-item'
  | null;

export function consumableRefusal(
  global: GlobalGameState,
  inventoryIndex: number,
): ConsumableRefusal {
  // Items are an overworld affordance. Allowing one mid-fight would let a player heal
  // out of a lethal turn the engine had already committed to, and would put a source of
  // healing outside the deterministic reducer entirely.
  //
  // Two flags are consulted, and either one is enough. `combat` is the live handle and
  // `activeEncounter` is its persisted mirror; asking for both to agree would mean a
  // desync unlocks the satchel, where asking for either means a desync merely locks it.
  // Failing shut is the right way round for a rule that exists to stop an exploit.
  if (global.combat !== null || global.overworld.activeEncounter !== null) return 'in-combat';
  const item = global.overworld.inventory[inventoryIndex];
  if (!item) return 'no-such-item';
  return null;
}

/**
 * Uses an item, returning whether it was used.
 *
 * A boolean rather than a throw: a click on a greyed-out satchel during a fight is a
 * thing players do, not a programming error. `consumableRefusal` gives the UI the reason
 * when it wants to say one.
 */
export function useConsumable(global: GlobalGameState, inventoryIndex: number): boolean {
  if (consumableRefusal(global, inventoryIndex) !== null) return false;

  const { overworld } = global;
  const item = overworld.inventory[inventoryIndex]!;

  if (item.type === 'healing') {
    overworld.pact.currentHp = Math.min(
      overworld.pact.maxHp,
      overworld.pact.currentHp + item.value,
    );
  } else {
    // Overwrites rather than stacks, so the question is always which brew and never how
    // many. A second one drunk before a fight simply replaces the first.
    overworld.activeBuff = item.id as typeof overworld.activeBuff;
  }

  overworld.inventory.splice(inventoryIndex, 1);
  return true;
}

/** Guard for anything building an inventory, so the cap cannot be exceeded by assembly. */
export function inventoryHasRoom(overworld: OverworldState): boolean {
  return overworld.inventory.length < INVENTORY_LIMIT;
}
