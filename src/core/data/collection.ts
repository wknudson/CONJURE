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
import { CARDS } from './cards/index.js';
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

export function grantCard(collection: Collection, cardId: string): Collection {
  if (!CARDS[cardId]) return collection;
  return { owned: { ...collection.owned, [cardId]: (collection.owned[cardId] ?? 0) + 1 } };
}

/**
 * Whether a card is something a player can come to own at all.
 *
 * Setup-only stat blocks are placed by the engine and are not cards anyone can hold; the
 * Rite is injected by the Trial itself. One predicate rather than one filter per caller —
 * the reward roller and the Artificer's blueprint list have to agree about this, and the
 * last time the rule lived in two places, a rename left one of them offering the Rite.
 */
export function isObtainable(def: CardDef): boolean {
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

  return { collection: { owned }, dropped };
}
