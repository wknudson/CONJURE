import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  MINIONS_BY_SPECIES,
  PLAYABLE_SCHOOLS,
  SPECIES_BY_SCHOOL,
  foundersOf,
  playableFrom,
  SPELL_POOLS_BY_SPECIES,
  speciesForSchool,
  startingRosterFor,
} from '../core/data/pools.js';
import { COMPANIONS, DEFAULT_SCHOOL, GRIMOIRE_SIZE, companionById } from '../core/data/companions.js';
import { CARDS, STARTER_DECK } from '../core/data/cards/index.js';
import {
  HERO_SCHOOLS,
  MAX_DECK,
  MIN_DECK,
  fusedDeckSize,
  validateDeck,
} from '../core/data/deckRules.js';
import {
  STARTING_WARBAND_POINTS,
  rosterCost,
  rosterPointsOf,
  validateRoster,
} from '../core/data/roster.js';
import { COMPANION_TRAITS } from '../core/data/companionTraits.js';
import { newProfile } from '../app/save.js';

/**
 * Enrolment: the one decision a character is made of.
 *
 * Four things fall out of the school a player picks — the bloodline beside them, the eight
 * spells it drafts, the bodies their Vanguard may field, and therefore the other half of
 * their opening fifteen. This file walks all six disciplines through all four, because a
 * flow that works for Pyre and quietly hands a Bloom character an empty tray is the exact
 * failure a derived catalog is supposed to make impossible.
 */

function installStorage(): void {
  const store = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
  });
}

describe('the disciplines on offer', () => {
  it('offers exactly the six the design names', () => {
    expect([...PLAYABLE_SCHOOLS].sort()).toEqual(
      ['bloom', 'bulwark', 'dusk', 'frost', 'pyre', 'surge'].sort(),
    );
  });

  it('gives each one a mono-element bloodline of its own', () => {
    for (const school of PLAYABLE_SCHOOLS) {
      const baseId = speciesForSchool(school);
      expect(baseId, school).toBeDefined();
      const species = companionById(baseId!)!;
      expect(species.grimoire.schools, `${school} founder`).toEqual([school]);
    }
  });

  it('never offers a hybrid as a starting point', () => {
    // A character does not begin holding two schools. `SPECIES_BY_SCHOOL` filters on the
    // *pool*, not on `def.school`, which is what keeps a Chimera — filed under pyre for
    // its Resonance — from being handed to somebody who chose Pyre.
    const founders = new Set(Object.values(SPECIES_BY_SCHOOL));
    for (const id of founders) {
      expect(companionById(id)!.grimoire.schools, id).toHaveLength(1);
    }
    expect(founders.has('chimera'), 'no hybrid founders').toBe(false);
  });

  it('turns a hybrid away, even at the front of the list', () => {
    // `SPECIES_BY_SCHOOL` cannot demonstrate this on its own: the shipped roster lists all
    // seven mono bloodlines before any hybrid, so "first wins" hides the mono check
    // entirely. Handing the rule a list in the other order is the only way to see it work.
    const founders = foundersOf([
      { id: 'chimera', grimoire: { schools: ['pyre', 'frost'], hybridChance: 35 } },
      { id: 'ignis', grimoire: { schools: ['pyre'], hybridChance: 5 } },
    ]);
    expect(founders.pyre, 'the mono one, not the hybrid').toBe('ignis');
    expect(founders.frost, 'and the hybrid founds nothing').toBeUndefined();
  });

  it('keeps the first of two bloodlines that speak one school', () => {
    const founders = foundersOf([
      { id: 'boreas', grimoire: { schools: ['frost'], hybridChance: 5 } },
      { id: 'a_second_frost_beast', grimoire: { schools: ['frost'], hybridChance: 5 } },
    ]);
    expect(founders.frost, 'stable under a save').toBe('boreas');
  });

  it('leaves a school with no bloodline unfounded', () => {
    // Which is what `PLAYABLE_SCHOOLS` filters on: a school authored before its founding
    // species would otherwise reach the selection screen and hand out an undefined beast.
    const founders = foundersOf([{ id: 'ignis', grimoire: { schools: ['pyre'], hybridChance: 5 } }]);
    expect(founders.bloom).toBeUndefined();
    expect(Object.keys(founders)).toEqual(['pyre']);
  });

  it('keeps an unfounded school off the selection screen', () => {
    // A school authored before its founding species would otherwise appear as a panel and
    // hand out an undefined Companion. Unobservable against the shipped roster, where all
    // six are founded, so the filter is asked about a map with a hole in it.
    const partial = playableFrom({ pyre: 'ignis', frost: 'boreas' });
    expect(partial).toEqual(['pyre', 'frost']);
    expect(playableFrom({}), 'nothing founded, nothing offered').toEqual([]);
  });

  it('names one founder per school and no school twice', () => {
    const founders = Object.values(SPECIES_BY_SCHOOL);
    expect(new Set(founders).size, 'one bloodline cannot found two schools').toBe(founders.length);
  });

  it('falls back to the school the game started with', () => {
    expect(PLAYABLE_SCHOOLS).toContain(DEFAULT_SCHOOL);
    expect(speciesForSchool(DEFAULT_SCHOOL)).toBe(COMPANIONS[0]!.id);
  });
});

