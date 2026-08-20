import type { CardInstanceId, Coord, TargetRef, UnitId } from '../../contract/ids.js';
import type { ChosenTarget } from './cards.js';

/** External intents. The engine's only entry point is applyCommand(state, command). */
export type Command =
  | { type: 'playCard'; card: CardInstanceId; target: ChosenTarget }
  | { type: 'moveUnit'; unit: UnitId; to: Coord }
  | { type: 'attack'; attacker: UnitId; target: TargetRef }
  /**
   * Blood Magic: open one of your own units for Marrow.
   *
   * It is not an offering — the body stays on the board, wounded and Exhausted. What you
   * spend is its turn and its health, not the unit itself.
   */
  | { type: 'bloodTithe'; unit: UnitId }
  /** Spend a unit's attack to extract Marrow instead of swinging. */
  | { type: 'channel'; unit: UnitId }
  /**
   * A declared attack resolving on a tile that is now empty. It costs the unit its
   * action and deals nothing — the visible reward for having moved the target away.
   */
  | { type: 'attackTile'; attacker: UnitId; at: Coord }
  /**
   * Records the enemy's commitment for next turn. A command rather than a side effect so
   * it passes through the one reducer and replays identically from a seed.
   */
  | { type: 'declareIntents'; plan: Command[]; telegraph: 'all' | 'attacks' }
  | { type: 'endTurn' };

export class IllegalCommandError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IllegalCommandError';
  }
}
