import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  SAVE_VERSION,
  SLOT_IDS,
  STARTING_DUCATS,
  clearSave,
  deleteProfile,
  emptySave,
  firstEmptySlot,
  loadSave,
  newProfile,
  writeSave,
  type Profile,
  type SaveFile,
} from '../app/save.js';
import { COMPANIONS } from '../core/data/companions.js';
import { TIER_WAGER } from '../core/data/bounties.js';
import { HUNTS } from '../core/data/hunts.js';
import { ERRANDS } from '../district/errands.js';
import { dayNumber, NIGHT_ANCHOR } from '../district/daylight.js';
import { traitsFor } from '../core/data/companionTraits.js';
import { validateDeck } from '../core/data/deckRules.js';
import { CARDS } from '../core/data/cards/index.js';
import {
  INVENTORY_LIMIT,
  addConsumable,
  forfeitIfAbandoned,
  newRun,
} from '../core/overworld/state.js';
import { BASE_PACT_HP, HP_ROLL_MAX, HP_ROLL_MIN } from '../core/overworld/vivarium.js';

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

/** A file with a character on the given slots. */
function fileWith(...slots: string[]): SaveFile {
  const file = emptySave();
  for (const slot of slots) {
    file.profiles[slot as (typeof SLOT_IDS)[number]] = newProfile(slot);
  }
  return file;
}

describe('the wall', () => {
  let store: Map<string, string>;
  beforeEach(() => {
    store = installStorage();
  });

  it('starts empty, with nobody chosen', () => {
    const { save, notes } = loadSave();
    expect(save.version).toBe(SAVE_VERSION);
    expect(save.activeProfileId).toBeNull();
    expect(Object.keys(save.profiles)).toHaveLength(0);
    expect(notes).toHaveLength(0);
  });

  it('holds three and no more', () => {
    const file = fileWith(...SLOT_IDS);
    expect(firstEmptySlot(file), 'the wall is full').toBeNull();
    expect(Object.keys(file.profiles)).toHaveLength(3);
  });

  it('hands out the first blank poster', () => {
    expect(firstEmptySlot(emptySave())).toBe('slot-1');
    expect(firstEmptySlot(fileWith('slot-1'))).toBe('slot-2');
    expect(firstEmptySlot(fileWith('slot-1', 'slot-3'))).toBe('slot-2');
  });

  it('gives a new character a legal deck and a stake for the first duel', () => {
    const p = newProfile('slot-1');
    expect(p.name).toBe('Commander');
    expect(p.level).toBe(1);
    // Enough to cover the Novice duel's buy-in and nothing more — see STARTING_DUCATS.
    expect(p.state.overworld.economy.ducats).toBe(STARTING_DUCATS);
    expect(p.state.overworld.economy.ducats).toBeGreaterThanOrEqual(TIER_WAGER.novice);
    expect(p.state.overworld.economy.marrowShards).toBe(0);
    // Two cores in the satchel: the splicing bench has no other way in yet, so a
    // character who could not reach it at all would never learn it exists.
    expect(p.state.overworld.economy.reagents).toEqual({ core_frost: 2, core_surge: 2 });
    expect(p.state.overworld.pact).toEqual({ currentHp: 400, maxHp: 400 });
    expect(p.activeCompanionId, 'an instance id, not a species').toBe(
      p.companions[0]!.instanceId,
    );
    for (const companion of COMPANIONS) {
      expect(validateDeck(p.decks[companion.id]!.cards, p.collection), companion.name).toEqual([]);
    }
  });

  it('round-trips three characters at once', () => {
    const file = fileWith(...SLOT_IDS);
    file.profiles['slot-1']!.name = 'Vessel';
    file.profiles['slot-2']!.state.overworld.economy.ducats = 900;
    file.profiles['slot-3']!.record.wins = 12;
    file.activeProfileId = 'slot-2';
    writeSave(file);

    const { save } = loadSave();
    expect(save.profiles['slot-1']!.name).toBe('Vessel');
    expect(save.profiles['slot-2']!.state.overworld.economy.ducats).toBe(900);
    expect(save.profiles['slot-3']!.record.wins).toBe(12);
    expect(save.activeProfileId).toBe('slot-2');
  });

  it('keeps the other two slots untouched when one is played', () => {
    // The rule the whole refactor exists for. `writeSave` takes the file, so this is true
    // by construction — and this test is what stops that ever becoming untrue.
    const file = fileWith(...SLOT_IDS);
    file.profiles['slot-2']!.state.overworld.economy.ducats = 500;
    file.profiles['slot-3']!.state.overworld.economy.ducats = 500;
    writeSave(file);

    const reopened = loadSave().save;
    reopened.activeProfileId = 'slot-1';
    reopened.profiles['slot-1']!.state.overworld.economy.ducats = 7;
    reopened.profiles['slot-1']!.collection = { unlocked: ['scout_imp'] };
    writeSave(reopened);

    const { save } = loadSave();
    expect(save.profiles['slot-2']!.state.overworld.economy.ducats).toBe(500);
    expect(save.profiles['slot-3']!.state.overworld.economy.ducats).toBe(500);
    expect(save.profiles['slot-2']!.collection.unlocked).not.toContain('a_card_from_a_past_patch');
  });

  it('drops a pointer at a slot with nobody on it', () => {
    const file = fileWith('slot-1');
    file.activeProfileId = 'slot-3';
    writeSave(file);
    expect(loadSave().save.activeProfileId, 'better the wall than a ghost').toBeNull();
  });

  it('shares the difficulty across characters, because it is a preference', () => {
    const file = fileWith('slot-1', 'slot-2');
    file.difficulty = 'Adept';
    writeSave(file);
    expect(loadSave().save.difficulty).toBe('Adept');
  });

  it('recovers from a torn write', () => {
    writeSave(fileWith('slot-1'));
    const good = fileWith('slot-1');
    good.profiles['slot-1']!.name = 'Survivor';
    writeSave(good);

    store.set('conjure.save', '{ this is not json');

    const { save, notes } = loadSave();
    expect(notes.join(' ')).toMatch(/damaged|Could not read/);
    expect(save.profiles['slot-1']).toBeDefined();
  });

  it('falls back to a blank wall when the save and its backup are both unreadable', () => {
    store.set('conjure.save', 'garbage');
    store.set('conjure.save.bak', 'also garbage');
    const { save, notes } = loadSave();
    expect(Object.keys(save.profiles)).toHaveLength(0);
    expect(notes.length).toBeGreaterThan(0);
  });

  it('clears everything', () => {
    writeSave(fileWith('slot-1'));
    clearSave();
    expect(Object.keys(loadSave().save.profiles)).toHaveLength(0);
  });
});

