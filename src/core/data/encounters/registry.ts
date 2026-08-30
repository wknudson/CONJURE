/**
 * Encounter scripts.
 *
 * Boss behaviour lives in data-side hooks rather than in the engine, so the Ignis trial's
 * phase gates and the Harpoon Protocol add no branches to the combat rules.
 */

import type { School, Side } from '../../../contract/ids.js';
import type { Ctx } from '../../engine/context.js';
import type { GameState, Weather } from '../../types/state.js';

export interface EncounterDef {
  id: string;
  name: string;
  blurb: string;
  width: number;
  height: number;
  /** Commander HP for each side. */
  playerHp: number;
  enemyHp: number;
  /**
   * Banked Bones both sides open with. The contact table sets frontal (neutral)
   * engagement at 3 Bones and 5 cards; without it turn one is a dead turn.
   */
  startingBones?: number;
  playerName: string;
  companionName: string;
  /** Default Companion when the player has not chosen one. */
  companionId?: string;
  /** Drives the Companion's Resonance passive and its card framing. */
  companionSchool: School;
  enemyName: string;
  enemySchool: School;
  enemyDeck: string[];
  /** Units the enemy starts with, as [cardDefId, x, y]. */
  enemyOpeningBoard: [string, number, number][];
  /**
   * The enemy's Companion, given a body on the board.
   *
   * **Required for every fight that has an enemy Commander**, which is every fight that is
   * not a `victory: 'rout'`. A Commander cannot be struck: the Hero stands off the grid as
   * the Architect, and the only route to their Pact is this body, whose wounds `dealDamage`
   * redirects to the portrait. An encounter that names a Commander and no Companion is an
   * unwinnable fight, and a test holds the two together so one cannot be authored.
   *
   * `at` is the tile it opens on, defaulting to the enemy's Companion lane on their back
   * row. Give it explicitly when `enemyOpeningBoard` already stands something there.
   *
   * Their ranged Companion cards are anchored to it, exactly as yours are to yours.
   */
  enemyCompanion?: { unitCardId: string; at?: { x: number; y: number } };
  /**
   * Map terrain, Pirate101-style: every arena has its own shape and furniture.
   * `wall` blocks movement and sight; `cover` blocks only sight, so units may stand on it.
   */
  terrain?: { at: { x: number; y: number }; kind: 'wall' | 'cover'; hp?: number }[];
  /**
   * Named scenery placed at fixed tiles — crystals, barrels, anything with an obstacle
   * definition. Unlike `terrain`, which is generic walls and cover, these are specific
   * things whose behaviour lives on their card.
   */
  props?: { at: { x: number; y: number }; defId: string }[];
  /**
   * Volatile Marrow Geodes scattered on neutral ground at setup.
   *
   * Per-encounter rather than universal so a boss arena can stay clean and a test arena
   * stays predictable. Every ordinary fight opts in, so from the player's side they are
   * simply part of the furniture.
   */
  marrowGeodes?: { min: number; max: number };
  /**
   * Tiles that carry whatever stands on them, one step per round, in `dir`.
   *
   * A lane of these is ground both sides want and neither fully controls: it delivers
   * your units toward the enemy, and theirs toward you, whether or not that was the plan.
   */
  currents?: { at: { x: number; y: number }; dir: { x: number; y: number } }[];
  /** The sky this fight is had under. Shown before the deck is locked. */
  weather?: Weather;
  /** A loot-carrying scavenger turns up mid-fight and runs for the edge. */
  scavenger?: true;
  /** Wild beasts arrive and maul whichever army is nearest. */
  turfwar?: { count: number; unitCardId: string };
  /** Free opening unit placed for both sides. Set to null to skip. */
  vanguard?: string | null;
  /**
   * The species a successful subjugation adds to the roster, by Companion id.
   *
   * Here rather than in the engine for the same reason `beginSubjugation` is called from
   * a script rather than fired by a rule: the tether belongs to the engine, *which beast
   * is on the end of it* belongs to the encounter. The engine never learns a species name
   * and the overworld never learns how a tether works.
   *
   * Optional, and absent from every ordinary fight. An encounter that seals without
   * naming one binds a beast that cannot be kept, which is a `bound` result that pays
   * like a victory -- the behaviour every subjugation had before this field existed.
   */
  /**
   * How this fight is won. Absent means the ordinary rule: drop the enemy commander.
   *
   * `'rout'` is for a fight with **no commander to drop** — a wandering pack, which has no
   * hero behind it, no Bound Form and nothing to negotiate with. Clear every body and it is
   * over. It is the one case that may leave `enemyCompanion` unset: there is no Pact behind
   * the pack for a Companion to be the body of, so the pack really is the whole of the
   * opposition rather than a screen in front of an abstract health bar.
   */
  victory?: 'rout';
  subjugationPrize?: string;
  script?: EncounterScript;
}

export interface EncounterScript {
  /** Runs once after both sides are set up. */
  setup?(ctx: Ctx): void;
  /** Clamps or modifies damage before it lands on a commander. Return the new amount. */
  onDamageToCommander?(ctx: Ctx, side: Side, amount: number): number;
  /** Fires after a commander actually loses HP. */
  onCommanderHpChanged?(ctx: Ctx, side: Side): void;
  /** Fires at the start of each side's turn, before that side acts. */
  onTurnStart?(ctx: Ctx, side: Side): void;
}

const registry = new Map<string, EncounterScript>();

export function registerEncounterScript(id: string, script: EncounterScript): void {
  registry.set(id, script);
}

export function getEncounterScript(id: string): EncounterScript | undefined {
  return registry.get(id);
}

/**
 * The definitions themselves, registered as they are declared.
 *
 * The turn machine needs to read an encounter's own settings — whether it has wildlife,
 * what weather it is fought in — and it only ever has the id to hand. Populated by the
 * encounter modules on import, so it cannot fall out of step with what ships.
 */
const defs = new Map<string, EncounterDef>();

export function registerEncounter(def: EncounterDef): EncounterDef {
  defs.set(def.id, def);
  return def;
}

export function encounterDefById(id: string): EncounterDef | undefined {
  return defs.get(id);
}

export function encounterOf(state: GameState): string {
  return state.encounter.id;
}