describe('the opening warband', () => {
  it('is legal, and in the character’s own colour', () => {
    for (const school of PLAYABLE_SCHOOLS) {
      const line = startingRosterFor(school);
      expect(line.length, `${school} line`).toBeGreaterThan(0);
      expect(rosterCost(line), `${school} budget`).toBeLessThanOrEqual(STARTING_WARBAND_POINTS);

      const own = new Set(MINIONS_BY_SPECIES[speciesForSchool(school)!]);
      for (const id of line) {
        const universal = CARDS[id]!.school === 'neutral' || CARDS[id]!.school === 'arcane';
        expect(universal || own.has(id), `${school} fielded ${id}`).toBe(true);
      }
    }
  });

  it('actually fields a body of the school, not just the universal two', () => {
    // The failure this guards against is silent: a warband of Footmen and Scout Imps is
    // legal, spends the budget, and passes every other assertion in this file while
    // telling the player nothing about the discipline they just chose.
    for (const school of PLAYABLE_SCHOOLS) {
      const own = new Set(MINIONS_BY_SPECIES[speciesForSchool(school)!]);
      expect(own.size, `${school} has no bodies to field`).toBeGreaterThan(0);
      const line = startingRosterFor(school);
      expect(line.some((id) => own.has(id)), `${school} opened in nobody's colour`).toBe(true);
    }
  });

  it('spends everything it can spend', () => {
    // Not "exactly ten" — no school has a one-point body, so a line that took a 3-cost
    // specialist can finish on nine with nothing that fits the remainder.
    for (const school of PLAYABLE_SCHOOLS) {
      const line = startingRosterFor(school);
      const cheapest = Math.min(
        ...[...line, ...MINIONS_BY_SPECIES[speciesForSchool(school)!]!].map((id) =>
          rosterPointsOf(CARDS[id]!),
        ),
      );
      expect(rosterCost(line) + cheapest, `${school} left room`).toBeGreaterThan(
        STARTING_WARBAND_POINTS,
      );
    }
  });

  it('picks a new body up the day it is authored', () => {
    // The Stone-Heart Golem is a Bulwark body written with nothing but a `school`, and it
    // is in Bulwark's opening consideration set with no per-school list anywhere.
    expect(MINIONS_BY_SPECIES.ferrum).toContain('stone_heart_golem');
  });
});

