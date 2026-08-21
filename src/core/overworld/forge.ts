/**
 * The Artificer's till.
 *
 * Both of the bench's trades are the same shape — spend from the purse, write to the
 * collection — so they share a file and a pair of conventions: a `*Refusal` predicate
 * that names why something cannot happen, and a doer that asks it rather than trusting
 * the caller. The screen greys a button out; this decides whether it may be pressed.
 *
 * Two trades, two shapes of price:
 *
 *  - **Acquiring** a card you have never held costs Ducats, and nothing else. Learning a
 *    new spell should be reachable from any run.
 *  - **Mastering** one you already know costs Ducats, Aether Shards *and* a Reagent. It
 *    is the deeper sink and it asks for all three, so it cannot be reached by grinding a
 *    single thing.
 *
 * Keeping the two priced differently means winning contracts, taking hard ones, and
 * butchering scenery all pull in different directions.
 *
 * The collection is passed in and returned rather than mutated: it lives in the save, it
 * outlives the character, and `grantCard` has always been immutable. The purse *is*
 * mutated, because it belongs to the character this is spending from.
 */

import type { Collection } from '../data/deckRules.js';
import type { GlobalGameState } from './state.js';
import { CARDS, ascendedId } from '../data/cards/index.js';
import { grantCard, isAscended, isUnlocked } from '../data/collection.js';

/**
 * What an Ascension costs, in all three currencies at once.
 *
 * Three, deliberately, and each is earned a different way:
 *
 *  - **Ducats** come from contracts. Time.
 *  - **Aether Shards** come from the harder tiers only. Difficulty.
 *  - **A Reagent** comes from a Master payout or the Audit. Scarcity.
 *
 * A sink that took one currency could be starved by saving in another, or trivialised by
 * a run that happened to be rich in it. Taking all three means an Ascension is paid for by
 * having *played*, rather than by having ground one thing.
 *
 * Flat, whatever the card. A per-Tier curve is the obvious next move and deliberately not
 * this change: the uplift is a flat 10% at every Tier, so a flat price is the honest
 * matching shape until the uplift stops being flat.
 */
export const ASCENSION_COST = {
  ducats: 60,
  shards: 3,
  /** Cores, of any one kind. See `reagentForAscension`. */
  reagents: 1,
} as const;

/** Kept as its own export: half the codebase and most of the tests name it directly. */
export const ASCENSION_COST_SHARDS = ASCENSION_COST.shards;

/**
 * Which Core an Ascension will actually spend.
 *
 * **Any one Core, and the bench takes whichever you hold most of.** The brief calls for
 * "Regional Reagents", and regions are not a thing this game models yet — there is no
 * biome on a bounty and no province on a map, so a Core cannot be matched to where a card
 * was earned. Rather than invent a geography to satisfy a word, the cost is one Core of
 * the player's deepest stack: still a real scarcity gate, and still the thing Master
 * contracts are for. When regions exist, this function is the one place that changes.
 *
 * Deepest stack rather than a prompt, because the alternative is a modal asking which of
 * three identical-in-every-way materials to burn. Ties break by id so the choice is
 * reproducible.
 */
export function reagentForAscension(reagents: Record<string, number>): string | undefined {
  const held = Object.entries(reagents)
    .filter(([, n]) => n >= ASCENSION_COST.reagents)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  return held[0]?.[0];
}

/**
 * Flat, whatever the card — for now.
 *
 * A Tier 1 staple therefore costs what a Tier 3 finisher does, which is not where this
 * should end up; the brief has Reagents arriving to differentiate them, and a per-tier
 * curve would be the wrong thing to build twice.
 */
export const SCHEMATIC_COST_DUCATS = 100;

// ---------------------------------------------------------------- ascension

export type AscensionRefusal =
  | 'in-combat'
  | 'not-owned'
  | 'already-ascended'
  | 'no-rank-2'
  | 'too-poor'
  | 'no-reagent'
  | null;

export function ascensionRefusal(
  state: GlobalGameState,
  collection: Collection,
  cardId: string,
): AscensionRefusal {
  // The bench is an overworld affordance. Nothing may change a deck once a fight has
  // been committed to, or a card could be upgraded between the contract and the board.
  if (state.combat !== null || state.overworld.activeEncounter !== null) return 'in-combat';
  if (!CARDS[ascendedId(cardId)]) return 'no-rank-2';
  if (!isUnlocked(collection, cardId)) return 'not-owned';
  if (isAscended(collection, cardId)) return 'already-ascended';
  const { ducats, marrowShards, reagents } = state.overworld.economy;
  if (marrowShards < ASCENSION_COST.shards || ducats < ASCENSION_COST.ducats) return 'too-poor';
  // Named separately from `too-poor` because it is a different errand: money and Shards
  // are earned by taking any contract, and a Core is not.
  if (!reagentForAscension(reagents)) return 'no-reagent';
  return null;
}

/**
 * Raises a card to Rank 2, or returns null if it cannot be raised.
 *
 * Null rather than a throw, for the same reason `useConsumable` returns a boolean: a
 * click on a stale button is a thing that happens, not a programming error. The Shards
 * are only taken once the mark has been made, so a refusal can never charge for nothing.
 */
export function ascendCard(
  state: GlobalGameState,
  collection: Collection,
  cardId: string,
): Collection | null {
  if (ascensionRefusal(state, collection, cardId) !== null) return null;

  const economy = state.overworld.economy;
  // Resolved before anything is spent, and non-null because the refusal above asked for it.
  const core = reagentForAscension(economy.reagents)!;

  const ascended = [...(collection.ascended ?? []), cardId].sort();
  economy.marrowShards -= ASCENSION_COST.shards;
  economy.ducats -= ASCENSION_COST.ducats;
  economy.reagents[core] -= ASCENSION_COST.reagents;
  // An empty stack is deleted rather than left at zero, matching what the splicing bench
  // does — a bag holding "0 Frost Cores" renders as a material you have, and you do not.
  if (economy.reagents[core]! <= 0) delete economy.reagents[core];

  return { ...collection, ascended };
}

// ------------------------------------------------------------- schematics

export type SchematicRefusal = 'in-combat' | 'already-forged' | 'unknown-card' | 'too-poor' | null;

export function schematicRefusal(
  state: GlobalGameState,
  collection: Collection,
  cardId: string,
): SchematicRefusal {
  if (state.combat !== null || state.overworld.activeEncounter !== null) return 'in-combat';
  if (!CARDS[cardId]) return 'unknown-card';
  // Forged once, and that is the whole of it. There is no second copy to buy: an unlock
  // is permanent and how many go in a deck is the Tier limit's business, so paying twice
  // would buy exactly nothing.
  if (isUnlocked(collection, cardId)) return 'already-forged';
  if (state.overworld.economy.ducats < SCHEMATIC_COST_DUCATS) return 'too-poor';
  return null;
}

/** Cuts a card from its Schematic, or returns null if it cannot be cut. */
export function forgeSchematic(
  state: GlobalGameState,
  collection: Collection,
  cardId: string,
): Collection | null {
  if (schematicRefusal(state, collection, cardId) !== null) return null;

  state.overworld.economy.ducats -= SCHEMATIC_COST_DUCATS;
  // `grantCard` spreads the whole collection, so any Ascensions come through untouched.
  return grantCard(collection, cardId);
}
