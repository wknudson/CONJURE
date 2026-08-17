/**
 * Small conveniences for tests that need to put terrain on a board.
 *
 * The engine only ever spawns these from inside a command, so a test that wants one
 * pre-placed has to build a Ctx by hand. Doing that in one place keeps the setup out of
 * the tests themselves, where it is noise rather than intent.
 */

import type { Coord } from '../contract/ids.js';
import type { GameState, HazardKind } from '../core/types/state.js';
import { makeCtx } from '../core/engine/context.js';
import { spawnObstacle as engineSpawnObstacle } from '../core/engine/spawn.js';
import { spawnHazard } from '../core/engine/reactions.js';

/** Places an obstacle on the board and returns its id. */
export function spawnObstacle(state: GameState, defId: string, at: Coord): string {
  const id = engineSpawnObstacle(makeCtx(state), defId, 'player', at);
  if (!id) throw new Error(`could not place ${defId} at ${at.x},${at.y}`);
  return id;
}

/** Places a hazard. Rubble is permanent; everything else ages normally. */
export function spawnHazardAt(
  state: GameState,
  at: Coord,
  kind: HazardKind,
  turns = 2,
): void {
  spawnHazard(makeCtx(state), at, kind, turns, kind === 'rubble');
}