describe('the upgrade from one character to three', () => {
  beforeEach(() => {
    installStorage();
  });

  /** A v6 file: one character at the root, no notion of a slot. */
  function legacy(over: Record<string, unknown> = {}): void {
    const overworld = newRun(5);
    overworld.economy = { ducats: 640, marrowShards: 4, reagents: {} };
    overworld.pact = { currentHp: 22, maxHp: 40 };

    localStorage.setItem(
      'conjure.save',
      JSON.stringify({
        version: 6,
        collection: { unlocked: ['scout_imp', 'shield_bash'], ascended: ['shield_bash'] },
        decks: {},
        activeCompanionId: 'boreas',
        companions: { boreas: { level: 3, bonusMaxHp: 4, startingArmor: 0, bonusBones: 0 } },
        difficulty: 'Adept',
        record: { wins: 4, losses: 1, bound: 0 },
        overworld,
        ...over,
      }),
    );
  }

  it('pins the old character to the first poster rather than binning them', () => {
    legacy();
    const { save, notes } = loadSave();

    expect(save.activeProfileId).toBe('slot-1');
    expect(notes.join(' ')).toMatch(/first poster/i);
    expect(save.profiles['slot-2'], 'and the other two stay blank').toBeUndefined();
  });

  it('brings their purse, their Pact and their Ascensions with them', () => {
    legacy();
    const p = loadSave().save.profiles['slot-1']!;

    expect(p.state.overworld.economy.ducats).toBe(640);
    expect(p.state.overworld.economy.marrowShards).toBe(4);
    expect(p.state.overworld.pact.currentHp).toBe(220);
    expect(p.collection.ascended).toContain('shield_bash');
    expect(p.record.wins).toBe(4);
  });

  it('keeps the difficulty, which was never theirs to keep', () => {
    legacy();
    expect(loadSave().save.difficulty).toBe('Adept');
  });

  it('restores the Pact ceiling their Companion had earned', () => {
    // A levelled Companion read off disk used to sit at the base 40 until the next level
    // was bought, because nothing resynced the gauge on load.
    legacy();
    const p = loadSave().save.profiles['slot-1']!;
    // The pointer is an instance now, and the migrated beast keeps the body it had been
    // fighting with — 40, not a fresh roll, so upgrading is not a lottery ticket.
    const active = p.companions.find((c) => c.instanceId === p.activeCompanionId)!;
    expect(active.baseId).toBe('boreas');
    expect(active.baseHpRoll).toBe(400);
    expect(p.state.overworld.pact.maxHp).toBe(440);
    expect(p.level, 'and the poster shows the level without opening them').toBe(3);
  });

  it('collects on a fight they walked out of', () => {
    legacy({
      overworld: {
        ...newRun(5),
        activeEncounter: { bountyId: 'x', spoils: { ducats: 90 } },
      },
    });
    const p = loadSave().save.profiles['slot-1']!;
    expect(p.state.overworld.activeEncounter, 'still open on disk').not.toBeNull();
    expect(forfeitIfAbandoned(p.state.overworld)).toBe(true);
  });
});

