import type { CardInstanceId, Coord, TargetRef, UnitId } from '../../contract/ids.js';
import type { ChosenTarget } from './cards.js';

/** External intents. The engine's only entry point is applyCommand(state, command). */
export type Command =
  /**
   * `x` is the declared price of a variable-cost card, and is required by one — see
   * `CardDef.xCost`. Ignored entirely by every other card.
   */
  | { type: 'playCard'; card: CardInstanceId; target: ChosenTarget; x?: number }
  | { type: 'moveUnit'; unit: UnitId; to: Coord }
  | { type: 'attack'; attacker: UnitId; target: TargetRef }
  /**
   * Blood Magic: open one of your own units for Marrow.
   *
   * It is not an offering — the body stays on the board, wounded and Exhausted. What you
   * spend is its turn and its health, not the unit itself.
   */
  | { type: 'bloodTithe'; unit: UnitId }
  /**
   * Puts one rostered body on an Anchor Tile, before turn one.
   *
   * Free and reversible: nothing is spent, so there is nothing to refund, and a player
   * rearranging their line has no reason to be charged for changing their mind.
   */
  | { type: 'deployUnit'; defId: string; at: Coord }
  /** Picks a deployed body back up, returning it to the tray. */
  | { type: 'recallUnit'; unit: UnitId }
  /** Sets the line. Ends the deployment phase and begins turn one. */
  | { type: 'finishDeployment' }
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
  /**
   * The player gives up the fight. It ends as a defeat, through the same bell every
   * other ending rings, so the results screen, the contract and the rescue all follow.
   *
   * A command rather than a screen-side shortcut so it is in the event stream and replays
   * from a seed like everything else. Legal at any moment of the fight, including the
   * enemy's turn and deployment: its whole point is to be the exit that always works. The
   * AI never enumerates it.
   */
  | { type: 'concede' }
  | { type: 'endTurn' };

export class IllegalCommandError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IllegalCommandError';
  }
}
