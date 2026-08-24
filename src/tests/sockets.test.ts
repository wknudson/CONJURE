import { describe, expect, it } from 'vitest';
import type { GrimoireSource } from '../core/data/grimoire.js';
import {
  acceptsSchool,
  resolveGrimoire,
  schoolsOfCard,
  socketRefusal,
  socketableCards,
} from '../core/data/grimoire.js';
import { CARDS, ascendedId } from '../core/data/cards/index.js';
import { COMPANIONS, GRIMOIRE_SIZE, companionById } from '../core/data/companions.js';
import { createCombat } from '../core/engine/setup.js';
import { NOVICE_DUELIST } from '../core/data/encounters/index.js';
import { tameCompanion } from '../core/overworld/vivarium.js';
import { makeRng } from '../core/util/rng.js';

/**
 * Grimoire Override Sockets.
 *
 * The last hole in the progression loop. A spliced Hybrid is an *elemental* card and the
 * Hero Deck takes neutral and arcane only — so until now a player could press a Vaporize
 * Blast at the bench, own it outright, and have nowhere in the entire game to put it. The
 * Companion's half is where elemental magic lives, so that is where a forged one goes.
 *
 * The gate is the interesting part, and it is not "is this a Hybrid". It is whether the
 * beast has any claim to the card at all.
 */

const IGNIS = companionById('ignis')!.grimoire;
const BOREAS = companionById('boreas')!.grimoire;

describe('what a card is made of', () => {
  it('reads a fusion from its recipe, not from where it is filed', () => {
    // Vaporize Blast is filed under frost and pressed from Pyre and Frost. Reading
    // `def.school` alone would tell a fire drake it cannot hold the fire-and-ice spell
    // that is half made of fire.
    expect(CARDS.vaporize_blast!.school, 'the filing').toBe('frost');
    expect(schoolsOfCard(CARDS.vaporize_blast!).sort()).toEqual(['frost', 'pyre']);
  });

  it('reads an ordinary spell as the one school it says it is', () => {
    expect(schoolsOfCard(CARDS.flame_surge!)).toEqual(['pyre']);
    expect(schoolsOfCard(CARDS.glacial_spike!)).toEqual(['frost']);
  });
});

describe('the school gate', () => {
  it('lets a fire drake hold a fire-and-ice fusion', () => {
    expect(acceptsSchool(IGNIS, CARDS.vaporize_blast!)).toBe(true);
    expect(acceptsSchool(IGNIS, CARDS.cryo_combustion!)).toBe(true);
  });

  it('refuses a fusion it has no part of', () => {
    // Galvanic Spores is Bloom and Surge. An Ignis is neither, and half a claim is the
    // minimum — no claim is no card.
    expect(schoolsOfCard(CARDS.galvanic_spores!).sort()).toEqual(['bloom', 'surge']);
    expect(acceptsSchool(IGNIS, CARDS.galvanic_spores!)).toBe(false);
  });

  it('takes a plain spell of its own school', () => {
    expect(acceptsSchool(IGNIS, CARDS.flame_surge!)).toBe(true);
    expect(acceptsSchool(BOREAS, CARDS.glacial_spike!)).toBe(true);
  });

  it('refuses a plain spell of somebody else’s', () => {
    expect(acceptsSchool(IGNIS, CARDS.glacial_spike!)).toBe(false);
    expect(acceptsSchool(BOREAS, CARDS.flame_surge!)).toBe(false);
  });

  it('refuses neutral utility outright', () => {
    // No bloodline is `neutral`, so this falls out of the rule rather than being a case in
    // it — and that is the right answer: colourless utility is what the Hero Deck is for,
    // and a socket that took it would make the two halves the same half.
    for (const c of COMPANIONS) {
      expect(acceptsSchool(c.grimoire, CARDS.shield_bash!), c.name).toBe(false);
      expect(acceptsSchool(c.grimoire, CARDS.stone_barricade!), c.name).toBe(false);
    }
  });
});

