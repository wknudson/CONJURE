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
import { NOVICE_AI, profileByName } from '../core/ai/controller.js';
import type {
  ActiveEncounterState,
  Consumable,
  OverworldState,
} from '../core/overworld/state.js';
import { INVENTORY_LIMIT, isBuffId } from '../core/overworld/state.js';

const KEY = 'conjure.save';
const BACKUP_KEY = 'conjure.save.bak';
export const SAVE_VERSION = 5;

/**
 * Cards that have been renamed, old id to new.
 *
 * A save stores card ids, so renaming one in the card database silently deletes it from
 * every existing collection: `reconcileCollection` drops ids it no longer recognises, and
 * decks holding one stop validating. Remapping on load is what makes a rename a rename
 * rather than a confiscation.
 */
const RENAMED_CARDS: Record<string, string> = {
  // The Sparks -> Marrow consolidation (v3).
  spark_wisp: 'marrow_wisp',
};

function rename(id: string): string {
  return RENAMED_CARDS[id] ?? id;
}

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
  /** AI tier name, matched against AI_PROFILES on load. */
  difficulty: string;
  record: { wins: number; losses: number; bound: number };
  /**
   * The last fight as it was actually set up, seed included.
   *
   * The seed used to be an unnamed default deep inside the combat screen: never shown,
   * never recorded, and rerolled on every rematch. Keeping it means a battle worth
   * talking about can be found again, and a bug report can name the exact game.
   */
  lastRun?: {
    encounterId: string;
    seed: number;
    companionId: string;
    /** The adapted deck, which may differ from the saved one by up to MAX_SWAPS. */
    deck: string[];
  };
  /**
   * The character outside combat: Pact, purse, satchel, open contract (added in v4).
   *
   * Optional because "not started" is a real state, not a broken one — a fresh save, or a
   * player who has never left the title. Its absence needs no repair, the same reason
   * `lastRun` is optional.
   *
   * Deliberately holds no deck. The master deck lives in `decks`, and under the RPG model
   * that *is* the active deck; a copy here would be the run deck the design discarded.
   */
  overworld?: OverworldState;
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
    difficulty: NOVICE_AI.name,
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
  // Renames are applied before reconciliation, which is the whole point: reconciliation
  // is what would otherwise throw the old id away as an unknown card.
  let collection = base.collection;
  if (data.collection && typeof data.collection.owned === 'object') {
    const owned: Record<string, number> = {};
    for (const [id, count] of Object.entries(data.collection.owned)) {
      const to = rename(id);
      // Summed rather than assigned: a save could in principle hold both ids at once,
      // and the player should end up with the cards from both.
      owned[to] = (owned[to] ?? 0) + count;
    }
    const reconciled = reconcileCollection({ owned });
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

    const cards = saved.cards.filter((c): c is string => typeof c === 'string').map(rename);
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

  // An unknown tier (renamed, or from a future version) falls back rather than leaving
  // the game with no AI to run.
  const difficulty = profileByName(String(data.difficulty ?? '')) ? data.difficulty! : base.difficulty;

  // --- last run (added in v2) ---
  // A v1 save simply has none, which is the same as never having played: the field is
  // optional precisely so the absence needs no repair.
  const run = data.lastRun;
  const lastRun =
    run &&
    typeof run.encounterId === 'string' &&
    typeof run.seed === 'number' &&
    Number.isFinite(run.seed) &&
    Array.isArray(run.deck)
      ? {
          encounterId: run.encounterId,
          seed: run.seed,
          companionId: String(run.companionId ?? lastCompanionId),
          deck: run.deck.filter((c): c is string => typeof c === 'string').map(rename),
        }
      : undefined;

  // --- the run in progress (added in v4) ---
  const overworld = readOverworld(data.overworld);

  return {
    version: SAVE_VERSION,
    collection,
    decks,
    lastCompanionId,
    difficulty,
    record,
    ...(lastRun ? { lastRun } : {}),
    ...(overworld ? { overworld } : {}),
  };
}

/**
 * Rebuilds a run from whatever is on disk, or gives up and returns nothing.
 *
 * Every field is reconstructed rather than trusted, on the same rule the rest of this
 * file follows: a save may not be *partly* valid. The values here are the ones a player
 * would most want to edit by hand — health, money, a full satchel — so the clamps are
 * load-bearing rather than paranoid, and a run that cannot be rebuilt is dropped whole
 * instead of resurrected with holes in it.
 */
function readOverworld(raw: unknown): OverworldState | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const data = raw as Partial<OverworldState>;
  if (!data.pact || typeof data.pact !== 'object') return undefined;

  const maxHp = Math.max(1, Math.round(numberOr(data.pact.maxHp, 40)));
  const currentHp = Math.max(
    0,
    Math.min(maxHp, Math.round(numberOr(data.pact.currentHp, maxHp))),
  );

  const pos = data.playerPos;
  const playerPos = {
    x: numberOr(pos?.x, 0),
    y: numberOr(pos?.y, 0),
    mapId: typeof pos?.mapId === 'string' ? pos.mapId : 'start',
  };

  const inventory = (Array.isArray(data.inventory) ? data.inventory : [])
    .filter(isConsumable)
    .slice(0, INVENTORY_LIMIT);

  return {
    playerPos,
    pact: { currentHp, maxHp },
    economy: {
      ducats: Math.max(0, Math.round(numberOr(data.economy?.ducats, 0))),
      marrowShards: Math.max(0, Math.round(numberOr(data.economy?.marrowShards, 0))),
    },
    inventory,
    // An unknown brew becomes none rather than being carried as a word the fight cannot
    // read. `BUFF_IDS` is the same list the type is made of, so this cannot drift.
    activeBuff: isBuffId(data.activeBuff) ? data.activeBuff : null,
    activeEncounter: readActiveEncounter(data.activeEncounter),
    bountySeed: Math.max(1, Math.round(numberOr(data.bountySeed, 1))),
  };
}

/**
 * The open contract, rebuilt or dropped.
 *
 * Anything that is not a well-formed contract reads as "no fight in progress", including
 * the `true` a v4 save would have written here. That is deliberately forgiving in one
 * direction only: the cost of missing a forfeit is one un-punished tab-close during a
 * version upgrade, where the cost of inventing one is killing a player who was standing
 * safely in the Safehouse.
 *
 * The spoils are rebuilt rather than trusted for the obvious reason — this is the field
 * that pays out, and it is a text file.
 */
function readActiveEncounter(raw: unknown): ActiveEncounterState | null {
  if (!raw || typeof raw !== 'object') return null;
  const data = raw as Partial<ActiveEncounterState>;
  if (typeof data.bountyId !== 'string') return null;

  return {
    bountyId: data.bountyId,
    spoils: {
      ducats: Math.max(0, Math.round(numberOr(data.spoils?.ducats, 0))),
      marrowShards: Math.max(0, Math.round(numberOr(data.spoils?.marrowShards, 0))),
    },
  };
}

function isConsumable(value: unknown): value is Consumable {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<Consumable>;
  if (typeof item.id !== 'string' || typeof item.name !== 'string') return false;
  if (item.type !== 'healing' && item.type !== 'buff') return false;
  if (typeof item.value !== 'number' || !Number.isFinite(item.value)) return false;
  // A buff whose id no longer exists would sit in the satchel forever doing nothing when
  // drunk. Dropping it is kinder than keeping a dead bottle.
  return item.type !== 'buff' || isBuffId(item.id);
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
