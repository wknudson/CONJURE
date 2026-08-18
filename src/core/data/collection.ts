/**
 * What the player owns, and how it grows.
 *
 * Module 4 resolves the bankruptcy soft-lock by making the baseline Hero cards
 * **permanent soulbound assets** — they can never leave the collection. That rule is
 * enforced here in the model rather than by hiding a button, so no future wager, sale,
 * or corrupted save can strand a player without a legal deck.
 */

import type { Collection } from './deckRules.js';
import type { CardDef } from '../types/cards.js';
import { CARDS, ascendableIds, ascendedId, isAscendedId } from './cards/index.js';
import { COMPANIONS } from './companions.js';
import type { RngState } from '../util/rng.js';
import { nextInt } from '../util/rng.js';

/** Cards the player can never lose. Enough on their own to build a legal deck. */
export const SOULBOUND: readonly string[] = [
  'vanguard_footman',
  'scout_imp',
  'marrow_wisp',
  'grave_sentinel',
  'dark_tithe',
  'shield_bash',
  'stone_barricade',
  'aegis_ward',
];

/** A new player's collection: every companion's starting deck, pooled. */
export function startingCollection(): Collection {
  const owned: Record<string, number> = {};

  for (const companion of COMPANIONS) {
    for (const id of companion.deck) {
      owned[id] = (owned[id] ?? 0) + 1;
    }
  }

  // Round the soulbound staples up to their full copy allowance, so a fresh player can
  // always assemble a legal 12-card deck no matter which companion they pick.
  for (const id of SOULBOUND) {
    owned[id] = Math.max(owned[id] ?? 0, 3);
  }

  // A marksman and a mortar to start with. Both reward reading the ground rather than
  // out-statting it, which is the lesson the pre-combat arena preview is asking players
  // to learn — and neither is in a companion deck, so they would otherwise be invisible
  // until a reward roll happened to offer one.
  for (const id of ['longshot_stalker', 'cinder_lobber']) {
    owned[id] = Math.max(owned[id] ?? 0, 1);
  }

  return { owned };
}

export function ownedCount(collection: Collection, cardId: string): number {
  return collection.owned[cardId] ?? 0;
}

/** Whether this base card has been Ascended, account-wide. */
export function isAscended(collection: Collection, cardId: string): boolean {
  return (collection.ascended ?? []).includes(cardId);
}

/**
 * The printing a deck entry actually resolves to.
 *
 * The single place a base id becomes `_r2`. Ascension is account-wide, so a deck list
 * written before the forge was used still names the base card — this is what makes that
 * list mean the upgraded printing without anything having been migrated.
 */
export function printedId(collection: Collection, cardId: string): string {
  return isAscended(collection, cardId) && CARDS[ascendedId(cardId)]
    ? ascendedId(cardId)
    : cardId;
}

/** A deck as the engine should receive it, with every Ascension applied. */
export function printedDeck(collection: Collection, deck: string[]): string[] {
  return deck.map((id) => printedId(collection, id));
}

/**
 * What the forge can still offer: owned, upgradeable, and not already upgraded.
 *
 * Owning at least one copy is the gate. Ascension teaches you the card rather than
 * upgrading a copy, so a second copy buys nothing — but you cannot learn a card you have
 * never held.
 */
export function ascendableFor(collection: Collection): string[] {
  return ascendableIds().filter(
    (id) => ownedCount(collection, id) > 0 && !isAscended(collection, id),
  );
}

export function grantCard(collection: Collection, cardId: string): Collection {
  if (!CARDS[cardId]) return collection;
  // Spread the whole collection, not just `owned`. Rebuilding it field by field is how
  // claiming a reward card silently erased every Ascension the player had paid for.
  return {
    ...collection,
    owned: { ...collection.owned, [cardId]: (collection.owned[cardId] ?? 0) + 1 },
  };
}

/**
 * Whether a card is something a player can come to own at all.
 *
 * Setup-only stat blocks are placed by the engine and are not cards anyone can hold; the
 * Rite is injected by the Trial itself. One predicate rather than one filter per caller —
 * the reward roller and the Artificer's Schematic list have to agree about this, and the
 * last time the rule lived in two places, a rename left one of them offering the Rite.
 */
export function isObtainable(def: CardDef): boolean {
  // A Rank 2 printing is not something you obtain — it is something you upgrade into, at
  // the forge, for Shards. Letting one into this predicate would put ascended cards in
  // reward rolls and on the Artificer's shelf, handing out for free the exact thing the
  // Ascension sink exists to charge for.
  if (isAscendedId(def.id)) return false;
  return !def.setupOnly && def.id !== 'rite_of_subjugation';
}

/**
 * A win offers a choice of cards. Drawn from what exists rather than what is owned, so
 * rewards can introduce a school the player has never played.
 */
export function rollRewards(rng: RngState, count = 3): string[] {
  const pool = Object.values(CARDS)
    .filter(isObtainable)
    .map((c) => c.id)
    .sort();

  const picks: string[] = [];
  const taken = new Set<string>();
  // Bounded so a shrinking pool cannot spin here.
  for (let guard = 0; guard < 200 && picks.length < count && taken.size < pool.length; guard++) {
    const id = pool[nextInt(rng, pool.length)]!;
    if (taken.has(id)) continue;
    taken.add(id);
    picks.push(id);
  }
  return picks;
}

/**
 * Repairs a collection loaded from disk: drops cards that no longer exist and restores
 * anything soulbound. A save from an older version must never leave the player stuck.
 */
export function reconcileCollection(collection: Collection): {
  collection: Collection;
  dropped: string[];
} {
  const owned: Record<string, number> = {};
  const dropped: string[] = [];

  for (const [id, count] of Object.entries(collection.owned)) {
    if (!CARDS[id]) {
      dropped.push(id);
      continue;
    }
    if (count > 0) owned[id] = count;
  }

  for (const id of SOULBOUND) {
    owned[id] = Math.max(owned[id] ?? 0, 3);
  }

  // An Ascension of a card that no longer has a Rank 2 printing is dropped rather than
  // carried: it would sit in the save forever, unreadable, and `printedId` would keep
  // asking for an id that is not in the registry.
  const upgradeable = new Set(ascendableIds());
  const ascended = [...new Set(collection.ascended ?? [])].filter((id) => upgradeable.has(id)).sort();

  return {
    collection: { owned, ...(ascended.length > 0 ? { ascended } : {}) },
    dropped,
  };
}