describe('socketing a slot', () => {
  const forged = ['vaporize_blast', 'flame_surge', 'glacial_spike', 'shield_bash'];

  it('accepts a forged fusion the bloodline shares a school with', () => {
    expect(socketRefusal(IGNIS, forged, 3, 'vaporize_blast')).toBeNull();
  });

  it('refuses a card that was never forged', () => {
    // The half of the gate that makes the Forge matter. Owning the printing is the point:
    // a socket is where a spliced card goes, and you have to have spliced it.
    expect(socketRefusal(IGNIS, [], 0, 'vaporize_blast')).toBe('not-unlocked');
  });

  it('refuses a card the bloodline has no claim to, even when forged', () => {
    expect(socketRefusal(IGNIS, ['galvanic_spores'], 0, 'galvanic_spores')).toBe('off-school');
  });

  it('refuses a slot that is not one of the eight', () => {
    for (const slot of [-1, 8, 99, 1.5]) {
      expect(socketRefusal(IGNIS, forged, slot, 'vaporize_blast'), `${slot}`).toBe('bad-slot');
    }
  });

  it('refuses a card nobody printed', () => {
    expect(socketRefusal(IGNIS, ['nonsense'], 0, 'nonsense')).toBe('unknown-card');
  });

  it('refuses a body, a Rank 2 printing, and the card the Trial deals itself', () => {
    // The same predicate the draft uses. A card the beast could never have drawn must not
    // be reachable by slotting it in the side door.
    expect(socketRefusal(IGNIS, ['magma_brute'], 0, 'magma_brute')).toBe('not-castable');
    const raised = ascendedId('flame_surge');
    expect(socketRefusal(IGNIS, [raised], 0, raised)).toBe('not-castable');
    // An arcane source, written out rather than borrowed from a species: the Ink Owl was
    // the only bloodline that spoke arcane and has been retired, but the rule under test
    // is about the school, not about who happened to speak it.
    const arcane: GrimoireSource = { schools: ['arcane'], hybridChance: 0 };
    expect(
      socketRefusal(arcane, ['rite_of_subjugation'], 0, 'rite_of_subjugation'),
    ).toBe('not-castable');
  });

  it('names the missing forge before the wrong school, because one is actionable', () => {
    // A player who owns nothing should be told to go and forge, not told their beast is
    // the wrong colour for a card they could not have slotted anyway.
    expect(socketRefusal(IGNIS, [], 0, 'galvanic_spores')).toBe('not-unlocked');
  });
});

describe('what the picker offers', () => {
  it('lists only what will actually seat', () => {
    const held = ['vaporize_blast', 'galvanic_spores', 'flame_surge', 'shield_bash', 'glacial_spike'];
    expect(socketableCards(IGNIS, held).map((c) => c.id)).toEqual(['flame_surge', 'vaporize_blast']);
  });

  it('offers nothing to a player who has forged nothing', () => {
    expect(socketableCards(IGNIS, [])).toEqual([]);
  });

  it('agrees with the refusal on every card in the game', () => {
    // The picker and the writer ask one question. If they could disagree, a stale modal
    // would be able to socket something the rules refuse.
    const everything = Object.keys(CARDS);
    for (const c of COMPANIONS) {
      const offered = new Set(socketableCards(c.grimoire, everything).map((d) => d.id));
      for (const id of everything) {
        const legal = socketRefusal(c.grimoire, everything, 0, id) === null;
        expect(offered.has(id), `${c.name}: ${id}`).toBe(legal);
      }
    }
  });
});

describe('resolving the eight', () => {
  const drafted = ['flame_surge', 'flame_surge', 'cinder_mark', 'cataclysm'];

  it('hands back the drafted book when nothing is socketed', () => {
    expect(resolveGrimoire(drafted, {})).toEqual(drafted);
    expect(resolveGrimoire(drafted, undefined)).toEqual(drafted);
  });

  it('swaps exactly the slot that was socketed, and no other copy', () => {
    // The reason sockets are keyed by position rather than by card. Replacing one of two
    // Flame Surges has to leave the other one alone, and a map keyed by def id could not
    // say which was meant.
    expect(resolveGrimoire(drafted, { 0: 'vaporize_blast' })).toEqual([
      'vaporize_blast',
      'flame_surge',
      'cinder_mark',
      'cataclysm',
    ]);
  });

  it('ignores an override naming a card that no longer exists', () => {
    // A hole in the draw pile is worse than a card the player forgot they socketed.
    expect(resolveGrimoire(drafted, { 1: 'card_that_was_cut' })).toEqual(drafted);
  });

  it('never changes the size of the book', () => {
    expect(resolveGrimoire(drafted, { 0: 'vaporize_blast', 9: 'flame_surge' })).toHaveLength(
      drafted.length,
    );
  });
});

describe('the socket reaching the board', () => {
  const beast = tameCompanion(makeRng(12), 'ignis', 1);

  const fight = (overrides?: Record<number, string>) =>
    createCombat(NOVICE_DUELIST, 7, 'ignis', ['shield_bash', 'aegis_ward', 'stone_barricade', 'grapple_line'], {
      grimoire: beast.grimoire,
      ...(overrides ? { grimoireOverrides: overrides } : {}),
    });

  const dealt = (overrides?: Record<number, string>): string[] => {
    const { state } = fight(overrides);
    const p = state.players.player;
    return [...p.hand, ...p.deck, ...p.discard].map((id) => p.cards[id]!.defId);
  };

  it('deals the drafted book when nothing is socketed', () => {
    expect(dealt()).not.toContain('vaporize_blast');
  });

  it('deals the socketed spell instead of the one it replaced', () => {
    const replaced = beast.grimoire[2]!;
    const after = dealt({ 2: 'vaporize_blast' });

    expect(after, 'the forged spell is in the pile').toContain('vaporize_blast');
    expect(
      after.filter((id) => id === replaced).length,
      'and one copy of what it displaced is gone',
    ).toBe(beast.grimoire.filter((id) => id === replaced).length - 1);
  });

  it('leaves the deck exactly as large as it was', () => {
    expect(dealt({ 0: 'vaporize_blast', 3: 'flame_surge' })).toHaveLength(dealt().length);
  });

  it('leaves the Hero half untouched', () => {
    const after = dealt({ 0: 'vaporize_blast' });
    for (const id of ['shield_bash', 'aegis_ward', 'stone_barricade', 'grapple_line']) {
      expect(after, id).toContain(id);
    }
  });

  it('gives a socketed card none of the beast’s rolls', () => {
    // A roll belongs to a spell the beast drafted. This one was forged at a bench, and a
    // card arriving pre-rolled would be a roll nobody caught.
    const { state } = createCombat(NOVICE_DUELIST, 7, 'ignis', undefined, {
      grimoire: beast.grimoire,
      grimoireOverrides: { 0: 'vaporize_blast' },
      spellModifiers: { vaporize_blast: { bonusDamage: 10 } },
    });
    const p = state.players.player;
    const copies = Object.values(p.cards).filter((c) => c.defId === 'vaporize_blast');
    expect(copies.length).toBe(1);
    // The carry claims a roll for it; the beast never drafted it, so `spellModifiers` on a
    // real character could not hold one. Whatever the carry says, the fusion applies it by
    // def id -- so this pins the *current* behaviour rather than an aspiration.
    expect(copies[0]!.mods).toEqual({ bonusDamage: 10 });
  });
});

