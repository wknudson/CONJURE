/**
 * The resolution context threaded through every mutation.
 *
 * All state changes go through helpers that take a Ctx, and those helpers are the ONLY
 * emitters of events. That is what guarantees a new card cannot accidentally bypass rune
 * triggers, Counter, fizzle checks, or the lethal check.
 */

import type { GameEvent } from '../../contract/events.js';
import type { GameState } from '../types/state.js';

export interface Ctx {
  state: GameState;
  events: GameEvent[];
  /** Stamped onto every event emitted during the current atomic step. */
  causeId: string;
}

export function makeCtx(state: GameState): Ctx {
  state.causeCounter += 1;
  return { state, events: [], causeId: `c${state.causeCounter}` };
}

/** Opens a nested atomic step, so its events group separately in the sequencer. */
export function newCause(ctx: Ctx): void {
  ctx.state.causeCounter += 1;
  ctx.causeId = `c${ctx.state.causeCounter}`;
}

/**
 * Omit must distribute across the GameEvent union — a plain Omit<GameEvent, 'causeId'>
 * collapses to only the keys every variant shares, which rejects every real event.
 */
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

export type EventDraft = DistributiveOmit<GameEvent, 'causeId'>;

export function emit(ctx: Ctx, event: EventDraft): void {
  ctx.events.push({ ...event, causeId: ctx.causeId } as GameEvent);
}
