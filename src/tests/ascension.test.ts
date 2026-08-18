import { describe, expect, it } from 'vitest';
import {
  CARDS,
  STARTER_DECK,
  ascendableIds,
  ascendedId,
  isAscendedId,
} from '../core/data/cards/index.js';
import {
  ascendableFor,
  grantCard,
  isObtainable,
  printedDeck,
  printedId,
  reconcileCollection,
  rollRewards,
  startingCollection,
} from '../core/data/collection.js';
import { baseIdOf, tierOf, validateDeck, type Collection } from '../core/data/deckRules.js';
import { makeRng } from '../core/util/rng.js';

/**
 * Card Ascension.
 *
 * The Rank 2 printing is a real card in the registry, merged from its `rank2` block once
 * at load. Most of what is worth testing is therefore about what must *not* have leaked
 * out of that: an upgraded card handed out as a reward, or sold at the Artificer, would
 * be the Ascension sink giving away the thing it exists to charge for.
 */

const withAscended = (ids: string[]): Collection => ({
  ...startingCollection(),
  ascended: ids,
});

describe('the Rank 2 printing', () => {
  it('exists for every card that authors one', () => {
    const authored = ascendableIds();
    expect(authored.length, 'some cards have a rank2 block').toBeGreaterThan(0);
    for (const id of authored) {
      expect(CARDS[ascendedId(id)], id).toBeDefined();
    }
  });

  it('shares a copy cap with the card it came from', () => {
    // The reason `_r2` is the suffix: `baseIdOf` has stripped it since before Ascension
    // existed, precisely so an upgrade could not double a Tier 3 card's single copy.
    for (const id of ascendableIds()) {
      expect(baseIdOf(ascendedId(id))).toBe(id);
      expect(tierOf(CARDS[ascendedId(id)]!), id).toBe(tierOf(CARDS[id]!));
    }
  });

  it('keeps what a Rank 2 is not allowed to change', () => {
    // A Rank 2 that targeted differently, or moved from Hero to Companion, would be a
    // different card sharing another card's copy allowance.
    for (const id of ascendableIds()) {
      const base = CARDS[id]!;
      const up = CARDS[ascendedId(id)]!;
      expect(up.school, id).toBe(base.school);
      expect(up.source, id).toBe(base.source);
      expect(up.kind, id).toBe(base.kind);
      expect(up.target, id).toEqual(base.target);
    }
  });

  it('cannot be ascended again', () => {
    for (const id of ascendableIds()) {
      expect(CARDS[ascendedId(id)]!.rank2, id).toBeUndefined();
    }
    expect(ascendableIds().every((id) => !isAscendedId(id))).toBe(true);
  });

  it('merges a partial stat block over the printed one', () => {
    // The mortar raises atk, hp and reach and says nothing about its archetype. Losing
    // the archetype would quietly turn a Lobber into an ordinary melee body.
    const base = CARDS.scrap_metal_mortar!;
    const up = CARDS[ascendedId('scrap_metal_mortar')]!;

    expect(up.unit!.atk).toBeGreaterThan(base.unit!.atk);
    expect(up.unit!.archetype, 'kept from Rank 1').toBe(base.unit!.archetype);
    expect(up.unit!.attackProfile).toBe(base.unit!.attackProfile);
    expect(up.unit!.rangeMin, 'the blind spot survives the upgrade').toBe(base.unit!.rangeMin);
  });

  it('takes a name that reads as an upgrade of the same card', () => {
    for (const id of ascendableIds()) {
      expect(CARDS[ascendedId(id)]!.name, id).toContain(CARDS[id]!.name);
    }
  });
});

describe('what Ascension must not give away', () => {
  it('never offers a Rank 2 as a post-victory reward', () => {
    // Rank 2 cards live in `CARDS` now, so the reward roller would happily hand one out
    // for free — which is the Ascension sink paying itself.
    for (let seed = 1; seed < 120; seed++) {
      for (const id of rollRewards(makeRng(seed), 3)) {
        expect(isAscendedId(id), `reward roll ${seed} offered ${id}`).toBe(false);
      }
    }
  });

  it('excludes them from the one predicate every giveaway asks', () => {
    for (const id of ascendableIds()) {
      expect(isObtainable(CARDS[ascendedId(id)]!), id).toBe(false);
    }
  });
});

describe('the account-wide mark', () => {
  it('offers only cards the player owns and has not raised', () => {
    const owned = startingCollection();
    const offered = ascendableFor(owned);
    expect(offered.length).toBeGreaterThan(0);
    for (const id of offered) expect(owned.owned[id]).toBeGreaterThan(0);

    const after = withAscended([offered[0]!]);
    expect(ascendableFor(after), 'a raised card leaves the bench').not.toContain(offered[0]);
  });

  it('upgrades every copy in every deck at once', () => {
    // Ascension teaches the card rather than upgrading one copy, so a deck written before
    // the forge was used still names the base id and still means the new printing.
    const collection = withAscended(['shield_bash']);
    const deck = ['shield_bash', 'scout_imp', 'shield_bash'];

    expect(printedDeck(collection, deck)).toEqual([
      ascendedId('shield_bash'),
      'scout_imp',
      ascendedId('shield_bash'),
    ]);
  });

  it('leaves a deck alone when nothing is raised', () => {
    const deck = ['shield_bash', 'scout_imp'];
    expect(printedDeck(startingCollection(), deck)).toEqual(deck);
  });

  it('does not invent a printing that was never authored', () => {
    const collection = withAscended(['aegis_ward_that_never_existed']);
    expect(printedId(collection, 'aegis_ward_that_never_existed')).toBe(
      'aegis_ward_that_never_existed',
    );
  });

  it('survives claiming a reward card', () => {
    // `grantCard` used to rebuild the collection from `owned` alone, which erased every
    // Ascension the moment a win offered a card.
    const before = withAscended(['shield_bash']);
    const after = grantCard(before, 'scout_imp');
    expect(after.ascended, 'still raised').toEqual(['shield_bash']);
  });

  it('is dropped on load if the card no longer has a Rank 2', () => {
    const { collection } = reconcileCollection({
      owned: { shield_bash: 3 },
      ascended: ['shield_bash', 'a_card_with_no_rank_two'],
    });
    expect(collection.ascended).toEqual(['shield_bash']);
  });

  it('leaves a real deck legal once its cards are raised', () => {
    // The whole point of reusing the `_r2` convention: the deck rules were built to
    // handle two ranks, so a printed deck needs no special case anywhere.
    const collection = withAscended(['shield_bash', 'harvest_the_weak']);
    const printed = printedDeck(collection, STARTER_DECK);

    expect(printed, 'the upgrade did land').toContain(ascendedId('shield_bash'));
    expect(validateDeck(printed, collection)).toEqual([]);
    expect(validateDeck(STARTER_DECK, collection), 'and so was it before').toEqual([]);
  });
});
