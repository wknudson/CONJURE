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
import { emit, newCause } from './context.js';
import { unitAt } from './board.js';
import { pushUnit } from './displacement.js';
import { walksFreely } from './movement.js';
import { tickSubjugation } from './subjugation.js';
import { DRAW_PER_TURN, drawCards, endOfTurnCleanup, gainPips } from './deck.js';
import { refreshUnits, startOfTurnStatuses } from './status.js';
import { checkLethal } from './death.js';
import { dealDamage } from './damage.js';
import { encounterDefById, getEncounterScript } from '../data/encounters/registry.js';
import { runWildlife } from '../data/encounters/wildlife.js';
import { opposite } from './board.js';

export function beginTurn(ctx: Ctx, side: Side): void {
  if (ctx.state.result) return;

  ctx.state.activeSide = side;
  ctx.state.phase = 'startOfTurn';
  emit(ctx, { t: 'turnStarted', side, turn: ctx.state.turn });
  emit(ctx, { t: 'phaseChanged', phase: 'startOfTurn', side });

  refreshUnits(ctx, side);
  ctx.state.players[side].resonancesThisTurn = 0;
  ctx.state.players[side].reactionPipsThisTurn = 0;
  // The game's only source of Pip income. If play ever shows the economy is too tight
  // even with Channel, reaction refunds and geodes in it, raising this 1 to a 2 is the
  // whole of the fail-safe — starting Pips are already 3 and the cap is already 8.
  gainPips(ctx, side, 1);
  // The opening hand of 5 dealt during setup IS turn one's draw. Drawing again here
  // would immediately overdraw past the hand limit of 7 and burn two cards.
  if (ctx.state.turn > 1) drawCards(ctx, side, DRAW_PER_TURN);
  startOfTurnStatuses(ctx, side);

  const script = getEncounterScript(ctx.state.encounter.id);
  script?.onTurnStart?.(ctx, side);

  // The wildlife takes its turn alongside the side it is filed under. Driven from here
  // rather than from a script so that an encounter can have beasts without having to be
  // a program — opting in is a field on the definition.
  if (side === 'enemy' && !ctx.state.result) {
    const def = encounterDefById(ctx.state.encounter.id);
    if (def) runWildlife(ctx, def);
  }

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
    runCurrents(ctx);
    if (ctx.state.result) return;
    // After the currents, deliberately: a conveyor can shove the anchor into a wall and
    // kill it, and a tether that snapped this round must not also be credited with
    // surviving it. The order here is the difference between those two outcomes.
    tickSubjugation(ctx);
    if (ctx.state.result) return;
    applyPacifistLockout(ctx);
    if (ctx.state.result) return;
  }
  beginTurn(ctx, next);
}

/**
 * Moving ground, applied once both sides have had their turn.
 *
 * The round boundary is the only fair place for this: applied per turn it would carry a
 * unit twice as far for the side that acted first, and applied mid-turn it would move
 * pieces out from under a plan already committed to.
 *
 * The tiles are snapshotted before anything moves, so a unit carried onto another current
 * is not carried again this round — that keeps a ring of currents from spinning forever,
 * and keeps the whole sweep to one deterministic pass. Order is fixed by position rather
 * than by insertion, so a replay lays out identically.
 *
 * Blocked pushes deal their usual collision damage. A current that shoves a unit into a
 * wall is a weapon, which is the point of fighting over the lane.
 */
function runCurrents(ctx: Ctx): void {
  const carried = Object.values(ctx.state.hazards)
    .filter((h) => h.kind === 'current' && h.dir)
    .map((h) => ({ at: { ...h.at }, dir: { ...h.dir! } }))
    .sort((a, b) => a.at.y - b.at.y || a.at.x - b.at.x);

  for (const lane of carried) {
    if (ctx.state.result) return;
    const rider = unitAt(ctx.state, lane.at);
    if (!rider) continue;
    // A Behemoth rides the tile under its anchor, so a 2x2 straddling two lanes is
    // carried once rather than twice.
    if (rider.anchor.x !== lane.at.x || rider.anchor.y !== lane.at.y) continue;
    // Nothing here to grab: an ethereal Bound Form is not standing in the water.
    if (walksFreely(ctx.state, rider)) continue;

    newCause(ctx);
    pushUnit(ctx, rider, lane.dir, 1);
  }
}

/**
 * Rounds of stalling before the lockout fires. Set high enough
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
  // Suspended while a tether is live. The lockout exists to break a stalemate between two
  // sides who will not commit; a subjugation is the opposite of that -- it is a timed
  // siege in which the beast is sealed and neither commander CAN be hurt. Left running it
  // would fire on schedule and kill the player with unblockable damage the sealed Alpha
  // is immune to, turning the doc's "try again" loop into a guaranteed loss.
  if (ctx.state.encounter.subjugation.active) {
    ctx.state.commanderDamagedThisRound = false;
    return;
  }

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
