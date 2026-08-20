/**
 * Deck construction rules (Draft 7 §10, Module 2 §7).
 *
 * A deck is 12–30 cards. How many copies of a card you may run depends on its **Tier**,
 * and the cap is tracked by *base card id* rather than by printed card, so a future
 * Ascension that upgrades a card to Rank 2 cannot double the cap by the back door.
 */

import type { CardDef } from '../types/cards.js';
import { cardCostTotal } from '../types/cards.js';
import { CARDS } from './cards/index.js';

/**
 * The Hero Deck: small, and yours.
 *
 * It was 12-30 when the deck was the whole spellbook. It is 5-15 now because it is only
 * *half* of one — the equipped Companion fuses eight fixed elemental spells in at the
 * bell (`GRIMOIRE_SIZE`), so a 15-card Hero Deck is really a 23-card deck by the time it
 * is shuffled. A small hand-built half beside a fixed elemental half is the whole point:
 * what you choose is the utility, and what you *catch* is the magic.
 */
export const MIN_DECK = 5;
export const MAX_DECK = 15;

/**
 * Schools a Hero Deck may hold.
 *
 * The elemental colour comes from the Companion now. A Hero Deck holding Pyre cards would
 * be competing with the Grimoire for the same job — and would let a player carry a second
 * school their Companion cannot support with a Resonance.
 */
export const HERO_SCHOOLS: readonly string[] = ['neutral', 'arcane'];
/** Module 2: no more than two Behemoths in a deck, at any size. */
export const MAX_BEHEMOTHS = 2;

/** Copies permitted, by Tier. */
export const TIER_COPY_LIMIT: Record<CardTier, number> = { 1: 3, 2: 2, 3: 1 };

export type CardTier = 1 | 2 | 3;

/**
 * A card's Tier.
 *
 * The source documents never tabulate this, so it is derived from what a card actually
 * does: Power Tier finishers and Behemoths are Tier 3, mid-cost cards Tier 2, and the
 * cheap staples Tier 1. Derived rather than hand-listed so a new card cannot be added
 * without a Tier, which would silently grant it an unlimited copy count.
 */
export function tierOf(def: CardDef): CardTier {
  if (def.keywords.includes('PowerTier')) return 3;
  if (def.unit?.footprint === 2) return 3;
  if (cardCostTotal(def.cost) >= 4) return 3;
  if (cardCostTotal(def.cost) >= 2) return 2;
  return 1;
}

/**
 * Cards you may change between seeing the arena and fighting in it.
 *
 * Small on purpose. Adapting to a narrow ruin or an open field should mean bringing the
 * two or three answers that shape needs, not rebuilding into a different deck once the
 * terrain is known — which would make the deck you built beforehand irrelevant.
 *
 * Cut from five to two when the Hero Deck shrank to 5-15. Five swaps against a thirty-card
 * deck was an adjustment; against a five-card one it was a rebuild, and the guard below
 * would have started failing rather than the design quietly going wrong.
 */
export const MAX_SWAPS = 2;

/**
 * How many cards differ between a deck and the one it started as.
 *
 * Counted as a multiset difference, taking the larger side, so that trading one card for
 * another costs one swap rather than two, and changing the deck's size costs what it
 * actually changes.
 */
export function swapCount(base: string[], candidate: string[]): number {
  const tally = new Map<string, number>();
  for (const id of base) tally.set(id, (tally.get(id) ?? 0) + 1);
  for (const id of candidate) tally.set(id, (tally.get(id) ?? 0) - 1);

  let removed = 0;
  let added = 0;
  for (const n of tally.values()) {
    if (n > 0) removed += n;
    else added -= n;
  }
  return Math.max(removed, added);
}

/** The base card a copy belongs to. Ranks share a base, so they share a cap. */
export function baseIdOf(cardId: string): string {
  return cardId.replace(/_r[23]$/, '');
}

export interface DeckProblem {
  /** Machine-readable so the UI can highlight the offending card. */
  code:
    | 'too_small'
    | 'too_large'
    | 'over_copy_limit'
    | 'too_many_behemoths'
    | 'not_unlocked'
    | 'unknown_card'
    /** A body in a spell deck. Minions are a Vanguard Roster now, not cards. */
    | 'minion_in_deck'
    /** An elemental card in the Hero half. That colour is the Companion's to bring. */
    | 'off_school';
  message: string;
  cardId?: string;
}

export interface Collection {
  /**
   * Every card this character has unlocked, by def id.
   *
   * A **set**, not a tally. Cards used to be physical copies you could run out of, which
   * meant the deck builder was arguing with the collection about the same number twice —
   * a Tier limit *and* an inventory count, both capping the same thing.
   *
   * Unlocking is permanent and one-way. Nothing in the game removes an entry: not a loss,
   * not a splice, not a wager. What a card costs is paid once, at the Forge, and what
   * bottlenecks a deck afterwards is the Tier limit alone.
   */
  unlocked: string[];
  /**
   * Base ids the player has Ascended, account-wide.
   *
   * Ascension is a property of knowing the card, not of one copy of it: paying three
   * Shards upgrades every copy in every deck at once. Stored as a set of base ids rather
   * than by rewriting deck lists to `_r2`, so a deck built before an Ascension keeps
   * working and nothing has to be migrated when the forge is used.
   */
  ascended?: string[];
}

