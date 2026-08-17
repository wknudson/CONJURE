/**
 * The wildlife schedule an encounter can opt into.
 *
 * Kept here rather than in each encounter so that "a scavenger turns up on round two"
 * means the same thing everywhere, and so an encounter file stays a description of a
 * place rather than a program.
 */

import type { Ctx } from '../../engine/context.js';
import type { EncounterDef } from './registry.js';
import { summonUnit } from '../../engine/spawn.js';
import { canPlace } from '../../engine/board.js';
import { nextInt } from '../../util/rng.js';
import {
  atBoardEdge,
  escape,
  feralAggressStep,
  feralFleeStep,
} from '../../engine/feral.js';

const SCAVENGER_GATE = 'scavenger';
const TURFWAR_GATE = 'turfwar';

/** Rounds are counted by `state.turn`, which advances once both sides have acted. */
const SCAVENGER_ROUND = 2;
const TURFWAR_ROUND = 3;
/** How long a scavenger will stay before slipping away with everything it carries. */
const SCAVENGER_PATIENCE = 5;

/**
 * Runs a fight's wildlife for one enemy turn.
 *
 * Called from an encounter's `onTurnStart`, and only on the enemy's turn: beasts move
 * once a round, and hanging them off the side that also owns them keeps the ordering
 * obvious rather than making it depend on who acted first.
 */
export function runWildlife(ctx: Ctx, encounter: EncounterDef): void {
  const state = ctx.state;

  if (encounter.scavenger && !state.encounter.firedGates.includes(SCAVENGER_GATE)) {
    if (state.turn >= SCAVENGER_ROUND) {
      state.encounter.firedGates.push(SCAVENGER_GATE);
      spawnOnNeutralGround(ctx, 'gilded_scavenger');
    }
  }

  if (encounter.turfwar && !state.encounter.firedGates.includes(TURFWAR_GATE)) {
    if (state.turn >= TURFWAR_ROUND) {
      state.encounter.firedGates.push(TURFWAR_GATE);
      for (let i = 0; i < encounter.turfwar.count; i++) {
        spawnOnNeutralGround(ctx, encounter.turfwar.unitCardId);
      }
    }
  }

  // Iterated over a snapshot: a beast's bite can kill another, and a scavenger can leave
  // the board entirely, either of which would otherwise mutate the list being walked.
  for (const id of Object.keys(state.units)) {
    const unit = state.units[id];
    if (!unit || !unit.keywords.includes('Feral')) continue;

    if (unit.defId === 'gilded_scavenger') {
      // It bolts on arrival and keeps going. Past its patience, anything standing on an
      // edge is gone — the reward for ignoring it is that it takes the purse with it.
      feralFleeStep(ctx, id);
      if (state.turn >= SCAVENGER_ROUND + SCAVENGER_PATIENCE && atBoardEdge(ctx, id)) {
        escape(ctx, id);
      }
      continue;
    }

    feralAggressStep(ctx, id);
  }
}

/**
 * Drops a creature somewhere in the contested middle.
 *
 * Never in either deployment zone: wildlife wandering into a summon row would either be
 * free food or an obstruction to its "owner", and it is meant to be neither.
 */
function spawnOnNeutralGround(ctx: Ctx, defId: string): void {
  const state = ctx.state;
  const open: { x: number; y: number }[] = [];
  for (let y = 1; y < state.height - 1; y++) {
    for (let x = 0; x < state.width; x++) {
      if (canPlace(state, { x, y }, 1)) open.push({ x, y });
    }
  }
  if (open.length === 0) return;

  const at = open[nextInt(state.rng, open.length)]!;
  // Feral units are filed under the enemy because the engine has two sides and no third.
  // Nothing treats them as allies: not targeting, not the AI, not the threat map.
  const id = summonUnit(ctx, defId, 'enemy', at);
  const spawned = id ? state.units[id] : undefined;
  if (spawned) {
    // It was already here. Nothing summoned it, so it is not sick with summoning.
    spawned.summonedThisTurn = false;
    spawned.freshlySummoned = false;
  }
}
