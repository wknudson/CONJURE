/**
 * Deck construction rules (Draft 7 §10, Module 2 §7).
 *
 * A deck is 12–30 cards. How many copies of a card you may run depends on its **Tier**,
 * and the cap is tracked by *base card id* rather than by printed card, so a future
 * Ascension that upgrades a card to Rank 2 cannot double the cap by the back door.
 */

import type { CardDef, CardKind } from '../types/cards.js';
import { cardCostTotal } from '../types/cards.js';
import { CARDS } from './cards/index.js';
import { GRIMOIRE_SIZE } from './companions.js';

/**
 * The Hero Deck: small, and yours.
 *
 * It was 12-30 when the deck was the whole spellbook, and 5-15 when the Companion first
 * started fusing its own half in. It is **4-12** now, and the tightening is the point: a
 * 12-card Hero half plus the beast's eight is a 20-card deck, small enough that every
 * card in it is a card you meet, and every card you cut is a card you miss.
 *
 * What you choose is the utility. What you *catch* is the magic.
 */
export const MIN_DECK = 4;
export const MAX_DECK = 12;

/**
 * What the fused deck actually holds, once the beast has shuffled its eight in.
 *
 * Derived rather than restated, so the two halves can never disagree about the whole.
 */
export function fusedDeckSize(heroCards: number): number {
  return heroCards + GRIMOIRE_SIZE;
}

/**
 * What a Hero Deck may hold, by role.
 *
 * The Hero lays **Marks**, plays **Abilities** and raises **Constructs**. The Companion
 * casts the Spells and the Vanguard fields the bodies, and neither of those is a card the
 * Hero's half can contain.
 *
 * A list rather than a pair of negations, so the rule reads the way the player was told
 * it: these three, and the validator refuses everything else by not finding it here.
 */
export const HERO_KINDS: readonly CardKind[] = ['ability', 'mark', 'obstacle'];

/**
 * Schools a Hero Deck may hold.
 *
 * The elemental colour comes from the Companion now. A Hero Deck holding Pyre cards would
 * be competing with the Grimoire for the same job — and would let a player carry a second
 * school their Companion cannot support with a Resonance.
 *
 * **Marks are exempt** — see `validateDeck`. A Mark is a Hero card whose *payload* may be
 * any colour at all, and judging the card by the element it detonates for would refuse the
 * Hero their own trap.
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
 * Cut from five to two when the Hero Deck shrank to 5-15, and from two to **one** when it
 * shrank again to 4-12. Five swaps against a thirty-card deck was an adjustment; two
 * against a four-card one is half the deck, which is not adapting to a narrow ruin — it is
 * building a second deck once the ruin is known.
 *
 * One answer, brought for the terrain. That is a real decision and it cannot rebuild
 * anything.
 */
export const MAX_SWAPS = 1;

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

/**
 * Why this card can never sit in a Hero Deck, or `null` if it may.
 *
 * One rule with three readers: `validateDeck` turns it into a problem, `remainingCopies`
 * turns it into a disabled card in the case, and the Field Journal turns it into the
 * sentence on the tooltip. Before this existed the first two disagreed — the shelf let you
 * click a Spell and the validator then refused the deck you had just built, which is the
 * builder arguing with itself about a rule it holds twice.
 *
 * Order matters and is the same order the messages are useful in: what the card *is* comes
 * before what colour it is, because a Spell is elemental by construction and "wrong colour"
 * would send the player hunting for an arcane Flame Surge.
 */
export type RoleRefusal = 'minion' | 'spell' | 'off_school' | null;

export function deckRoleRefusal(def: CardDef): RoleRefusal {
  if (def.kind === 'minion') return 'minion';
  if (def.kind === 'spell') return 'spell';
  // Belt for a sixth kind nobody has taught this function about yet.
  if (!HERO_KINDS.includes(def.kind)) return 'minion';
  // Marks are exempt: a Mark is the Hero's by `kind`, and its school describes the payload
  // it detonates for rather than whose half of the deck it belongs to.
  if (def.kind !== 'mark' && !HERO_SCHOOLS.includes(def.school)) return 'off_school';
  return null;
}

/** The refusal in the player's words. Shared by the validator and every tooltip. */
export function roleRefusalMessage(def: CardDef, why: Exclude<RoleRefusal, null>): string {
  switch (why) {
    case 'minion':
      return `${def.name} belongs in your Vanguard Roster, not your deck.`;
    case 'spell':
      return `${def.name} is a Spell — your Companion casts those. Your half holds Abilities, Marks and Constructs.`;
    case 'off_school':
      return `${def.name} is ${def.school} — your Companion brings the elements.`;
  }
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
    /** Elemental magic in the Hero half. Spells are the Companion's, and only the Companion's. */
    | 'spell_in_deck'
    /** An elemental card in the Hero half. That colour is the Companion's to bring. */
    | 'off_school';
  message: string;
  cardId?: string;
}

/** Which problem code each refusal reports as. The UI highlights on the code. */
const ROLE_PROBLEM_CODE: Record<Exclude<RoleRefusal, null>, DeckProblem['code']> = {
  minion: 'minion_in_deck',
  spell: 'spell_in_deck',
  off_school: 'off_school',
};

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
    // Role before copies, so a deck full of Spells is told the one thing that matters
    // rather than a list of tier violations underneath it.
    const refusal = deckRoleRefusal(def);
    if (refusal) {
      problems.push({
        code: ROLE_PROBLEM_CODE[refusal],
        cardId,
        message: roleRefusalMessage(def, refusal),
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
  // A card the deck may never hold has no copies remaining — not "one fewer than the tier
  // allows". This is what stops the case offering a Spell the validator will then refuse.
  if (deckRoleRefusal(def)) return 0;
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
