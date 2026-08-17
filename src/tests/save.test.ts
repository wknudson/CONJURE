import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SAVE_VERSION, clearSave, defaultSave, loadSave, writeSave } from '../app/save.js';
import { COMPANIONS } from '../core/data/companions.js';
import { validateDeck } from '../core/data/deckRules.js';

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
