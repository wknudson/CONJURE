/**
 * Local persistence: three Profiles, one of them active.
 *
 * CONJURE is a persistent RPG rather than a roguelike, so the unit of storage is a
 * **character**, not a session. Three of them live side by side and never touch: a
 * purchase made by one may not be visible to another, which is the single rule this file
 * exists to guarantee. Every write goes through `writeSave`, which takes the whole file,
 * so a save can never be assembled from one profile and half of another.
 *
 * `Profile` carries its metadata — name, level, the purse — at the top rather than only
 * inside `state`, so the title wall can paint three posters without deserialising three
 * engine states. Those fields are a cache, refreshed on every write by `stampProfile`.
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
import { CARDS } from '../core/data/cards/index.js';
import { RELICS, RELIC_SLOTS } from '../core/data/relics.js';
import { validateDeck } from '../core/data/deckRules.js';
import { COMPANIONS, DEFAULT_COMPANION } from '../core/data/companions.js';
import { NOVICE_AI, profileByName } from '../core/ai/controller.js';
import type {
  ActiveEncounterState,
  Consumable,
  OverworldState,
} from '../core/overworld/state.js';
import type { Bestiary, GlobalGameState } from '../core/overworld/state.js';
import { INVENTORY_LIMIT, isBuffId, newRun } from '../core/overworld/state.js';
import {
  syncPactCeiling,
  BASE_PACT_HP,
  HP_ROLL_MAX,
  HP_ROLL_MIN,
  tameCompanion,
  type CompanionInstance,
} from '../core/overworld/vivarium.js';
import { traitById, traitsFor } from '../core/data/companionTraits.js';
import { makeRng } from '../core/util/rng.js';

const KEY = 'conjure.save';
const BACKUP_KEY = 'conjure.save.bak';
export const SAVE_VERSION = 9;

/** Posters on the wall. Three, and the wall is the reason it is three. */
export const PROFILE_SLOTS = 3;

/**
 * Slot ids are fixed rather than generated.
 *
 * A poster is a place on a wall, so its identity is the place. Fixed ids mean an empty
 * slot is simply a missing key, deleting a character is deleting one, and the active
 * profile survives a reload as a string that means the same thing next time.
 */
export const SLOT_IDS = ['slot-1', 'slot-2', 'slot-3'] as const;

export type SlotId = (typeof SLOT_IDS)[number];

export function isSlotId(value: unknown): value is SlotId {
  return typeof value === 'string' && (SLOT_IDS as readonly string[]).includes(value);
}

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
  // Hybrids shed the odd `spell_` prefix nothing else in the registry wore (v8).
  spell_vaporize_blast: 'vaporize_blast',
  spell_superconduct_strike: 'superconduct_strike',
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

/**
 * One character, and everything they own.
 *
 * `state` is the live game state — the Pact, the purse, the satchel, the open contract.
 * Everything beside it is property that outlives any single fight: the collection, the
 * decks, the Companions. The split is the same one the rest of the codebase draws, and
 * keeping it here means `GlobalGameState` needed no widening to be storable.
 */
export interface Profile {
  profileId: string;
  /** What the poster is made out to. */
  name: string;
  /**
   * Shown on the poster without opening the profile.
   *
   * A cache of the active Companion's level, restamped on every write. Denormalised on
   * purpose: the title wall reads three of these and should not have to reason about
   * Companion progression to do it.
   */
  level: number;
  state: GlobalGameState;
  collection: Collection;
  /** One deck per companion, keyed by companion id. */
  decks: Record<string, SavedDeck>;
  /**
   * The **instance** currently standing beside the player, by `instanceId` (v9).
   *
   * A roster entry, not a species. Everything that needs the species — the deck, the
   * school, the Bound Form — reads `baseId` off the instance, so the two can never be
   * confused for one another by a caller that guessed.
   */
  activeCompanionId: string;
  /**
   * The roster: every beast this character has tamed (v9).
   *
   * A list rather than a map keyed by species, because two Ignis are two animals. Before
   * v9 this was `Record<baseId, progress>`, which could hold exactly one of each and so
   * had nothing to roll for.
   */
  companions: CompanionInstance[];
  record: { wins: number; losses: number; bound: number };
  /**
   * What this character has met and put down, by unit definition id (v8).
   *
   * Per character rather than shared, so a second Commander starts the Ledger blank —
   * which is what makes filling it in feel like their own work rather than an unlock
   * inherited from somebody else's play.
   */
  bestiary: Bestiary;
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
}