describe('one character on disk', () => {
  beforeEach(() => {
    installStorage();
  });

  const saved = (edit: (p: Profile) => void): Profile => {
    const file = fileWith('slot-1');
    edit(file.profiles['slot-1']!);
    writeSave(file);
    return loadSave().save.profiles['slot-1']!;
  };

  it('carries a wounded, half-spent character', () => {
    const p = saved((c) => {
      c.state.overworld.pact = { currentHp: 170, maxHp: 400 };
      c.state.overworld.economy = { ducats: 95, marrowShards: 4, reagents: {} };
      c.state.overworld.activeBuff = 'ironbrew';
      addConsumable(c.state.overworld, {
        id: 'mending_tonic',
        name: 'Mending Tonic',
        type: 'healing',
        value: 120,
      });
    });

    expect(p.state.overworld.pact.currentHp).toBe(170);
    // The ceiling comes from whichever beast is standing there, so it is the roll rather
    // than a constant — the point of the taming loop.
    expect(p.state.overworld.pact.maxHp).toBe(p.companions[0]!.baseHpRoll);
    expect(p.state.overworld.economy.ducats).toBe(95);
    expect(p.state.overworld.economy.marrowShards).toBe(4);
    expect(p.state.overworld.activeBuff).toBe('ironbrew');
    expect(p.state.overworld.inventory).toHaveLength(1);
  });

  it('never restores a live fight handle', () => {
    // A reload is not a resume. The open contract on `overworld` is what the forfeit
    // failsafe reads; `combat` is a pointer into a session that no longer exists.
    const p = saved((c) => {
      c.state.combat = { pretend: 'a live fight' };
    });
    expect(p.state.combat).toBeNull();
  });

  it('clamps a hand-edited character instead of trusting it', () => {
    const file = fileWith('slot-1');
    writeSave(file);
    const raw = JSON.parse(localStorage.getItem('conjure.save')!);
    raw.profiles['slot-1'].state.overworld = {
      pact: { currentHp: 99999, maxHp: 400 },
      economy: { ducats: -50, marrowShards: 2.7 },
      inventory: Array.from({ length: 6 }, () => ({
        id: 'mending_tonic',
        name: 'Mending Tonic',
        type: 'healing',
        value: 12,
      })),
      activeBuff: 'not_a_real_brew',
    };
    localStorage.setItem('conjure.save', JSON.stringify(raw));

    const restored = loadSave().save.profiles['slot-1']!;
    const over = restored.state.overworld;

    // Two clamps run here, in this order, and the second is not the first undone:
    // `readOverworld` caps the hand-edited 9999 at the *stored* gauge of 40, and then
    // `syncPactCeiling` sets the real ceiling from the beast standing beside them. A
    // bigger beast is a bigger gauge, not a heal — so a 43 HP companion leaves this
    // character at 40 with room to spare, and asserting the roll itself would fail
    // whenever the roll came up above the stored gauge.
    const ceiling = restored.companions[0]!.baseHpRoll;
    expect(over.pact.maxHp, 'the gauge belongs to the beast').toBe(ceiling);
    expect(over.pact.currentHp, 'cannot exceed the gauge').toBeLessThanOrEqual(over.pact.maxHp);
    expect(over.pact.currentHp, 'clamped down from 9999').toBe(Math.min(BASE_PACT_HP, ceiling));
    expect(over.economy.ducats, 'no negative purse').toBe(0);
    expect(Number.isInteger(over.economy.marrowShards)).toBe(true);
    expect(over.inventory.length, 'capped at the satchel limit').toBe(INVENTORY_LIMIT);
    expect(over.activeBuff, 'an unreadable brew becomes none').toBeNull();
  });

  it('keeps a hybrid wearing a knack it inherited from a parent', () => {
    // A Chimera of the Caldera legitimately rolls Rimed Lungs, which is filed under
    // `boreas`. Validating the saved trait by `trait.baseId === baseId` rejected exactly
    // that and quietly reset the beast to the first knack in its pool — a player's
    // Companion changing what it was good at because they closed the game.
    //
    // Deliberately *not* an `ignis` knack: those sort to the front of a Chimera's pool, so
    // the reset fallback lands on one and the assertion cannot tell the two apart.
    const file = fileWith('slot-1');
    file.profiles['slot-1']!.companions[0] = {
      ...file.profiles['slot-1']!.companions[0]!,
      baseId: 'chimera',
      traitId: 'rimed_lungs',
    };
    writeSave(file);

    const back = loadSave().save.profiles['slot-1']!.companions[0]!;
    expect(back.traitId).toBe('rimed_lungs');
  });

  it('still refuses a knack no bloodline of that beast can roll', () => {
    const file = fileWith('slot-1');
    file.profiles['slot-1']!.companions[0] = {
      ...file.profiles['slot-1']!.companions[0]!,
      baseId: 'chimera',
      // Sylva is not a parent of a Chimera, and `hollow_ice` is pending and unrollable.
      traitId: 'toxic_bloom',
    };
    writeSave(file);

    const back = loadSave().save.profiles['slot-1']!.companions[0]!;
    expect(back.traitId).not.toBe('toxic_bloom');
    expect(traitsFor('chimera').some((t) => t.id === back.traitId)).toBe(true);
  });

  it('keeps no deck of its own — the master deck is the only one', () => {
    const p = saved(() => {});
    expect(p.state.overworld as unknown as Record<string, unknown>).not.toHaveProperty('deck');
  });

  it('holds a roster of instances, and clamps a hand-edited one', () => {
    const file = fileWith('slot-1');
    file.profiles['slot-1']!.companions[0]!.level = 4;
    file.profiles['slot-1']!.companions[0]!.bonusMaxHp = 6;
    writeSave(file);

    const back = loadSave().save.profiles['slot-1']!.companions[0]!;
    expect(back.level).toBe(4);
    expect(back.bonusMaxHp).toBe(60);
    expect(back.baseHpRoll).toBeGreaterThanOrEqual(HP_ROLL_MIN);
    expect(back.baseHpRoll).toBeLessThanOrEqual(HP_ROLL_MAX);

    const raw = JSON.parse(localStorage.getItem('conjure.save')!);
    raw.profiles['slot-1'].companions = [
      { instanceId: 'ignis-1', baseId: 'ignis', level: -3, bonusMaxHp: -99, baseHpRoll: 4000 },
    ];
    localStorage.setItem('conjure.save', JSON.stringify(raw));

    const fixed = loadSave().save.profiles['slot-1']!.companions[0]!;
    expect(fixed.level).toBe(1);
    expect(fixed.bonusMaxHp).toBe(0);
    expect(fixed.baseHpRoll, 'clamped into the band it could have been rolled in').toBe(
      HP_ROLL_MAX,
    );
  });

  it('starts a character with one tamed beast, rolled', () => {
    const p = newProfile('slot-1');
    expect(p.companions).toHaveLength(1);
    expect(p.companions[0]!.baseId).toBe(COMPANIONS[0]!.id);
    expect(p.companions[0]!.baseHpRoll).toBeGreaterThanOrEqual(HP_ROLL_MIN);
    expect(p.companions[0]!.baseHpRoll).toBeLessThanOrEqual(HP_ROLL_MAX);
    expect(p.activeCompanionId, 'and the pointer names the instance').toBe(
      p.companions[0]!.instanceId,
    );
  });

  it('renames a card held anywhere it names one', () => {
    const file = fileWith('slot-1');
    writeSave(file);
    const raw = JSON.parse(localStorage.getItem('conjure.save')!);
    raw.profiles['slot-1'].collection = { unlocked: ['spark_wisp'], ascended: ['spark_wisp'] };
    // The deck half is observed through the *note* rather than through what survives,
    // because Vaporize Blast is a Spell and a Spell cannot stay in a Hero Deck. That is the
    // point: an id that failed to rename would be an unknown card and would be dropped in
    // silence, so being *counted* — as a Spell rather than merely as debris — is the proof
    // the rename table recognised it.
    raw.profiles['slot-1'].decks.ignis = {
      companionId: 'ignis',
      cards: ['spell_vaporize_blast', 'shield_bash'],
    };
    localStorage.setItem('conjure.save', JSON.stringify(raw));

    const loaded = loadSave();
    const p = loaded.save.profiles['slot-1']!;
    expect(p.collection.unlocked).toContain('marrow_wisp');
    expect(p.collection.unlocked).not.toContain('spark_wisp');

    expect(p.decks.ignis!.cards, 'the Hero-legal card is kept').toEqual(['shield_bash']);
    expect(
      loaded.notes.join(' '),
      'and the renamed hybrid was recognised, then stripped as a Spell',
    ).toMatch(/1 Spell\(s\) left your/);
  });

  it('renames a species the same way, so a rename is not a confiscation', () => {
    // Conduit Kite -> Conduit Kudu. `readRoster` drops any companion whose `baseId` names
    // nothing in `COMPANIONS` — the rule that lets a body genuinely removed from the game
    // stop cluttering the roster — so an unmapped species rename would read as extinction
    // rather than a rename and silently delete the beast from the save.
    const file = fileWith('slot-1');
    writeSave(file);
    const raw = JSON.parse(localStorage.getItem('conjure.save')!);
    const profile = raw.profiles['slot-1'];

    // The shape a genuine pre-rename save has on disk: a companion of the old species, an
    // `activeCompanionId` some saves point at a species rather than an instance (v8 and
    // earlier), and a deck filed under the old id with no 'kudu' entry to collide with —
    // that id did not exist when a save like this was written.
    profile.companions = [{ ...profile.companions[0], instanceId: 'kite-1', baseId: 'kite' }];
    profile.activeCompanionId = 'kite';
    delete profile.decks.kudu;
    // A Hero-legal card, not one of the beast's own Spells — the same reason the rename
    // test above reaches for `shield_bash` rather than something a Grimoire would hold.
    profile.decks.kite = { companionId: 'kite', cards: ['shield_bash'] };
    localStorage.setItem('conjure.save', JSON.stringify(raw));

    const p = loadSave().save.profiles['slot-1']!;
    const beast = p.companions.find((c) => c.instanceId === 'kite-1');

    expect(beast, 'the beast survives the rename rather than being dropped').toBeDefined();
    expect(beast!.baseId).toBe('kudu');
    expect(p.activeCompanionId, 'the species pointer still finds it').toBe('kite-1');
    expect(p.decks.kudu?.cards, 'the deck moves to the new key').toEqual(['shield_bash']);
  });

  it('takes the Spells out of a deck saved before the Fused Grimoire, and leaves the Mark', () => {
    // Two rules in one deck, and the second one is new. The Companion casts the Spells, so
    // Flame Surge can never be legal here again and is stripped rather than flagged.
    //
    // The Cinder Rune in the same list is the other half. It is written to disk under its
    // old id, arrives as `cinder_mark` through the rename map, and **stays** — because a
    // Mark is the Hero's trap now. A migration that confiscated it would be taking a card
    // away from a player at the exact moment the rules started letting them keep it.
    const file = fileWith('slot-1');
    writeSave(file);
    const raw = JSON.parse(localStorage.getItem('conjure.save')!);
    raw.profiles['slot-1'].decks.ignis = {
      companionId: 'ignis',
      cards: ['flame_surge', 'cinder_rune', 'shield_bash', 'aegis_ward'],
    };
    localStorage.setItem('conjure.save', JSON.stringify(raw));

    const loaded = loadSave();
    const p = loaded.save.profiles['slot-1']!;

    expect(p.decks.ignis!.cards).toEqual(['cinder_mark', 'shield_bash', 'aegis_ward']);
    expect(p.decks.ignis!.invalid, 'and it is now too short, so it is flagged').toBe(true);
    expect(loaded.notes.join(' ')).toMatch(/Spell\(s\) left your/);
  });

  it('gives a beast caught before the Grimoire the same roll on every load', () => {
    // Not a fresh roll: re-rolling at load would make every reload a different animal,
    // which is the exact thing storing `baseHpRoll` rather than deriving it prevents.
    const file = fileWith('slot-1');
    writeSave(file);
    const raw = JSON.parse(localStorage.getItem('conjure.save')!);
    delete raw.profiles['slot-1'].companions[0].spellModifiers;
    localStorage.setItem('conjure.save', JSON.stringify(raw));

    const first = loadSave().save.profiles['slot-1']!.companions[0]!;
    const second = loadSave().save.profiles['slot-1']!.companions[0]!;

    expect(first.spellModifiers).toEqual(second.spellModifiers);
  });

  it('starts a character with no plans at all', () => {
    // The first Schematic comes off the first thing they beat. Seeding even one would make
    // the Artificer's door useful before the player has any idea what is behind it.
    expect(newProfile('slot-1').schematics).toEqual([]);
  });

  it('leaves a save written before Schematics with none, rather than backfilling', () => {
    // The tempting migration is "grant a plan for everything they had not got", and it is
    // wrong: that character earned their collection under the old free-rewards economy and
    // handing them the whole catalogue on the way out of it is paying them twice.
    const file = fileWith('slot-1');
    writeSave(file);
    const raw = JSON.parse(localStorage.getItem('conjure.save')!);
    raw.version = 18;
    delete raw.profiles['slot-1'].schematics;
    localStorage.setItem('conjure.save', JSON.stringify(raw));

    const p = loadSave().save.profiles['slot-1']!;
    expect(p.schematics).toEqual([]);
    expect(p.collection.unlocked.length, 'and what they had forged is untouched').toBeGreaterThan(0);
  });

  it('carries plans across a rename, and drops ones that name nothing', () => {
    // Same rule the decks and the collection keep. A Schematic is a thing the player went
    // and earned, so a card being renamed must not quietly confiscate it.
    const file = fileWith('slot-1');
    writeSave(file);
    const raw = JSON.parse(localStorage.getItem('conjure.save')!);
    raw.profiles['slot-1'].schematics = [
      'cinder_rune',
      'shield_bash',
      'a_card_from_a_past_patch',
      'rite_of_subjugation',
      42,
    ];
    localStorage.setItem('conjure.save', JSON.stringify(raw));

    const p = loadSave().save.profiles['slot-1']!;
    expect(p.schematics, 'renamed, kept, and the junk gone').toEqual(['cinder_mark', 'shield_bash']);
  });

  it('takes the Marks out of a Grimoire caught before the role overhaul', () => {
    // Every beast tamed before today has Marks in its book: Ignis drafted Cinder Marks,
    // Mortis drafted Soul Splinters. A Mark is the Hero's trap now, and leaving them would
    // make "a Companion never holds a Mark" true only for players who started this week.
    const file = fileWith('slot-1');
    writeSave(file);
    const raw = JSON.parse(localStorage.getItem('conjure.save')!);
    raw.profiles['slot-1'].companions[0].baseId = 'ignis';
    raw.profiles['slot-1'].companions[0].grimoire = [
      'flame_surge',
      'cinder_rune',
      'cinder_rune',
      'ashen_wake',
      'ember_coat',
      'cataclysm',
      'flame_surge',
      'cataclysmic_core',
    ];
    delete raw.profiles['slot-1'].companions[0].spellModifiers;
    localStorage.setItem('conjure.save', JSON.stringify(raw));

    const beast = loadSave().save.profiles['slot-1']!.companions[0]!;

    expect(beast.grimoire, 'the book is still eight').toHaveLength(8);
    for (const id of beast.grimoire) {
      expect(CARDS[id], id).toBeDefined();
      expect(CARDS[id]!.kind, `${id} is still a Mark`).not.toBe('mark');
    }
    // Slot by slot, not a re-draft. Everything that was legal is exactly where it was --
    // redrawing the whole book would hand the player a different animal than the one they
    // went out and caught.
    expect(beast.grimoire[0]).toBe('flame_surge');
    expect(beast.grimoire[3]).toBe('ashen_wake');
    expect(beast.grimoire[7]).toBe('cataclysmic_core');
  });

  it('repairs that Grimoire the same way on every load', () => {
    // Seeded off the beast's own id, for the same reason the roll is: a repair that used
    // `Math.random` would make every reload a different Companion, which is precisely what
    // storing `baseHpRoll` rather than deriving it exists to prevent.
    const file = fileWith('slot-1');
    writeSave(file);
    const raw = JSON.parse(localStorage.getItem('conjure.save')!);
    raw.profiles['slot-1'].companions[0].baseId = 'ignis';
    raw.profiles['slot-1'].companions[0].grimoire = ['cinder_rune', 'cinder_rune', 'flame_surge'];
    localStorage.setItem('conjure.save', JSON.stringify(raw));

    const first = loadSave().save.profiles['slot-1']!.companions[0]!.grimoire;
    const second = loadSave().save.profiles['slot-1']!.companions[0]!.grimoire;
    expect(first).toEqual(second);
  });

  it('takes the bodies out of a deck saved before the Vanguard overhaul', () => {
    // Stripped rather than flagged: "your deck is illegal" is not actionable when the
    // illegal cards are no longer cards at all. What is left is short, and *that* is
    // flagged in the ordinary way for the player to top up.
    const file = fileWith('slot-1');
    writeSave(file);
    const raw = JSON.parse(localStorage.getItem('conjure.save')!);
    raw.profiles['slot-1'].decks.ignis = {
      companionId: 'ignis',
      cards: ['scout_imp', 'marrow_wisp', 'grave_sentinel', 'shield_bash', 'aegis_ward'],
    };
    localStorage.setItem('conjure.save', JSON.stringify(raw));

    const loaded = loadSave();
    const p = loaded.save.profiles['slot-1']!;

    expect(p.decks.ignis!.cards).toEqual(['shield_bash', 'aegis_ward']);
    expect(p.decks.ignis!.invalid, 'and it is short, so it is flagged').toBe(true);
    expect(loaded.notes.join(' ')).toMatch(/Vanguard Roster/);
  });

  it('restamps the poster metadata on every write', () => {
    const file = fileWith('slot-1');
    file.profiles['slot-1']!.companions[0]!.level = 6;
    file.profiles['slot-1']!.level = 1;
    writeSave(file);

    expect(loadSave().save.profiles['slot-1']!.level, 'cache caught up').toBe(6);
  });

  it('drops a character whose slot holds nonsense', () => {
    const file = fileWith('slot-1', 'slot-2');
    writeSave(file);
    const raw = JSON.parse(localStorage.getItem('conjure.save')!);
    raw.profiles['slot-2'] = 'not a character';
    localStorage.setItem('conjure.save', JSON.stringify(raw));

    const { save } = loadSave();
    expect(save.profiles['slot-1'], 'the good one survives').toBeDefined();
    expect(save.profiles['slot-2']).toBeUndefined();
  });
});

