/**
 * Local persistence.
 *
 * Module 8's rule, adopted from the first save rather than retrofitted: every save
 * carries a `version`, and loading an older one runs a migration that re-reads static
 * card data from the master database instead of trusting what the save recorded. Card
 * definitions change; a save must never pin stale numbers.
 *
 * Everything here is defensive. localStorage can be unavailable (private browsing), full
 * (quota), or hold corrupted JSON from an interrupted write — none of which may lose a
 * player's collection or, worse, crash the game on boot.
 */

import type { Collection } from '../core/data/deckRules.js';
import { reconcileCollection, startingCollection } from '../core/data/collection.js';
import { validateDeck } from '../core/data/deckRules.js';
import { COMPANIONS, DEFAULT_COMPANION } from '../core/data/companions.js';

const KEY = 'conjure.save';
const BACKUP_KEY = 'conjure.save.bak';
export const SAVE_VERSION = 1;

export interface SavedDeck {
  companionId: string;
  cards: string[];
  /** Set on load when the deck no longer validates, so the UI can force an edit. */
  invalid?: boolean;
}

export interface SaveData {
  version: number;
  collection: Collection;
  /** One deck per companion, keyed by companion id. */
  decks: Record<string, SavedDeck>;
  lastCompanionId: string;
  record: { wins: number; losses: number; bound: number };
}

export function defaultSave(): SaveData {
  const decks: Record<string, SavedDeck> = {};
  for (const companion of COMPANIONS) {
    decks[companion.id] = { companionId: companion.id, cards: [...companion.deck] };
  }
  return {
    version: SAVE_VERSION,
    collection: startingCollection(),
    decks,
    lastCompanionId: DEFAULT_COMPANION.id,
    record: { wins: 0, losses: 0, bound: 0 },
  };
}

export interface LoadResult {
  save: SaveData;
  /** Non-fatal issues worth telling the player about. */
  notes: string[];
}

export function loadSave(): LoadResult {
  const notes: string[] = [];

  for (const key of [KEY, BACKUP_KEY]) {
    const raw = readRaw(key);
    if (raw === null) continue;

    try {
      const parsed = JSON.parse(raw) as unknown;
      const result = migrate(parsed, notes);
      if (key === BACKUP_KEY) notes.push('Your save was damaged; the previous one was restored.');
      return { save: result, notes };
    } catch {
      notes.push(`Could not read ${key === KEY ? 'your save' : 'the backup save'}.`);
    }
  }

  return { save: defaultSave(), notes };
}

/**
 * Brings any older or partial save up to the current shape. Unknown fields are dropped
 * and missing ones filled from defaults, so a save can never be *partly* valid.
 */
function migrate(raw: unknown, notes: string[]): SaveData {
  const base = defaultSave();
  if (!raw || typeof raw !== 'object') return base;
  const data = raw as Partial<SaveData>;

  const version = typeof data.version === 'number' ? data.version : 0;
  if (version > SAVE_VERSION) {
    notes.push('This save came from a newer version; some of it was ignored.');
    return base;
  }

  // --- collection ---
  let collection = base.collection;
  if (data.collection && typeof data.collection.owned === 'object') {
    const reconciled = reconcileCollection({ owned: { ...data.collection.owned } });
    collection = reconciled.collection;
    if (reconciled.dropped.length > 0) {
      notes.push(`${reconciled.dropped.length} card(s) no longer exist and were removed.`);
    }
  }

  // --- decks ---
  const decks: Record<string, SavedDeck> = { ...base.decks };
  for (const companion of COMPANIONS) {
    const saved = data.decks?.[companion.id];
    if (!saved || !Array.isArray(saved.cards)) continue;

    const cards = saved.cards.filter((c): c is string => typeof c === 'string');
    const problems = validateDeck(cards, collection);
    decks[companion.id] = {
      companionId: companion.id,
      cards,
      // Flagged rather than silently repaired: the player should see what changed and
      // choose the fix themselves (Module 8's binder-validation rule).
      ...(problems.length > 0 ? { invalid: true } : {}),
    };
    if (problems.length > 0) {
      notes.push(`Your ${companion.name} deck is no longer legal and needs editing.`);
    }
  }

  const lastCompanionId = COMPANIONS.some((c) => c.id === data.lastCompanionId)
    ? data.lastCompanionId!
    : base.lastCompanionId;

  const record =
    data.record && typeof data.record === 'object'
      ? {
          wins: numberOr(data.record.wins, 0),
          losses: numberOr(data.record.losses, 0),
          bound: numberOr(data.record.bound, 0),
        }
      : base.record;

  return { version: SAVE_VERSION, collection, decks, lastCompanionId, record };
}

function numberOr(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** Writes the save, keeping the previous one as a backup in case this write is torn. */
export function writeSave(save: SaveData): boolean {
  try {
    const previous = readRaw(KEY);
    if (previous !== null) localStorage.setItem(BACKUP_KEY, previous);
    localStorage.setItem(KEY, JSON.stringify({ ...save, version: SAVE_VERSION }));
    return true;
  } catch {
    // Quota exceeded or storage disabled. The session continues in memory; the player
    // simply will not keep their progress, which is better than an unhandled throw.
    return false;
  }
}

export function clearSave(): void {
  try {
    localStorage.removeItem(KEY);
    localStorage.removeItem(BACKUP_KEY);
  } catch {
    /* nothing to clear */
  }
}

function readRaw(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
