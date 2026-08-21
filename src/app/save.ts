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
import type { School } from '../contract/ids.js';
import type { CharacterLook } from '../core/data/characterLook.js';
import { defaultLook, normalizeLook } from '../core/data/characterLook.js';
import { reconcileCollection, startingCollection } from '../core/data/collection.js';
import { CARDS } from '../core/data/cards/index.js';
import { RELICS, slotOf } from '../core/data/relics.js';
import { HERO_SCHOOLS, validateDeck } from '../core/data/deckRules.js';
import type { CardModifier } from '../core/types/cards.js';
import { rollSpellModifiers } from '../core/overworld/vivarium.js';
import {
  DEFAULT_ROSTER,
  ROSTER_BUDGET,
  UNIVERSAL_ROSTER,
  VANGUARD_START_LEVEL,
  unlockVanguard,
  validateRoster,
  type VanguardProgress,
} from '../core/data/roster.js';
import { STAT_SCALE } from '../core/scale.js';
import {
  COMPANIONS,
  DEFAULT_COMPANION,
  DEFAULT_SCHOOL,
  companionById,
} from '../core/data/companions.js';
import {
  grantsFor,
  rosterUnlocksFor,
  speciesForSchool,
  startingRosterFor,
} from '../core/data/pools.js';
import { NOVICE_AI, profileByName } from '../core/ai/controller.js';
import type {
  ActiveEncounterState,
  Consumable,
  OverworldState,
} from '../core/overworld/state.js';
import type { Bestiary, GlobalGameState } from '../core/overworld/state.js';
import { INVENTORY_LIMIT, isBuffId, newRun, emptyLoadout, RELIC_SLOT_ORDER } from '../core/overworld/state.js';
import type { RelicLoadout } from '../core/overworld/state.js';
import {
  syncPactCeiling,
  BASE_PACT_HP,
  HP_PER_LEVEL,
  HP_ROLL_MAX,
  HP_ROLL_MIN,
  tameCompanion,
  type CompanionInstance,
} from '../core/overworld/vivarium.js';
import { APOTHECARY_STOCK } from '../core/data/apothecary.js';
import { traitsFor } from '../core/data/companionTraits.js';
import { makeRng } from '../core/util/rng.js';
import { socketRefusal } from '../core/data/grimoire.js';

const KEY = 'conjure.save';
const BACKUP_KEY = 'conjure.save.bak';
export const SAVE_VERSION = 18;

/**
 * The first version whose health numbers are written at the stretched scale.
 *
 * Anything older holds a Pact of 40 and a Companion rolled between 36 and 44, and those
 * are now a tenth of what they should be. Left alone, a returning player would boot into
 * a character at 22 of 400 -- critically wounded by an upgrade, and unable to take a
 * contract until they had paid a Clinic bill for damage they never took.
 */
const FIRST_STRETCHED_SAVE = 14;

/**
 * The first version whose Companions carry a drafted Grimoire of their own.
 *
 * Anything older stored no card list, because the eight were fixed by species. Those beasts
 * keep the eight they were caught with rather than drawing fresh ones -- re-rolling would
 * hand the player a different Companion than the one they went out and caught, and would
 * do it again on every load.
 */
