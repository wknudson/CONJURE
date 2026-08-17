/**
 * Deck construction rules (Draft 7 §10, Module 2 §7).
 *
 * A deck is 12–30 cards. How many copies of a card you may run depends on its **Tier**,
 * and the cap is tracked by *base card id* rather than by printed card, so a future
 * Ascension that upgrades a card to Rank 2 cannot double the cap by the back door.
 */

import type { CardDef } from '../types/cards.js';
import { CARDS } from './cards/index.js';

export const MIN_DECK = 12;
export const MAX_DECK = 30;
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
  if (def.cost >= 4) return 3;
  if (def.cost >= 2) return 2;
  return 1;
}

/** The base card a copy belongs to. Ranks share a base, so they share a cap. */
export function baseIdOf(cardId: string): string {
  return cardId.replace(/_r[23]$/, '');
}

export interface DeckProblem {
  /** Machine-readable so the UI can highlight the offending card. */
  code: 'too_small' | 'too_large' | 'over_copy_limit' | 'too_many_behemoths' | 'not_owned' | 'unknown_card';
  message: string;
  cardId?: string;
}

export interface Collection {
  /** Copies owned, by card id. */
  owned: Record<string, number>;
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
      const owned = collection.owned[base] ?? 0;
      if (count > owned) {
        problems.push({
          code: 'not_owned',
          cardId: base,
          message: `${count}× ${def.name} but you own ${owned}.`,
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
  const byOwnership = collection ? (collection.owned[base] ?? 0) - inDeck : Infinity;
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
    curve[Math.min(def.cost, curve.length - 1)] += 1;
  }
  return curve;
}
