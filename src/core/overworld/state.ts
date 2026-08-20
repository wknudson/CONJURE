/**
 * The world outside a fight, and the character that persists across fights.
 *
 * CONJURE's combat engine is a pure reducer over a `GameState` that begins and ends with
 * one encounter. Progression needs what the encounter cannot hold: a Pact that stays
 * wounded, a purse that remembers, a satchel carried from one contract to the next.
 *
 * The progression model is **RPG, not roguelike**. Nothing here is wagered on a single
 * outing: the deck and the satchel are the player's property and survive death. What a
 * knockout costs is money and time, never possessions — see `rescuePlayer`.
 *
 * There is deliberately no `deck` field. The saved master deck *is* the active deck, and
 * a second copy here would be the "run deck" the design discarded. One list, one truth:
 * a mirror is how the two drift apart.
 *
 * Deliberately in `src/core/` and therefore DOM-free: none of this touches a screen, all
 * of it is a pure function of what came before, and keeping it beside the engine means it
 * is testable in the same way and cannot quietly grow a dependency on the renderer.
 *
 * The one rule that shapes the whole file: **this module never imports the combat
 * engine, and the engine never imports this.** They meet in `run.ts`, which knows about
 * both. A `createCombat` that understood what an "overworld" was would be a combat engine
 * you could not test without one.
 *
 * That is also why the brew *table* is not here. This file owns which brews exist;
 * `run.ts` owns what one does to a fight, because saying so requires the engine's
 * vocabulary. `src/tests/boundaries.test.ts` holds the rule to it.
 */

/**
 * Where on the Commander a relic sits.
 *
 * Named places rather than interchangeable holes. A slotted loadout asks a
 * better question than a flat list did: the flat version made every relic compete with
 * every other for the same four openings, so the answer was always "the four strongest"
 * and the decision was arithmetic. Anatomy means a pair of goggles competes with other
 * goggles, and the Will slot cannot be filled with more armour.
 *
 * Declared here rather than beside `RELICS`, because this is the shape of what gets
 * written to disk. `relics.ts` imports the type to tag each piece of gear, the same
 * direction `bounties.ts` already reads `CombatSpoils` from this file.
 */
export type RelicSlot = 'optics' | 'vestment' | 'trinket' | 'treads' | 'will';

/** The order the loadout is drawn and iterated in. Head downward, then the intangible. */
export const RELIC_SLOT_ORDER: readonly RelicSlot[] = [
  'optics',
  'vestment',
  'trinket',
  'treads',
  'will',
];

/**
 * What is worn, by slot.
 *
 * Every slot is present and explicitly `null` when bare rather than absent, so reading a
 * loadout never has to distinguish "empty" from "this save predates the slot" — the
 * migration settles that once, on load.
 */
export type RelicLoadout = Record<RelicSlot, string | null>;

export function emptyLoadout(): RelicLoadout {
  return { optics: null, vestment: null, trinket: null, treads: null, will: null };
}

/** The ids currently worn, in slot order, skipping bare slots. */
export function wornRelics(loadout: RelicLoadout): string[] {
  return RELIC_SLOT_ORDER.map((slot) => loadout[slot]).filter((id): id is string => id !== null);
}

/** A carried item. Healing is spent immediately; a buff is held until the next fight. */
export interface Consumable {
  id: BuffId | string;
  name: string;
  type: 'healing' | 'buff';
  /** Points restored, for healing. A buff reads its strength from `BUFF_EFFECTS` in `run.ts`. */
  value: number;
}

/**
 * The three brews a character can carry into a fight.
 *
 * The list is the runtime value and the type is derived from it, so a save holding an
 * unknown brew can be checked against the same thing the type is made of.
 */
export const BUFF_IDS = ['ironbrew', 'kinetic_capacitor', 'quicksilver'] as const;

export type BuffId = (typeof BUFF_IDS)[number];

export function isBuffId(value: unknown): value is BuffId {
  return typeof value === 'string' && (BUFF_IDS as readonly string[]).includes(value);
}

/**
 * What a won fight pays.
 *
 * Named for the purse it lands in rather than for the contract it came from — `ducats`
 * and `marrowShards` are the economy's own field names, so a payout cannot miss by being
 * spelled one way at the bounty end and another at the till.
 */
export interface CombatSpoils {
  ducats?: number;
  marrowShards?: number;
  /** Splicing materials, by reagent id. The only way to earn a core. */
  reagents?: Record<string, number>;
}

/**
 * A fight that has been committed to and not yet answered for.
 *
 * Non-null from the moment a bounty is accepted until `resolveCombat` closes it, and —
 * critically — written to disk in that state *before* the board is mounted. A player who
 * closes the tab on a losing turn leaves this set, and the next boot reads it as a
 * forfeit. Without it, walking away is strictly better than losing.
 *
 * It carries the payout rather than merely marking that a fight is open, so what a win is
 * worth is fixed when the contract is taken. The board rerolls after every fight; without
 * the cached copy, a victory would be paid at whatever the new board happened to offer.
 */