const FIRST_DRAFTED_GRIMOIRE = 15;

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
  // Superconduct Strike was named for a reaction it cannot produce; it makes an Overload
  // (v11). Both historical spellings point at the current id rather than chaining through
  // each other, because `rename` is a single lookup and a chain would strand the oldest
  // saves on an id that no longer exists.
  spell_superconduct_strike: 'overload_strike',
  superconduct_strike: 'overload_strike',
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
   * The Vanguard: the bodies this character takes into a fight, as def ids (v12).
   *
   * **Not to be confused with `companions` below**, which the prose elsewhere also calls a
   * roster — that one is tamed beasts, this one is the warband. One list per character
   * rather than per Companion, because a Vanguard is bought out of a budget the character
   * owns, and re-buying it every time you swapped beasts would make the point-buy a chore
   * rather than a build.
   *
   * Empty is legal and means "no Vanguard": the fight then opens on turn one with no
   * deployment phase at all, which is exactly the pre-overhaul behaviour.
   */
  roster: string[];
  /**
   * What each Vanguard body has trained to, keyed by its `defId` (v14).
   *
   * Separate from `roster` above, and it has to be: the roster is *this season's* four
   * bodies, and progress belongs to every body the character has ever unlocked. Benching a
   * Footman for a Behemoth must not cost the Footman its career, or the point-buy would
   * quietly become a decision you can never take back.
   *
   * A key exists from the moment a body is unlocked, not from the moment it is fielded.
   * Anything missing fights at level 1, so a save written before this field is a save
   * where everything is simply new.
   */
  vanguardProgress: Record<string, VanguardProgress>;
  /**
   * Every body this character has permanently earned the right to field (v17).
   *
   * **Stored rather than derived, and the difference is a bug this fixes.** The gate began
   * life as `rosterUnlocksFor(companions.map(c => c.baseId))`, computed fresh each time —
   * which reads well until you notice the Vivarium has a Release button. Letting a Ferrum
   * go took the Bulwark bodies back with it, and because `loadProfile` repairs a roster
   * against the gate, the next load then silently deleted the Stone-Heart Golem out of the
   * player's saved warband. A claim is supposed to be permanent; a derived answer cannot be.
   *
   * So this is a ledger of grants, and the only thing that ever writes it is
   * `grantRosterUnlocks`. `pools.grantsFor` remains the *rule* for what one claim is worth,
   * which keeps "what does taming a Boreas give me" answerable without a save in hand.
   */
  rosterUnlocks: string[];
  /**
   * Who the player said they were, at the desk (v18).
   *
   * Five fields and deliberately **no gear**: optics, vestment, trinket, treads and will
   * are earned, and putting them in the creator would spend the reward before the first
   * contract. What is stored is what a sprite can actually show — a name, a bearing, a
   * silhouette — plus the one irreversible choice, the bloodline vowed to.
   *
   * `starterCompanion` is a `CompanionDef.id` rather than a school, because it is the
   * narrower fact: the school is derivable from the beast and the beast is not derivable
   * from the school once a second bloodline speaks one.
   */
  characterLook: CharacterLook;
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
/**
 * Folds a set of grants into a legal, stable unlock list.
 *
 * Two jobs, and both are about the answer being boring: the floor is always present so a
 * tray can never open empty, and the result is deduplicated and sorted so two saves that
 * unlocked the same bodies in a different order compare equal.
 */
/**
 * The school a founding bloodline speaks.
 *
 * A `CharacterLook` names the *beast*, which is the narrower fact; everything that wants a
 * school -- the opening warband, the stage tint -- derives it here rather than storing a
 * second copy that could disagree with the first.
 */
function schoolOfSpecies(baseId: string): School {
  return companionById(baseId)?.grimoire.schools[0] ?? DEFAULT_SCHOOL;
}

function unlockFloor(granted: readonly string[]): string[] {
  // `UNIVERSAL_ROSTER` only. `DEFAULT_ROSTER` used to be in here as well, and it was the
  // right call while every character started as an Ignis: it made the opening warband
  // legal by construction. Enrolment changes that -- it carries a Cinder Lobber and a
  // Longshot Stalker, so keeping it would hand a Boreas a Pyre body and a Dusk one on
  // creation, which is the exact identity the discipline screen exists to establish.
  //
  // Nothing is lost from an existing save: `loadProfile` unions the warband it finds on
  // disk into this list, so a character who was fielding a Longshot Stalker under the old
  // rule keeps it.
  return [...new Set([...UNIVERSAL_ROSTER, ...granted])].sort();
}

/**
 * Stamps one bloodline's bodies into a character, permanently.
 *
 * The single writer of `Profile.rosterUnlocks`, called wherever a beast actually becomes
 * the player's — a wild taming, or a subjugation claimed off a trial. Nothing removes from
 * this list: releasing the animal keeps the bodies, which is what "permanently unlocks"
 * has to mean if the Vivarium is going to have a Release button at all.
 *
 * Returns whether anything was new, so a caller can tell the player about a reward that
 * actually landed rather than announcing one they already had.
 */
export function grantRosterUnlocks(profile: Profile, baseId: string): string[] {
  const before = new Set(profile.rosterUnlocks);
  const gained = grantsFor(baseId).filter((id) => !before.has(id));
  if (gained.length > 0) {
    profile.rosterUnlocks = unlockFloor([...profile.rosterUnlocks, ...gained]);
  }
  return gained;
}

