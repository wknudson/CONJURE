/**
 * Encounter scripts.
 *
 * Boss behaviour lives in data-side hooks rather than in the engine, so the Ignis trial's
 * phase gates and Rite of Binding injection add no branches to the combat rules.
 */

import type { School, Side } from '../../../contract/ids.js';
import type { Ctx } from '../../engine/context.js';
import type { GameState } from '../../types/state.js';

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
   * Banked Pips both sides open with. Module 3's contact table sets frontal (neutral)
   * engagement at 3 Pips and 5 cards; without it turn one is a dead turn.
   */
  startingPips?: number;
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
   * Map terrain, Pirate101-style: every arena has its own shape and furniture.
   * `wall` blocks movement and sight; `cover` blocks only sight, so units may stand on it.
   */
  terrain?: { at: { x: number; y: number }; kind: 'wall' | 'cover'; hp?: number }[];
  /** Free opening unit placed for both sides. Set to null to skip. */
  vanguard?: string | null;
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

export function encounterOf(state: GameState): string {
  return state.encounter.id;
}
