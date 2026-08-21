import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  MINIONS_BY_SPECIES,
  SPELL_POOLS_BY_SPECIES,
  TRAITS_BY_SPECIES,
  grantsFor,
  minionPool,
  rosterUnlocksFor,
  spellPool,
} from '../core/data/pools.js';
import { COMPANIONS, GRIMOIRE_SIZE } from '../core/data/companions.js';
import { COMPANION_TRAITS, traitsFor } from '../core/data/companionTraits.js';
import { CARDS } from '../core/data/cards/index.js';
import { UNIVERSAL_ROSTER, validateRoster } from '../core/data/roster.js';
import { tameCompanion } from '../core/overworld/vivarium.js';
import { draftGrimoire } from '../core/data/grimoire.js';
import { makeRng } from '../core/util/rng.js';
import {
  emptySave,
  grantRosterUnlocks,
  loadSave,
  newProfile,
  writeSave,
  type Profile,
  type SaveFile,
} from '../app/save.js';

/**
 * The three variance pillars, and the one thing that was quietly wrong about them.
 *
 * Two of the three were already built — `draftGrimoire` has drawn eight from a pool since
 * the Grimoire shipped, and `tameCompanion` has rolled one knack from a bloodline since
 * traits existed. What this file mostly does is *pin* them, because "the reward is
 * dynamic" is a claim worth a test rather than a reading of the code.
 *
 * The third had a real defect. Unlocks were derived from the current roster, and the
 * Vivarium has a Release button.
 */

/** A minimal in-memory localStorage, so these run without a DOM. */
function installStorage(): Map<string, string> {
  const store = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
  });
  return store;
}

describe('the species registries', () => {
  beforeEach(() => installStorage());

  it('covers every bloodline in all three', () => {
    for (const c of COMPANIONS) {
      expect(MINIONS_BY_SPECIES[c.id], `${c.name} minions`).toBeDefined();
      expect(SPELL_POOLS_BY_SPECIES[c.id], `${c.name} spells`).toBeDefined();
      expect(TRAITS_BY_SPECIES[c.id], `${c.name} traits`).toBeDefined();
    }
    expect(Object.keys(MINIONS_BY_SPECIES)).toHaveLength(COMPANIONS.length);
  });

  it('gives every bloodline something to draw in each pool', () => {
    // The modularity claim is only worth anything if the pools are non-empty. A species
    // with no bodies is a subjugation trial whose reward is an empty tray.
    for (const c of COMPANIONS) {
      expect(MINIONS_BY_SPECIES[c.id]!.length, `${c.name} has no bodies`).toBeGreaterThan(0);
      expect(SPELL_POOLS_BY_SPECIES[c.id]!.length, `${c.name} has no spells`).toBeGreaterThan(0);
      expect(TRAITS_BY_SPECIES[c.id]!.length, `${c.name} has no knacks`).toBeGreaterThan(1);
    }
  });

  it('names only things that exist', () => {
    for (const c of COMPANIONS) {
      for (const id of MINIONS_BY_SPECIES[c.id]!) expect(CARDS[id], id).toBeDefined();
      for (const id of SPELL_POOLS_BY_SPECIES[c.id]!) expect(CARDS[id], id).toBeDefined();
      for (const id of TRAITS_BY_SPECIES[c.id]!) expect(COMPANION_TRAITS[id], id).toBeDefined();
    }
  });

  it('picks a new card up without anybody editing a registry', () => {
    // The whole reason these are derived. Stone-Heart Golem is a Bulwark body authored
    // with nothing but a `school`, and it is in the pool of every bloodline that speaks
    // Bulwark — the Vault Boar and four of the hybrids — with no per-species list anywhere.
    const bulwarkSpeakers = COMPANIONS.filter((c) => c.grimoire.schools.includes('bulwark'));
    expect(bulwarkSpeakers.length, 'more than one, or this proves nothing').toBeGreaterThan(1);
    for (const c of bulwarkSpeakers) {
      expect(MINIONS_BY_SPECIES[c.id], c.name).toContain('stone_heart_golem');
      expect(SPELL_POOLS_BY_SPECIES[c.id], c.name).toContain('tectonic_plate');
    }
  });

  it('gives a hybrid both of its schools and neither of anybody else’s', () => {
    const gargoyle = MINIONS_BY_SPECIES.gargoyle!;
    expect(gargoyle, 'the Frost half').toContain('glacial_stalker');
    expect(gargoyle, 'and the Dusk half').toContain('hollowed_husk');
    expect(gargoyle, 'but not Bloom').not.toContain('briar_wolf');
  });

  it('agrees with the pools the roll actually draws from', () => {
    // Two sources of truth for "what can this beast roll" would drift, and the drift would
    // be invisible: the registry is what a screen shows and the pool is what the RNG uses.
    for (const c of COMPANIONS) {
      const fromSchools = new Set(c.grimoire.schools.flatMap((s) => minionPool(s).map((m) => m.id)));
      expect(new Set(MINIONS_BY_SPECIES[c.id]), c.name).toEqual(fromSchools);
      expect(TRAITS_BY_SPECIES[c.id], c.name).toEqual(traitsFor(c.id).map((t) => t.id));
      const spells = new Set(c.grimoire.schools.flatMap((s) => spellPool(s).map((m) => m.id)));
      expect(new Set(SPELL_POOLS_BY_SPECIES[c.id]), c.name).toEqual(spells);
    }
  });
});

