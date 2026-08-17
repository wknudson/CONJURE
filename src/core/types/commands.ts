import type { CardInstanceId, Coord, TargetRef, UnitId } from '../../contract/ids.js';
import type { ChosenTarget } from './cards.js';

/** External intents. The engine's only entry point is applyCommand(state, command). */
export type Command =
  | { type: 'playCard'; card: CardInstanceId; target: ChosenTarget }
  | { type: 'moveUnit'; unit: UnitId; to: Coord }
  | { type: 'attack'; attacker: UnitId; target: TargetRef }
  | { type: 'sacrifice'; unit: UnitId }
  | { type: 'endTurn' };

export class IllegalCommandError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IllegalCommandError';
  }
}
