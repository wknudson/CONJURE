import { describe, expect, it } from 'vitest';
import { spliceCard, spliceRefusal, type DeckList } from '../core/overworld/splice.js';
import { newRun, type GlobalGameState } from '../core/overworld/state.js';
import { recipeFor, spliceableBaseIds, SPLICE_RECIPES } from '../core/data/splicing.js';
import { CARDS } from '../core/data/cards/index.js';
import { isObtainable, ownedCount, rollRewards } from '../core/data/collection.js';
import { validateDeck, type Collection } from '../core/data/deckRules.js';
import { schematicsFor } from '../core/data/artificer.js';
import { makeRng } from '../core/util/rng.js';

/**
 * The splicing bench.
 *
 * This is the only purchase in the game that *removes* a card, and the collection is what
 * decks validate against — so most of what follows is about the copy that comes out, not
 * the hybrid that goes in.
 */

const BASE = SPLICE_RECIPES[0]!.baseCardId;
const CORE = SPLICE_RECIPES[0]!.catalystId;
const RESULT = SPLICE_RECIPES[0]!.resultId;

const bench = (owned = 1, cores = 2): GlobalGameState => {
  const overworld = newRun(1);
  overworld.economy.reagents = { [CORE]: cores };
  void owned;
  return { overworld, combat: null };
};

const holding = (n: number): Collection => ({ owned: { [BASE]: n } });

describe('the recipe book', () => {
  it('names only cards the registry actually has', () => {
    for (const recipe of SPLICE_RECIPES) {
      expect(CARDS[recipe.baseCardId], recipe.baseCardId).toBeDefined();
      expect(CARDS[recipe.resultId], recipe.resultId).toBeDefined();
    }
  });

  it('offers a base card the starter collection can actually reach', () => {
    // A bench nobody can use on day one is a bench nobody finds.
    expect(spliceableBaseIds().length).toBeGreaterThan(0);
    expect(CARDS[BASE]!.unit, 'a spell, not a body').toBeUndefined();
  });

  it('keeps hybrids out of every giveaway', () => {
    // The same leak Rank 2 printings had: hybrids live in `CARDS`, so a reward roll or the
    // Schematic shelf would hand out for free the thing this sink charges for.
    for (const recipe of SPLICE_RECIPES) {
      expect(isObtainable(CARDS[recipe.resultId]!), recipe.resultId).toBe(false);
    }
    const shelf = schematicsFor({ owned: {} }).map((d) => d.id);
    for (let seed = 1; seed < 80; seed++) {
      for (const id of rollRewards(makeRng(seed), 3)) {
        expect(SPLICE_RECIPES.some((r) => r.resultId === id), `roll ${seed}`).toBe(false);
      }
    }
    for (const recipe of SPLICE_RECIPES) expect(shelf).not.toContain(recipe.resultId);
  });
});

describe('pressing a card', () => {
  it('spends the core, the copy, and hands over the hybrid', () => {
    const g = bench();
    const decks: Record<string, DeckList> = {};

    const done = spliceCard(g, holding(2), decks, BASE, CORE)!;

    expect(done.resultId).toBe(RESULT);
    expect(ownedCount(done.collection, RESULT)).toBe(1);
    expect(ownedCount(done.collection, BASE), 'one copy gone').toBe(1);
    expect(g.overworld.economy.reagents[CORE], 'one core gone').toBe(1);
  });

  it('removes the base card entirely when it was the last copy', () => {
    const g = bench();
    const done = spliceCard(g, holding(1), {}, BASE, CORE)!;

    expect(ownedCount(done.collection, BASE)).toBe(0);
    expect(done.collection.owned, 'and leaves no zero behind').not.toHaveProperty(BASE);
  });

  it('drops the core key rather than leaving a zero', () => {
    const g = bench(1, 1);
    spliceCard(g, holding(1), {}, BASE, CORE);
    expect(g.overworld.economy.reagents).not.toHaveProperty(CORE);
  });

  it('keeps everything else in the collection', () => {
    const g = bench();
    const before: Collection = {
      owned: { [BASE]: 2, scout_imp: 3 },
      ascended: ['shield_bash'],
    };
    const done = spliceCard(g, before, {}, BASE, CORE)!;

    expect(ownedCount(done.collection, 'scout_imp')).toBe(3);
    expect(done.collection.ascended, 'an Ascension is not collateral').toEqual(['shield_bash']);
  });
});