// ------------------------------------------------------------------- Phase 1

describe('claiming a bloodline', () => {
  beforeEach(() => installStorage());

  it('stamps the bodies onto the character, permanently', () => {
    const p = newProfile('slot-1');
    expect(p.rosterUnlocks, 'a fresh character has no Bulwark').not.toContain('stone_heart_golem');

    const gained = grantRosterUnlocks(p, 'ferrum');
    expect(gained, 'and is told what it just earned').toContain('stone_heart_golem');
    expect(p.rosterUnlocks).toContain('stone_heart_golem');
    expect(validateRoster(['stone_heart_golem'], p.rosterUnlocks)).toEqual([]);
  });

  it('keeps the bodies when the beast is released', () => {
    // The defect this whole field exists for. Unlocks used to be recomputed from the
    // current roster, so letting a Ferrum go took the Bulwark bodies back with it — and
    // because `loadProfile` repairs a warband against the gate, the *next load* then
    // silently deleted the Golem the player had already built into their Vanguard.
    const p = newProfile('slot-1');
    grantRosterUnlocks(p, 'ferrum');
    p.companions = p.companions.filter((c) => c.baseId !== 'ferrum');

    expect(p.rosterUnlocks, 'a claim is a claim').toContain('stone_heart_golem');
    // And the derived rule, which is still the right answer for "what is one worth",
    // genuinely would have taken it away.
    expect(rosterUnlocksFor(p.companions.map((c) => c.baseId))).not.toContain('stone_heart_golem');
  });

  it('says nothing the second time', () => {
    const p = newProfile('slot-1');
    expect(grantRosterUnlocks(p, 'ferrum').length).toBeGreaterThan(0);
    expect(grantRosterUnlocks(p, 'ferrum'), 'already had them').toEqual([]);
  });

  it('stamps the bloodline a new character actually starts beside', () => {
    // Not just the floor. A fresh Commander stands next to an Ignis, so the Pyre bodies
    // are theirs from the first Vanguard screen — otherwise the beast in the tank would be
    // worth a Grimoire and nothing else.
    const p = newProfile('slot-1');
    for (const id of grantsFor('ignis')) expect(p.rosterUnlocks, id).toContain(id);
    expect(validateRoster(['ember_moth'], p.rosterUnlocks), 'a Pyre body, day one').toEqual([]);
  });

  it('always leaves a tray to open, in the character’s own colour', () => {
    // `DEFAULT_ROSTER` is deliberately no longer in this floor. It carries a Cinder Lobber
    // and a Longshot Stalker, which was the right default while every character was an
    // Ignis and is wrong now that a Boreas can exist -- so what is guaranteed is the
    // universal line plus the school they actually enrolled in.
    const p = newProfile('slot-1', 'Commander', 'frost');
    for (const id of UNIVERSAL_ROSTER) expect(p.rosterUnlocks, id).toContain(id);
    expect(validateRoster(p.roster, p.rosterUnlocks), 'the opening warband').toEqual([]);
    expect(p.rosterUnlocks, 'their own school').toContain('glacial_stalker');
    expect(p.rosterUnlocks, 'and nobody else’s').not.toContain('longshot_stalker');
  });

  it('survives a round trip, and takes nothing away from an older save', () => {
    const p = newProfile('slot-1');
    grantRosterUnlocks(p, 'ferrum');
    p.roster = ['vanguard_footman', 'stone_heart_golem'];
    // Released afterwards, which is the case the migration has to be generous about.
    p.companions = p.companions.filter((c) => c.baseId !== 'ferrum');

    const file: SaveFile = { ...emptySave(), profiles: { 'slot-1': p } };
    writeSave(file);
    const back = loadSave().save.profiles['slot-1']!;

    expect(back.rosterUnlocks, 'stored and read back').toContain('stone_heart_golem');
    expect(back.roster, 'and the warband is left alone').toContain('stone_heart_golem');
  });

  it('backfills a save written before the ledger existed', () => {
    const p = newProfile('slot-1');
    grantRosterUnlocks(p, 'ferrum');
    p.roster = ['vanguard_footman', 'stone_heart_golem'];

    const raw = JSON.parse(JSON.stringify({ ...emptySave(), profiles: { 'slot-1': p } }));
    // An old save has no such key at all, and its warband is the only evidence left.
    delete raw.profiles['slot-1'].rosterUnlocks;
    raw.profiles['slot-1'].companions = [];
    localStorage.setItem('conjure.save', JSON.stringify(raw));

    const back = loadSave().save.profiles['slot-1']!;
    expect(back.rosterUnlocks, 'inferred from what they were fielding').toContain(
      'stone_heart_golem',
    );
    expect(back.roster, 'so nothing is trimmed').toContain('stone_heart_golem');
  });

  it('matches what the rule says a claim is worth', () => {
    // `grantsFor` is the rule and the ledger is the record. They have to agree, or the
    // Vivarium would promise a reward the Vanguard never receives.
    for (const c of COMPANIONS) {
      const p = newProfile('slot-1');
      grantRosterUnlocks(p, c.id);
      for (const id of grantsFor(c.id)) expect(p.rosterUnlocks, `${c.name}: ${id}`).toContain(id);
    }
  });
});

