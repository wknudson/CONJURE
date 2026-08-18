import { describe, expect, it } from 'vitest';
import {
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
import { isAscended, ownedCount, printedDeck } from '../core/data/collection.js';
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
  overworld.economy = { ducats: 500, marrowShards: 9 };
  return { overworld, combat: null };
};

const holding = (ids: string[]): Collection => ({
  owned: Object.fromEntries(ids.map((id) => [id, 1])),
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
    const before: Collection = { owned: { shield_bash: 3, scout_imp: 2 }, ascended: ['scout_imp'] };
    const after = ascendCard(g, before, 'shield_bash')!;

    expect(after.owned, 'copies are not spent by ascending').toEqual(before.owned);
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
      ['no-rank-2', 9, holding(['aegis_ward']), 'aegis_ward'],
    ];

    for (const [why, purse, collection, id] of cases) {
      const g = rich();
      g.overworld.economy.marrowShards = purse;

      expect(ascensionRefusal(g, collection, id), why ?? '').toBe(why);
      expect(ascendCard(g, collection, id), why ?? '').toBeNull();
      expect(g.overworld.economy.marrowShards, `${why} cost nothing`).toBe(purse);
    }
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

    expect(ownedCount(after, 'scout_imp')).toBe(1);
    expect(g.overworld.economy.ducats).toBe(before - SCHEMATIC_COST_DUCATS);
  });

  it('refuses a second copy, so a purse cannot buy a deck', () => {
    const g = rich();
    const owned = forgeSchematic(g, holding([]), 'scout_imp')!;
    const ducats = g.overworld.economy.ducats;

    expect(schematicRefusal(g, owned, 'scout_imp')).toBe('already-owned');
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
    const before: Collection = { owned: { shield_bash: 1 }, ascended: ['shield_bash'] };
    const after = forgeSchematic(g, before, 'scout_imp')!;
    expect(after.ascended).toEqual(['shield_bash']);
  });
});

describe('the two sinks', () => {
  it('do not compete for the same coin', () => {
    // Ducats acquire, Shards master. If either could pay for the other, one of the two
    // reasons to fight would stop mattering.
    const g = rich();
    const shardsBefore = g.overworld.economy.marrowShards;
    forgeSchematic(g, holding([]), 'scout_imp');
    expect(g.overworld.economy.marrowShards, 'forging spent no Shards').toBe(shardsBefore);

    const ducatsBefore = g.overworld.economy.ducats;
    ascendCard(g, holding(['shield_bash']), 'shield_bash');
    expect(g.overworld.economy.ducats, 'ascending spent no Ducats').toBe(ducatsBefore);
  });
});
