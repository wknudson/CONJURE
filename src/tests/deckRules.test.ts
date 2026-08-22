import { describe, expect, it } from 'vitest';
import {
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
  startingCollection,
} from '../core/data/collection.js';
import { CARDS } from '../core/data/cards/index.js';
import { COMPANIONS } from '../core/data/companions.js';
import { makeRng } from '../core/util/rng.js';
import { SCHEMATIC_PICKS, rollSchematicOffer, schematicPool } from '../core/data/schematics.js';
import { tierOfEncounter } from '../core/data/bounties.js';
import { ENCOUNTERS, encounterById } from '../core/data/encounters/index.js';

/**
 * A legal filler deck of N copies drawn from cheap Tier 1 staples.
 *
 * Spells only. Minions are a Vanguard Roster now, so a filler deck built from bodies would
 * fail on `minion_in_deck` before any of the rules under test were reached.
 */
function fillerDeck(size: number): string[] {
  // All Tier 1, so five staples at three copies apiece exactly reach the 15-card ceiling.
  // A Tier 2 card here caps the filler at 14 and the boundary test cannot be written.
  const staples = ['grapple_line', 'cull_the_weak', 'shield_bash', 'aegis_ward', 'stone_barricade'];
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
    const deck = Array.from({ length: MAX_DECK + 1 }, () => 'shield_bash');
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
    expect(tierOf(CARDS.grapple_line!)).toBe(1);
    expect(tierOf(CARDS.aether_beam!)).toBe(2);

    const tooMany = [...fillerDeck(MIN_DECK), 'aether_beam', 'aether_beam', 'aether_beam'];
    const problems = validateDeck(tooMany);
    expect(problems.some((p) => p.code === 'over_copy_limit' && p.cardId === 'aether_beam')).toBe(true);
  });

  it('counts ranks of the same card against one shared cap', () => {
    // Ascension will print rank-2 variants; they must not double the allowance.
    expect(baseIdOf('grapple_line_r2')).toBe('grapple_line');
    expect(baseIdOf('grapple_line')).toBe('grapple_line');
  });

  it('reports how many more copies a deck can take', () => {
    const deck = ['grapple_line', 'grapple_line'];
    expect(remainingCopies(deck, 'grapple_line')).toBe(1);
    expect(remainingCopies([...deck, 'grapple_line'], 'grapple_line')).toBe(0);
  });
});

describe('bodies are not cards any more', () => {
  it('refuses any minion in a deck, by name', () => {
    const deck = [...fillerDeck(MIN_DECK), 'grave_sentinel'];
    const problems = validateDeck(deck);
    const minion = problems.find((p) => p.code === 'minion_in_deck');

    expect(minion, 'a body in a spell deck must be named as such').toBeDefined();
    expect(minion!.cardId).toBe('grave_sentinel');
    expect(minion!.message).toMatch(/Vanguard Roster/);
  });

  it('refuses a Behemoth for the same reason, not the old Behemoth rule', () => {
    // `MAX_BEHEMOTHS` governed bodies in decks, and there are none. The roster owns that
    // limit now; the deck simply refuses the body outright.
    const problems = validateDeck([...fillerDeck(MIN_DECK), 'magma_brute']);
    expect(problems.some((p) => p.code === 'minion_in_deck')).toBe(true);
    expect(problems.some((p) => p.code === 'too_many_behemoths')).toBe(false);
  });

  it('leaves a deck of pure spells alone', () => {
    expect(validateDeck(fillerDeck(MIN_DECK))).toEqual([]);
  });
});

