/**
 * What the player owns, and how it grows.
 *
 * The bankruptcy soft-lock is resolved by making the baseline Hero cards
 * **permanent soulbound assets** — they can never leave the collection. That rule is
 * enforced here in the model rather than by hiding a button, so no future wager, sale,
 * or corrupted save can strand a player without a legal deck.
 */

import type { Collection } from './deckRules.js';
import type { CardDef } from '../types/cards.js';
import { CARDS, ascendableIds, ascendedId, isAscendedId } from './cards/index.js';
import { COMPANIONS } from './companions.js';

/**
 * The Hero's arcane baseline, handed to every new character.
 *
 * Seeded but *not* soulbound: the un-loseable core exists to guarantee a legal 12-card
 * deck exists no matter what a player does, and eight cards already does that. Adding
 * four more would make the guarantee no stronger and the collection four cards less
 * yours to spend.
 */
export const ARCANE_BASELINE: readonly string[] = [
  'grapple_line',
  'scrap_phalanx',
  'cull_the_weak',
  'alchemists_barricade',
];

/**
 * Cards the player can never lose. Enough on their own to build a legal deck.
 *
 * Half of this list used to be bodies, and bodies are a Vanguard Roster now — which broke
 * the promise in the sentence above twice over. A deck cannot hold them, so the eight no
 * longer built anything; and because `reconcileCollection` tops this list up on every
 * load, it is also the only thing that hands an existing save a card the game did not
 * ship with. The four minions are replaced by the Aura line, which is both what the
 * starter deck now needs and what an old save would otherwise never be granted.
 */
export const SOULBOUND: readonly string[] = [
  'ember_coat',
  'cataclysm',
  'marrow_siphon',
  'marrow_burst',
  'dark_tithe',
  'shield_bash',
  'stone_barricade',
  'aegis_ward',
];

/** A new player's collection: every companion's starting deck, pooled. */
export function startingCollection(): Collection {
  const unlocked = new Set<string>();

  // The Hero Deck once, not once per Companion.
  //
  // Every species hands over the same one now — the elemental half moved into the
  // Grimoire, which is innate and never enters the collection at all. Pooling seven
  // identical lists granted seven copies of every staple and blew straight past the Tier
  // caps, which is the bug this loop had the moment the decks converged.
  const heroDeck = COMPANIONS[0]?.deck ?? [];
  for (const id of heroDeck) unlocked.add(id);

  // The soulbound staples, so a fresh player can always assemble a legal deck whichever
  // Companion they pick. No count any more: an unlock is an unlock, and how many copies
  // may go in a deck is the Tier limit's business rather than the collection's.
  for (const id of SOULBOUND) unlocked.add(id);

  // A marksman and a mortar to start with. Both reward reading the ground rather than
  // out-statting it, which is the lesson the pre-combat arena preview is asking players
  // to learn — and neither is in a companion deck, so they would otherwise be invisible
  // until a reward roll happened to offer one.
  for (const id of ['longshot_stalker', 'cinder_lobber']) unlocked.add(id);

  // The Hero's own arcane baseline. Two copies rather than the full Tier allowance: enough
  // to build around, not so many that the deck builds itself. These are the Hero's half of
  // the pairing — a wall, a construct, a hook, and a finisher, none of which belong to a
  // Companion — so without seeding them a new character would meet their own school only
  // when a reward roll happened to offer it.
  for (const id of ARCANE_BASELINE) unlocked.add(id);

  return { unlocked: [...unlocked].sort() };
}

/**
 * Whether this character may put the card in a deck at all.
 *
 * Replaced `ownedCount`, which every caller but two was already reducing to `> 0`. The
 * two that were not — the deck's ownership cap and the Artificer's "×3" chip — were the
 * two places the copy model was actually visible, and both are gone with it.
 */
export function isUnlocked(collection: Collection, cardId: string): boolean {
  return collection.unlocked.includes(cardId);
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
  return printedWith(collection.ascended ?? [], cardId);
}