describe('burning a dossier', () => {
  beforeEach(() => {
    installStorage();
  });

  it('frees the slot and leaves the others alone', () => {
    const file = fileWith(...SLOT_IDS);
    file.profiles['slot-1']!.name = 'Keeper';
    file.profiles['slot-3']!.name = 'Also Keeper';

    expect(deleteProfile(file, 'slot-2')).toBe(true);

    expect(file.profiles['slot-2'], 'blank parchment again').toBeUndefined();
    expect(firstEmptySlot(file), 'and the wall offers it back').toBe('slot-2');
    expect(file.profiles['slot-1']!.name).toBe('Keeper');
    expect(file.profiles['slot-3']!.name).toBe('Also Keeper');
  });

  it('takes the pointer with it when the burnt one was named', () => {
    // A pointer at a slot nobody is on would open a ghost. `loadSave` drops a dangling
    // one anyway, but writing one at all leaves a file that is wrong between here and
    // the next load.
    const file = fileWith('slot-1', 'slot-2');
    file.activeProfileId = 'slot-2';

    deleteProfile(file, 'slot-2');
    expect(file.activeProfileId).toBeNull();
  });

  it('leaves the pointer alone when somebody else was burnt', () => {
    const file = fileWith('slot-1', 'slot-2');
    file.activeProfileId = 'slot-1';

    deleteProfile(file, 'slot-2');
    expect(file.activeProfileId, 'you are still the one playing').toBe('slot-1');
  });

  it('refuses a slot with nothing on it, and an id that is not a slot', () => {
    const file = fileWith('slot-1');
    expect(deleteProfile(file, 'slot-2'), 'nothing to burn').toBe(false);
    expect(deleteProfile(file, 'slot-9'), 'not a poster at all').toBe(false);
    expect(Object.keys(file.profiles), 'and nothing was touched').toEqual(['slot-1']);
  });

  it('survives the trip to disk, and the slot can be drafted again', () => {
    const file = fileWith(...SLOT_IDS);
    writeSave(file);

    const reopened = loadSave().save;
    deleteProfile(reopened, 'slot-1');
    writeSave(reopened);

    const after = loadSave().save;
    expect(after.profiles['slot-1']).toBeUndefined();
    expect(Object.keys(after.profiles)).toHaveLength(2);

    after.profiles['slot-1'] = newProfile('slot-1', 'Second Draft');
    writeSave(after);
    expect(loadSave().save.profiles['slot-1']!.name).toBe('Second Draft');
  });

  it('does not resurrect the burnt character in the freed slot', () => {
    // The failure this guards: a delete that only cleared the *pointer* would leave the
    // old character's purse under a new name.
    const file = fileWith('slot-1');
    file.profiles['slot-1']!.state.overworld.economy.ducats = 4000;
    writeSave(file);

    const reopened = loadSave().save;
    deleteProfile(reopened, 'slot-1');
    reopened.profiles['slot-1'] = newProfile('slot-1');
    writeSave(reopened);

    // Back to a new character's stake, not the 4000 the burnt one had banked.
    expect(loadSave().save.profiles['slot-1']!.state.overworld.economy.ducats).toBe(
      STARTING_DUCATS,
    );
  });
});

