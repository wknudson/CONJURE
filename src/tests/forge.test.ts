import { describe, expect, it } from 'vitest';
import {
  ASCENSION_COST,
  ASCENSION_COST_SHARDS,
  SCHEMATIC_COST_DUCATS,
  ascendCard,
  ascensionRefusal,
  forgeSchematic,
  schematicRefusal,
  type AscensionRefusal,
} from '../core/overworld/forge.js';
import { newRun, type GlobalGameState } from '../core/overworld/state.js';
import { ascendedId } from '../core/data/cards/index.js';
import { isAscended, isUnlocked, printedDeck } from '../core/data/collection.js';
import type { Collection } from '../core/data/deckRules.js';

/**
 * The Artificer's till.
 *
 * Every test here is really the same question asked twice: can the player end up with
 * the goods and the money, or the money gone and no goods. Both are silent in play and
 * both are the reason the doer asks the refusal rather than trusting a button.
 */

const rich = (): GlobalGameState => {
  const overworld = newRun(1);
  // An Ascension takes all three now: money, Shards and a Core.
  overworld.economy = { ducats: 500, marrowShards: 9, reagents: { core_frost: 4 } };
  return { overworld, combat: null };
};

const holding = (ids: string[]): Collection => ({
  unlocked: [...ids],
});

describe('ascension', () => {
  it('takes the Shards and marks the card', () => {
    const g = rich();
    const before = g.overworld.economy.marrowShards;

    const after = ascendCard(g, holding(['shield_bash']), 'shield_bash')!;

    expect(after).not.toBeNull();
    expect(isAscended(after, 'shield_bash')).toBe(true);
    expect(g.overworld.economy.marrowShards).toBe(before - ASCENSION_COST_SHARDS);
  });

  it('raises every copy in the deck, without touching the deck', () => {
    const g = rich();
    const after = ascendCard(g, holding(['shield_bash']), 'shield_bash')!;
    const deck = ['shield_bash', 'scout_imp', 'shield_bash'];

    expect(printedDeck(after, deck)).toEqual([
      ascendedId('shield_bash'),
      'scout_imp',
      ascendedId('shield_bash'),
    ]);
    expect(deck, 'the saved list is untouched').toEqual([
      'shield_bash',
      'scout_imp',
      'shield_bash',
    ]);
  });

  it('leaves everything else in the collection alone', () => {
    const g = rich();
    const before: Collection = { unlocked: ['shield_bash', 'scout_imp'], ascended: ['scout_imp'] };
    const after = ascendCard(g, before, 'shield_bash')!;

    expect(after.unlocked, 'unlocks are not spent by ascending').toEqual(before.unlocked);
    expect(after.ascended, 'and an earlier ascension survives').toContain('scout_imp');
  });

  it('charges nothing when it refuses', () => {
    const cases: Array<[AscensionRefusal, number, Collection, string]> = [
      ['too-poor', 1, holding(['shield_bash']), 'shield_bash'],
      ['not-owned', 9, holding([]), 'shield_bash'],
      [
        'already-ascended',
        9,
        { ...holding(['shield_bash']), ascended: ['shield_bash'] },
        'shield_bash',
      ],
      // A card made entirely of quantities Ascension refuses to touch: the tithe wounds
      // your own body, the cap is Marrow, the payoff is cards. Nothing to raise, so there
      // is no Rank 2 to sell.
      ['no-rank-2', 9, holding(['harvest_the_weak']), 'harvest_the_weak'],
    ];

    for (const [why, purse, collection, id] of cases) {
      const g = rich();
      g.overworld.economy.marrowShards = purse;

      expect(ascensionRefusal(g, collection, id), why ?? '').toBe(why);
      expect(ascendCard(g, collection, id), why ?? '').toBeNull();
      expect(g.overworld.economy.marrowShards, `${why} cost nothing`).toBe(purse);
    }
  });

  it('refuses a player with the money but no Core, and says which', () => {
    // Named apart from `too-poor` because it is a different errand. Ducats and Shards come
    // from taking any contract; a Core does not, and telling a player they are "too poor"
    // when their purse is full would send them to earn the wrong thing.
    const g = rich();
    g.overworld.economy.reagents = {};

    expect(ascensionRefusal(g, holding(['shield_bash']), 'shield_bash')).toBe('no-reagent');
    expect(ascendCard(g, holding(['shield_bash']), 'shield_bash')).toBeNull();
  });

  it('takes one Core, the Ducats and the Shards together', () => {
    const g = rich();
    const before = {
      ducats: g.overworld.economy.ducats,
      shards: g.overworld.economy.marrowShards,
      cores: g.overworld.economy.reagents.core_frost,
    };

    expect(ascendCard(g, holding(['shield_bash']), 'shield_bash')).not.toBeNull();

    expect(g.overworld.economy.ducats).toBe(before.ducats - ASCENSION_COST.ducats);
    expect(g.overworld.economy.marrowShards).toBe(before.shards - ASCENSION_COST.shards);
    expect(g.overworld.economy.reagents.core_frost).toBe(before.cores! - ASCENSION_COST.reagents);
  });

  it('spends from the deepest stack, so a thin one is not emptied first', () => {
    const g = rich();
    g.overworld.economy.reagents = { core_pyre: 1, core_surge: 5 };

    ascendCard(g, holding(['shield_bash']), 'shield_bash');

    expect(g.overworld.economy.reagents.core_surge, 'the deep one paid').toBe(4);
    expect(g.overworld.economy.reagents.core_pyre, 'the thin one is untouched').toBe(1);
  });

  it('clears an emptied stack rather than leaving a zero', () => {
    const g = rich();
    g.overworld.economy.reagents = { core_pyre: 1 };

    ascendCard(g, holding(['shield_bash']), 'shield_bash');

    expect(g.overworld.economy.reagents.core_pyre, 'a bag of none is no bag').toBeUndefined();
  });

  it('is barred once a contract is open', () => {
    // Upgrading a card between accepting a bounty and fighting it would change a deck the
    // fight had already been committed to.
    const g = rich();
    g.overworld.activeEncounter = { bountyId: 'x', spoils: { ducats: 10 } };

    expect(ascensionRefusal(g, holding(['shield_bash']), 'shield_bash')).toBe('in-combat');
    expect(ascendCard(g, holding(['shield_bash']), 'shield_bash')).toBeNull();
  });

  it('cannot be bought twice', () => {
    const g = rich();
    const once = ascendCard(g, holding(['shield_bash']), 'shield_bash')!;
    const shards = g.overworld.economy.marrowShards;

    expect(ascendCard(g, once, 'shield_bash')).toBeNull();
    expect(g.overworld.economy.marrowShards, 'and was not charged again').toBe(shards);
  });
});

