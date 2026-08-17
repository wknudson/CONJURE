/**
 * The Animation Sequencer — the single seam between logic and presentation.
 *
 * The core resolves instantly and hands over an ordered event batch. This drains that
 * queue one step at a time, awaiting each animation, so cascades and chained collisions
 * play back in the order they actually resolved.
 *
 * Events sharing a causeId AND belonging to a parallel-safe type animate together, so an
 * AoE reads as one hit rather than a slow stutter of individual numbers. Detonations are
 * deliberately kept serial so a cascade reads as pop -> pop -> pop.
 */

import type { GameEvent } from '../contract/events.js';
import { PARALLEL_SAFE } from '../contract/events.js';
import { finishAll } from './tween.js';

export interface FxContext<T> {
  view: T;
  /** Duration scaler: returns 0 while skipping so every await resolves immediately. */
  t: (ms: number) => number;
}

export type EventHandler<T, K extends GameEvent['t'] = GameEvent['t']> = (
  event: Extract<GameEvent, { t: K }>,
  ctx: FxContext<T>,
) => Promise<void> | void;

/** Storage type: the per-type narrowing lives in `on()`, not in the map. */
type AnyHandler<T> = (event: never, ctx: FxContext<T>) => Promise<void> | void;

/** How long one uninterrupted batch of events may take to play out. */
const TURN_ANIMATION_BUDGET_MS = 6_000;
/** Rough cost of an average animation step, used to forecast a batch's length. */
const TYPICAL_STEP_MS = 260;
/** Never compress past this, or a busy turn becomes an unreadable blur. */
const MIN_BUDGET_SCALE = 0.25;

export class Sequencer<T> {
  private queue: GameEvent[] = [];
  private handlers = new Map<GameEvent['t'], AnyHandler<T>>();
  private speed = 1;
  private draining = false;
  /** Extra compression applied when a batch is too long to play at full pace. */
  private budgetScale = 1;
  private drainStartedAt = 0;

  onIdle?: () => void;
  onEvent?: (event: GameEvent) => void;

  constructor(private readonly view: T) {}

  on<K extends GameEvent['t']>(type: K, handler: EventHandler<T, K>): void {
    this.handlers.set(type, handler as AnyHandler<T>);
  }

  get busy(): boolean {
    return this.draining || this.queue.length > 0;
  }

  enqueue(events: GameEvent[]): void {
    this.queue.push(...events);
    void this.drain();
  }

  /** Hold to accelerate; used while watching the AI take its turn. */
  fastForward(on: boolean): void {
    this.speed = on ? 5 : 1;
  }

  /** Abandons all pacing: handlers still run in order, but instantly. */
  skip(): void {
    this.speed = Infinity;
    finishAll();
  }

  private ctx(): FxContext<T> {
    return {
      view: this.view,
      t: (ms: number) =>
        this.speed === Infinity ? 0 : (ms / this.speed) * this.budgetScale,
    };
  }

  /**
   * Keeps a long batch from dragging.
   *
   * A busy enemy turn can queue dozens of events, and played at full pace that becomes a
   * stretch of dead time the player just watches. Rather than truncate — which would
   * hide what happened — every remaining step is compressed so the whole batch lands
   * inside the budget. Short batches are untouched and play at their designed pace.
   */
  private updateBudget(): void {
    const elapsed = performance.now() - this.drainStartedAt;
    const remaining = TURN_ANIMATION_BUDGET_MS - elapsed;

    if (remaining <= 0) {
      this.budgetScale = MIN_BUDGET_SCALE;
      return;
    }
    // Rough forecast: assume each queued step costs about as much as an average one.
    const projected = this.queue.length * TYPICAL_STEP_MS;
    this.budgetScale = projected <= remaining
      ? 1
      : Math.max(MIN_BUDGET_SCALE, remaining / projected);
  }

  private async drain(): Promise<void> {
    if (this.draining) return;
    this.draining = true;
    this.drainStartedAt = performance.now();
    this.budgetScale = 1;

    try {
      while (this.queue.length > 0) {
        this.updateBudget();
        const group = this.takeGroup();
        const ctx = this.ctx();

        await Promise.all(
          group.map(async (event) => {
            this.onEvent?.(event);
            const handler = this.handlers.get(event.t);
            if (handler) await (handler as (e: GameEvent, c: FxContext<T>) => Promise<void> | void)(event, ctx);
          }),
        );
      }
    } finally {
      this.speed = 1;
      this.budgetScale = 1;
      this.draining = false;
      this.onIdle?.();
    }
  }

  /**
   * Takes the next animation step: either a run of parallel-safe events sharing one
   * causeId, or a single serial event.
   */
  private takeGroup(): GameEvent[] {
    const first = this.queue.shift()!;
    if (!PARALLEL_SAFE.has(first.t)) return [first];

    const group = [first];
    while (this.queue.length > 0) {
      const next = this.queue[0]!;
      if (next.causeId !== first.causeId) break;
      if (!PARALLEL_SAFE.has(next.t)) break;
      group.push(this.queue.shift()!);
    }
    return group;
  }
}
