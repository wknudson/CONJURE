import { describe, expect, it } from 'vitest';
import { applyCommand } from '../core/engine/engine.js';
import { createCombat } from '../core/engine/setup.js';
import { ENCOUNTERS } from '../core/data/encounters/index.js';
import { planTurn } from '../core/ai/controller.js';
import type { GameState } from '../core/types/state.js';

interface Outcome {
  result: string;
  turns: number;
  playerHp: number;
  enemyHp: number;
}

function playOut(encounterId: string, seed: number): Outcome {
  const encounter = ENCOUNTERS.find((e) => e.id === encounterId)!;
  let state: GameState = createCombat(encounter, seed).state;
  let guard = 0;

  while (!state.result && guard++ < 120) {
    const plan = planTurn(state, state.activeSide);
    for (const command of plan) {
      if (state.result) break;
      try {
        state = applyCommand(state, command).state;
      } catch {
        break;
      }
    }
  }

  return {
    result: state.result ?? 'stalled',
    turns: state.turn,
    playerHp: state.players.player.hp,
    enemyHp: state.players.enemy.hp,
  };
}

/**
 * These are feel checks, not strict balance assertions. They exist to catch structural
 * failures: games that never end, or a side that literally cannot deal damage.
 */

/**
 * One playout per (encounter, seed), computed once and shared.
 *
 * The per-seed tests below each ask for exactly their own game, and the aggregate test
 * reads the same eight back out of the cache — so splitting one long test into nine did
 * not multiply the work, it only divided the wall time. Run in isolation (a `-t` filter),
 * the aggregate simply computes what nobody has yet, which is slower but never wrong.
 */
const PLAYOUT_SEEDS = 8;
const playoutCache = new Map<string, Outcome>();

function outcomeFor(encounterId: string, seed: number): Outcome {
  const key = `${encounterId}:${seed}`;
  let out = playoutCache.get(key);
  if (!out) {
    out = playOut(encounterId, seed);
    playoutCache.set(key, out);
  }
  return out;
}

describe('encounter balance sanity', () => {
  for (const encounter of ENCOUNTERS) {
    describe(encounter.name, () => {
      // Eight seeds, down from twelve — the Fused Grimoire made every deck permanently
      // larger, so the same twelve playouts took half again as long; eight still catches
      // the two structural failures this file guards. And **one test per seed now, not
      // one test running all eight.** A single `it` playing eight full games serially
      // held a worker for 200-plus seconds on the heaviest arena — inside the deadline,
      // but exactly the kind of long-pinned process a loaded machine kills from outside,
      // which reads as a mystery crash and says nothing about the code. Split, the worst
      // single test is one game long, and a killed run loses one seed instead of the file.
      for (let seed = 1; seed <= PLAYOUT_SEEDS; seed++) {
        it(`seed ${seed} reaches a decision`, () => {
          const o = outcomeFor(encounter.id, seed);
          expect(o.result, `stalled after ${o.turns} turns`).not.toBe('stalled');
        });
      }

      it('both sides can threaten across the set', () => {
        const outcomes = Array.from({ length: PLAYOUT_SEEDS }, (_, i) =>
          outcomeFor(encounter.id, i + 1),
        );

        // Both sides must be able to threaten: across the set the enemy commander has to
        // lose HP somewhere, or the player side is structurally unable to win.
        //
        // A **rout** is asked the equivalent question in its own terms. There is no enemy
        // commander to wound in one, so commander damage would be zero in every playout
        // and this would fail on every pack for a reason that says nothing about the pack.
        // What it means there is "can the player win at all", and the answer is whether
        // any of the eight games ended in a victory.
        if (encounter.victory === 'rout') {
          const everWon = outcomes.some((o) => o.result === 'victory');
          expect(everWon, 'player never cleared the pack in eight games').toBe(true);
        } else {
          const enemyEverDamaged = outcomes.some((o) => o.enemyHp < encounter.enemyHp);
          expect(enemyEverDamaged, 'player never dealt any commander damage').toBe(true);
        }

        const playerEverDamaged = outcomes.some((o) => o.playerHp < encounter.playerHp);
        expect(playerEverDamaged, 'enemy never dealt any commander damage').toBe(true);
        // Full playouts, run alongside every other AI-heavy suite in a parallel worker.
        // The budget is for "did this hang", not "was this fast" -- which is why there is
        // no number here. This carried a 120s override while the global deadline was
        // 180s, so the file was held to a *stricter* budget than the config that exists
        // to keep exactly this kind of test from failing on load -- and it duly failed at
        // 142s in a full run and passed alone. Inheriting the global is the policy.
      });
    });
  }

  it('resolves in a reasonable number of turns', () => {
    // Twelve games: the eight the seed tests already played, read back out of the cache,
    // plus four fresh ones -- the average is steadier over twelve and the marginal cost
    // is only the four.
    const outcomes = Array.from({ length: 12 }, (_, i) => outcomeFor('novice_duelist', i + 1));
    const avg = outcomes.reduce((s, o) => s + o.turns, 0) / outcomes.length;
    // A demo duel should not drag on for dozens of rounds. The deeper lane arena adds
    // an approach phase, so this sits higher than it did on the old compact board.
    expect(avg).toBeLessThan(30);
    // Same reasoning as above: the budget guards against a hang, not against slowness,
    // and the global deadline is where that guard lives.
  });
});
