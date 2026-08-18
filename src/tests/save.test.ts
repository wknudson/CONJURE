import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SAVE_VERSION, clearSave, defaultSave, loadSave, writeSave } from '../app/save.js';
import { COMPANIONS } from '../core/data/companions.js';
import { validateDeck } from '../core/data/deckRules.js';
import {
  INVENTORY_LIMIT,
  addConsumable,
  newRun,
  type OverworldState,
} from '../core/overworld/state.js';

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

describe('save round-trip', () => {
  let store: Map<string, string>;
  beforeEach(() => {
    store = installStorage();
  });

  it('returns a playable default when nothing is stored', () => {
    const { save, notes } = loadSave();
    expect(save.version).toBe(SAVE_VERSION);
    expect(notes).toHaveLength(0);
    for (const companion of COMPANIONS) {
      expect(validateDeck(save.decks[companion.id]!.cards, save.collection)).toHaveLength(0);
    }
  });

  it('persists and reloads a change', () => {
    const save = defaultSave();
    save.record.wins = 3;
    save.lastCompanionId = 'boreas';
    expect(writeSave(save)).toBe(true);

    const { save: loaded } = loadSave();
    expect(loaded.record.wins).toBe(3);
    expect(loaded.lastCompanionId).toBe('boreas');
  });

  it('keeps the previous save as a backup and recovers from corruption', () => {
    writeSave(defaultSave());
    const good = defaultSave();
    good.record.wins = 9;
    writeSave(good);

    // Simulate a torn write.
    store.set('conjure.save', '{ this is not json');

    const { save, notes } = loadSave();
    expect(save.record.wins).toBeGreaterThanOrEqual(0);
    expect(notes.join(' ')).toMatch(/damaged|Could not read/);
  });

  it('falls back to defaults when both the save and its backup are unreadable', () => {
    store.set('conjure.save', 'garbage');
    store.set('conjure.save.bak', 'also garbage');

    const { save, notes } = loadSave();
    expect(save.version).toBe(SAVE_VERSION);
    expect(notes.length).toBeGreaterThan(0);
    // Still playable, which is the whole point.
    for (const companion of COMPANIONS) {
      expect(validateDeck(save.decks[companion.id]!.cards, save.collection)).toHaveLength(0);
    }
  });
});