export interface ActiveEncounterState {
  bountyId: string;
  spoils: CombatSpoils;
  /**
   * The stake already paid to take this contract, if it was a duel.
   *
   * Cached here for the same reason the spoils are: the board rerolls after every fight,
   * so a payout settled against the *new* board would be paying out a bet nobody placed.
   * Also what makes the buy-in survive a reload — the Ducats are gone from the purse the
   * moment the contract opens, and this is the only record of why.
   */
  wager?: number;
}

export interface OverworldState {
  playerPos: { x: number; y: number; mapId: string };
  /**
   * The Pact, carried between fights.
   *
   * Not reset on entering combat: a fight won at three health is one that makes the next
   * contract terrifying. A knockout does not reset it either — `rescuePlayer` stands the
   * player back up at exactly 1.
   */
  pact: { currentHp: number; maxHp: number };
  economy: {
    ducats: number;
    marrowShards: number;
    /**
     * Splicing materials, by reagent id.
     *
     * A bag rather than named fields: reagents are content, and a new one should be a
     * row in a data table rather than a migration. A missing key is zero.
     */
    reagents: Record<string, number>;
  };
  /** Hard cap of `INVENTORY_LIMIT`; enforced by `addConsumable`, not by convention. */
  inventory: Consumable[];
  /**
   * Gear owned, and the four pieces currently worn.
   *
   * Two collections rather than a flag on each relic: "what I have" and "what I am
   * wearing" are different questions, and the loadout screen asks both at once. Every id
   * in the loadout is always also in `relics` — `equipRelic` is what holds that, not
   * convention.
   */
  relics: string[];
  equippedRelics: RelicLoadout;
  /**
   * The single brew that will be consumed by the next fight, if any.
   *
   * One, not a list. Drinking a second overwrites the first rather than stacking, so the
   * decision is always "which one", never "how many".
   */
  activeBuff: BuffId | null;
  /** The open contract, or null when standing safely in the Safehouse. */
  activeEncounter: ActiveEncounterState | null;
  /**
   * Seeds the three bounties currently pinned to the board.
   *
   * A seed rather than the bounties themselves, so the board is stable across a hub that
   * is re-entered every time a shop door closes, and so the save grows by one number
   * instead of three objects. Bumped once per finished fight.
   */
  bountySeed: number;
}

/**
 * The whole application's state.
 *
 * `combat` being null is what "we are in the overworld" means — there is no separate
 * mode flag to fall out of step with it.
 */
export interface GlobalGameState {
  overworld: OverworldState;
  combat: CombatSnapshotRef | null;
}

/**
 * A handle to the live combat, kept deliberately opaque here.
 *
 * Typed as an unknown-shaped reference rather than as `GameState` so this module has no
 * reason to import the engine. `run.ts` is where the two are known together, and it does
 * the narrowing.
 */
export type CombatSnapshotRef = unknown;

/**
 * What a character has met and what they have put down, by unit definition id.
 *
 * Kept per character rather than globally: a second Commander starts knowing nothing,
 * which is what makes the Ledger filling up feel like their own doing.
 */
export type Bestiary = Record<string, { encountered: number; defeated: number }>;

/** Items a character may carry at once. */
export const INVENTORY_LIMIT = 3;

/** A fresh character. */
export function newRun(bountySeed = 1, maxHp = 40): OverworldState {
  return {
    playerPos: { x: 0, y: 0, mapId: 'start' },
    pact: { currentHp: maxHp, maxHp },
    economy: { ducats: 0, marrowShards: 0, reagents: {} },
    inventory: [],
    relics: [],
    equippedRelics: emptyLoadout(),
    activeBuff: null,
    activeEncounter: null,
    bountySeed,
  };
}

/**
 * Picks up an item, or refuses when the satchel is full.
 *
 * Returns whether it was taken rather than throwing: finding loot with no room is an
 * ordinary thing that happens, not a programming error.
 */
export function addConsumable(state: OverworldState, item: Consumable): boolean {
  if (state.inventory.length >= INVENTORY_LIMIT) return false;
  state.inventory.push(item);
  return true;
}

/**
 * Why a relic could not be worn, or null if it can.
 *
 * `no-slot` is gone with the flat list. A relic names the slot it belongs in, so there is
 * always exactly one place it could go — the only question is whether something is
 * already there, and that is answered by swapping rather than by refusing.
 */
export type EquipRefusal = 'in-combat' | 'not-owned' | 'already-worn' | 'unknown-slot' | null;