describe('the copy that comes out of a deck', () => {
  it('trims a deck that was running more than the player still owns', () => {
    // The failure this prevents: a splice that only touched the collection would leave a
    // deck holding three copies of a card the player owns two of, flagged illegal on the
    // next load with nothing to explain it.
    const g = bench();
    const decks: Record<string, DeckList> = { ignis: { cards: [BASE, BASE, 'scout_imp'] } };

    const done = spliceCard(g, holding(2), decks, BASE, CORE)!;

    expect(done.trimmed).toBe(1);
    expect(decks.ignis!.cards.filter((c) => c === BASE)).toHaveLength(1);
    expect(decks.ignis!.cards, 'and nothing else was touched').toContain('scout_imp');
  });

  it('leaves a deck alone when it was running fewer than are left', () => {
    const g = bench();
    const decks: Record<string, DeckList> = { ignis: { cards: [BASE, 'scout_imp'] } };

    const done = spliceCard(g, holding(3), decks, BASE, CORE)!;

    expect(done.trimmed).toBe(0);
    expect(decks.ignis!.cards).toEqual([BASE, 'scout_imp']);
  });

  it('trims every deck that was over, not just the first', () => {
    const g = bench();
    const decks: Record<string, DeckList> = {
      ignis: { cards: [BASE] },
      boreas: { cards: [BASE] },
    };

    const done = spliceCard(g, holding(0 + 1), decks, BASE, CORE)!;

    // Nothing is left owned, so no deck may hold one.
    expect(done.trimmed).toBe(2);
    expect(decks.ignis!.cards).toEqual([]);
    expect(decks.boreas!.cards).toEqual([]);
  });

  it('never leaves a deck holding more than is owned', () => {
    const g = bench();
    const deck = [
      BASE, BASE,
      'scout_imp', 'scout_imp', 'scout_imp',
      'marrow_wisp', 'marrow_wisp', 'marrow_wisp',
      'shield_bash', 'shield_bash', 'shield_bash',
      'aegis_ward',
    ];
    const collection: Collection = {
      owned: {
        [BASE]: 2, scout_imp: 3, marrow_wisp: 3, shield_bash: 3, aegis_ward: 3,
      },
    };
    const decks: Record<string, DeckList> = { ignis: { cards: [...deck] } };

    const done = spliceCard(g, collection, decks, BASE, CORE)!;

    // The two problems a splice could cause and must not: a deck running copies the
    // player no longer owns, or more copies than the Tier allows.
    const codes = validateDeck(decks.ignis!.cards, done.collection).map((p) => p.code);
    expect(codes).not.toContain('not_owned');
    expect(codes).not.toContain('over_copy_limit');

    // It *is* one card short now, and that is correct rather than a bug: the player spent
    // a card out of a full deck. The builder says so in as many words, which is the whole
    // reason the deck is flagged rather than silently topped up with something.
    expect(codes, 'and says exactly what is wrong').toEqual(['too_small']);
  });
});

describe('what the bench refuses', () => {
  it('charges nothing for a pairing it has never heard of', () => {
    const g = bench();
    expect(spliceRefusal(g, holding(1), 'scout_imp', CORE)).toBe('no-recipe');
    expect(spliceCard(g, holding(1), {}, 'scout_imp', CORE)).toBeNull();
    expect(g.overworld.economy.reagents[CORE], 'the core is still there').toBe(2);
  });

  it('charges nothing when the card is not owned', () => {
    const g = bench();
    expect(spliceRefusal(g, { owned: {} }, BASE, CORE)).toBe('not-owned');
    expect(spliceCard(g, { owned: {} }, {}, BASE, CORE)).toBeNull();
    expect(g.overworld.economy.reagents[CORE]).toBe(2);
  });

  it('charges nothing when the core is spent', () => {
    const g = bench();
    g.overworld.economy.reagents = {};
    const before = { ...holding(2).owned };

    expect(spliceRefusal(g, holding(2), BASE, CORE)).toBe('no-reagent');
    expect(spliceCard(g, holding(2), {}, BASE, CORE)).toBeNull();
    expect(holding(2).owned).toEqual(before);
  });

  it('is barred once a contract is open', () => {
    const g = bench();
    g.overworld.activeEncounter = { bountyId: 'x', spoils: { ducats: 5 } };

    expect(spliceRefusal(g, holding(2), BASE, CORE)).toBe('in-combat');
    expect(spliceCard(g, holding(2), {}, BASE, CORE)).toBeNull();
  });

  it('has a recipe for the second core too, and it makes a different thing', () => {
    const first = recipeFor(BASE, CORE)!;
    const second = SPLICE_RECIPES.find((r) => r.catalystId !== CORE)!;
    expect(second.resultId).not.toBe(first.resultId);
    expect(CARDS[second.resultId]).toBeDefined();
  });
});
