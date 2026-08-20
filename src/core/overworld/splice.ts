/**
 * The splicing bench's till.
 *
 * Same shape as the Artificer's other two trades: a `*Refusal` that names why in the
 * player's words, and a doer that asks it rather than trusting the button that called it.
 * Nothing is charged for a refusal.
 *
 * What makes this one different is that it *consumes a card*. Every other purchase in the
 * game only ever adds, so this is the only place where the collection can shrink — and
 * the collection is what decks validate against. A splice that took a copy out from under
 * a deck holding three of them would leave the player with a deck flagged illegal and no
 * explanation, so trimming the decks is part of the same transaction rather than a
 * follow-up somebody has to remember.
 */

import type { Collection } from '../data/deckRules.js';
import type { GlobalGameState } from './state.js';
import { CARDS } from '../data/cards/index.js';
import { isUnlocked } from '../data/collection.js';
import { recipeFor } from '../data/splicing.js';

/** The shape this needs from a saved deck, so core never imports the app's save types. */
export interface DeckList {
  cards: string[];
}

export type SpliceRefusal =
  | 'in-combat'
  | 'no-recipe'
  | 'not-owned'
  | 'no-reagent'
  | null;

export function spliceRefusal(
  state: GlobalGameState,
  collection: Collection,
  baseCardId: string,
  catalystId: string,
): SpliceRefusal {
  if (state.combat !== null || state.overworld.activeEncounter !== null) return 'in-combat';

  const recipe = recipeFor(baseCardId, catalystId);
  // The result being missing from the registry counts as no recipe: a book entry naming a
  // card nobody printed should refuse at the counter, not produce an unplayable card.
  if (!recipe || !CARDS[recipe.resultId]) return 'no-recipe';

  if (!isUnlocked(collection, baseCardId)) return 'not-owned';
  if ((state.overworld.economy.reagents[catalystId] ?? 0) <= 0) return 'no-reagent';
  return null;
}

export interface SpliceResult {
  collection: Collection;
  resultId: string;
  /** How many copies had to come out of saved decks to keep them legal. */
  trimmed: number;
}

/**
 * Presses a card and a core into a hybrid, or returns null if it cannot.
 *
 * The order is: refuse, then take, then give. The reagent and the base copy are both
 * spent before the hybrid is granted, so there is no window in which the player has been
 * charged and has nothing — and because the refusal is asked first, a stale button can
 * never take anything at all.
 *
 * `decks` is mutated in place; the collection is replaced, like every other till here,
 * because it belongs to the save rather than to the character.
 */
export function spliceCard(
  state: GlobalGameState,
  collection: Collection,
  baseCardId: string,
  catalystId: string,
): SpliceResult | null {
  if (spliceRefusal(state, collection, baseCardId, catalystId) !== null) return null;
  const recipe = recipeFor(baseCardId, catalystId)!;

  const { reagents } = state.overworld.economy;
  reagents[catalystId] = (reagents[catalystId] ?? 0) - 1;
  if (reagents[catalystId] <= 0) delete reagents[catalystId];

  // The base card is **not** consumed any more. An unlock cannot be spent — that is what
  // makes it an unlock — so the bench charges the Core alone and hands back a second card
  // the player now knows. A recipe that ate the base would be the one place in the game
  // where knowing something could be taken away from you.
  const unlocked = collection.unlocked.includes(recipe.resultId)
    ? collection.unlocked
    : [...collection.unlocked, recipe.resultId].sort();

  // Nothing to trim: no deck can be holding a card the player just lost, because nobody
  // lost one.
  return { collection: { ...collection, unlocked }, resultId: recipe.resultId, trimmed: 0 };
}