/**
 * Validates a deck. Returns every problem rather than the first, so the builder can show
 * a complete list instead of making the player fix them one at a time.
 */
export function validateDeck(deck: string[], collection?: Collection): DeckProblem[] {
  const problems: DeckProblem[] = [];

  if (deck.length < MIN_DECK) {
    problems.push({
      code: 'too_small',
      message: `${deck.length} cards — the minimum is ${MIN_DECK}. Add ${MIN_DECK - deck.length} more.`,
    });
  }
  if (deck.length > MAX_DECK) {
    problems.push({
      code: 'too_large',
      message: `${deck.length} cards — the maximum is ${MAX_DECK}. Remove ${deck.length - MAX_DECK}.`,
    });
  }

  const byBase = new Map<string, number>();
  let behemoths = 0;

  for (const cardId of deck) {
    const def = CARDS[cardId];
    if (!def) {
      problems.push({
        code: 'unknown_card',
        cardId,
        message: `"${cardId}" is no longer a card in this version.`,
      });
      continue;
    }
    // A body in a spell deck. Asked *before* the school rule, because a minion is very
    // nearly always elemental too and "this belongs in your Vanguard" is the useful half
    // of that answer — being told a Grave Sentinel is the wrong colour would send the
    // player looking for a neutral one.
    if (def.kind === 'minion') {
      problems.push({
        code: 'minion_in_deck',
        cardId,
        message: `${def.name} belongs in your Vanguard Roster, not your deck.`,
      });
      continue;
    }
    // An elemental card in the Hero half. Checked before the copy limits so a deck full
    // of Pyre is told the one thing that matters rather than a list of tier violations.
    if (!HERO_SCHOOLS.includes(def.school)) {
      problems.push({
        code: 'off_school',
        cardId,
        message: `${def.name} is ${def.school} — your Companion brings the elements.`,
      });
      continue;
    }
    const base = baseIdOf(cardId);
    byBase.set(base, (byBase.get(base) ?? 0) + 1);
    if (def.unit?.footprint === 2) behemoths += 1;
  }

  for (const [base, count] of byBase) {
    const def = CARDS[base];
    if (!def) continue;
    const limit = TIER_COPY_LIMIT[tierOf(def)];
    if (count > limit) {
      problems.push({
        code: 'over_copy_limit',
        cardId: base,
        message: `${count}× ${def.name} — Tier ${tierOf(def)} allows ${limit}.`,
      });
    }
    if (collection) {
      // Unlocked or not — never "how many". The Tier limit above is the only thing that
      // caps copies now, which is what stops the builder arguing with the collection about
      // the same number twice.
      if (!collection.unlocked.includes(base)) {
        problems.push({
          code: 'not_unlocked',
          cardId: base,
          message: `${def.name} is not forged yet.`,
        });
      }
    }
  }

  if (behemoths > MAX_BEHEMOTHS) {
    problems.push({
      code: 'too_many_behemoths',
      message: `${behemoths} Behemoths — a deck may hold at most ${MAX_BEHEMOTHS}.`,
    });
  }

  return problems;
}

export function isLegalDeck(deck: string[], collection?: Collection): boolean {
  return validateDeck(deck, collection).length === 0;
}

/** How many more copies of a card the deck could still take. */
export function remainingCopies(
  deck: string[],
  cardId: string,
  collection?: Collection,
): number {
  const def = CARDS[cardId];
  if (!def) return 0;
  const base = baseIdOf(cardId);
  const inDeck = deck.filter((c) => baseIdOf(c) === base).length;
  const byTier = TIER_COPY_LIMIT[tierOf(def)] - inDeck;
  // Locked cards offer nothing; unlocked ones are limited by the Tier alone. A count
  // here would be the copy model surviving inside a boolean question.
  const byOwnership = !collection || collection.unlocked.includes(base) ? Infinity : 0;
  const byBehemoth =
    def.unit?.footprint === 2
      ? MAX_BEHEMOTHS - deck.filter((c) => CARDS[c]?.unit?.footprint === 2).length
      : Infinity;
  const bySize = MAX_DECK - deck.length;
  return Math.max(0, Math.min(byTier, byOwnership, byBehemoth, bySize));
}

/** Pip-cost histogram, for the builder's curve display. */
export function costCurve(deck: string[]): number[] {
  const curve = new Array(7).fill(0) as number[];
  for (const id of deck) {
    const def = CARDS[id];
    if (!def) continue;
    curve[Math.min(cardCostTotal(def.cost), curve.length - 1)] += 1;
  }
  return curve;
}
