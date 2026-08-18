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
  economy: { ducats: number; marrowShards: number };
  /** Hard cap of `INVENTORY_LIMIT`; enforced by `addConsumable`, not by convention. */
  inventory: Consumable[];
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

/** Items a character may carry at once. */
export const INVENTORY_LIMIT = 3;

/** A fresh character. */
export function newRun(bountySeed = 1, maxHp = 40): OverworldState {
  return {
    playerPos: { x: 0, y: 0, mapId: 'start' },
    pact: { currentHp: maxHp, maxHp },
    economy: { ducats: 0, marrowShards: 0 },
    inventory: [],
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