/**
 * The whole file: three slots and a pointer at one of them.
 *
 * `difficulty` sits here rather than on a Profile because the AI tier is a preference
 * about how the player likes to be challenged, not something a character owns — changing
 * it should not mean changing it three times.
 */
export interface SaveFile {
  version: number;
  activeProfileId: SlotId | null;
  /** AI tier name, matched against AI_PROFILES on load. */
  difficulty: string;
  /** Keyed by slot. A missing key is an empty poster, which is a real state. */
  profiles: Partial<Record<SlotId, Profile>>;
}

/**
 * A character at the moment of creation.
 *
 * The starter decks, the full collection floor, every Companion at level 1, a Pact at 40,
 * and an empty purse. Nothing is handed over: the first contract is what pays for the
 * first tonic, which is what makes the first contract mean something.
 */
export function newProfile(profileId: string, name = 'Commander'): Profile {
  const decks: Record<string, SavedDeck> = {};
  for (const companion of COMPANIONS) {
    decks[companion.id] = { companionId: companion.id, cards: [...companion.deck] };
  }
  // One tamed beast to start, rolled like any other. A character who began with a
  // guaranteed 40/40 would learn nothing from their second roll.
  const rng = makeRng(Math.floor(Math.random() * 1e9) >>> 0);
  const companions: CompanionInstance[] = [tameCompanion(rng, DEFAULT_COMPANION.id, 1)];

  // Seeded once, at creation, so two characters do not stare at the same board forever.
  const overworld = newRun(Math.floor(Math.random() * 1e9) >>> 0);
  // Two cores in the satchel from the start. Contracts pay more from Adept upward, so
  // these are the ones you learn the bench with rather than the only ones you will ever
  // hold.
  overworld.economy.reagents = { core_frost: 2, core_surge: 2 };
  // The coat, worn. A character who started with four bare slots would meet the loadout
  // screen as an empty grid and learn nothing from it.
  overworld.relics = ['relic_coat'];
  overworld.equippedRelics = ['relic_coat'];

  return {
    profileId,
    name,
    level: 1,
    state: { overworld, combat: null },
    collection: startingCollection(),
    decks,
    activeCompanionId: companions[0]!.instanceId,
    companions,
    record: { wins: 0, losses: 0, bound: 0 },
    bestiary: {},
  };
}

/** An empty wall. Three blank posters and nobody chosen. */
export function emptySave(): SaveFile {
  return {
    version: SAVE_VERSION,
    activeProfileId: null,
    difficulty: NOVICE_AI.name,
    profiles: {},
  };
}

/**
 * Refreshes the metadata the title wall reads without opening a profile.
 *
 * Called on every write rather than at each of the places `level` could change, so the
 * cache cannot fall behind the thing it caches. Cheap, and it is the only reason the
 * poster can be painted from the file alone.
 */
export function stampProfile(profile: Profile): void {
  profile.level = activeCompanionOf(profile)?.level ?? 1;
}

/**
 * The instance standing beside this character, or undefined if the roster is empty.
 *
 * The one lookup, so nothing anywhere has to decide for itself whether
 * `activeCompanionId` names a species or a roster entry. It names a roster entry.
 */
export function activeCompanionOf(profile: Profile): CompanionInstance | undefined {
  return profile.companions.find((c) => c.instanceId === profile.activeCompanionId);
}

/**
 * Tears a character off the wall, and reports whether one was there.
 *
 * Mutates the file rather than returning a new one, for the same reason every other
 * write here does: `writeSave` takes the file whole, and the caller persists. There is
 * deliberately no variant that reaches into `localStorage` itself — a delete that wrote
 * on its own would be the one code path able to save a file the game was not holding.
 *
 * If the character being burnt is the one the pointer names, the pointer goes with them.
 * `loadSave` would drop a dangling pointer anyway, but writing one at all means a crash
 * between here and the next load leaves a file that opens a ghost.
 */