export function equipRefusal(
  state: GlobalGameState,
  relicId: string,
  slot: RelicSlot | undefined,
): EquipRefusal {
  // Gear is chosen before the bell, like everything else the Safehouse sells. Changing
  // what you are wearing after a contract is accepted would change a fight the board was
  // already built against.
  if (state.combat !== null || state.overworld.activeEncounter !== null) return 'in-combat';

  const { relics, equippedRelics } = state.overworld;
  if (!relics.includes(relicId)) return 'not-owned';
  // The caller looks the slot up, because this module holds no registry — a relic the
  // catalogue has forgotten has nowhere to go and must not be silently dropped anywhere.
  if (!slot || !RELIC_SLOT_ORDER.includes(slot)) return 'unknown-slot';
  if (equippedRelics[slot] === relicId) return 'already-worn';
  return null;
}

/**
 * Puts a relic on, and reports whether it went on.
 *
 * **Wearing something in an occupied slot swaps it**, rather than refusing. With a flat
 * list a full loadout had to say no, because the game could not know which of the four to
 * drop. A slot answers that by construction: there is one thing in the way and it is the
 * thing being replaced. Refusing here would mean two clicks to change goggles, and the
 * first of them would be "take off the pair I am about to stop wearing".
 *
 * The displaced relic is not lost — `relics` is ownership and is never touched here.
 *
 * A boolean rather than a throw, like every other affordance in the Safehouse: a click on
 * a stale render is a thing players do, and `equipRefusal` gives the screen the reason.
 */
export function equipRelic(
  state: GlobalGameState,
  relicId: string,
  slot: RelicSlot | undefined,
): boolean {
  if (equipRefusal(state, relicId, slot) !== null) return false;
  state.overworld.equippedRelics[slot!] = relicId;
  return true;
}

/** Takes a relic off. Always allowed out of combat — there is no cost to bare slots. */
export function unequipRelic(state: GlobalGameState, relicId: string): boolean {
  if (state.combat !== null || state.overworld.activeEncounter !== null) return false;

  const loadout = state.overworld.equippedRelics;
  // Found by id rather than by slot, so the screen can say "take this off" about the
  // thing the player is looking at without also having to know where it sits.
  const slot = RELIC_SLOT_ORDER.find((s) => loadout[s] === relicId);
  if (!slot) return false;

  loadout[slot] = null;
  return true;
}

/**
 * Whether the player is down and owes the Magistracy a rescue.
 *
 * Not "the run is over" — under the RPG model there is no run to end. Zero is a state to
 * be recovered from at a price, which is what `rescuePlayer` charges.
 */
export function isDown(state: OverworldState): boolean {
  return state.pact.currentHp <= 0;
}

/** At or below this, the player is upright but in no state to take a contract. */
export const CRITICAL_HP = 5;

export function isCritical(state: OverworldState): boolean {
  return !isDown(state) && state.pact.currentHp <= CRITICAL_HP;
}

/**
 * Collects on an abandoned fight, and reports whether it had to.
 *
 * A save loaded with a contract still open was interrupted between committing to a fight
 * and finishing one, which in practice means the tab was closed. Treated as a knockout
 * rather than a resume: the alternative is that quitting a fight going badly costs
 * nothing, which makes every defeat optional.
 *
 * Idempotent — the contract is closed as the Pact is emptied, so a second boot finds an
 * ordinary knockout rather than forfeiting it again.
 */
export function forfeitIfAbandoned(state: OverworldState): boolean {
  if (state.activeEncounter === null) return false;
  state.activeEncounter = null;
  state.pact.currentHp = 0;
  return true;
}

/** The share of the purse the Magistracy keeps for carrying you home. */
export const RESCUE_FEE_RATE = 0.2;

/**
 * Picks the player up off the floor, and returns what it cost them.
 *
 * The RPG death penalty, and the whole reason there is no wipe: a knockout takes money
 * and time, never property. The deck, the satchel, the collection and the Marrow Shards
 * all come through untouched — those were earned, and earning is what this model keeps.
 *
 * Two things make it sting anyway. The fee is a share of the purse, so it is felt by a
 * rich player as much as a poor one. And the Pact comes back at **1**, not full: upright,
 * but unable to take another contract without spending a tonic or a Clinic fee on getting
 * well. Waking at full health would make dying a free ride home.
 *
 * Mutates in place because the state is referenced from the save; swapping the object
 * would leave `save.overworld` pointing at the version that got knocked out.
 */
export function rescuePlayer(state: GlobalGameState): number {
  const { overworld } = state;

  const before = overworld.economy.ducats;
  overworld.economy.ducats = Math.floor(before * (1 - RESCUE_FEE_RATE));
  const fee = before - overworld.economy.ducats;

  overworld.pact.currentHp = 1;
  overworld.activeBuff = null;
  overworld.activeEncounter = null;
  state.combat = null;

  return fee;
}