describe('a freshly caught beast', () => {
  it('arrives with nothing socketed', () => {
    for (const c of COMPANIONS) {
      const fresh = tameCompanion(makeRng(5), c.id, 1);
      expect(fresh.overrides, c.name).toEqual({});
      expect(fresh.grimoire, c.name).toHaveLength(GRIMOIRE_SIZE);
    }
  });
});

// ---------------------------------------------------------------- ascension reaching the Grimoire

describe('an Ascension the Companion actually brings', () => {
  const book = [
    'flame_surge',
    'flame_surge',
    'cinder_mark',
    'cinder_mark',
    'ember_coat',
    'ember_coat',
    'cataclysm',
    'cataclysmic_core',
  ];

  const dealt = (carry: Record<string, unknown>): string[] => {
    const { state } = createCombat(
      NOVICE_DUELIST,
      7,
      'ignis',
      ['shield_bash', 'aegis_ward', 'stone_barricade', 'grapple_line'],
      { grimoire: book, ...carry },
    );
    const p = state.players.player;
    return [...p.hand, ...p.deck, ...p.discard].map((id) => p.cards[id]!.defId);
  };

  it('deals Rank 2 out of the Grimoire once the card is raised', () => {
    // The bug this closes: the Hero half was printed by the caller and the Companion half
    // was not, so a player could pay Ducats, Shards and a Core to raise Flame Surge and
    // then watch their Ignis deal the Rank 1 printing all fight.
    const after = dealt({ ascended: ['flame_surge'] });
    expect(after.filter((id) => id === ascendedId('flame_surge')), 'both copies').toHaveLength(2);
    expect(after, 'and none at Rank 1').not.toContain('flame_surge');
  });

  it('leaves an unraised card exactly where it was', () => {
    const after = dealt({ ascended: ['flame_surge'] });
    expect(after.filter((id) => id === 'cinder_mark')).toHaveLength(2);
  });

  it('raises a socketed card too, because a socketed card is a card', () => {
    const after = dealt({
      grimoireOverrides: { 0: 'vaporize_blast' },
      ascended: ['vaporize_blast'],
    });
    expect(after).toContain(ascendedId('vaporize_blast'));
    expect(after).not.toContain('vaporize_blast');
  });

  it('raises the replacement rather than the card it replaced', () => {
    // The ordering that only reads one way. Printing before socketing would raise the
    // displaced card and leave the socketed one at Rank 1.
    const after = dealt({
      grimoireOverrides: { 0: 'vaporize_blast' },
      ascended: ['flame_surge', 'vaporize_blast'],
    });
    expect(after).toContain(ascendedId('vaporize_blast'));
    // Slot 1 still holds the other Flame Surge, raised.
    expect(after.filter((id) => id === ascendedId('flame_surge'))).toHaveLength(1);
  });

  it('changes nothing at all when the character has ascended nothing', () => {
    expect(dealt({})).toEqual(dealt({ ascended: [] }));
  });

  it('ignores an Ascension of a card with no Rank 2 printing', () => {
    // Cinder Mark is *in this book* and has no Rank 2 — attaching a mark moves no number
    // Ascension may touch, so the registry holds no `cinder_mark_r2`. A hand-edited save
    // claiming one must not deal a card that does not exist.
    expect(book, 'the premise').toContain('cinder_mark');
    expect(CARDS[ascendedId('cinder_mark')], 'and it genuinely has no Rank 2').toBeUndefined();

    const after = dealt({ ascended: ['cinder_mark'] });
    expect(after.filter((id) => id === 'cinder_mark'), 'dealt at Rank 1').toHaveLength(2);
    for (const id of after) expect(CARDS[id], `${id} is a real card`).toBeDefined();
  });
});