export function deleteProfile(file: SaveFile, profileId: string): boolean {
  if (!isSlotId(profileId) || !file.profiles[profileId]) return false;

  delete file.profiles[profileId];
  if (file.activeProfileId === profileId) file.activeProfileId = null;
  return true;
}

/** The first slot with nothing pinned to it, or null when the wall is full. */
export function firstEmptySlot(file: SaveFile): SlotId | null {
  return SLOT_IDS.find((id) => !file.profiles[id]) ?? null;
}

export interface LoadResult {
  save: SaveFile;
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
      const result = migrateFile(parsed, notes);
      if (key === BACKUP_KEY) notes.push('Your save was damaged; the previous one was restored.');
      return { save: result, notes };
    } catch {
      notes.push(`Could not read ${key === KEY ? 'your save' : 'the backup save'}.`);
    }
  }

  return { save: emptySave(), notes };
}

/**
 * Reads the file, from either shape it has ever had.
 *
 * A v6 save held one character at the root with no notion of a slot. Rather than discard
 * it — which would be a player's whole collection thrown away by an upgrade — it is
 * migrated onto the first poster and set active, so the next boot looks exactly like
 * carrying on.
 */
function migrateFile(raw: unknown, notes: string[]): SaveFile {
  if (!raw || typeof raw !== 'object') return emptySave();
  const data = raw as Partial<SaveFile> & { collection?: unknown };

  const version = typeof data.version === 'number' ? data.version : 0;
  if (version > SAVE_VERSION) {
    notes.push('This save came from a newer version; some of it was ignored.');
    return emptySave();
  }

  const difficulty = profileByName(String((data as { difficulty?: unknown }).difficulty ?? ''))
    ? String(data.difficulty)
    : NOVICE_AI.name;

  // --- the single-character shape, v6 and earlier ---
  if (!data.profiles && data.collection) {
    const only = migrateProfile(raw, SLOT_IDS[0], notes);
    notes.push('Your character was pinned to the first poster.');
    return {
      version: SAVE_VERSION,
      activeProfileId: SLOT_IDS[0],
      difficulty,
      profiles: { [SLOT_IDS[0]]: only },
    };
  }

  const profiles: Partial<Record<SlotId, Profile>> = {};
  for (const slot of SLOT_IDS) {
    const saved = data.profiles?.[slot];
    if (!saved || typeof saved !== 'object') continue;
    profiles[slot] = migrateProfile(saved, slot, notes);
  }

  // A pointer at an empty slot is worse than no pointer: it would open a character that
  // is not there. Dropped rather than repaired, which puts the player back at the wall.
  const claimed = data.activeProfileId;
  const activeProfileId = isSlotId(claimed) && profiles[claimed] ? claimed : null;

  return { version: SAVE_VERSION, activeProfileId, difficulty, profiles };
}

/**
 * Brings one character up to the current shape. Unknown fields are dropped and missing
 * ones filled from defaults, so a profile can never be *partly* valid.
 */
