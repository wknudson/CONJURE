/**
 * The turn state machine.
 *
 *   startOfTurn -> action -> resolution -> endOfTurn -> (flip side) -> startOfTurn
 *
 * Only the `action` phase accepts external commands. The other three are internal
 * pipelines that run to completion, emitting events as they go.
 *
 * Note on the Resolution phase: detonations, collisions and cascades resolve INLINE
 * within each action, because the rules describe them as instant and same-step. The
 * formal Resolution phase is kept as a safety sweep plus the lethal check. Presenting
 * detonations as a distinct beat is the sequencer's job, not the engine's.
 */

import type { Side } from '../../contract/ids.js';
import type { Ctx } from './context.js';
import { emit } from './context.js';
import { DRAW_PER_TURN, drawCards, endOfTurnCleanup, gainPips } from './deck.js';
import { refreshUnits, startOfTurnStatuses } from './status.js';
import { checkLethal } from './death.js';
import { dealDamage } from './damage.js';
import { getEncounterScript } from '../data/encounters/registry.js';
import { opposite } from './board.js';

export function beginTurn(ctx: Ctx, side: Side): void {
  if (ctx.state.result) return;

  ctx.state.activeSide = side;
  ctx.state.phase = 'startOfTurn';
  emit(ctx, { t: 'turnStarted', side, turn: ctx.state.turn });
  emit(ctx, { t: 'phaseChanged', phase: 'startOfTurn', side });

  refreshUnits(ctx, side);
  ctx.state.players[side].resonanceUsedThisTurn = false;
  gainPips(ctx, side, 1);
  // The opening hand of 5 dealt during setup IS turn one's draw. Drawing again here
  // would immediately overdraw past the hand limit of 7 and burn two cards.
  if (ctx.state.turn > 1) drawCards(ctx, side, DRAW_PER_TURN);
  startOfTurnStatuses(ctx, side);

  const script = getEncounterScript(ctx.state.encounter.id);
  script?.onTurnStart?.(ctx, side);

  if (ctx.state.result) return;

  ctx.state.phase = 'action';
  emit(ctx, { t: 'phaseChanged', phase: 'action', side });
}

/** Ends the active side's turn and starts the opponent's. */
export function endTurn(ctx: Ctx): void {
  if (ctx.state.result) return;

  const side = ctx.state.activeSide;

  ctx.state.phase = 'resolution';
  emit(ctx, { t: 'phaseChanged', phase: 'resolution', side });
  // Safety sweep: the chain-cancel flag is per-action, so clear it before handing over.
  ctx.state.encounter.chainCancelled = false;
  checkLethal(ctx);
  if (ctx.state.result) return;

  ctx.state.phase = 'endOfTurn';
  emit(ctx, { t: 'phaseChanged', phase: 'endOfTurn', side });
  endOfTurnCleanup(ctx, side);

  const next = opposite(side);
  if (next === 'player') {
    ctx.state.turn += 1;
    applyPacifistLockout(ctx);
    if (ctx.state.result) return;
  }
  beginTurn(ctx, next);
}

/**
 * Rounds of stalling before the lockout fires (Module 5 §failsafes). Set high enough
 * that competent play will never see it — it exists only so a game cannot literally run
 * forever if both sides refuse to engage.
 */
const STALL_LIMIT = 6;
const LOCKOUT_DAMAGE = 10;

/**
 * Pacifist Lockout: if neither commander takes damage for several full rounds, the
 * arena itself starts collecting. Without this, two turtling sides — or two cautious
 * AIs — can trade board presence forever and the game never resolves.
 */
function applyPacifistLockout(ctx: Ctx): void {
  if (ctx.state.commanderDamagedThisRound) {
    ctx.state.stalledRounds = 0;
    ctx.state.commanderDamagedThisRound = false;
    return;
  }

  ctx.state.stalledRounds += 1;
  ctx.state.commanderDamagedThisRound = false;
  if (ctx.state.stalledRounds < STALL_LIMIT) return;

  // Escalating unblockable damage to both commanders until someone falls.
  const amount = LOCKOUT_DAMAGE + (ctx.state.stalledRounds - STALL_LIMIT) * 5;
  emit(ctx, { t: 'phaseChanged', phase: 'resolution', side: ctx.state.activeSide });

  for (const side of ['player', 'enemy'] as const) {
    if (ctx.state.result) return;
    dealDamage(ctx, {
      target: { kind: 'portrait', side },
      amount,
      dtype: 'true',
      cause: 'status',
    });
  }
  // The lockout's own damage must not reset the counter, or it fires only once.
  ctx.state.commanderDamagedThisRound = false;
}
