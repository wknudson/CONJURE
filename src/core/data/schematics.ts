/**
 * Schematics: the only way a card enters a collection.
 *
 * A win used to hand over the card itself. That made the Artificer's first trade a
 * formality — the bench would cut anything you had not already got, so the shelf was the
 * whole catalogue and Ducats were the only gate. Two routes to the same place, and the
 * free one was strictly better.
 *
 * There is one route now, and it has two halves:
 *
 * 1. **Beat something and take the plan off it.** A fight offers a choice of Schematics
 *    drawn from the deck it just played against you.
 * 2. **Pay the Artificer to cut it.** The Schematic is permission; the Ducats are the
 *    price. Neither half is enough on its own.
 *
 * What a loss costs is still money and time, never possessions — nothing here takes a
 * Schematic away, and a fight you lose simply offers none.
 */

import type { CardDef } from '../types/cards.js';
import type { EncounterDef } from './encounters/registry.js';
import type { Collection } from './deckRules.js';
import type { BountyDifficulty } from './bounties.js';
import type { RngState } from '../util/rng.js';
import { nextInt } from '../util/rng.js';
import { CARDS } from './cards/index.js';
import { isObtainable } from './collection.js';
import { tierOfEncounter } from './bounties.js';

/**
 * How many Schematics a win lays out to choose between, by tier.
 *
 * You take **one**. The number is how wide the choice is, not how much you get, so a
 * Master contract is not four times the pay — it is a decision with four ways to go
 * wrong, which is the thing a boss should be selling.
 *
 * Two at Novice rather than one, because one is not an offer.
 */
export const SCHEMATIC_PICKS: Record<BountyDifficulty, number> = {
  novice: 2,
  adept: 3,
  master: 4,
};

/**
 * Everything a given fight could teach you, derived from the deck it fights with.
 *
 * **Derived, never authored.** The alternative was a `blueprintPool` field on
 * `EncounterDef`, and that is a second list of what an encounter contains — it would be
 * correct on the day it was written and wrong the first time somebody retuned an enemy
 * deck without scrolling down. Reading `enemyDeck` means a fight teaches what it actually
 * beat you with, and a new encounter has a pool by existing.
 *
 * Filtered through `isObtainable`, which is the same predicate the bench's shelf uses, so
 * a fight can never offer a plan for the Rite, a Rank 2 printing, a spliced Hybrid or a
 * body. Deduped and sorted, because an enemy deck holding three Flame Surges is one thing
 * to learn and because a pool ordered by deck-list order would shuffle every offer the day
 * somebody reordered a card list.
 */
export function schematicPool(encounter: EncounterDef): CardDef[] {
  const seen = new Set<string>();
  const out: CardDef[] = [];
  for (const id of encounter.enemyDeck) {
    if (seen.has(id)) continue;
    seen.add(id);
    const def = CARDS[id];
    if (def && isObtainable(def)) out.push(def);
  }
  return out.sort((a, b) => a.id.localeCompare(b.id));
}

/**
 * What this win lays on the table.
 *
 * Excludes anything already forged **and** anything already held as a Schematic, so an
 * offer is never a card the player cannot use — a duplicate plan is a reward that does
 * nothing, and the second time it happens it reads as the game being broken rather than as
 * a run of bad luck.
 *
 * A pool with nothing left to give returns empty, and the screens draw nothing rather than
 * an empty frame. That is the correct end state for a fight you have wrung dry: it still
 * pays Ducats and Cores, it simply has no more to teach.
 *
 * Seeded, like every other roll in this project, so the same win offers the same three
 * however many times the screen is rebuilt.
 */
export function rollSchematicOffer(
  rng: RngState,
  encounter: EncounterDef,
  collection: Collection,
  held: readonly string[],
  count = SCHEMATIC_PICKS[tierOfEncounter(encounter.id)],
): string[] {
  const available = schematicPool(encounter)
    .map((d) => d.id)
    .filter((id) => !collection.unlocked.includes(id) && !held.includes(id));

  // Draw without replacement out of a copy, rather than picking-and-retrying against a
  // `taken` set. A retry loop spends most of its attempts re-drawing the same handful once
  // a pool is nearly exhausted, which is exactly the state this pool is in late in a save.
  const bag = [...available];
  const picks: string[] = [];
  while (picks.length < count && bag.length > 0) {
    picks.push(bag.splice(nextInt(rng, bag.length), 1)[0]!);
  }
  return picks.sort();
}

/**
 * Adds a Schematic to what a character holds. Idempotent.
 *
 * Held ids rather than a count: a Schematic is permission to cut a card, and cutting it
 * unlocks the card **permanently**. A second copy of the same plan would be permission you
 * already have, which is why `rollSchematicOffer` refuses to offer one in the first place.
 */
export function grantSchematic(held: readonly string[], cardId: string): string[] {
  if (!CARDS[cardId]) return [...held];
  if (held.includes(cardId)) return [...held];
  return [...held, cardId].sort();
}
