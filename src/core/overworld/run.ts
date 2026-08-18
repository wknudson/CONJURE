/**
 * Where the overworld and a fight meet.
 *
 * This is the only module that knows about both. `state.ts` never imports the engine and
 * the engine never imports it; everything that has to understand the two together — what
 * a run hands a fight, and what a fight hands back — is here, so the seam is one file
 * rather than a habit.
 */

import type { GameState } from '../types/state.js';
import type { CombatResult } from '../../contract/events.js';
import type { CombatCarry } from '../engine/setup.js';
import type { GlobalGameState, OverworldState } from './state.js';
import { BUFF_EFFECTS, INVENTORY_LIMIT } from './state.js';

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

export interface CombatSpoils {
  ducats?: number;
  marrowShards?: number;
}

/**
 * Closes a fight and folds it back into the run.
 *
 * Three things happen in a fixed order, and the order matters:
 *
 *  1. The surviving Pact is written back, whatever it is. A defeat writes zero rather
 *     than being suppressed — a run that ended should read as ended, and `isRunOver`
 *     should not need a second flag to agree with the number beside it.
 *  2. The buff clears regardless of outcome. It was drunk on the way in; losing does not
 *     give it back, and a brew that survived a defeat would make retrying strictly better
 *     than winning.
 *  3. Spoils are granted only on a win, and only after the Pact is settled, so a victory
 *     at one health still pays.
 *
 * The combat handle is nulled last: `combat === null` is what "we are in the overworld"
 * means, so it flips once everything it was holding has been read out of it.
 */
export function resolveCombat(
  global: GlobalGameState,
  finished: GameState,
  result: CombatResult,
  spoils: CombatSpoils = {},
): void {
  const { overworld } = global;

  overworld.pact.currentHp = Math.max(
    0,
    Math.min(overworld.pact.maxHp, finished.players.player.hp),
  );

  overworld.activeBuff = null;

  // 'bound' is a win: the companion was subjugated rather than the enemy killed.
  if (result === 'victory' || result === 'bound') {
    overworld.economy.ducats += spoils.ducats ?? 0;
    overworld.economy.marrowShards += spoils.marrowShards ?? 0;
  }

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
  if (global.combat !== null) return 'in-combat';
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
