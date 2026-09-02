/**
 * The Combat Ring's second wave.
 *
 * When the overworld's ring closes around more than one roaming mob, the extra mobs are
 * not a bigger opening board — they are a *second fight arriving late*. They come in at
 * Round 2, and the player is paid for having been jumped by them: one banked Bone and one
 * card per mob dragged in.
 *
 * Engine-level rather than an encounter script, and this is the whole reason the module
 * exists. A script is looked up by encounter id (`getEncounterScript`), so hanging the
 * wave off one would mean either registering a fight per possible pull — which leaks into
 * every test that walks `ENCOUNTERS` — or teaching each pack's own script a rule that has
 * nothing to do with that pack. The wave is a property of *this fight*, carried on the
 * state, so it reads off the state and works whatever arena it lands in.
 *
 * Mirrors `runWildlife` in shape: a pair of functions driven from `beginTurn`, gated on
 * `firedGates` so each fires exactly once and survives a save round trip.
 */

import type { Ctx } from './context.js';
import type { GameState } from '../types/state.js';
import { emit, newCause } from './context.js';
import { drawCards, gainBones } from './deck.js';
import { firstFreeNear, summonUnit } from './spawn.js';
import { CARDS } from '../data/cards/index.js';

/** The compensation has been paid. */
const PAID = 'wave2:paid';
/** The bodies are on the board — or were offered the board and found no room. */
const ARRIVED = 'wave2:arrived';

/**
 * The round the ring's second wave lands on.
 *
 * Two, not later. The existing random reinforcement waits until round three at the
 * earliest because it is a surprise; this one is not a surprise — the player watched it
 * happen, and making them wait would read as the game forgetting.
 */
const WAVE_ROUND = 2;

/**
 * Where the wave stands when it arrives.
 *
 * The enemy's own rows, spread rather than clustered, exactly as a pack's opening board
 * is. `firstFreeNear` walks to the nearest free tile in that side's territory from each
 * of these, so a crowded back line resolves instead of dropping a body.
 */
const OPENING: readonly [number, number][] = [
  [1, 1],
  [5, 1],
  [3, 0],
  [6, 0],
  [2, 0],
  [4, 1],
];

/**
 * Is this fight still owed a wave?
 *
 * Read by `checkLethal` as well as by the wave itself, and that is the load-bearing use: a
 * pack fight is won by clearing the board, so a player who wipes the opening line on round
 * one would otherwise be handed the victory before the mobs they *saw get dragged in* ever
 * showed up. The fight has to stay open until the ring has delivered what it promised.
 */
export function wavePending(state: GameState): boolean {
  const squads = state.encounter.wave2;
  return (
    squads !== undefined && squads.length > 0 && !state.encounter.firedGates.includes(ARRIVED)
  );
}

/**
 * Pays for having been jumped: one Bone and one card per mob the ring pulled in.
 *
 * Called on the player's turn only, and it self-guards on the round so the caller does not
 * have to know which one. It lands *after* the turn's ordinary Bone and draw, so the two
 * read as income plus a bonus rather than as one strange number.
 *
 * A hand already at its limit burns the extra card for Marrow, which is the ordinary
 * overdraw rule and is left alone deliberately — a player holding seven cards is not short
 * of options, and a silent exception here would be a second rule about hand size.
 */
export function payWaveCompensation(ctx: Ctx): void {
  const state = ctx.state;
  const squads = state.encounter.wave2;
  if (!squads || squads.length === 0) return;
  if (state.turn < WAVE_ROUND) return;
  if (state.encounter.firedGates.includes(PAID)) return;

  state.encounter.firedGates.push(PAID);
  gainBones(ctx, 'player', squads.length);
  drawCards(ctx, 'player', squads.length);
}

/**
 * Puts the pulled squads on the board.
 *
 * The gate is pushed *before* anything is placed, so a body that cannot find room does not
 * leave the fight waiting on a wave that will never arrive — the promise was to deliver
 * them, not to guarantee the ground. That also makes `wavePending` go false the moment the
 * wave is spent, which is what lets the held rout resolve.
 */
export function runWave2(ctx: Ctx): void {
  const state = ctx.state;
  if (!wavePending(state)) return;
  if (state.turn < WAVE_ROUND) return;

  state.encounter.firedGates.push(ARRIVED);

  // Summoned, not placed as an opening line. This used to go through `placeOpeningUnit`,
  // which clears the arrival flags because a body already on the field when the bell rang
  // has stood its round — and a body walking in on round two has not. Cleared, the wave
  // skipped the Haste gate and the Growth grace and swung on the turn it landed, from
  // ground the player had never been shown a blow from. It arrives at the start of the
  // enemy's turn, after its bodies have refreshed, so a real summon sits this round out and
  // acts on the next: the same rule every other thing that enters a fight mid-way obeys.
  let placed = 0;
  newCause(ctx);
  for (const squad of state.encounter.wave2 ?? []) {
    for (const defId of squad) {
      const at = OPENING[placed % OPENING.length]!;
      placed += 1;
      const footprint = CARDS[defId]?.unit?.footprint ?? 1;
      const spot = firstFreeNear(state, { x: at[0], y: at[1] }, 'enemy', footprint);
      if (!spot) continue;
      summonUnit(ctx, defId, 'enemy', spot);
    }
  }

  if (placed > 0) {
    // The same event the random reinforcement emits, so the banner and the renderer need
    // to learn nothing about rings.
    emit(ctx, { t: 'bossPhaseShift', side: 'enemy', phase: 2, name: 'The circle closes' });
  }
}
