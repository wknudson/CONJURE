/**
 * The Artificer's till.
 *
 * Both of the bench's trades are the same shape — spend from the purse, write to the
 * collection — so they share a file and a pair of conventions: a `*Refusal` predicate
 * that names why something cannot happen, and a doer that asks it rather than trusting
 * the caller. The screen greys a button out; this decides whether it may be pressed.
 *
 * Two currencies, two jobs, deliberately not interchangeable:
 *
 *  - **Ducats** acquire. A Schematic buys a card you have never held.
 *  - **Aether Shards** master. An Ascension raises a card you already know.
 *
 * Keeping them separate means winning contracts and butchering things pull in different
 * directions, and neither sink can be starved by spending on the other.
 *
 * The collection is passed in and returned rather than mutated: it lives in the save, it
 * outlives the character, and `grantCard` has always been immutable. The purse *is*
 * mutated, because it belongs to the character this is spending from.
 */

import type { Collection } from '../data/deckRules.js';
import type { GlobalGameState } from './state.js';
import { CARDS, ascendedId } from '../data/cards/index.js';
import { grantCard, isAscended, isUnlocked } from '../data/collection.js';

/** Flat, whatever the card. Ascension is a sink, not a market. */
export const ASCENSION_COST_SHARDS = 3;

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
  if (state.overworld.economy.marrowShards < ASCENSION_COST_SHARDS) return 'too-poor';
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

  const ascended = [...(collection.ascended ?? []), cardId].sort();
  state.overworld.economy.marrowShards -= ASCENSION_COST_SHARDS;

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