// ------------------------------------------------------------------- Phase 2

describe('the drafted Grimoire', () => {
  it('always draws exactly eight, for every bloodline', () => {
    for (const c of COMPANIONS) {
      for (let seed = 1; seed < 12; seed++) {
        const beast = tameCompanion(makeRng(seed), c.id, 1);
        expect(beast.grimoire, `${c.name} @ ${seed}`).toHaveLength(GRIMOIRE_SIZE);
        for (const id of beast.grimoire) expect(CARDS[id], id).toBeDefined();
      }
    }
  });

  it('draws a different book from a different seed', () => {
    // The variance claim. Two Ignis are two animals, and if they knew the same eight
    // spells the taming roll would be a formality.
    const books = new Set(
      Array.from({ length: 40 }, (_, i) =>
        tameCompanion(makeRng(i + 1), 'ignis', 1).grimoire.slice().sort().join('|'),
      ),
    );
    expect(books.size, 'forty rolls, mostly distinct books').toBeGreaterThan(20);
  });

  it('draws the same book from the same seed', () => {
    const a = tameCompanion(makeRng(404), 'boreas', 1);
    const b = tameCompanion(makeRng(404), 'boreas', 1);
    expect(a.grimoire).toEqual(b.grimoire);
  });

  it('draws from the bloodline’s own pool, and tops up colourless when it must', () => {
    for (const c of COMPANIONS) {
      const own = new Set(SPELL_POOLS_BY_SPECIES[c.id]);
      for (let seed = 1; seed < 8; seed++) {
        for (const id of tameCompanion(makeRng(seed), c.id, 1).grimoire) {
          const def = CARDS[id]!;
          const colourless = def.school === 'neutral' || def.school === 'arcane';
          const fusion = def.spliceOnly === true;
          expect(own.has(id) || colourless || fusion, `${c.name} drew ${id}`).toBe(true);
        }
      }
    }
  });

  it('falls back to colourless utility when a bloodline has no shelf at all', () => {
    // The "pad it out until we author more" rule, exercised directly.
    //
    // No live bloodline reaches this today — the catalog expansion gave every school
    // enough of its own — so the fallback is untestable through `tameCompanion` and would
    // rot unseen. A source naming no schools is the honest way to reach it: pure and
    // hybrid come back empty and every slot falls through.
    const book = draftGrimoire(makeRng(9), { schools: [], hybridChance: 0 }, GRIMOIRE_SIZE);
    expect(book, 'a full book out of nothing but utility').toHaveLength(GRIMOIRE_SIZE);

    const schools = new Set(book.map((id) => CARDS[id]!.school));
    for (const s of schools) expect(['neutral', 'arcane'], 'colourless only').toContain(s);
    // Arcane specifically: it was left out of the fallback by accident, since the set was
    // written before Arcane existed, and both are the same kind of nobody's-school utility.
    expect(schools.has('arcane'), 'Arcane is part of the net').toBe(true);
  });

  it('never exceeds a card’s copy limit', () => {
    for (const c of COMPANIONS) {
      for (let seed = 1; seed < 10; seed++) {
        const counts = new Map<string, number>();
        for (const id of tameCompanion(makeRng(seed), c.id, 1).grimoire) {
          counts.set(id, (counts.get(id) ?? 0) + 1);
        }
        for (const [id, n] of counts) {
          expect(n, `${c.name} drew ${n}x ${id}`).toBeLessThanOrEqual(3);
        }
      }
    }
  });
});