/**
 * Drafts a fresh commission.
 *
 * `school` is the discipline the player enrolled in, and it decides four things at once:
 * which bloodline they start beside, what that beast drafts into its Grimoire, which
 * bodies their Vanguard may field, and therefore what the other half of their opening
 * fifteen actually is. Everything else about a new character is identical whichever they
 * pick, which is what keeps the choice a *colour* rather than a difficulty setting.
 *
 * Defaulted rather than required, because two dozen tests and the legacy title flow call
 * this with a slot and nothing else, and a character who never chose is a Pyre one -- the
 * school the game started with.
 */
export function newProfile(
  profileId: string,
  name = 'Commander',
  school: School = DEFAULT_SCHOOL,
): Profile {
  return initializeNewProfile(profileId, {
    ...defaultLook(),
    nickname: name,
    // A discipline nothing speaks falls back rather than throwing: a save file is data,
    // and hand-edited data should land the player in the game rather than in a stack trace.
    starterCompanion: speciesForSchool(school) ?? DEFAULT_COMPANION.id,
  });
}

/**
 * Drafts a fresh commission from what the player built at the desk.
 *
 * The single writer of a new `Profile`, and everything it decides follows from the look:
 * the bloodline tamed, the eight spells that beast drafts, the bodies the Vanguard may
 * field, and therefore the elemental half of the opening fifteen. Everything else about a
 * new character is identical whichever they picked, which is what keeps the Vow a *colour*
 * rather than a difficulty setting.
 *
 * `newProfile` above is the thin legacy door onto this, kept because two dozen tests and
 * the old title flow call it with a slot and a school.
 */
export function initializeNewProfile(profileId: string, rawLook: CharacterLook): Profile {
  // Normalised on the way in, not trusted. This is the boundary between a screen the
  // player was typing into and a schema everything downstream reads.
  const characterLook = normalizeLook(rawLook);
  const baseId = characterLook.starterCompanion;
  const decks: Record<string, SavedDeck> = {};
  for (const companion of COMPANIONS) {
    decks[companion.id] = { companionId: companion.id, cards: [...companion.deck] };
  }
  // One tamed beast to start, rolled like any other -- the same three rolls a wild catch
  // makes, so the animal a player is handed at creation is a real roll rather than a
  // fixture. A character who began with a guaranteed 40/40 and a fixed knack would learn
  // nothing from their second beast.
  const rng = makeRng(Math.floor(Math.random() * 1e9) >>> 0);
  const companions: CompanionInstance[] = [tameCompanion(rng, baseId, 1)];
  // Seeded once, at creation, so two characters do not stare at the same board forever.
  const overworld = newRun(Math.floor(Math.random() * 1e9) >>> 0);
  // Two cores in the satchel from the start. Contracts pay more from Adept upward, so
  // these are the ones you learn the bench with rather than the only ones you will ever
  // hold.
  overworld.economy.reagents = { core_frost: 2, core_surge: 2 };
  // The coat is **owned and not worn**, and the distinction is the point.
  //
  // Every slot starts bare -- optics, vestment, trinket, treads, will -- because gear is
  // what a Commander earns and the creator deliberately has nothing to say about it. The
  // coat still arrives in the footlocker, so the loadout screen is not an empty grid with
  // nothing to teach; the player equips it themselves, which is a better first lesson than
  // finding it already on.
  //
  // Existing saves are untouched: what a character already owns and wears is read back off
  // disk, so nobody is undressed by an upgrade.
  overworld.relics = ['relic_coat'];
  overworld.equippedRelics = emptyLoadout();

  return {
    profileId,
    name: characterLook.nickname,
    level: 1,
    state: { overworld, combat: null },
    collection: startingCollection(),
    decks,
    // A warband of their own colour, spending as much of the ten as their school's shelf
    // allows -- so a new player meets the deployment phase with a real line to place, and
    // that line looks like the discipline they picked.
    roster: startingRosterFor(schoolOfSpecies(baseId)),
    // The floor, plus the bloodline they start beside. Written at creation rather than
    // left empty, so the very first Vanguard screen already reflects the one school this
    // character has.
    rosterUnlocks: unlockFloor(grantsFor(baseId)),
    characterLook,
    // Everything they can field, on the books at level 1. Seeded at creation rather than
    // on first deployment so the Assembly screen can show a level beside a body the player
    // has not taken into a fight yet -- an unlocked body with no record would read as a
    // bug, not as a body at level 1.
    vanguardProgress: startingVanguardProgress(),
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
    const only = migrateProfile(raw, SLOT_IDS[0], notes, version);
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
    profiles[slot] = migrateProfile(saved, slot, notes, version);
  }

  // A pointer at an empty slot is worse than no pointer: it would open a character that
  // is not there. Dropped rather than repaired, which puts the player back at the wall.
  const claimed = data.activeProfileId;
  const activeProfileId = isSlotId(claimed) && profiles[claimed] ? claimed : null;

  return { version: SAVE_VERSION, activeProfileId, difficulty, profiles };
}