describe('migration', () => {
  beforeEach(() => installStorage());

  it('flags a deck that is no longer legal rather than silently rewriting it', () => {
    const save = defaultSave();
    save.decks.ignis!.cards = ['scout_imp', 'a_card_from_a_past_patch'];
    writeSave(save);

    const { save: loaded, notes } = loadSave();
    expect(loaded.decks.ignis!.invalid).toBe(true);
    expect(notes.join(' ')).toMatch(/no longer legal/);
    // The player's list is preserved so they can see what changed.
    expect(loaded.decks.ignis!.cards).toContain('scout_imp');
  });

  it('drops collection entries for cards that no longer exist', () => {
    const save = defaultSave();
    save.collection.owned.a_card_from_a_past_patch = 4;
    writeSave(save);

    const { save: loaded, notes } = loadSave();
    expect(loaded.collection.owned.a_card_from_a_past_patch).toBeUndefined();
    expect(notes.join(' ')).toMatch(/no longer exist/);
  });

  it('ignores a save written by a newer version', () => {
    localStorage.setItem(
      'conjure.save',
      JSON.stringify({ version: SAVE_VERSION + 5, collection: { owned: {} }, decks: {} }),
    );
    const { save, notes } = loadSave();
    expect(save.version).toBe(SAVE_VERSION);
    expect(notes.join(' ')).toMatch(/newer version/);
  });

  it('fills in missing fields from a partial save', () => {
    localStorage.setItem('conjure.save', JSON.stringify({ version: 1 }));
    const { save } = loadSave();
    expect(Object.keys(save.decks).length).toBe(COMPANIONS.length);
    expect(save.record.wins).toBe(0);
    expect(Object.keys(save.collection.owned).length).toBeGreaterThan(0);
  });

  it('upgrades a version 1 save, which has no recorded run', () => {
    // v1 predates pre-combat adaptation. Having never played is not a fault to repair.
    localStorage.setItem(
      'conjure.save',
      JSON.stringify({ ...defaultSave(), version: 1, lastRun: undefined }),
    );
    const { save, notes } = loadSave();
    expect(save.version).toBe(SAVE_VERSION);
    expect(save.lastRun).toBeUndefined();
    expect(notes).toHaveLength(0);
  });

  it('keeps the last run so the same battle can be found again', () => {
    const save = defaultSave();
    save.lastRun = {
      encounterId: 'novice_duelist',
      seed: 123456,
      companionId: COMPANIONS[0]!.id,
      deck: ['scout_imp', 'flame_surge'],
    };
    writeSave(save);

    const { save: loaded } = loadSave();
    expect(loaded.lastRun?.seed).toBe(123456);
    expect(loaded.lastRun?.deck).toEqual(['scout_imp', 'flame_surge']);
  });

  it('discards a recorded run that is missing its seed', () => {
    localStorage.setItem(
      'conjure.save',
      JSON.stringify({ ...defaultSave(), lastRun: { encounterId: 'x', deck: [] } }),
    );
    const { save } = loadSave();
    expect(save.lastRun, 'a run without a seed cannot be reproduced').toBeUndefined();
  });

  /**
   * The Sparks -> Marrow rename (v3) changed a card id. Without the remap, reconciliation
   * would read `spark_wisp` as a card from a deleted patch and quietly confiscate it.
   */
  it('carries a renamed card through the collection, decks, and last run', () => {
    const save = defaultSave();
    delete save.collection.owned.marrow_wisp;
    // Above the soulbound floor of 3, so the assertion measures the remap rather than
    // the top-up that would restore this particular card either way.
    save.collection.owned.spark_wisp = 5;
    save.decks.ignis!.cards = save.decks.ignis!.cards.map((c) =>
      c === 'marrow_wisp' ? 'spark_wisp' : c,
    );
    save.lastRun = {
      encounterId: 'novice_duelist',
      seed: 7,
      companionId: 'ignis',
      deck: ['spark_wisp', 'scout_imp'],
    };
    localStorage.setItem('conjure.save', JSON.stringify({ ...save, version: 2 }));

    const { save: loaded, notes } = loadSave();

    expect(loaded.collection.owned.marrow_wisp).toBe(5);
    expect(loaded.collection.owned.spark_wisp).toBeUndefined();
    // The deck is where the rename actually bites: an unremapped id is not a real card,
    // so the deck would stop validating and the player would be sent to fix it.
    expect(loaded.decks.ignis!.cards).toContain('marrow_wisp');
    expect(loaded.decks.ignis!.cards).not.toContain('spark_wisp');
    expect(loaded.lastRun?.deck).toEqual(['marrow_wisp', 'scout_imp']);

    // The point of the remap: nothing was lost, so there is nothing to report.
    expect(loaded.decks.ignis!.invalid).toBeUndefined();
    expect(notes).toHaveLength(0);
  });

  it('sums the counts when a save somehow holds both the old and new card id', () => {
    const save = defaultSave();
    save.collection.owned.marrow_wisp = 2;
    save.collection.owned.spark_wisp = 3;
    localStorage.setItem('conjure.save', JSON.stringify({ ...save, version: 2 }));

    const { save: loaded } = loadSave();
    expect(loaded.collection.owned.marrow_wisp).toBe(5);
  });

  it('rejects a companion id that is not real', () => {
    const save = defaultSave();
    (save as { lastCompanionId: string }).lastCompanionId = 'nobody';
    writeSave(save);
    const { save: loaded } = loadSave();
    expect(COMPANIONS.some((c) => c.id === loaded.lastCompanionId)).toBe(true);
  });
});

describe('storage failure', () => {
  it('reports a failed write instead of throwing', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => null,
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
      removeItem: () => {},
    });

    expect(() => writeSave(defaultSave())).not.toThrow();
    expect(writeSave(defaultSave())).toBe(false);
  });

  it('loads defaults when storage is unavailable entirely', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('SecurityError');
      },
      setItem: () => {},
      removeItem: () => {},
    });

    const { save } = loadSave();
    expect(save.version).toBe(SAVE_VERSION);
    expect(() => clearSave()).not.toThrow();
  });
});

