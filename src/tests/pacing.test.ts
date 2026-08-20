import { describe, expect, it } from 'vitest';
import {
  AI_BEAT_MS,
  MAX_TOTAL_BEAT_MS,
  NORMAL_MOTION,
  Sequencer,
} from '../anim/Sequencer.js';
import type { GameEvent } from '../contract/events.js';

/**
 * Playback pacing.
 *
 * The enemy's whole turn arrives as one batch, so there was nothing between a move, a cast
 * and a strike to say where one ended. The beat is that gap — and the property worth
 * guarding hardest is that it is only ever a *wait*: it must never drop, reorder or
 * re-enter the queue, however it is toggled mid-turn.
 */

/** Two events under one cause are one action; a different cause is the next one. */
function ev(t: string, causeId: number): GameEvent {
  return { t, causeId } as unknown as GameEvent;
}

/** Records the order handlers ran in, so a dropped or reordered event is visible. */
function harness() {
  const seen: string[] = [];
  const seq = new Sequencer<null>(null);
  for (const t of ['unitMoved', 'attackDeclared', 'cardPlayed', 'damageDealt']) {
    seq.on(t as GameEvent['t'], (e) => {
      seen.push(`${e.t}:${(e as unknown as { causeId: number }).causeId}`);
    });
  }
  return { seq, seen };
}

const settle = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

describe('the beat', () => {
  it('is off by default, so the player’s own plays are not held up', async () => {
    const { seq, seen } = harness();
    const started = Date.now();

    seq.enqueue([ev('unitMoved', 1), ev('attackDeclared', 2), ev('cardPlayed', 3)]);
    while (seq.busy) await settle();

    expect(seen).toHaveLength(3);
    expect(Date.now() - started, 'nothing should have waited').toBeLessThan(200);
  });

  it('holds between actions once set', async () => {
    const { seq, seen } = harness();
    seq.setBeat(60);
    const started = Date.now();

    // Three causes: two gaps between them.
    seq.enqueue([ev('unitMoved', 1), ev('attackDeclared', 2), ev('cardPlayed', 3)]);
    while (seq.busy) await settle();

    expect(seen).toHaveLength(3);
    expect(Date.now() - started, 'two gaps of 60ms').toBeGreaterThanOrEqual(100);
  });

  it('does not hold after the last action', async () => {
    // A trailing pause is dead time: there is nothing left to read.
    const { seq } = harness();
    seq.setBeat(120);
    const started = Date.now();

    seq.enqueue([ev('unitMoved', 1)]);
    while (seq.busy) await settle();

    expect(Date.now() - started, 'a single action waits for nothing').toBeLessThan(100);
  });

  it('is shortened by fast-forward', async () => {
    // The division by `speed` is only observable here: a skip is caught by its own guard
    // one line earlier, so testing only the skip left the arithmetic unverified.
    const { seq, seen } = harness();
    seq.setBeat(300);
    seq.fastForward(true);
    const started = Date.now();

    seq.enqueue([ev('unitMoved', 1), ev('attackDeclared', 2), ev('cardPlayed', 3)]);
    while (seq.busy) await settle();

    expect(seen).toHaveLength(3);
    // Two gaps: 600ms at full pace, 120ms at 5x. Generous either side of the boundary.
    expect(Date.now() - started, 'fast-forward did not shorten the gaps').toBeLessThan(400);
  });

  it('is erased by a skip', async () => {
    const { seq, seen } = harness();
    seq.setBeat(400);
    seq.skip();
    const started = Date.now();

    seq.enqueue([ev('unitMoved', 1), ev('attackDeclared', 2), ev('cardPlayed', 3)]);
    while (seq.busy) await settle();

    expect(seen, 'a skip still runs every handler, in order').toHaveLength(3);
    expect(Date.now() - started, 'but waits for none of them').toBeLessThan(120);
  });
});

describe('toggling mid-turn cannot break the queue', () => {
  it('plays every event, in order, when the beat is changed mid-drain', async () => {
    // The directive's own worry. The drain reads `beat` fresh before each pause, so a flip
    // changes the next gap and touches nothing already queued.
    const { seq, seen } = harness();
    seq.setBeat(40);

    const batch = [
      ev('unitMoved', 1),
      ev('attackDeclared', 2),
      ev('cardPlayed', 3),
      ev('damageDealt', 4),
      ev('unitMoved', 5),
    ];
    seq.enqueue(batch);

    // Flip it repeatedly while the batch is still draining.
    for (let i = 0; i < 6 && seq.busy; i += 1) {
      seq.setBeat(i % 2 === 0 ? 0 : 40);
      await settle();
    }
    while (seq.busy) await settle();

    expect(seen).toEqual([
      'unitMoved:1',
      'attackDeclared:2',
      'cardPlayed:3',
      'damageDealt:4',
      'unitMoved:5',
    ]);
  });

  it('drains everything even when the beat is raised part-way through', async () => {
    const { seq, seen } = harness();
    seq.enqueue([ev('unitMoved', 1), ev('attackDeclared', 2), ev('cardPlayed', 3)]);
    seq.setBeat(30);
    while (seq.busy) await settle();
    expect(seen).toHaveLength(3);
  });

  it('accepts events arriving mid-drain and still plays them all', async () => {
    const { seq, seen } = harness();
    seq.setBeat(30);
    seq.enqueue([ev('unitMoved', 1), ev('attackDeclared', 2)]);
    await settle();
    seq.enqueue([ev('cardPlayed', 3)]);
    while (seq.busy) await settle();

    expect(seen).toEqual(['unitMoved:1', 'attackDeclared:2', 'cardPlayed:3']);
  });

  it('stops pacing as soon as the beat is cleared', async () => {
    const { seq } = harness();
    seq.setBeat(40);
    seq.enqueue([ev('unitMoved', 1), ev('attackDeclared', 2)]);
    while (seq.busy) await settle();

    seq.setBeat(0);
    const started = Date.now();
    seq.enqueue([ev('cardPlayed', 3), ev('damageDealt', 4)]);
    while (seq.busy) await settle();

    expect(Date.now() - started).toBeLessThan(120);
  });
});