describe('the guided lap', () => {
  let store: Map<string, string>;
  beforeEach(() => {
    store = installStorage();
  });

  /** Writes a raw save at a chosen version, bypassing `writeSave`'s version stamp. */
  function writeRaw(version: number, tutorial?: unknown): void {
    const file = fileWith('slot-1');
    const raw = JSON.parse(JSON.stringify(file)) as Record<string, unknown>;
    raw.version = version;
    const profiles = raw.profiles as Record<string, Record<string, unknown>>;
    if (tutorial === undefined) delete profiles['slot-1']!.tutorial;
    else profiles['slot-1']!.tutorial = tutorial;
    store.set('conjure.save', JSON.stringify(raw));
  }

  it('starts a new character at the door with nothing walked', () => {
    expect(newProfile('slot-1').tutorial).toEqual([]);
  });

  it('carries the steps a character has actually taken', () => {
    writeRaw(SAVE_VERSION, ['intro', 'artificer']);
    expect(loadSave().save.profiles['slot-1']!.tutorial).toEqual(['intro', 'artificer']);
  });

  it('counts a character from before the ward as having walked it', () => {
    // They have lived in the old Safehouse. Marching them past its doors on upgrade would
    // be the new version taking something away.
    //
    // Pinned to the ward's own landmark (v20's predecessor), not to `SAVE_VERSION - 1`:
    // the relative form silently changed meaning the day v21 shipped, and started
    // testing a v20 save — which post-dates the ward and is owed no backfill.
    writeRaw(19);
    expect(loadSave().save.profiles['slot-1']!.tutorial).toContain('complete');
  });

  it('drops steps nothing checks, rather than stranding the objective on one', () => {
    writeRaw(SAVE_VERSION, ['intro', 'wander_off', 42, null, 'intro']);
    expect(loadSave().save.profiles['slot-1']!.tutorial).toEqual(['intro']);
  });

  it('reads a missing or malformed ledger as nothing walked', () => {
    writeRaw(SAVE_VERSION, 'not an array');
    expect(loadSave().save.profiles['slot-1']!.tutorial).toEqual([]);
  });

  it('survives a round trip through disk', () => {
    const file = fileWith('slot-1');
    file.profiles['slot-1']!.tutorial = ['intro', 'artificer', 'journal'];
    writeSave(file);
    expect(loadSave().save.profiles['slot-1']!.tutorial).toEqual(['intro', 'artificer', 'journal']);
  });
});