/** Every universally available body, plus the starting warband, all at level 1. */
function startingVanguardProgress(): Record<string, VanguardProgress> {
  let progress: Record<string, VanguardProgress> = {};
  for (const defId of [...UNIVERSAL_ROSTER, ...DEFAULT_ROSTER]) {
    progress = unlockVanguard(progress, defId);
  }
  return progress;
}

/**
 * Rebuilds Vanguard progression from disk.
 *
 * Every entry is reconstructed rather than trusted, on this file's standing rule. A record
 * naming a body that no longer exists is dropped outright -- the alternative is a level
 * quietly attached to nothing, which would resurface as an Assembly screen listing a unit
 * the game cannot build.
 */
function readVanguardProgress(raw: unknown): Record<string, VanguardProgress> {
  if (!raw || typeof raw !== 'object') return {};
  const out: Record<string, VanguardProgress> = {};
  for (const [id, value] of Object.entries(raw as Record<string, unknown>)) {
    const defId = rename(id);
    if (!CARDS[defId]) continue;
    const p = value as Partial<VanguardProgress> | undefined;
    out[defId] = {
      level: Math.max(VANGUARD_START_LEVEL, Math.round(numberOr(p?.level, VANGUARD_START_LEVEL))),
      xp: Math.max(0, Math.round(numberOr(p?.xp, 0))),
    };
  }
  return out;
}

/**
 * Brings one character up to the current shape. Unknown fields are dropped and missing
 * ones filled from defaults, so a profile can never be *partly* valid.
 */