describe('a freshly enrolled character', () => {
  beforeEach(() => installStorage());

  it('starts beside a beast of the school they chose', () => {
    for (const school of PLAYABLE_SCHOOLS) {
      const p = newProfile('slot-1', 'Commander', school);
      expect(p.companions, school).toHaveLength(1);
      expect(p.companions[0]!.baseId, school).toBe(speciesForSchool(school));
      expect(p.activeCompanionId, `${school} active`).toBe(p.companions[0]!.instanceId);
    }
  });

  it('rolls that beast rather than issuing a fixture', () => {
    // Three independent rolls, the same ones a wild catch makes. A character handed a
    // guaranteed constitution and a fixed knack would learn nothing from their second beast.
    const beast = newProfile('slot-1', 'Commander', 'frost').companions[0]!;
    expect(beast.baseHpRoll).toBeGreaterThan(0);
    expect(beast.traitId, 'a knack').toBeTruthy();
    expect(COMPANION_TRAITS[beast.traitId]!.baseId, 'from its own lineage').toBeTruthy();
    expect(beast.grimoire, 'and a drafted book').toHaveLength(GRIMOIRE_SIZE);
  });

  it('rolls a different beast each time', () => {
    const rolls = new Set(
      Array.from({ length: 25 }, () => {
        const b = newProfile('slot-1', 'Commander', 'bloom').companions[0]!;
        return `${b.baseHpRoll}|${b.traitId}|${b.grimoire.slice().sort().join(',')}`;
      }),
    );
    expect(rolls.size, 'twenty-five enrolments, mostly distinct beasts').toBeGreaterThan(10);
  });

  it('opens with a fifteen-card deck: seven of theirs, eight of the beast’s', () => {
    // The brief's "exactly 15". The Hero half is 4–12 and strictly colourless, and the
    // elemental half is what the Companion brings — so fifteen is the *fused* deck, which
    // is the only reading that satisfies both halves of Phase 4 without rewriting a rule.
    expect(STARTER_DECK).toHaveLength(7);
    expect(fusedDeckSize(STARTER_DECK.length), 'the opening deck').toBe(15);

    for (const school of PLAYABLE_SCHOOLS) {
      const p = newProfile('slot-1', 'Commander', school);
      const hero = p.decks[p.companions[0]!.baseId]!.cards;
      expect(hero, `${school} hero half`).toHaveLength(7);
      expect(fusedDeckSize(hero.length), `${school} fused`).toBe(15);
      expect(validateDeck(hero, p.collection), `${school} legality`).toEqual([]);
    }
  });

  it('keeps the Hero half colourless and the elemental half the beast’s', () => {
    for (const school of PLAYABLE_SCHOOLS) {
      const p = newProfile('slot-1', 'Commander', school);
      const beast = p.companions[0]!;

      for (const id of p.decks[beast.baseId]!.cards) {
        expect(HERO_SCHOOLS, `${school}: ${id} in the Hero half`).toContain(CARDS[id]!.school);
      }
      // And the school the player picked is what the other eight are drawn from.
      const pool = new Set(SPELL_POOLS_BY_SPECIES[beast.baseId]);
      const elemental = beast.grimoire.filter((id) => !HERO_SCHOOLS.includes(CARDS[id]!.school));
      expect(elemental.length, `${school} drew nothing of its own`).toBeGreaterThan(0);
      for (const id of elemental) {
        const fusion = CARDS[id]!.spliceOnly === true;
        expect(pool.has(id) || fusion, `${school} drew ${id}`).toBe(true);
      }
    }
  });

  it('leaves the deck room to grow', () => {
    expect(STARTER_DECK.length).toBeGreaterThanOrEqual(MIN_DECK);
    expect(STARTER_DECK.length, 'five Hero slots still open').toBeLessThan(MAX_DECK);
  });

  it('unlocks the universal bodies and its own school, and nobody else’s', () => {
    const p = newProfile('slot-1', 'Commander', 'frost');
    expect(p.rosterUnlocks, 'universal').toContain('vanguard_footman');
    expect(p.rosterUnlocks, 'its own').toContain('glacial_stalker');
    expect(p.rosterUnlocks, 'not Dusk').not.toContain('hollowed_husk');
    expect(p.rosterUnlocks, 'not Bulwark').not.toContain('stone_heart_golem');
    // The two bodies `DEFAULT_ROSTER` carries. They were in the unlock floor while every
    // character was an Ignis, and a Boreas holding a Cinder Lobber would undo the choice.
    expect(p.rosterUnlocks, 'not the old Pyre default').not.toContain('cinder_lobber');
    expect(p.rosterUnlocks, 'nor the old Dusk one').not.toContain('longshot_stalker');
  });

  it('can field the warband it was given, in every discipline', () => {
    for (const school of PLAYABLE_SCHOOLS) {
      const p = newProfile('slot-1', 'Commander', school);
      expect(validateRoster(p.roster, p.rosterUnlocks), school).toEqual([]);
    }
  });

  it('starts broke', () => {
    const p = newProfile('slot-1', 'Commander', 'dusk');
    expect(p.state.overworld.economy.ducats).toBe(0);
    expect(p.state.overworld.economy.marrowShards).toBe(0);
  });

  it('defaults to the founding school when nobody chose', () => {
    // Two dozen tests and the legacy title flow call this with a slot and nothing else.
    const p = newProfile('slot-1');
    expect(p.companions[0]!.baseId).toBe(speciesForSchool(DEFAULT_SCHOOL));
  });

  it('lands somewhere playable if the school is nonsense', () => {
    // A save file is data, and hand-edited data should put the player in the game rather
    // than in a stack trace.
    const p = newProfile('slot-1', 'Commander', 'not_a_school' as never);
    expect(p.companions[0]!.baseId).toBe(COMPANIONS[0]!.id);
    expect(validateRoster(p.roster, p.rosterUnlocks)).toEqual([]);
  });
});