describe('the run on disk', () => {
  let store: Map<string, string>;
  beforeEach(() => {
    store = installStorage();
  });

  const run = (over: Partial<OverworldState> = {}): OverworldState => ({
    ...newRun(['scout_imp', 'grave_sentinel']),
    ...over,
  });

  it('has none until a run is started, and that is not an error', () => {
    const { save, notes } = loadSave();
    expect(save.overworld).toBeUndefined();
    expect(notes).toHaveLength(0);
  });

  it('round-trips a wounded, half-spent run', () => {
    const save = defaultSave();
    save.overworld = run({
      pact: { currentHp: 17, maxHp: 40 },
      economy: { ducats: 95, marrowShards: 4 },
      inventory: [{ id: 'mending_tonic', name: 'Mending Tonic', type: 'healing', value: 12 }],
      activeBuff: 'ironbrew',
    });
    writeSave(save);

    const { save: loaded } = loadSave();
    expect(loaded.overworld?.pact).toEqual({ currentHp: 17, maxHp: 40 });
    expect(loaded.overworld?.economy).toEqual({ ducats: 95, marrowShards: 4 });
    expect(loaded.overworld?.inventory).toHaveLength(1);
    expect(loaded.overworld?.activeBuff).toBe('ironbrew');
  });

  it('survives the reload it exists for: buy, close the tab, come back', () => {
    const save = defaultSave();
    const global = { overworld: run(), combat: null };
    global.overworld.economy.ducats = 100;
    save.overworld = global.overworld;

    // What the Apothecary does, then what main does after it.
    addConsumable(global.overworld, {
      id: 'ironbrew',
      name: 'Ironbrew',
      type: 'buff',
      value: 0,
    });
    global.overworld.economy.ducats -= 45;
    writeSave(save);

    const { save: reloaded } = loadSave();
    expect(reloaded.overworld?.economy.ducats, 'the purse remembers').toBe(55);
    expect(reloaded.overworld?.inventory.map((i) => i.id)).toEqual(['ironbrew']);
  });

  it('clamps a hand-edited run instead of trusting it', () => {
    // These are the numbers a player edits first, so the repair has to be real.
    store.set(
      'conjure.save',
      JSON.stringify({
        ...defaultSave(),
        overworld: {
          pact: { currentHp: 9999, maxHp: 40 },
          economy: { ducats: -50, marrowShards: 2.7 },
          deck: ['scout_imp', 42, null],
          inventory: Array.from({ length: 6 }, () => ({
            id: 'mending_tonic',
            name: 'Mending Tonic',
            type: 'healing',
            value: 12,
          })),
          activeBuff: 'not_a_real_brew',
        },
      }),
    );

    const { save } = loadSave();
    const over = save.overworld!;
    expect(over.pact.currentHp, 'cannot exceed the gauge').toBe(40);
    expect(over.economy.ducats, 'no negative purse').toBe(0);
    expect(Number.isInteger(over.economy.marrowShards)).toBe(true);
    expect(over.deck, 'non-strings dropped').toEqual(['scout_imp']);
    expect(over.inventory.length, 'capped at the satchel limit').toBe(INVENTORY_LIMIT);
    expect(over.activeBuff, 'an unreadable brew becomes none').toBeNull();
  });

  it('drops a run with no Pact rather than inventing one', () => {
    store.set(
      'conjure.save',
      JSON.stringify({ ...defaultSave(), overworld: { economy: { ducats: 10 } } }),
    );
    expect(loadSave().save.overworld, 'whole, or not at all').toBeUndefined();
  });

  it('renames a card held in the run deck, same as everywhere else', () => {
    store.set(
      'conjure.save',
      JSON.stringify({
        ...defaultSave(),
        version: 2,
        overworld: { ...run(), deck: ['spark_wisp', 'scout_imp'] },
      }),
    );
    expect(loadSave().save.overworld?.deck).toEqual(['marrow_wisp', 'scout_imp']);
  });
});
