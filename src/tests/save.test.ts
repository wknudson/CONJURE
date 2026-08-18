import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  SAVE_VERSION,
  SLOT_IDS,
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
import { validateDeck } from '../core/data/deckRules.js';
import {
  INVENTORY_LIMIT,
  addConsumable,
  forfeitIfAbandoned,
  newRun,
} from '../core/overworld/state.js';
import { newCompanion } from '../core/overworld/vivarium.js';

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

  it('gives a new character a legal deck and an empty purse', () => {
    const p = newProfile('slot-1');
    expect(p.name).toBe('Commander');
    expect(p.level).toBe(1);
    expect(p.state.overworld.economy).toEqual({ ducats: 0, marrowShards: 0 });
    expect(p.state.overworld.pact).toEqual({ currentHp: 40, maxHp: 40 });
    expect(p.activeCompanionId).toBe(COMPANIONS[0]!.id);
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
    reopened.profiles['slot-1']!.collection = { owned: { scout_imp: 99 } };
    writeSave(reopened);

    const { save } = loadSave();
    expect(save.profiles['slot-2']!.state.overworld.economy.ducats).toBe(500);
    expect(save.profiles['slot-3']!.state.overworld.economy.ducats).toBe(500);
    expect(save.profiles['slot-2']!.collection.owned.scout_imp).not.toBe(99);
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
    overworld.economy = { ducats: 640, marrowShards: 4 };
    overworld.pact = { currentHp: 22, maxHp: 40 };

    localStorage.setItem(
      'conjure.save',
      JSON.stringify({
        version: 6,
        collection: { owned: { scout_imp: 3, shield_bash: 3 }, ascended: ['shield_bash'] },
        decks: {},
        activeCompanionId: 'boreas',
        companions: { boreas: { level: 3, bonusMaxHp: 4, startingArmor: 0, bonusPips: 0 } },
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

    expect(p.state.overworld.economy).toEqual({ ducats: 640, marrowShards: 4 });
    expect(p.state.overworld.pact.currentHp).toBe(22);
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
    expect(p.activeCompanionId).toBe('boreas');
    expect(p.state.overworld.pact.maxHp).toBe(44);
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
      c.state.overworld.pact = { currentHp: 17, maxHp: 40 };
      c.state.overworld.economy = { ducats: 95, marrowShards: 4 };
      c.state.overworld.activeBuff = 'ironbrew';
      addConsumable(c.state.overworld, {
        id: 'mending_tonic',
        name: 'Mending Tonic',
        type: 'healing',
        value: 12,
      });
    });

    expect(p.state.overworld.pact).toEqual({ currentHp: 17, maxHp: 40 });
    expect(p.state.overworld.economy).toEqual({ ducats: 95, marrowShards: 4 });
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
      pact: { currentHp: 9999, maxHp: 40 },
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

    const over = loadSave().save.profiles['slot-1']!.state.overworld;
    expect(over.pact.currentHp, 'cannot exceed the gauge').toBe(40);
    expect(over.economy.ducats, 'no negative purse').toBe(0);
    expect(Number.isInteger(over.economy.marrowShards)).toBe(true);
    expect(over.inventory.length, 'capped at the satchel limit').toBe(INVENTORY_LIMIT);
    expect(over.activeBuff, 'an unreadable brew becomes none').toBeNull();
  });

  it('keeps no deck of its own — the master deck is the only one', () => {
    const p = saved(() => {});
    expect(p.state.overworld as unknown as Record<string, unknown>).not.toHaveProperty('deck');
  });

  it('holds a Companion roster and clamps a hand-edited one', () => {
    const file = fileWith('slot-1');
    file.profiles['slot-1']!.companions.ignis = {
      level: 4,
      bonusMaxHp: 6,
      startingArmor: 1,
      bonusPips: 2,
    };
    writeSave(file);
    expect(loadSave().save.profiles['slot-1']!.companions.ignis).toEqual({
      level: 4,
      bonusMaxHp: 6,
      startingArmor: 1,
      bonusPips: 2,
    });

    const raw = JSON.parse(localStorage.getItem('conjure.save')!);
    raw.profiles['slot-1'].companions = { ignis: { level: -3, bonusMaxHp: -99 } };
    localStorage.setItem('conjure.save', JSON.stringify(raw));

    const ignis = loadSave().save.profiles['slot-1']!.companions.ignis!;
    expect(ignis.level).toBe(1);
    expect(ignis.bonusMaxHp).toBe(0);
  });

  it('starts every Companion at level one', () => {
    const p = newProfile('slot-1');
    for (const companion of COMPANIONS) {
      expect(p.companions[companion.id], companion.name).toEqual(newCompanion());
    }
  });

  it('renames a card held anywhere it names one', () => {
    const file = fileWith('slot-1');
    writeSave(file);
    const raw = JSON.parse(localStorage.getItem('conjure.save')!);
    raw.profiles['slot-1'].collection = { owned: { spark_wisp: 2 }, ascended: ['spark_wisp'] };
    raw.profiles['slot-1'].decks.ignis = { companionId: 'ignis', cards: ['spark_wisp'] };
    localStorage.setItem('conjure.save', JSON.stringify(raw));

    const p = loadSave().save.profiles['slot-1']!;
    expect(p.collection.owned.marrow_wisp).toBeGreaterThan(0);
    expect(p.collection.owned.spark_wisp).toBeUndefined();
    expect(p.decks.ignis!.cards).toEqual(['marrow_wisp']);
  });

  it('restamps the poster metadata on every write', () => {
    const file = fileWith('slot-1');
    file.profiles['slot-1']!.companions.ignis = {
      level: 6,
      bonusMaxHp: 10,
      startingArmor: 0,
      bonusPips: 0,
    };
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

    expect(loadSave().save.profiles['slot-1']!.state.overworld.economy.ducats).toBe(0);
  });
});