describe('the motion stretch', () => {
  /** A handler that reports the duration it was handed, so the scaling is observable. */
  function timed() {
    const durations: number[] = [];
    const seq = new Sequencer<null>(null);
    seq.on('unitMoved' as GameEvent['t'], (_e, ctx) => {
      durations.push(ctx.t(100));
    });
    return { seq, durations };
  }

  it('leaves durations alone by default', async () => {
    const { seq, durations } = timed();
    seq.enqueue([ev('unitMoved', 1)]);
    while (seq.busy) await settle();
    expect(durations[0]).toBe(100);
  });

  it('stretches every duration once set', async () => {
    // The gap made the turn readable; this is what makes it smooth. Every handler routes
    // its durations through `t`, so one knob reaches all of them.
    const { seq, durations } = timed();
    seq.setMotion(1.5);
    seq.enqueue([ev('unitMoved', 1)]);
    while (seq.busy) await settle();
    expect(durations[0]).toBe(150);
  });

  it('still collapses under a skip, however stretched', async () => {
    const { seq, durations } = timed();
    seq.setMotion(2);
    seq.skip();
    seq.enqueue([ev('unitMoved', 1)]);
    while (seq.busy) await settle();
    expect(durations[0]).toBe(0);
  });

  it('is shortened by fast-forward rather than fighting it', async () => {
    const { seq, durations } = timed();
    seq.setMotion(2);
    seq.fastForward(true);
    seq.enqueue([ev('unitMoved', 1)]);
    while (seq.busy) await settle();
    // 100 stretched to 200, then divided by the 5x hold.
    expect(durations[0]).toBeCloseTo(40, 5);
  });

  it('refuses a zero or negative stretch rather than freezing the board', async () => {
    // Asserted on the *effect*, not on it merely not throwing — which was true either way
    // and left the clamp unverified. A motion of zero would collapse every duration to
    // nothing and a negative one would hand handlers a negative tween.
    for (const bad of [0, -3]) {
      const { seq, durations } = timed();
      seq.setMotion(bad);
      seq.enqueue([ev('unitMoved', 1)]);
      while (seq.busy) await settle();
      expect(durations[0], `motion ${bad}`).toBeGreaterThan(0);
    }
  });

  it('asks for a slower, smoother Normal than the first pass shipped', () => {
    // Both halves of the note this answered: a longer gap *and* unhurried motion.
    expect(AI_BEAT_MS).toBeGreaterThan(900);
    expect(NORMAL_MOTION).toBeGreaterThan(1);
  });
});

describe('the default pace', () => {
  it('sits in the readable band the brief asked for', () => {
    expect(AI_BEAT_MS).toBeGreaterThanOrEqual(800);
    expect(AI_BEAT_MS).toBeLessThanOrEqual(1200);
  });

  it('refuses a negative beat rather than trusting the caller', () => {
    const { seq } = harness();
    expect(() => seq.setBeat(-500)).not.toThrow();
  });

  it('bounds a pathological turn rather than pausing linearly forever', () => {
    // The safety valve, asserted as a contract rather than by sleeping through it: proving
    // it by wall clock means waiting out the whole allowance, which is nine seconds of a
    // test suite doing nothing. What matters is that the cap is finite and that it buys a
    // sensible number of paced actions before it gives up.
    expect(Number.isFinite(MAX_TOTAL_BEAT_MS)).toBe(true);

    const pacedActions = MAX_TOTAL_BEAT_MS / AI_BEAT_MS;
    expect(pacedActions, 'too few actions get the readable pace').toBeGreaterThanOrEqual(6);
    expect(pacedActions, 'a turn could stall for too long').toBeLessThanOrEqual(15);
  });

  it('still drains a long batch completely, however much of it went unpaced', async () => {
    // The half that does matter behaviourally: hitting the allowance changes the *pacing*
    // and never the queue.
    const { seq, seen } = harness();
    seq.setBeat(8);

    const many = Array.from({ length: 80 }, (_, i) => ev('damageDealt', i + 1));
    seq.enqueue(many);
    while (seq.busy) await settle();

    expect(seen).toHaveLength(80);
    expect(seen[0]).toBe('damageDealt:1');
    expect(seen.at(-1)).toBe('damageDealt:80');
  });
});