describe('the hunt clock', () => {
  let store: Map<string, string>;
  beforeEach(() => {
    store = installStorage();
  });

  /** Writes a raw save at a chosen version, bypassing `writeSave`'s version stamp. */
  function writeRawHunts(version: number, hunts?: unknown): void {
    const file = fileWith('slot-1');
    const raw = JSON.parse(JSON.stringify(file)) as Record<string, unknown>;
    raw.version = version;
    const profiles = raw.profiles as Record<string, Record<string, unknown>>;
    if (hunts === undefined) delete profiles['slot-1']!.hunts;
    else profiles['slot-1']!.hunts = hunts;
    store.set('conjure.save', JSON.stringify(raw));
  }

  const A_HUNT = HUNTS[0]!.encounterId;

  it('starts a new character with every hunt open', () => {
    expect(newProfile('slot-1').hunts).toEqual({});
  });

  it('opens every hunt for a character from before they existed', () => {
    // There is nothing to migrate: a hunt not yet invented has not been walked.
    // Pinned to the literal version before hunts shipped, not to `SAVE_VERSION - 1`: the
    // relative form silently changes meaning the next time the version moves, which is the
    // trap the guided-lap test above records falling into.
    writeRawHunts(21, { [A_HUNT]: 1_700_000_000_000 });
    expect(loadSave().save.profiles['slot-1']!.hunts).toEqual({});
  });

  it('carries a stamp a character actually earned', () => {
    writeRawHunts(SAVE_VERSION, { [A_HUNT]: 1_700_000_000_000 });
    expect(loadSave().save.profiles['slot-1']!.hunts).toEqual({ [A_HUNT]: 1_700_000_000_000 });
  });

  it('drops stamps for hunts that no longer exist, rather than growing forever', () => {
    writeRawHunts(SAVE_VERSION, { [A_HUNT]: 1_000, hunt_retired_long_ago: 2_000 });
    expect(loadSave().save.profiles['slot-1']!.hunts).toEqual({ [A_HUNT]: 1_000 });
  });

  it('refuses a stamp that is not a finite number', () => {
    // NaN would make every comparison in the cooldown false and the arithmetic produce NaN,
    // which reads as neither locked nor open.
    writeRawHunts(SAVE_VERSION, { [A_HUNT]: 'soon', hunt_caldera_drake: null });
    expect(loadSave().save.profiles['slot-1']!.hunts).toEqual({});
  });

  it('reads a missing or malformed map as no hunts walked', () => {
    writeRawHunts(SAVE_VERSION, 'not an object');
    expect(loadSave().save.profiles['slot-1']!.hunts).toEqual({});
    writeRawHunts(SAVE_VERSION, ['array', 'is', 'not', 'a', 'map']);
    expect(loadSave().save.profiles['slot-1']!.hunts).toEqual({});
    writeRawHunts(SAVE_VERSION);
    expect(loadSave().save.profiles['slot-1']!.hunts).toEqual({});
  });

  it('survives a round trip through disk', () => {
    const file = fileWith('slot-1');
    file.profiles['slot-1']!.hunts = { [A_HUNT]: 1_700_000_000_000 };
    writeSave(file);
    expect(loadSave().save.profiles['slot-1']!.hunts).toEqual({ [A_HUNT]: 1_700_000_000_000 });
  });
});

