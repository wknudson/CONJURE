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
 */

/** A carried item. Healing is spent immediately; a buff is held until the next fight. */
export interface Consumable {
  id: BuffId | string;
  name: string;
  type: 'healing' | 'buff';
  /** Points restored, for healing. Buffs read their strength from `BUFF_EFFECTS`. */
  value: number;
}

/** The three brews a run can carry into a fight. */
export type BuffId = 'ironbrew' | 'spark_cell' | 'quicksilver';

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

/**
 * What each brew does to a fight, in the engine's own terms.
 *
 * The translation lives here rather than in `createCombat` so that adding a brew is
 * adding a row to this table — the combat engine is handed armor, pips and cards, and
 * never learns that a thing called "ironbrew" exists.
 */
export const BUFF_EFFECTS: Record<BuffId, CombatBoons> = {
  /** Armour to soak the first exchange. */
  ironbrew: { armor: 5 },
  /** Opens on a bigger bank, so a turn-one Power Tier play is briefly possible. */
  spark_cell: { pips: 2 },
  /** A wider opening hand: more options rather than more power. */
  quicksilver: { extraOpeningCards: 2 },
};

/**
 * Advantages a fight can begin with, expressed as things the engine already understands.
 *
 * Every field is additive and optional, so a fight with no boons is the same fight the
 * engine has always built.
 */
export interface CombatBoons {
  /** Persistent Armor on the Commander at the opening bell. */
  armor?: number;
  /** Added to the starting Pip bank. */
  pips?: number;
  /** Drawn on top of the ordinary opening hand. */
  extraOpeningCards?: number;
}

/** A fresh run. */
export function newRun(deck: string[], maxHp = 40): OverworldState {
  return {
    playerPos: { x: 0, y: 0, mapId: 'start' },
    pact: { currentHp: maxHp, maxHp },
    economy: { ducats: 0, marrowShards: 0 },
    deck: [...deck],
    inventory: [],
    activeBuff: null,
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