function migrateProfile(raw: unknown, slot: SlotId, notes: string[]): Profile {
  const base = newProfile(slot);
  if (!raw || typeof raw !== 'object') return base;
  const data = raw as Partial<Profile> & { overworld?: unknown };

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
    // Ascensions are keyed by base card id, so they go through the same rename map as
    // everything else that names a card.
    const ascended = Array.isArray(data.collection.ascended)
      ? data.collection.ascended.filter((c): c is string => typeof c === 'string').map(rename)
      : [];

    const reconciled = reconcileCollection({ owned, ascended });
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

  const companions = readRoster(data.companions, base.companions);

  // v5 and earlier called this `lastCompanionId`; v8 and earlier held a *species* id.
  // Read any of the three, write an instance id — falling back to whoever is first on the
  // roster, because a pointer at nobody would open a fight with no Companion at all.
  const legacy = (data as { lastCompanionId?: unknown }).lastCompanionId;
  const claimed = typeof data.activeCompanionId === 'string' ? data.activeCompanionId : legacy;
  const byInstance = companions.find((c) => c.instanceId === claimed);
  const bySpecies = companions.find((c) => c.baseId === claimed);
  const activeCompanionId =
    (byInstance ?? bySpecies ?? companions[0])?.instanceId ?? base.activeCompanionId;

  const record =
    data.record && typeof data.record === 'object'
      ? {
          wins: numberOr(data.record.wins, 0),
          losses: numberOr(data.record.losses, 0),
          bound: numberOr(data.record.bound, 0),
        }
      : base.record;

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
          companionId: String(run.companionId ?? activeCompanionId),
          deck: run.deck.filter((c): c is string => typeof c === 'string').map(rename),
        }
      : undefined;

  // --- the live state ---
  // Read from `state.overworld` (v7) or from a root `overworld` (v4 to v6), so an upgrade
  // does not cost a player the Pact they were carrying. `combat` is a live handle to a
  // fight in progress and is deliberately never restored: a reload is not a resume, and
  // the open contract on `overworld` is what the forfeit failsafe reads instead.
  const nested = (data.state as { overworld?: unknown } | undefined)?.overworld;
  const overworld = readOverworld(nested ?? data.overworld) ?? newRun(
    Math.floor(Math.random() * 1e9) >>> 0,
  );

  const profile: Profile = {
    profileId: slot,
    name: typeof data.name === 'string' && data.name.trim() ? data.name.trim().slice(0, 24) : base.name,
    level: 1,
    state: { overworld, combat: null },
    collection,
    decks,
    activeCompanionId,
    companions,
    record,
    bestiary: readBestiary(data.bestiary),
    ...(lastRun ? { lastRun } : {}),
  };

  // The ceiling belongs to whoever is standing beside the Pact, and a levelled Companion
  // restored from disk would otherwise sit at the base 40 until the next level was bought.
  syncPactCeiling(profile.state.overworld, activeCompanionOf(profile));
  stampProfile(profile);
  return profile;
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
      reagents: readCounts(data.economy?.reagents),
    },
    inventory,
    ...readRelics(data),
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

/**
 * A bag of counts, rebuilt: whole numbers, nothing negative, nothing at zero.
 *
 * Shared by the reagent bag and the Ledger's tallies, because both are the same shape and
 * both are exactly the kind of number a curious player edits first.
 */
function readCounts(raw: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (!raw || typeof raw !== 'object') return out;

  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const n = Math.max(0, Math.round(numberOr(value, 0)));
    if (n > 0) out[key] = n;
  }
  return out;
}

/**
 * The Ledger, rebuilt.
 *
 * Entries for units the game no longer has are dropped: they would sit in the save for
 * ever, and the Ledger renders from the registry, so a tally with nothing to attach to is
 * invisible weight. `defeated` is clamped to `encountered` — you cannot have killed more
 * of a thing than you ever met, and a Ledger saying otherwise reads as a bug.
 */
function readBestiary(raw: unknown): Bestiary {
  const out: Bestiary = {};
  if (!raw || typeof raw !== 'object') return out;

  for (const [defId, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!CARDS[defId] || !value || typeof value !== 'object') continue;
    const tally = value as { encountered?: unknown; defeated?: unknown };

    const encountered = Math.max(0, Math.round(numberOr(tally.encountered, 0)));
    const defeated = Math.min(
      encountered,
      Math.max(0, Math.round(numberOr(tally.defeated, 0))),
    );
    if (encountered > 0) out[defId] = { encountered, defeated };
  }
  return out;
}

/**
 * Gear, rebuilt.
 *
 * Relics that no longer exist are dropped, and anything worn must also be owned — the
 * equipped list is a *view* of the owned one, and a save claiming otherwise would put a
 * relic in a slot that the loadout screen could not take back out. Trimmed to the slot
 * count last, so a hand-edited file cannot field six.
 */