describe('unlocks', () => {
  it('refuses a card that has not been forged', () => {
    const collection = { unlocked: ['grapple_line'] };
    const deck = [...fillerDeck(MIN_DECK)];
    const problems = validateDeck(deck, collection);
    expect(problems.some((p) => p.code === 'not_unlocked')).toBe(true);
  });

  it('allows the full Tier allowance of an unlocked card, from one unlock', () => {
    // The whole change. One unlock is unlimited access, bottlenecked by Tier alone —
    // there is no second copy to go and find.
    const collection = { unlocked: ['grapple_line', 'shield_bash', 'aegis_ward'] };
    const three = ['grapple_line', 'grapple_line', 'grapple_line', 'shield_bash', 'aegis_ward'];

    expect(tierOf(CARDS.grapple_line!)).toBe(1);
    expect(validateDeck(three, collection)).toEqual([]);
  });

  it('still refuses a fourth copy of a Tier 1 card', () => {
    const collection = { unlocked: ['grapple_line', 'shield_bash'] };
    const four = ['grapple_line', 'grapple_line', 'grapple_line', 'grapple_line', 'shield_bash'];
    expect(validateDeck(four, collection).map((p) => p.code)).toContain('over_copy_limit');
  });

  it('ignores unlocks when no collection is supplied', () => {
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
    // Even a save stripped bare must come back able to build a deck.
    const { collection } = reconcileCollection({ unlocked: [] });
    for (const id of SOULBOUND) {
      expect(collection.unlocked, id).toContain(id);
    }
  });

  it('drops cards that no longer exist and reports them', () => {
    const stale = { unlocked: ['flame_surge', 'a_card_from_a_past_patch'] };
    const { collection, dropped } = reconcileCollection(stale);
    expect(dropped).toContain('a_card_from_a_past_patch');
    expect(collection.unlocked).not.toContain('a_card_from_a_past_patch');
    expect(collection.unlocked, 'and keeps the one that still exists').toContain('flame_surge');
  });

  it('grants a card without mutating the original collection', () => {
    const before = startingCollection();
    const after = grantCard(before, 'flame_surge');
    expect(after.unlocked).toContain('flame_surge');
    expect(before.unlocked, 'the original is untouched').not.toContain('flame_surge');
  });

  it('is idempotent — granting twice is granting once', () => {
    // There is no second copy to hand over, so a duplicate grant must be a no-op rather
    // than a silently growing list.
    const once = grantCard(startingCollection(), 'flame_surge');
    const twice = grantCard(once, 'flame_surge');
    expect(twice.unlocked.filter((id) => id === 'flame_surge')).toHaveLength(1);
    expect(twice).toBe(once);
  });

  it('ignores a grant of a card that does not exist', () => {
    const before = startingCollection();
    expect(grantCard(before, 'not_a_card')).toBe(before);
  });

  it('offers distinct, real Schematics deterministically from a seed', () => {
    const trial = encounterById('ignis_trial')!;
    const a = rollSchematicOffer(makeRng(7), trial, { unlocked: [] }, []);
    const b = rollSchematicOffer(makeRng(7), trial, { unlocked: [] }, []);
    expect(a).toEqual(b);
    expect(new Set(a).size).toBe(a.length);
    for (const id of a) expect(CARDS[id], id).toBeDefined();
    // The Rite is encounter-generated and must never be offered.
    expect(a).not.toContain('rite_of_subjugation');
  });

  it('offers only what the fight actually fought you with', () => {
    // The whole reason the pool is derived from `enemyDeck` rather than authored. A card
    // the encounter never played turning up here means the pool has drifted from the
    // fight, which is the failure an authored `blueprintPool` field would have made silent.
    for (const encounter of ENCOUNTERS) {
      const played = new Set(encounter.enemyDeck);
      for (let seed = 1; seed < 30; seed++) {
        for (const id of rollSchematicOffer(makeRng(seed), encounter, { unlocked: [] }, [])) {
          expect(played.has(id), `${encounter.id} offered ${id}, which it never played`).toBe(true);
        }
      }
    }
  });

  it('never offers a plan the player already owns or already holds', () => {
    // A duplicate plan is a reward that does nothing, and the second time it happens it
    // reads as the game being broken rather than as a run of bad luck.
    const trial = encounterById('ignis_trial')!;
    const pool = schematicPool(trial).map((d) => d.id);
    expect(pool.length, 'the Trial has a pool to draw on').toBeGreaterThan(2);

    const owned = { unlocked: [pool[0]!] };
    const held = [pool[1]!];
    for (let seed = 1; seed < 60; seed++) {
      const offer = rollSchematicOffer(makeRng(seed), trial, owned, held);
      expect(offer, `seed ${seed}`).not.toContain(pool[0]);
      expect(offer, `seed ${seed}`).not.toContain(pool[1]);
    }
  });

  it('runs a fight dry rather than repeating itself', () => {
    // The correct end state for a fight wrung out: it still pays Ducats and Cores, it
    // simply has nothing left to teach. An empty offer is a drawn-nothing, not an error.
    const ruin = encounterById('narrow_ruin')!;
    const everything = schematicPool(ruin).map((d) => d.id);
    expect(rollSchematicOffer(makeRng(3), ruin, { unlocked: everything }, [])).toEqual([]);
    expect(rollSchematicOffer(makeRng(3), ruin, { unlocked: [] }, everything)).toEqual([]);
  });

  it('widens the choice with the tier, without paying more of them', () => {
    // A Master contract is not four times the reward. It is a decision with four ways to
    // go wrong, and the player still takes exactly one.
    expect(SCHEMATIC_PICKS.novice).toBeLessThan(SCHEMATIC_PICKS.adept);
    expect(SCHEMATIC_PICKS.adept).toBeLessThan(SCHEMATIC_PICKS.master);
    expect(tierOfEncounter('ignis_trial')).toBe('master');
    expect(tierOfEncounter('novice_duelist')).toBe('novice');
    // An encounter on no poster is the cheapest work, not the dearest.
    expect(tierOfEncounter('no_such_fight')).toBe('novice');

    for (const encounter of ENCOUNTERS) {
      const cap = SCHEMATIC_PICKS[tierOfEncounter(encounter.id)];
      const offer = rollSchematicOffer(makeRng(11), encounter, { unlocked: [] }, []);
      expect(offer.length, encounter.id).toBeLessThanOrEqual(cap);
    }
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
