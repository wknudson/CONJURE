import { describe, expect, it } from 'vitest';
import { spliceCard, spliceRefusal } from '../core/overworld/splice.js';
import { newRun, type GlobalGameState } from '../core/overworld/state.js';
import { recipeFor, spliceableBaseIds, SPLICE_RECIPES } from '../core/data/splicing.js';
import { CARDS } from '../core/data/cards/index.js';
import { isObtainable, isUnlocked, rollRewards } from '../core/data/collection.js';
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

/**
 * A collection that knows the base card.
 *
 * Took a copy count once. There are no copies now — the bench needs the base *unlocked*
 * and consumes only the Core — so every caller asking for one, two or three is asking the
 * same question, and the parameter is gone with the model it belonged to.
 */
const holding = (): Collection => ({ unlocked: [BASE] });

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
    const shelf = schematicsFor({ unlocked: [] }).map((d) => d.id);
    for (let seed = 1; seed < 80; seed++) {
      for (const id of rollRewards(makeRng(seed), 3)) {
        expect(SPLICE_RECIPES.some((r) => r.resultId === id), `roll ${seed}`).toBe(false);
      }
    }
    for (const recipe of SPLICE_RECIPES) expect(shelf).not.toContain(recipe.resultId);
  });
});

describe('pressing a card', () => {
  it('spends the core alone, and hands over the hybrid', () => {
    const g = bench();
    const done = spliceCard(g, holding(), BASE, CORE)!;

    expect(done.resultId).toBe(RESULT);
    expect(isUnlocked(done.collection, RESULT)).toBe(true);
    expect(isUnlocked(done.collection, BASE), 'the base is kept — an unlock cannot be spent').toBe(true);
    expect(g.overworld.economy.reagents[CORE], 'one core gone').toBe(1);
  });

  it('keeps the base card — an unlock is never spent', () => {
    // It used to eat the base copy, which is why the bench also had to trim decks holding
    // it. Knowing a spell cannot be taken away, so the Core is the whole price now.
    const g = bench();
    const done = spliceCard(g, holding(), BASE, CORE)!;

    expect(isUnlocked(done.collection, BASE), 'still known afterwards').toBe(true);
    expect(done.trimmed, 'and no deck needed repairing').toBe(0);
  });

  it('drops the core key rather than leaving a zero', () => {
    const g = bench(1, 1);
    spliceCard(g, holding(), BASE, CORE);
    expect(g.overworld.economy.reagents).not.toHaveProperty(CORE);
  });

  it('keeps everything else in the collection', () => {
    const g = bench();
    const before: Collection = {
      unlocked: [BASE, 'scout_imp'],
      ascended: ['shield_bash'],
    };
    const done = spliceCard(g, before, BASE, CORE)!;

    expect(isUnlocked(done.collection, 'scout_imp')).toBe(true);
    expect(done.collection.ascended, 'an Ascension is not collateral').toEqual(['shield_bash']);
  });
});

describe('what the bench no longer does', () => {
  it('never takes a card out of a deck', () => {
    // This block used to test deck trimming: the bench ate the base copy, so a deck
    // running three of it had to lose one. Cards are unlocks now and an unlock cannot be
    // spent, so there is nothing to claw back and no deck to repair.
    const g = bench();
    const done = spliceCard(g, holding(), BASE, CORE)!;

    expect(done.trimmed, 'no deck was touched').toBe(0);
    expect(isUnlocked(done.collection, BASE), 'and the base is still known').toBe(true);
    expect(isUnlocked(done.collection, RESULT), 'alongside what it pressed into').toBe(true);
  });

  it('leaves a full deck of the base card perfectly legal afterwards', () => {
    const g = bench();
    const done = spliceCard(g, holding(), BASE, CORE)!;
    const deck = [BASE, BASE, BASE];

    expect(
      validateDeck(deck, done.collection).some((p) => p.code === 'not_unlocked'),
      'three copies from one unlock',
    ).toBe(false);
  });
});

describe('what the bench refuses', () => {
  it('charges nothing for a pairing it has never heard of', () => {
    const g = bench();
    expect(spliceRefusal(g, holding(), 'scout_imp', CORE)).toBe('no-recipe');
    expect(spliceCard(g, holding(), 'scout_imp', CORE)).toBeNull();
    expect(g.overworld.economy.reagents[CORE], 'the core is still there').toBe(2);
  });

  it('charges nothing when the card is not owned', () => {
    const g = bench();
    expect(spliceRefusal(g, { unlocked: [] }, BASE, CORE)).toBe('not-owned');
    expect(spliceCard(g, { unlocked: [] }, BASE, CORE)).toBeNull();
    expect(g.overworld.economy.reagents[CORE]).toBe(2);
  });

  it('charges nothing when the core is spent', () => {
    const g = bench();
    g.overworld.economy.reagents = {};
    const before = [...holding().unlocked];

    expect(spliceRefusal(g, holding(), BASE, CORE)).toBe('no-reagent');
    expect(spliceCard(g, holding(), BASE, CORE)).toBeNull();
    expect(holding().unlocked).toEqual(before);
  });

  it('is barred once a contract is open', () => {
    const g = bench();
    g.overworld.activeEncounter = { bountyId: 'x', spoils: { ducats: 5 } };

    expect(spliceRefusal(g, holding(), BASE, CORE)).toBe('in-combat');
    expect(spliceCard(g, holding(), BASE, CORE)).toBeNull();
  });

  it('has a recipe for the second core too, and it makes a different thing', () => {
    const first = recipeFor(BASE, CORE)!;
    const second = SPLICE_RECIPES.find((r) => r.catalystId !== CORE)!;
    expect(second.resultId).not.toBe(first.resultId);
    expect(CARDS[second.resultId]).toBeDefined();
  });
});