describe('the errand ledger', () => {
  let store: Map<string, string>;
  beforeEach(() => {
    store = installStorage();
  });

  /** Writes a raw save at a chosen version, bypassing `writeSave`'s version stamp. */
  function writeRawErrands(version: number, errands?: unknown): void {
    const file = fileWith('slot-1');
    const raw = JSON.parse(JSON.stringify(file)) as Record<string, unknown>;
    raw.version = version;
    const profiles = raw.profiles as Record<string, Record<string, unknown>>;
    if (errands === undefined) delete profiles['slot-1']!.errands;
    else profiles['slot-1']!.errands = errands;
    store.set('conjure.save', JSON.stringify(raw));
  }

  const AN_ERRAND = ERRANDS[0]!.id;
  const ANOTHER = ERRANDS[1]!.id;

  it('starts a new character owing nobody anything', () => {
    expect(newProfile('slot-1').errands).toEqual({ done: [], active: null });
  });

  it('gives a character from before errands existed an empty ledger', () => {
    // Nothing to migrate, and the opposite call to the guided lap's: no townsperson could ask
    // for anything before v23, so an old character genuinely has not run any. Backfilling would
    // mark work done that was never offered.
    //
    // Pinned to the literal version before errands shipped rather than to `SAVE_VERSION - 1`,
    // which is the trap the two ledgers above both record falling into.
    writeRawErrands(22, { done: [AN_ERRAND], active: null });
    expect(loadSave().save.profiles['slot-1']!.errands).toEqual({ done: [], active: null });
  });

  it('carries what a character actually ran', () => {
    writeRawErrands(SAVE_VERSION, { done: [AN_ERRAND], active: { id: ANOTHER, ready: true } });
    expect(loadSave().save.profiles['slot-1']!.errands).toEqual({
      done: [AN_ERRAND],
      active: { id: ANOTHER, ready: true },
    });
  });

  it('drops an id that no longer names an errand', () => {
    // Unlike `campaign`, which keeps unknown entries so a renamed contract does not quietly
    // un-complete itself. The two ledgers are asked different questions: a campaign ledger
    // records a story that was played, and this one is only ever asked "may this be offered
    // again" -- where a stale id is a job the player can never take.
    writeRawErrands(SAVE_VERSION, { done: [AN_ERRAND, 'errand_deleted_long_ago'], active: null });
    expect(loadSave().save.profiles['slot-1']!.errands.done).toEqual([AN_ERRAND]);
  });

  it('clears an open errand that has stopped existing', () => {
    // The important half. Left in place it is an objective panel pointing at nothing, with no
    // townsperson anywhere who can close it.
    writeRawErrands(SAVE_VERSION, { done: [], active: { id: 'errand_deleted_long_ago', ready: true } });
    expect(loadSave().save.profiles['slot-1']!.errands.active).toBeNull();
  });

  it('refuses to hold one errand both open and already done', () => {
    // A save interrupted between the payout and the write. The ledger is the authority -- it
    // has been paid for -- so the slot is dropped rather than the job being run twice.
    writeRawErrands(SAVE_VERSION, { done: [AN_ERRAND], active: { id: AN_ERRAND, ready: true } });
    const led = loadSave().save.profiles['slot-1']!.errands;
    expect(led.done).toEqual([AN_ERRAND]);
    expect(led.active).toBeNull();
  });

  it('reads a missing or malformed ledger as nothing run', () => {
    writeRawErrands(SAVE_VERSION, 'not an object');
    expect(loadSave().save.profiles['slot-1']!.errands).toEqual({ done: [], active: null });
    writeRawErrands(SAVE_VERSION);
    expect(loadSave().save.profiles['slot-1']!.errands).toEqual({ done: [], active: null });
  });

  it('treats a `ready` that is not true as not ready', () => {
    writeRawErrands(SAVE_VERSION, { done: [], active: { id: AN_ERRAND, ready: 'yes' } });
    expect(loadSave().save.profiles['slot-1']!.errands.active).toEqual({ id: AN_ERRAND, ready: false });
  });

  it('survives a round trip through disk', () => {
    const file = fileWith('slot-1');
    file.profiles['slot-1']!.errands = { done: [AN_ERRAND], active: { id: ANOTHER, ready: false } };
    writeSave(file);
    expect(loadSave().save.profiles['slot-1']!.errands).toEqual({
      done: [AN_ERRAND],
      active: { id: ANOTHER, ready: false },
    });
  });
});

