import { describe, expect, it } from 'vitest';
import { missingPrerequisites, spliceCard, spliceRefusal } from '../core/overworld/splice.js';
import { newRun, type GlobalGameState } from '../core/overworld/state.js';
import { recipeFor, spliceableBaseIds, SPLICE_RECIPES } from '../core/data/splicing.js';
import { CARDS } from '../core/data/cards/index.js';
import { isObtainable, isUnlocked } from '../core/data/collection.js';
import { rollSchematicOffer } from '../core/data/schematics.js';
import { ENCOUNTERS } from '../core/data/encounters/index.js';
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

/** Everything this recipe asks the player to already know: the base, and the other half. */
const PREREQS = SPLICE_RECIPES[0]!.requiredUnlockedCards ?? [];

/**
 * A collection that knows the base card, and the school it is being fused with.
 *
 * Took a copy count once. There are no copies now — the bench needs the base *unlocked*
 * and consumes only the Core — so every caller asking for one, two or three is asking the
 * same question, and the parameter is gone with the model it belonged to.
 *
 * The prerequisites are folded in here rather than listed at each call site, so a recipe
 * that gains a second one does not silently turn thirty passing tests into refusals about
 * something none of them are testing.
 */
const holding = (): Collection => ({ unlocked: [BASE, ...PREREQS] });

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
    // The same leak Rank 2 printings had: hybrids live in `CARDS`, so a fight's offer or
    // the Schematic shelf would hand out the thing this sink charges for.
    for (const recipe of SPLICE_RECIPES) {
      expect(isObtainable(CARDS[recipe.resultId]!), recipe.resultId).toBe(false);
    }
    const shelf = schematicsFor({ unlocked: [] }).map((d) => d.id);
    for (const encounter of ENCOUNTERS) {
      for (let seed = 1; seed < 30; seed++) {
        for (const id of rollSchematicOffer(makeRng(seed), encounter, { unlocked: [] }, [])) {
          expect(
            SPLICE_RECIPES.some((r) => r.resultId === id),
            `${encounter.id} seed ${seed}`,
          ).toBe(false);
        }
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
      unlocked: [BASE, ...PREREQS, 'scout_imp'],
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

describe('prerequisites', () => {
  it('asks for the other half of the fusion, and names it', () => {
    // A hybrid is two schools pressed together and the base card only ever accounts for
    // one of them. Pressing a Vaporize Blast out of a fire spell and a cold rock without
    // ever having learned frost would make the bench a shop rather than a payoff.
    expect(PREREQS.length, 'the first recipe should gate on something').toBeGreaterThan(0);
    for (const id of PREREQS) expect(CARDS[id], id).toBeDefined();
  });

  it('refuses the pressing while the other half is unlearned', () => {
    const g = bench();
    const knowsOnlyTheBase: Collection = { unlocked: [BASE] };
    expect(spliceRefusal(g, knowsOnlyTheBase, BASE, CORE)).toBe('missing-prerequisite');
    expect(spliceCard(g, knowsOnlyTheBase, BASE, CORE)).toBeNull();
  });

  it('charges nothing for a refused pressing', () => {
    // The standing rule at every counter in this game: a refusal is free. A bench that
    // ate the Core and then declined would be the worst possible way to learn the rule.
    const g = bench();
    const before = { ...g.overworld.economy.reagents };
    spliceCard(g, { unlocked: [BASE] }, BASE, CORE);
    expect(g.overworld.economy.reagents).toEqual(before);
  });

  it('allows it the moment the other half is learned', () => {
    const g = bench();
    expect(spliceRefusal(g, holding(), BASE, CORE)).toBeNull();
    expect(spliceCard(g, holding(), BASE, CORE)?.resultId).toBe(RESULT);
  });

  it('never consumes a prerequisite', () => {
    // The same rule that stopped the base card being eaten. An unlock that can be spent
    // is not an unlock, and a bench that ate the frost spell would make the *second*
    // pressing of the same recipe impossible.
    const g = bench();
    const result = spliceCard(g, holding(), BASE, CORE)!;
    for (const id of PREREQS) expect(isUnlocked(result.collection, id), id).toBe(true);
    expect(isUnlocked(result.collection, BASE), BASE).toBe(true);
  });

  it('names exactly what is missing, so the counter can say so', () => {
    expect(missingPrerequisites({ unlocked: [BASE] }, BASE, CORE)).toEqual([...PREREQS]);
    expect(missingPrerequisites(holding(), BASE, CORE)).toEqual([]);
    // An unknown pairing has no prerequisites to be missing — `no-recipe` is that story,
    // and this must not invent a second one.
    expect(missingPrerequisites({ unlocked: [] }, 'scout_imp', CORE)).toEqual([]);
  });

  it('asks about the qualification before the reagent', () => {
    // A player short of both is told about the thing they cannot buy their way out of.
    const broke = bench(1, 0);
    expect(spliceRefusal(broke, { unlocked: [BASE] }, BASE, CORE)).toBe('missing-prerequisite');
  });

  it('never gates a recipe behind its own product', () => {
    // Checked at module load too, but stated here as well: the failure mode is a card in
    // the registry that no amount of play could ever produce, and it is silent.
    for (const recipe of SPLICE_RECIPES) {
      expect(recipe.requiredUnlockedCards ?? [], recipe.resultId).not.toContain(recipe.resultId);
      expect(recipe.requiredUnlockedCards ?? [], recipe.resultId).not.toContain(recipe.baseCardId);
    }
  });

  it('gates every recipe on something the player can actually get', () => {
    for (const recipe of SPLICE_RECIPES) {
      for (const id of recipe.requiredUnlockedCards ?? []) {
        const def = CARDS[id];
        expect(def, `${recipe.resultId} requires ${id}`).toBeDefined();
        // A prerequisite that is itself splice-only would be a chain the player can never
        // start, and one that is `setupOnly` could never be unlocked at all.
        expect(def!.spliceOnly, id).toBeUndefined();
        expect(def!.setupOnly, id).toBeUndefined();
      }
    }
  });
});
