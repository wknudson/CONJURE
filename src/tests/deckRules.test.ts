import { describe, expect, it } from 'vitest';
import {
  MAX_BEHEMOTHS,
  MAX_DECK,
  MAX_SWAPS,
  MIN_DECK,
  swapCount,
  TIER_COPY_LIMIT,
  baseIdOf,
  costCurve,
  isLegalDeck,
  remainingCopies,
  tierOf,
  validateDeck,
} from '../core/data/deckRules.js';
import {
  SOULBOUND,
  grantCard,
  reconcileCollection,
  rollRewards,
  startingCollection,
} from '../core/data/collection.js';
import { CARDS } from '../core/data/cards/index.js';
import { COMPANIONS } from '../core/data/companions.js';
import { makeRng } from '../core/util/rng.js';

/** A legal filler deck of N copies drawn from cheap Tier 1 staples. */
function fillerDeck(size: number): string[] {
  const staples = ['scout_imp', 'marrow_wisp', 'shield_bash', 'aegis_ward', 'stone_barricade'];
  const out: string[] = [];
  let i = 0;
  while (out.length < size) {
    const card = staples[i % staples.length]!;
    if (out.filter((c) => c === card).length < 3) out.push(card);
    i++;
    if (i > 500) break;
  }
  return out;
}

describe('deck size', () => {
  it('rejects a deck below the minimum, and says how many are missing', () => {
    const problems = validateDeck(fillerDeck(MIN_DECK - 2));
    expect(problems.map((p) => p.code)).toContain('too_small');
    expect(problems[0]?.message).toMatch(/Add 2 more/);
  });

  it('rejects a deck above the maximum', () => {
    const deck = Array.from({ length: MAX_DECK + 1 }, () => 'scout_imp');
    expect(validateDeck(deck).map((p) => p.code)).toContain('too_large');
  });

  it('accepts a deck at each boundary', () => {
    expect(isLegalDeck(fillerDeck(MIN_DECK))).toBe(true);
    expect(isLegalDeck(fillerDeck(MAX_DECK))).toBe(true);
  });
});

describe('copy limits by tier', () => {
  it('assigns Power Tier and Behemoth cards to Tier 3', () => {
    expect(tierOf(CARDS.cataclysmic_core!)).toBe(3);
    expect(tierOf(CARDS.magma_brute!)).toBe(3);
    expect(TIER_COPY_LIMIT[3]).toBe(1);
  });

  it('caps Tier 1 staples at three and Tier 2 at two', () => {
    expect(tierOf(CARDS.scout_imp!)).toBe(1);
    expect(tierOf(CARDS.grave_sentinel!)).toBe(2);

    const tooMany = [...fillerDeck(MIN_DECK), 'grave_sentinel', 'grave_sentinel', 'grave_sentinel'];
    const problems = validateDeck(tooMany);
    expect(problems.some((p) => p.code === 'over_copy_limit' && p.cardId === 'grave_sentinel')).toBe(true);
  });

  it('counts ranks of the same card against one shared cap', () => {
    // Ascension will print rank-2 variants; they must not double the allowance.
    expect(baseIdOf('scout_imp_r2')).toBe('scout_imp');
    expect(baseIdOf('scout_imp')).toBe('scout_imp');
  });

  it('reports how many more copies a deck can take', () => {
    const deck = ['scout_imp', 'scout_imp'];
    expect(remainingCopies(deck, 'scout_imp')).toBe(1);
    expect(remainingCopies([...deck, 'scout_imp'], 'scout_imp')).toBe(0);
  });
});

describe('behemoth limit', () => {
  it('allows two and refuses three', () => {
    const two = [...fillerDeck(MIN_DECK), 'magma_brute', 'magma_brute'];
    // Two Behemoths breaks the Tier 3 single-copy rule, but not the Behemoth rule.
    expect(validateDeck(two).some((p) => p.code === 'too_many_behemoths')).toBe(false);

    const three = [...fillerDeck(MIN_DECK), 'magma_brute', 'magma_brute', 'magma_brute'];
    expect(validateDeck(three).some((p) => p.code === 'too_many_behemoths')).toBe(true);
    expect(MAX_BEHEMOTHS).toBe(2);
  });
});