describe('the clock', () => {
  let store: Map<string, string>;
  beforeEach(() => {
    store = installStorage();
  });

  function writeRawClock(version: number, clock?: unknown): void {
    const file = fileWith('slot-1');
    const raw = JSON.parse(JSON.stringify(file)) as Record<string, unknown>;
    raw.version = version;
    const profiles = raw.profiles as Record<string, Record<string, unknown>>;
    if (clock === undefined) delete profiles['slot-1']!.clock;
    else profiles['slot-1']!.clock = clock;
    store.set('conjure.save', JSON.stringify(raw));
  }

  it('starts a new character at the hour the world was measured at', () => {
    // `NIGHT_ANCHOR` is not an arbitrary default. Every value in `AMBIENT` describes the world at
    // exactly this hour, so a character who has done nothing sees the lighting three separate
    // measured passes agreed on.
    expect(newProfile('slot-1').clock).toBe(NIGHT_ANCHOR);
  });

  it('puts a character from before the clock at the same hour', () => {
    // The upgrade is invisible: they walk back into the ward they left. Pinned to the literal
    // version before the clock shipped rather than to `SAVE_VERSION - 1`, which is the trap the
    // three ledgers above all record falling into.
    writeRawClock(23, 14);
    expect(loadSave().save.profiles['slot-1']!.clock).toBe(NIGHT_ANCHOR);
  });

  it('carries an hour a character actually reached', () => {
    writeRawClock(SAVE_VERSION, 13.75);
    expect(loadSave().save.profiles['slot-1']!.clock).toBe(13.75);
  });

  it('keeps the day, because the sky is reading it', () => {
    // This used to wrap into a day, and the sky changing is what stopped it. The clock counts
    // hours since the character started; `dayNumber` divides it and `skyStrengthAt` rolls the
    // weather off the result. Wrapping threw the day away every midnight, which made every day
    // the same day.
    writeRawClock(SAVE_VERSION, 26.5);
    expect(loadSave().save.profiles['slot-1']!.clock).toBe(26.5);
    writeRawClock(SAVE_VERSION, 24 * 40 + 6);
    expect(loadSave().save.profiles['slot-1']!.clock).toBe(966);
  });

  it('still refuses a clock from before the character existed', () => {
    // The one direction that is not a reading. A negative clock is a corrupt file, not day minus
    // one, and `dayNumber` would floor it to something no roll should ever be asked for.
    writeRawClock(SAVE_VERSION, -2);
    expect(loadSave().save.profiles['slot-1']!.clock).toBe(0);
  });

  it('reads a v24 file as day zero, which is what it is', () => {
    // Why the sky changing cost no save version. Every clock written by v24 is a number between
    // 0 and 24, and that is already a valid monotonic reading -- it means the first day. There
    // was nothing to migrate.
    writeRawClock(24, 21.5);
    const clock = loadSave().save.profiles['slot-1']!.clock;
    expect(clock).toBe(21.5);
    expect(dayNumber(clock)).toBe(0);
  });

  it('refuses an hour that is not a finite number', () => {
    // `NaN` is the one worth guarding. Every comparison in `daylightAt` would be false, so it
    // falls through to "no daylight" -- and the world would be permanently, inexplicably at
    // night with nothing to point at. The same failure `readHunts` refuses a NaN stamp for.
    writeRawClock(SAVE_VERSION, Number.NaN);
    expect(loadSave().save.profiles['slot-1']!.clock).toBe(NIGHT_ANCHOR);
    writeRawClock(SAVE_VERSION, 'dawn');
    expect(loadSave().save.profiles['slot-1']!.clock).toBe(NIGHT_ANCHOR);
    writeRawClock(SAVE_VERSION);
    expect(loadSave().save.profiles['slot-1']!.clock).toBe(NIGHT_ANCHOR);
  });

  it('survives a round trip through disk', () => {
    const file = fileWith('slot-1');
    file.profiles['slot-1']!.clock = 9.25;
    writeSave(file);
    expect(loadSave().save.profiles['slot-1']!.clock).toBe(9.25);
  });
});