// ------------------------------------------------------------------- Phase 3

describe('the rolled knack', () => {
  it('always lands exactly one, from the bloodline’s own pool', () => {
    for (const c of COMPANIONS) {
      for (let seed = 1; seed < 12; seed++) {
        const beast = tameCompanion(makeRng(seed), c.id, 1);
        expect(beast.traitId, `${c.name} @ ${seed}`).not.toBe('');
        expect(TRAITS_BY_SPECIES[c.id], `${c.name} rolled ${beast.traitId}`).toContain(
          beast.traitId,
        );
        expect(COMPANION_TRAITS[beast.traitId]!.pending, beast.traitId).toBeUndefined();
      }
    }
  });

  it('rolls more than one answer per bloodline', () => {
    for (const c of COMPANIONS) {
      const rolled = new Set(
        Array.from({ length: 40 }, (_, i) => tameCompanion(makeRng(i + 1), c.id, 1).traitId),
      );
      expect(rolled.size, `${c.name} always rolls the same knack`).toBeGreaterThan(1);
    }
  });

  it('is the whole reward, alongside the book and the constitution', () => {
    // What makes one catch worth keeping over another, in one place: three independent
    // rolls off one seed.
    const beast = tameCompanion(makeRng(7), 'sylva', 1);
    expect(beast.traitId).toBeTruthy();
    expect(beast.grimoire).toHaveLength(GRIMOIRE_SIZE);
    expect(beast.baseHpRoll).toBeGreaterThan(0);
  });
});

// ------------------------------------------------------------------- end to end

describe('a claim, end to end', () => {
  beforeEach(() => installStorage());

  it('randomises the book and unlocks the bodies in one go', () => {
    const p: Profile = newProfile('slot-1');
    const before = p.rosterUnlocks.length;

    const beast = tameCompanion(makeRng(31), 'ferrum', p.companions.length + 1);
    p.companions.push(beast);
    grantRosterUnlocks(p, beast.baseId);

    expect(beast.grimoire, 'eight, drafted').toHaveLength(GRIMOIRE_SIZE);
    expect(beast.traitId, 'one knack, rolled').toBeTruthy();
    expect(p.rosterUnlocks.length, 'and bodies, stamped').toBeGreaterThan(before);
    expect(validateRoster(['stone_heart_golem', 'slag_iron_golem'], p.rosterUnlocks)).toEqual([]);
  });
});
