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
import { ownedCount } from '../data/collection.js';
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

  if (ownedCount(collection, baseCardId) <= 0) return 'not-owned';
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
  decks: Record<string, DeckList>,
  baseCardId: string,
  catalystId: string,
): SpliceResult | null {
  if (spliceRefusal(state, collection, baseCardId, catalystId) !== null) return null;
  const recipe = recipeFor(baseCardId, catalystId)!;

  const { reagents } = state.overworld.economy;
  reagents[catalystId] = (reagents[catalystId] ?? 0) - 1;
  if (reagents[catalystId] <= 0) delete reagents[catalystId];

  const owned = { ...collection.owned };
  const remaining = (owned[baseCardId] ?? 0) - 1;
  // Deleting at zero rather than leaving a `0` behind: `reconcileCollection` drops
  // zero-count keys anyway, and a bag that says "you have none of this" is noise.
  if (remaining > 0) owned[baseCardId] = remaining;
  else delete owned[baseCardId];

  owned[recipe.resultId] = (owned[recipe.resultId] ?? 0) + 1;

  const trimmed = trimDecks(decks, baseCardId, remaining);
  return { collection: { ...collection, owned }, resultId: recipe.resultId, trimmed };
}

/**
 * Takes copies out of saved decks until none holds more than the player still owns.
 *
 * The last copy first, so a deck loses the card it was least deliberate about keeping —
 * and only as many as it has to, so a deck running one of three is untouched when the
 * other two are spent.
 */
function trimDecks(
  decks: Record<string, DeckList>,
  cardId: string,
  remaining: number,
): number {
  let trimmed = 0;

  for (const deck of Object.values(decks)) {
    let held = deck.cards.filter((c) => c === cardId).length;
    while (held > remaining) {
      const at = deck.cards.lastIndexOf(cardId);
      if (at < 0) break;
      deck.cards.splice(at, 1);
      held -= 1;
      trimmed += 1;
    }
  }

  return trimmed;
}
