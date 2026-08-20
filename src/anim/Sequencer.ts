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

/**
 * The pause held between two of the enemy's actions, at Normal speed.
 *
 * The animations were never the problem: each one is paced fine on its own. What was
 * missing is the *gap* — the enemy's whole turn arrives as one batch of events, so a move,
 * a cast and a strike ran together with nothing between them to say where one ended.
 *
 * Held between **cause groups**, which is exactly where those seams are: every event from
 * one atomic resolution shares a `causeId`, so one group is one thing the enemy did.
 */
export const AI_BEAT_MS = 900;

/**
 * Total pausing one batch may spend before the beats stop.
 *
 * A safety valve, not a pacing decision. A pathological turn — twenty actions in a
 * cascade-heavy board — would otherwise hold the player for twenty seconds, and the point
 * of the beat is to make a turn readable rather than to make it long. Ordinary turns never
 * approach this.
 */
export const MAX_TOTAL_BEAT_MS = 9_000;

export class Sequencer<T> {
  private queue: GameEvent[] = [];
  private handlers = new Map<GameEvent['t'], AnyHandler<T>>();
  private speed = 1;
  private draining = false;
  /** Extra compression applied when a batch is too long to play at full pace. */
  private budgetScale = 1;
  private drainStartedAt = 0;
  /** Pause held between cause groups. Zero for the player's own actions. */
  private beat = 0;
  /** How much pausing this batch has already spent, against `MAX_TOTAL_BEAT_MS`. */
  private beatSpent = 0;

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

  /**
   * Sets the pause held between the enemy's discrete actions.
   *
   * Read fresh on every iteration of the drain loop rather than captured when the batch
   * started, so flipping the speed toggle mid-turn changes the *next* gap and touches
   * nothing already queued. The queue is never re-ordered, re-entered or dropped by this —
   * it only ever changes how long the loop waits between two groups it was already going
   * to play in that order.
   */
  setBeat(ms: number): void {
    this.beat = Math.max(0, ms);
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

        await this.holdBeat();
      }
    } finally {
      this.speed = 1;
      this.budgetScale = 1;
      this.beatSpent = 0;
      this.draining = false;
      this.onIdle?.();
    }
  }

  /**
   * The gap between two of the enemy's actions.
   *
   * Divided by `speed`, so holding fast-forward shortens it and a skip erases it — a
   * player who has asked to get on with it must not be held by a pause meant to slow them
   * down. Deliberately *not* multiplied by `budgetScale`: that compresses animations on a
   * busy turn, and the beat is the reading pace the player chose rather than time the
   * batch is overspending.
   *
   * Nothing left in the queue is touched. The wait sits between two groups that were
   * already going to play in that order, so a toggle mid-drain cannot disturb it.
   */
  private async holdBeat(): Promise<void> {
    if (this.beat <= 0 || this.speed === Infinity) return;
    if (this.queue.length === 0) return;
    if (this.beatSpent >= MAX_TOTAL_BEAT_MS) return;

    const wait = this.beat / this.speed;
    this.beatSpent += wait;
    await new Promise<void>((resolve) => setTimeout(resolve, wait));
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