function migrateProfile(
  raw: unknown,
  slot: SlotId,
  notes: string[],
  /** The file's version, so pre-Stretch health can be scaled on the way in. */
  version: number,
): Profile {
  const base = newProfile(slot);
  if (!raw || typeof raw !== 'object') return base;
  const data = raw as Partial<Profile> & { overworld?: unknown };

  // --- collection ---
  // Renames are applied before reconciliation, which is the whole point: reconciliation
  // is what would otherwise throw the old id away as an unknown card.
  let collection = base.collection;
  const legacyOwned = (data.collection as { owned?: unknown } | undefined)?.owned;
  const savedUnlocked = (data.collection as { unlocked?: unknown } | undefined)?.unlocked;

  if (Array.isArray(savedUnlocked) || (legacyOwned && typeof legacyOwned === 'object')) {
    const unlocked = new Set<string>();

    // v13 onward: a set of ids.
    if (Array.isArray(savedUnlocked)) {
      for (const id of savedUnlocked) {
        if (typeof id === 'string') unlocked.add(rename(id));
      }
    }

    // Before v13 the collection was a tally of physical copies. Every card the player
    // held any number of becomes an unlock — the counts are simply dropped, because there
    // is nothing left in the game that reads one. A player who owned three of a staple
    // and one of a finisher now owns both outright, which is strictly more than they had.
    if (legacyOwned && typeof legacyOwned === 'object') {
      for (const [id, count] of Object.entries(legacyOwned as Record<string, unknown>)) {
        if (typeof count === 'number' && count > 0) unlocked.add(rename(id));
      }
    }
    // Ascensions are keyed by base card id, so they go through the same rename map as
    // everything else that names a card.
    const savedAscended = (data.collection as { ascended?: unknown } | undefined)?.ascended;
    const ascended = Array.isArray(savedAscended)
      ? savedAscended.filter((c): c is string => typeof c === 'string').map(rename)
      : [];

    const reconciled = reconcileCollection({ unlocked: [...unlocked], ascended });
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

    const renamed = saved.cards.filter((c): c is string => typeof c === 'string').map(rename);

    // The Vanguard overhaul took bodies out of decks entirely. Stripped rather than
    // flagged, because "your deck is illegal" is not something the player can act on when
    // the illegal cards are no longer cards — there is nothing to remove them *to*. What
    // is left may well be under the minimum, and that is flagged in the ordinary way:
    // topping it up is a real choice, and the builder is where it should be made.
    const cards = renamed.filter(
      (id) => CARDS[id]?.kind !== 'minion' && HERO_SCHOOLS.includes(CARDS[id]?.school ?? ''),
    );
    const bodies = renamed.filter((id) => CARDS[id]?.kind === 'minion').length;
    const elemental = renamed.length - cards.length - bodies;

    if (bodies > 0) {
      notes.push(
        `${bodies} minion(s) left your ${companion.name} deck — they are Vanguard Roster kit now.`,
      );
    }
    // Stripped rather than flagged, for the same reason the bodies were: "your deck is
    // illegal" is not actionable when the illegal cards can never be legal again. The
    // elements belong to the Companion now, and it brings its own eight.
    if (elemental > 0) {
      notes.push(
        `${elemental} elemental card(s) left your ${companion.name} deck — ${companion.name} fuses its own eight in now.`,
      );
    }

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

  // --- the Vanguard (v12) ---
  //
  // A save written before the overhaul has no roster at all, and gets the default one:
  // arriving at the deployment phase with an empty tray would read as a bug rather than a
  // choice. A roster that has since become illegal — a body renamed out of the game, or a
  // budget that moved under it — is repaired down to what still fits rather than rejected,
  // because there is no screen a player could be sent to in order to fix a save that will
  // not load.
  const savedRoster = Array.isArray(data.roster)
    ? data.roster.filter((id): id is string => typeof id === 'string').map(rename)
    : undefined;
  // Read before the companions are migrated, so it uses the raw list rather than waiting
  // on work this function has not done yet.
  const tamed = Array.isArray(data.companions)
    ? data.companions
        .map((c) => (c && typeof c === 'object' ? (c as { baseId?: unknown }).baseId : undefined))
        .filter((b): b is string => typeof b === 'string')
    : [];
  // --- Vanguard unlocks (v17) ---
  //
  // Read what is stored, then backfill from what this character evidently owns: the
  // bloodlines currently on the roster, *and* every body already in their warband. The
  // second half is what makes the migration safe rather than merely correct — a character
  // who tamed a Ferrum, built a Golem into their Vanguard and then released the beast has
  // a warband the derived rule would refuse, and trimming it on load would be taking away
  // something they earned before the rule existed.
  const stored = Array.isArray(data.rosterUnlocks)
    ? data.rosterUnlocks.filter((id): id is string => typeof id === 'string').map(rename)
    : [];
  const unlocks = unlockFloor([
    ...stored,
    ...rosterUnlocksFor(tamed),
    ...(savedRoster ?? []),
  ]);
  let roster = savedRoster ?? [...DEFAULT_ROSTER];
  // Repaired against the *same* gate the builder enforces, which is what stops a save
  // hand-edited to hold a Stone-Heart Golem from fielding one with no claim behind it.
  if (validateRoster(roster, unlocks).length > 0) {
    const repaired: string[] = [];
    for (const id of roster) {
      if (validateRoster([...repaired, id], unlocks).length === 0) repaired.push(id);
    }
    if (repaired.length !== roster.length) {
      notes.push(
        `Your Vanguard held bodies it can no longer field, or overran its ${ROSTER_BUDGET}-point 
         budget, and was trimmed to what fits.`.replace(/\s+/g, ' '),
      );
    }
    roster = repaired;
  }

  // --- Vanguard progression (v14) ---
  //
  // Read what is there, then backfill: any body on the roster, and every universally
  // available one, gets a record if it does not have one. A save from before this field
  // existed therefore arrives with a complete set at level 1, which is exactly the state
  // the game had before levelling.
  let vanguardProgress = readVanguardProgress(data.vanguardProgress);
  for (const defId of [...UNIVERSAL_ROSTER, ...roster]) {
    vanguardProgress = unlockVanguard(vanguardProgress, defId);
  }

  // Read after the collection, because a socket is only legal if its card is unlocked.
  const companions = readRoster(data.companions, base.companions, version, collection);

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
  const overworld = readOverworld(nested ?? data.overworld, version) ?? newRun(
    Math.floor(Math.random() * 1e9) >>> 0,
  );
  if (version < FIRST_STRETCHED_SAVE) {
    notes.push('Health numbers are ten times larger now. Yours were scaled to match.');
  }
  if (version < FIRST_DRAFTED_GRIMOIRE && companions.length > 0) {
    // Said out loud because it is a *non*-event, and a player who reads the patch notes
    // and then finds their Ignis unchanged should know that was the intent: the draft
    // applies to beasts caught from here on, not retroactively to the one beside you.
    notes.push('Companions draft their own spells now. The ones you already have keep theirs.');
  }

  // --- the look (v18) ---
  //
  // Synthesised for anything older, from the two facts an old save already holds: the name
  // on the commission, and the beast currently standing beside them. A returning player
  // therefore keeps their name and their bloodline and is handed the default silhouette,
  // which is the honest answer -- nobody ever asked them what their hair looked like.
  const characterLook = normalizeLook({
    ...(data.characterLook && typeof data.characterLook === 'object' ? data.characterLook : {}),
    ...(data.characterLook
      ? {}
      : {
          nickname: typeof data.name === 'string' ? data.name : base.name,
          starterCompanion:
            companions.find((c) => c.instanceId === activeCompanionId)?.baseId ??
            DEFAULT_COMPANION.id,
        }),
  });

  const profile: Profile = {
    profileId: slot,
    name: typeof data.name === 'string' && data.name.trim() ? data.name.trim().slice(0, 24) : base.name,
    level: 1,
    state: { overworld, combat: null },
    collection,
    decks,
    roster,
    rosterUnlocks: unlocks,
    characterLook,
    vanguardProgress,
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
function readOverworld(raw: unknown, version: number): OverworldState | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const data = raw as Partial<OverworldState>;
  if (!data.pact || typeof data.pact !== 'object') return undefined;

  // Both halves of the gauge, or neither. Scaling the ceiling without the current health
  // is the same bug as not scaling at all, wearing a different mask.
  const stretch = version < FIRST_STRETCHED_SAVE ? STAT_SCALE : 1;
  const maxHp = Math.max(1, Math.round(numberOr(data.pact.maxHp, BASE_PACT_HP / stretch)) * stretch);
  const currentHp = Math.max(
    0,
    Math.min(maxHp, Math.round(numberOr(data.pact.currentHp, maxHp / stretch)) * stretch),
  );

  const pos = data.playerPos;
  const playerPos = {
    x: numberOr(pos?.x, 0),
    y: numberOr(pos?.y, 0),
    mapId: typeof pos?.mapId === 'string' ? pos.mapId : 'start',
  };

  // Re-read off the shelf rather than trusted off disk. What a Mending Tonic restores is
  // a balance decision that lives in one file, and a bottle bought before the Stat Stretch
  // would otherwise keep healing 12 of 400 forever. Anything the shelf no longer sells is
  // dropped, which is what `isConsumable` already did for a retired brew.
  const inventory = (Array.isArray(data.inventory) ? data.inventory : [])
    .filter(isConsumable)
    .map((item) => APOTHECARY_STOCK.find((s) => s.item.id === item.id)?.item)
    .filter((item): item is Consumable => item !== undefined)
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
  equippedRelics: RelicLoadout;
} {
  const strings = (raw: unknown): string[] =>
    (Array.isArray(raw) ? raw : []).filter((v): v is string => typeof v === 'string');

  const relics = [...new Set(strings(data.relics))].filter((id) => RELICS[id]);
  const loadout = emptyLoadout();

  /** Puts an owned relic in its own slot, first writer wins. */
  const wear = (id: unknown): void => {
    if (typeof id !== 'string' || !relics.includes(id)) return;
    const slot = slotOf(id);
    // A relic whose slot the catalogue no longer recognises stays owned but comes off:
    // there is nowhere legitimate to put it, and guessing would be worse than bare.
    if (!slot || loadout[slot] !== null) return;
    loadout[slot] = id;
  };

  const raw = data.equippedRelics;

  if (Array.isArray(raw)) {
    // v9 and earlier: a flat list of up to four. Each piece goes to the slot it now
    // belongs in, in the order it was worn — so a save holding two vestments keeps the
    // one the player equipped first and drops the other back to the footlocker rather
    // than silently choosing for them.
    for (const id of strings(raw)) wear(id);
  } else if (raw && typeof raw === 'object') {
    // v10 onward: already a loadout. Re-read rather than trusted, because a hand-edited
    // file could put a coat in the Optics slot, and `slotOf` is the only authority on
    // where a thing goes.
    const saved = raw as Partial<Record<string, unknown>>;
    for (const slot of RELIC_SLOT_ORDER) {
      const id = saved[slot];
      if (typeof id === 'string' && slotOf(id) === slot) wear(id);
    }
  }

  return { relics, equippedRelics: loadout };
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
/**
 * A beast's Grimoire rolls, cleaned on the way in.
 *
 * A save written before the Fused Grimoire has none, and gets none — **not** a fresh roll.
 * Re-rolling on load would make every reload a new beast, which is precisely the thing
 * `baseHpRoll` is stored rather than derived to avoid. An older beast is simply a plain
 * one, and the player can catch a better.
 *
 * Keys that are not in this species' Grimoire are dropped: a modifier on a spell the beast
 * does not carry is unreachable, and keeping it would let a hand-edited save smuggle a roll
 * onto a card the fusion never deals.
 */
/** A stable seed from a beast's own id, so a migrated roll never changes. */
function hashId(id: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function readSpellModifiers(
  raw: unknown,
  grimoire: string[],
  instanceId: string,
): Record<string, CardModifier> {
  // A beast caught before the Fused Grimoire has no rolls stored. It gets some — but
  // seeded off its own `instanceId`, so the answer is identical on every load. A fresh
  // `Math.random()` here would make every reload a different animal, which is exactly what
  // storing `baseHpRoll` rather than deriving it exists to prevent.
  if (!raw || typeof raw !== 'object') {
    if (grimoire.length === 0) return {};
    return rollSpellModifiers(makeRng(hashId(instanceId)), grimoire);
  }
  const known = new Set(grimoire);
  const out: Record<string, CardModifier> = {};

  for (const [defId, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!known.has(defId) || !value || typeof value !== 'object') continue;
    const v = value as Partial<CardModifier>;
    const mod: CardModifier = {};
    // Clamped to what the table can actually roll, so a hand-edited -9 is a -1.
    if (typeof v.pipCostDelta === 'number' && Number.isFinite(v.pipCostDelta)) {
      mod.pipCostDelta = Math.max(-1, Math.min(1, Math.round(v.pipCostDelta)));
    }
    if (typeof v.bonusDamage === 'number' && Number.isFinite(v.bonusDamage)) {
      // The table rolls one *stretched* point. A pre-Stretch save holding a literal 1 is
      // scaled up rather than clamped down, or the roll a player caught would quietly
      // become a tenth of what it was worth.
      const raw = Math.round(v.bonusDamage);
      const scaled = raw > 0 && raw < STAT_SCALE ? raw * STAT_SCALE : raw;
      mod.bonusDamage = Math.max(0, Math.min(STAT_SCALE, scaled));
    }
    if (v.grantRetain === true) mod.grantRetain = true;
    if (Object.keys(mod).length > 0) out[defId] = mod;
  }
  return out;
}

/**
 * The sockets, rebuilt and **re-validated** against the character who owns them.
 *
 * Re-validated rather than trusted, and that is the whole reason this is not two lines.
 * A socket is the one part of a Companion that points *outward* — at a card in the
 * collection — so it is the one part that can rot without anything else changing. A card
 * cut from the game, a slot index past the end of a shorter book, a hand-edited save
 * putting a Bloom spell in a fire drake: each would otherwise survive to the opening bell
 * and deal something the rules refuse.
 *
 * A socket that no longer validates is dropped, which returns that slot to the beast's own
 * drafted card. Falling back to what the beast actually knows is always legal.
 */
function readOverrides(
  raw: unknown,
  baseId: string,
  size: number,
  collection: Collection,
): Record<number, string> {
  if (!raw || typeof raw !== 'object') return {};
  const source = companionById(baseId)?.grimoire;
  if (!source) return {};

  const out: Record<number, string> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const slot = Number(key);
    if (typeof value !== 'string') continue;
    const cardId = rename(value);
    if (socketRefusal(source, collection.unlocked, slot, cardId, size) !== null) continue;
    out[slot] = cardId;
  }
  return out;
}

function readRoster(
  raw: unknown,
  base: CompanionInstance[],
  version: number,
  collection: Collection,
): CompanionInstance[] {
  if (!raw || typeof raw !== 'object') return base;
  const known = new Set(COMPANIONS.map((c) => c.id));
  const stretch = version < FIRST_STRETCHED_SAVE ? STAT_SCALE : 1;

  const clean = (
    saved: Partial<CompanionInstance>,
    baseId: string,
    fallbackId: string,
  ): CompanionInstance => {
    const level = Math.max(1, Math.round(numberOr(saved.level, 1)));
    const instanceId =
      typeof saved.instanceId === 'string' && saved.instanceId ? saved.instanceId : fallbackId;

    // What this beast knows, as it was written down. A beast caught before the draft
    // existed has none, and gets its species' old fixed eight rather than a fresh draw:
    // re-rolling here would hand the player a different Companion than the one they went
    // out and caught, every time they opened the game.
    const savedBook = Array.isArray(saved.grimoire)
      ? saved.grimoire.filter((c): c is string => typeof c === 'string').map(rename)
      : [];
    const grimoire = (savedBook.length > 0 ? savedBook : (companionById(baseId)?.legacyGrimoire ?? []))
      // A card that has since left the game would deal a hole in the deck.
      .filter((id) => CARDS[id]);

    // Membership in the *rollable* pool, not `trait.baseId === baseId`.
    //
    // A hybrid rolls its two parents' knacks alongside its own, so a Chimera legitimately
    // wearing Ash-Walker files that trait under `ignis`. The stricter reading rejected it
    // on load and quietly reset the beast to `pool[0]` — the player's Companion changing
    // knack because they closed the game.
    const pool = traitsFor(baseId);
    const traitId =
      typeof saved.traitId === 'string' && pool.some((t) => t.id === saved.traitId)
        ? saved.traitId
        : (pool[0]?.id ?? '');

    return {
      instanceId,
      baseId,
      grimoire,
      overrides: readOverrides(saved.overrides, baseId, grimoire.length, collection),
      // Clamped to the band it could have been rolled in, so a hand-edited 4000 is a 440.
      // Scaled first: a pre-Stretch roll of 44 clamps to 360 if it is read as-is, which
      // would quietly turn every good constitution into the worst one.
      baseHpRoll: Math.min(
        HP_ROLL_MAX,
        Math.max(
          HP_ROLL_MIN,
          Math.round(numberOr(saved.baseHpRoll, BASE_PACT_HP / stretch)) * stretch,
        ),
      ),
      level,
      // Derived from the level rather than read, which is what it has always been:
      // `levelCompanion` raises the two together and nothing else touches either. Deriving
      // it means the pre-Stretch value on disk needs no scaling rule of its own -- and a
      // hand-edited bonus can no longer disagree with the level that was paid for.
      bonusMaxHp: (level - 1) * HP_PER_LEVEL,
      startingArmor: Math.max(0, Math.round(numberOr(saved.startingArmor, 0))),
      bonusPips: Math.max(0, Math.round(numberOr(saved.bonusPips, 0))),
      traitId,
      spellModifiers: readSpellModifiers(saved.spellModifiers, grimoire, instanceId),
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
    // No `baseHpRoll` override: a v8 entry never had one, and `clean` already falls back
    // to the standard body *in the units the save was written in*. Forcing the current
    // constant in here fed a stretched 400 into the pre-Stretch scaling and handed every
    // migrated beast the best constitution in the band.
    legacy.push(clean({ ...saved }, companion.id, `${companion.id}-${n}`));
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