function readRelics(data: { relics?: unknown; equippedRelics?: unknown }): {
  relics: string[];
  equippedRelics: string[];
} {
  const strings = (raw: unknown): string[] =>
    (Array.isArray(raw) ? raw : []).filter((v): v is string => typeof v === 'string');

  const relics = [...new Set(strings(data.relics))].filter((id) => RELICS[id]);
  const equippedRelics = [...new Set(strings(data.equippedRelics))]
    .filter((id) => relics.includes(id))
    .slice(0, RELIC_SLOTS);

  return { relics, equippedRelics };
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

/**
 * The roster, rebuilt — from either shape it has ever had.
 *
 * A v8 save held `Record<baseId, progress>`: one entry per species, no constitution and
 * no knack. Those become instances rather than being thrown away, and the levels they
 * had earned come with them. A beast that predates the roll gets `BASE_PACT_HP` — the
 * body it has been fighting with all along — rather than a fresh roll, because rolling
 * on migration would hand some players a god roll and others a dud for having upgraded.
 *
 * Species that no longer exist are dropped, and a trait that no longer exists is replaced
 * with one the species can actually have, so the Vivarium never prints a blank knack.
 */
function readRoster(raw: unknown, base: CompanionInstance[]): CompanionInstance[] {
  if (!raw || typeof raw !== 'object') return base;
  const known = new Set(COMPANIONS.map((c) => c.id));

  const clean = (
    saved: Partial<CompanionInstance>,
    baseId: string,
    fallbackId: string,
  ): CompanionInstance => {
    const pool = traitsFor(baseId);
    const traitId =
      typeof saved.traitId === 'string' && traitById(saved.traitId)?.baseId === baseId
        ? saved.traitId
        : (pool[0]?.id ?? '');

    return {
      instanceId: typeof saved.instanceId === 'string' && saved.instanceId ? saved.instanceId : fallbackId,
      baseId,
      // Clamped to the band it could have been rolled in, so a hand-edited 400 is a 44.
      baseHpRoll: Math.min(
        HP_ROLL_MAX,
        Math.max(HP_ROLL_MIN, Math.round(numberOr(saved.baseHpRoll, BASE_PACT_HP))),
      ),
      level: Math.max(1, Math.round(numberOr(saved.level, 1))),
      bonusMaxHp: Math.max(0, Math.round(numberOr(saved.bonusMaxHp, 0))),
      startingArmor: Math.max(0, Math.round(numberOr(saved.startingArmor, 0))),
      bonusPips: Math.max(0, Math.round(numberOr(saved.bonusPips, 0))),
      traitId,
    };
  };

  // --- v9 onward: a list of instances ---
  if (Array.isArray(raw)) {
    const seen = new Set<string>();
    const roster = raw
      .filter((v): v is Partial<CompanionInstance> => Boolean(v) && typeof v === 'object')
      .filter((v) => typeof v.baseId === 'string' && known.has(v.baseId))
      .map((v, i) => clean(v, v.baseId as string, `${v.baseId}-${i + 1}`))
      // Two entries claiming one id would make "release this one" ambiguous.
      .filter((c) => (seen.has(c.instanceId) ? false : (seen.add(c.instanceId), true)));

    return roster.length > 0 ? roster : base;
  }

  // --- v8 and earlier: one entry per species ---
  const legacy: CompanionInstance[] = [];
  let n = 0;
  for (const companion of COMPANIONS) {
    const saved = (raw as Record<string, Partial<CompanionInstance>>)[companion.id];
    if (!saved || typeof saved !== 'object') continue;
    n += 1;
    legacy.push(clean({ ...saved, baseHpRoll: BASE_PACT_HP }, companion.id, `${companion.id}-${n}`));
  }

  return legacy.length > 0 ? legacy : base;
}

function numberOr(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/**
 * Writes the whole file, keeping the previous one as a backup in case this write is torn.
 *
 * The *whole* file, always. Writing a single profile back on its own is how two
 * characters end up sharing a purse, so there is deliberately no function that can.
 */
export function writeSave(save: SaveFile): boolean {
  try {
    for (const slot of SLOT_IDS) {
      const profile = save.profiles[slot];
      if (profile) stampProfile(profile);
    }
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