describe('schematic forging', () => {
  it('takes the Ducats and hands over the card', () => {
    const g = rich();
    const before = g.overworld.economy.ducats;

    const after = forgeSchematic(g, holding([]), 'scout_imp')!;

    expect(isUnlocked(after, 'scout_imp')).toBe(true);
    expect(g.overworld.economy.ducats).toBe(before - SCHEMATIC_COST_DUCATS);
  });

  it('refuses a second forging, because there is no second copy to buy', () => {
    const g = rich();
    const owned = forgeSchematic(g, holding([]), 'scout_imp')!;
    const ducats = g.overworld.economy.ducats;

    expect(schematicRefusal(g, owned, 'scout_imp')).toBe('already-forged');
    expect(forgeSchematic(g, owned, 'scout_imp')).toBeNull();
    expect(g.overworld.economy.ducats, 'and charged nothing for the refusal').toBe(ducats);
  });

  it('charges nothing when the purse is short', () => {
    const g = rich();
    g.overworld.economy.ducats = SCHEMATIC_COST_DUCATS - 1;

    expect(schematicRefusal(g, holding([]), 'scout_imp')).toBe('too-poor');
    expect(forgeSchematic(g, holding([]), 'scout_imp')).toBeNull();
    expect(g.overworld.economy.ducats).toBe(SCHEMATIC_COST_DUCATS - 1);
  });

  it('will not cut a card that does not exist', () => {
    const g = rich();
    expect(schematicRefusal(g, holding([]), 'no_such_card')).toBe('unknown-card');
    expect(forgeSchematic(g, holding([]), 'no_such_card')).toBeNull();
  });

  it('keeps Ascensions when it grants a card', () => {
    const g = rich();
    const before: Collection = { unlocked: ['shield_bash'], ascended: ['shield_bash'] };
    const after = forgeSchematic(g, before, 'scout_imp')!;
    expect(after.ascended).toEqual(['shield_bash']);
  });
});

describe('the two sinks', () => {
  it('cannot be reduced to one another, even sharing a coin', () => {
    // The two sinks share Ducats now, and are still not interchangeable: acquiring a card
    // costs money and *only* money, while mastering one also demands Shards and a Core.
    // A player rich in coin can always learn something new; mastering what they already
    // know needs them to have taken hard contracts and broken open scenery as well.
    const g = rich();
    const shardsBefore = g.overworld.economy.marrowShards;
    forgeSchematic(g, holding([]), 'scout_imp');
    expect(g.overworld.economy.marrowShards, 'forging spends no Shards').toBe(shardsBefore);
    expect(g.overworld.economy.reagents.core_frost, 'and no Cores').toBe(4);

    // Money alone is never enough for an Ascension, however much of it there is.
    const flush = rich();
    flush.overworld.economy.marrowShards = 0;
    flush.overworld.economy.ducats = 99_999;
    expect(ascensionRefusal(flush, holding(['shield_bash']), 'shield_bash')).toBe('too-poor');
  });
});