/**
 * The same rule, against a bare list of ascended base ids.
 *
 * The Companion's half of the deck is resolved inside the combat reducer — the sockets are
 * applied there, so the printing has to be too — and the reducer has never heard of a
 * `Collection`. It is handed the list instead, exactly as it is handed a list of Vanguard
 * levels rather than a Profile.
 *
 * One definition, asked twice. Two readings of "which printing is this" is how the Hero
 * half of a deck comes to arrive at Rank 2 while the Companion half arrives at Rank 1 --
 * which is precisely the bug this exists to have fixed.
 */
export function printedWith(ascended: readonly string[], cardId: string): string {
  return ascended.includes(cardId) && CARDS[ascendedId(cardId)] ? ascendedId(cardId) : cardId;
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
    (id) => isUnlocked(collection, id) && !isAscended(collection, id),
  );
}

/**
 * Unlocks a card. Idempotent — granting one twice is granting it once.
 *
 * Spreads the whole collection rather than rebuilding it field by field, which is how
 * claiming a reward card once silently erased every Ascension the player had paid for.
 */
export function grantCard(collection: Collection, cardId: string): Collection {
  if (!CARDS[cardId]) return collection;
  if (collection.unlocked.includes(cardId)) return collection;
  return { ...collection, unlocked: [...collection.unlocked, cardId].sort() };
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
  if (isEngineDealt(def)) return false;
  // A Rank 2 printing is not something you obtain — it is something you upgrade into, at
  // the forge, for Shards. Letting one into this predicate would put ascended cards in
  // reward rolls and on the Artificer's shelf, handing out for free the exact thing the
  // Ascension sink exists to charge for.
  if (isAscendedId(def.id)) return false;
  // Hybrids are the splicing bench's product, and free access to a sink's output is the
  // sink not existing.
  if (def.spliceOnly) return false;
  // Minions are no longer cards you own copies of. They are fielded from the Vanguard
  // Roster, which is a point-buy over what you have *unlocked* — so a minion in a reward
  // roll or on the Artificer's shelf would be selling something the deck cannot hold.
  if (def.kind === 'minion') return false;
  return true;
}

/**
 * Cards the engine deals for itself, which nobody may otherwise come by.
 *
 * Split out of `isObtainable` because the Grimoire draft needs the same exclusion for a
 * different reason: a Companion may draft a *Hybrid*, which `isObtainable` refuses, but it
 * must never draft the Rite. The last time this rule lived in two places a rename left one
 * of them offering the Rite, so it lives in one and is asked twice.
 */
export function isEngineDealt(def: CardDef): boolean {
  return Boolean(def.setupOnly) || def.id === 'rite_of_subjugation';
}

/*
 * `rollRewards` used to live here: a win drew three cards from the whole catalogue and
 * handed one over free. It is gone, and its absence is the point.
 *
 * A card enters a collection through exactly one door now — a Schematic taken off
 * something you beat, then Ducats paid at the Artificer to cut it. See `data/schematics.ts`
 * for the first half and `overworld/forge.ts` for the second. Two routes to the same place,
 * where one of them was free, is the shape this removed.
 */

/**
 * Repairs a collection loaded from disk: drops cards that no longer exist and restores
 * anything soulbound. A save from an older version must never leave the player stuck.
 */
export function reconcileCollection(collection: Collection): {
  collection: Collection;
  dropped: string[];
} {
  const unlocked = new Set<string>();
  const dropped: string[] = [];

  for (const id of collection.unlocked) {
    if (!CARDS[id]) {
      dropped.push(id);
      continue;
    }
    unlocked.add(id);
  }

  for (const id of SOULBOUND) unlocked.add(id);

  // An Ascension of a card that no longer has a Rank 2 printing is dropped rather than
  // carried: it would sit in the save forever, unreadable, and `printedId` would keep
  // asking for an id that is not in the registry.
  const upgradeable = new Set(ascendableIds());
  const ascended = [...new Set(collection.ascended ?? [])].filter((id) => upgradeable.has(id)).sort();

  return {
    collection: { unlocked: [...unlocked].sort(), ...(ascended.length > 0 ? { ascended } : {}) },
    dropped,
  };
}
