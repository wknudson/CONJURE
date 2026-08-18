/**
 * The world outside a fight, and the run that persists across fights.
 *
 * CONJURE's combat engine is a pure reducer over a `GameState` that begins and ends with
 * one encounter. The Gauntlet needs something the encounter cannot hold: a Pact that
 * stays wounded, a purse that remembers, an inventory carried between rooms. That lives
 * here.
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

import { STARTER_DECK } from '../data/cards/starter.js';

/** A carried item. Healing is spent immediately; a buff is held until the next fight. */
export interface Consumable {
  id: BuffId | string;
  name: string;
  type: 'healing' | 'buff';
  /** Points restored, for healing. A buff reads its strength from `BUFF_EFFECTS` in `run.ts`. */
  value: number;
}

/**
 * The three brews a run can carry into a fight.
 *
 * The list is the runtime value and the type is derived from it, so a save holding an
 * unknown brew can be checked against the same thing the type is made of.
 */
export const BUFF_IDS = ['ironbrew', 'kinetic_capacitor', 'quicksilver'] as const;

export type BuffId = (typeof BUFF_IDS)[number];

export function isBuffId(value: unknown): value is BuffId {
  return typeof value === 'string' && (BUFF_IDS as readonly string[]).includes(value);
}

export interface OverworldState {
  playerPos: { x: number; y: number; mapId: string };
  /**
   * The Pact, carried between fights.
   *
   * Not reset on entering combat, which is the whole point of the Gauntlet: a fight won
   * at three health is a fight that makes the next room terrifying.
   */
  pact: { currentHp: number; maxHp: number };
  economy: { ducats: number; marrowShards: number };
  /** Card ids. The deck the next fight is built from. */
  deck: string[];
  /** Hard cap of `INVENTORY_LIMIT`; enforced by `addConsumable`, not by convention. */
  inventory: Consumable[];
  /**
   * The single brew that will be consumed by the next fight, if any.
   *
   * One, not a list. Drinking a second overwrites the first rather than stacking, so the
   * decision is always "which one", never "how many".
   */
  activeBuff: BuffId | null;
  /**
   * True from the moment a fight is committed to until it is resolved.
   *
   * Written to disk *before* the Combat Screen mounts, which is the whole point: a
   * player who closes the tab on a losing turn leaves this set, and the next boot reads
   * it as a forfeit. Without it, walking away is strictly better than losing.
   */
  activeEncounter: boolean;
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

/** Items a run may carry at once. */
export const INVENTORY_LIMIT = 3;

/** A fresh run. */
export function newRun(deck: string[], maxHp = 40): OverworldState {
  return {
    playerPos: { x: 0, y: 0, mapId: 'start' },
    pact: { currentHp: maxHp, maxHp },
    economy: { ducats: 0, marrowShards: 0 },
    deck: [...deck],
    inventory: [],
    activeBuff: null,
    activeEncounter: false,
  };
}

/**
 * Picks up an item, or refuses when the satchel is full.
 *
 * Returns whether it was taken rather than throwing: finding loot with no room is an
 * ordinary thing that happens in a run, not a programming error.
 */
export function addConsumable(state: OverworldState, item: Consumable): boolean {
  if (state.inventory.length >= INVENTORY_LIMIT) return false;
  state.inventory.push(item);
  return true;
}

/** Whether the run is over. A Pact at zero does not recover between rooms. */
export function isRunOver(state: OverworldState): boolean {
  return state.pact.currentHp <= 0;
}

/**
 * Collects on an abandoned fight, and reports whether it had to.
 *
 * A run loaded with `activeEncounter` still set was interrupted between committing to a
 * fight and finishing one, which in practice means the tab was closed. Treated as a
 * lethal forfeit rather than a resume: the alternative is that quitting a fight going
 * badly costs nothing, which makes every defeat optional.
 *
 * Idempotent — the flag is cleared as the Pact is emptied, so a second boot finds an
 * ordinary dead run rather than forfeiting it again.
 */
export function forfeitIfAbandoned(state: OverworldState): boolean {
  if (!state.activeEncounter) return false;
  state.activeEncounter = false;
  state.pact.currentHp = 0;
  return true;
}

/**
 * What a dead run leaves behind: nothing but the gauge it starts with.
 *
 * The Ducats a corpse was carrying do not follow it back. Only the *collection* survives
 * a death — a forged card was bought once and stays bought — which is the line between
 * progress that persists and progress that is wagered on a run.
 */
export const SURVIVAL_STIPEND = 0;

/**
 * Wipes a spent run back to its opening state, in place.
 *
 * Mutates rather than returning a fresh object because the run is referenced from the
 * save, and swapping the object would leave `save.overworld` pointing at the corpse.
 *
 * `maxHp` is deliberately untouched: it is the shape of the Pact rather than something
 * the run spent, and a permanent upgrade to it should survive a death.
 */
export function resetRun(state: GlobalGameState): void {
  const { overworld } = state;

  overworld.playerPos = { x: 0, y: 0, mapId: 'start' };
  overworld.pact.currentHp = overworld.pact.maxHp;
  overworld.deck = [...STARTER_DECK];
  overworld.inventory = [];
  overworld.economy = { ducats: SURVIVAL_STIPEND, marrowShards: 0 };
  // Not in the brief, but a wipe that left a brew in hand or a fight marked open would
  // be a wipe with a hole in it.
  overworld.activeBuff = null;
  overworld.activeEncounter = false;

  state.combat = null;
}