describe('ownership', () => {
  it('refuses cards the player does not own', () => {
    const collection = { owned: { scout_imp: 1 } };
    const deck = [...fillerDeck(MIN_DECK)];
    const problems = validateDeck(deck, collection);
    expect(problems.some((p) => p.code === 'not_owned')).toBe(true);
  });

  it('ignores ownership when no collection is supplied', () => {
    expect(isLegalDeck(fillerDeck(MIN_DECK))).toBe(true);
  });

  it('starts a player able to build a legal deck for every companion', () => {
    const collection = startingCollection();
    for (const companion of COMPANIONS) {
      const problems = validateDeck(companion.deck, collection);
      expect(problems.map((p) => p.message).join('; '), companion.name).toBe('');
    }
  });
});

describe('collection', () => {
  it('never lets a soulbound staple be lost', () => {
    // Even a save that zeroes them out must come back able to build a deck.
    const stripped = { owned: { scout_imp: 0 } };
    const { collection } = reconcileCollection(stripped);
    for (const id of SOULBOUND) {
      expect(collection.owned[id] ?? 0, id).toBeGreaterThan(0);
    }
  });

  it('drops cards that no longer exist and reports them', () => {
    // flame_surge is not soulbound, so its count passes through untouched — unlike a
    // staple, which would be floored back up to its full allowance.
    const stale = { owned: { flame_surge: 2, a_card_from_a_past_patch: 3 } };
    const { collection, dropped } = reconcileCollection(stale);
    expect(dropped).toContain('a_card_from_a_past_patch');
    expect(collection.owned.a_card_from_a_past_patch).toBeUndefined();
    expect(collection.owned.flame_surge).toBe(2);
  });

  it('grants a card without mutating the original collection', () => {
    const before = startingCollection();
    const beforeCount = before.owned.flame_surge ?? 0;
    const after = grantCard(before, 'flame_surge');
    expect(after.owned.flame_surge).toBe(beforeCount + 1);
    expect(before.owned.flame_surge ?? 0).toBe(beforeCount);
  });

  it('ignores a grant of a card that does not exist', () => {
    const before = startingCollection();
    expect(grantCard(before, 'not_a_card')).toBe(before);
  });

  it('offers distinct, real rewards deterministically from a seed', () => {
    const a = rollRewards(makeRng(7), 3);
    const b = rollRewards(makeRng(7), 3);
    expect(a).toEqual(b);
    expect(new Set(a).size).toBe(a.length);
    for (const id of a) expect(CARDS[id], id).toBeDefined();
    // The Rite is encounter-generated and must never be a reward.
    expect(a).not.toContain('rite_of_subjugation');
  });
});

describe('cost curve', () => {
  it('buckets a deck by pip cost', () => {
    const curve = costCurve(['dark_tithe', 'scout_imp', 'scout_imp', 'grave_sentinel']);
    expect(curve[0]).toBe(1); // Dark Tithe is free
    expect(curve[1]).toBe(2);
    expect(curve[2]).toBe(1);
  });
});

describe('pre-combat swaps', () => {
  const base = ['scout_imp', 'scout_imp', 'flame_surge', 'aegis_ward'];

  it('counts an unchanged deck as no swaps at all', () => {
    expect(swapCount(base, [...base])).toBe(0);
    // Order is not a change: a deck is a multiset.
    expect(swapCount(base, [...base].reverse())).toBe(0);
  });

  it('charges one swap for a card traded one-for-one', () => {
    expect(swapCount(base, ['scout_imp', 'scout_imp', 'glacial_spike', 'aegis_ward'])).toBe(1);
  });

  it('charges by the larger side, not both', () => {
    // Two out and two in is two swaps, not four.
    expect(
      swapCount(base, ['glacial_spike', 'frost_nova', 'flame_surge', 'aegis_ward']),
    ).toBe(2);
  });

  it('charges for changing the deck size', () => {
    expect(swapCount(base, [...base, 'frost_nova'])).toBe(1);
    expect(swapCount(base, base.slice(0, 2))).toBe(2);
  });

  it('counts duplicates individually', () => {
    expect(swapCount(base, ['scout_imp', 'flame_surge', 'aegis_ward', 'frost_nova'])).toBe(1);
  });

  it('keeps the budget small enough that the built deck still matters', () => {
    // A guard on the design, not the code: a budget approaching deck size would make
    // pre-combat adaptation into pre-combat deck building.
    expect(MAX_SWAPS).toBeLessThan(MIN_DECK / 2);
  });
});
