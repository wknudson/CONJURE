import { defineConfig } from 'vitest/config';

/**
 * Test runner settings.
 *
 * Several suites here play whole games: a dozen AI-vs-AI playouts, replay-and-compare
 * across many seeds, a fuzz soak. They are slow by nature, and they got slower as the
 * engine gained things to think about — wildlife, scenery, weather, an extra action.
 *
 * The problem that caused was not slowness but *flakiness*: run in parallel, those files
 * competed for the same cores and blew per-test deadlines that were fine in isolation,
 * which meant chasing timing failures that said nothing about the code. Rather than keep
 * raising individual budgets, the deadline is generous and global — these tests exist to
 * catch a hang or a divergence, never to measure a machine.
 *
 * **The worker cap was two, and it is six now.** That cap was doing nothing. Measured with
 * `--reporter=json`, the balance playouts were 1738s of a 1753-second run — 83% in one
 * file, against fifty-odd seconds for the other 114 — and a file cannot be split across
 * workers, so the wall clock was one file on one core and every spare core idle. Capping
 * workers could not help and raising them could not either. The fix was the one the note
 * below prescribes: `balance.test.ts` became six shard files (see `balanceSuite.ts`), and
 * only *then* was there anything for more workers to do. Six, on eight cores, leaves two
 * for the OS.
 *
 * Raised to 240s for the Fused Grimoire. Every deck is permanently larger now — a Hero
 * half plus eight innate spells — and the AI's cost scales with the options it has to
 * weigh, so the heaviest playout file moved from comfortably inside 180s to just outside
 * it under load. The playout counts came down at the same time; this is the global half
 * of that fix, and the global one is the budget this comment says to move.
 *
 * **Before moving it again, split the test instead.** The failure mode this budget keeps
 * getting raised for eventually stopped being a timeout at all: a single `it` that played
 * eight full games held a worker for 200-plus seconds, and on a loaded machine the OS
 * killed the pinned process outright — the run died with no summary and a bare exit 127,
 * which reads as a runner bug and cost an afternoon to trace. `balance.test.ts` now plays
 * one game per test against a shared cache for exactly this reason. A deadline can only
 * guard against a hang the runner survives to report; wall-time per *test* is the number
 * that has to stay small, and no budget here can buy that.
 */
export default defineConfig({
  test: {
    testTimeout: 240_000,
    hookTimeout: 60_000,
    minWorkers: 1,
    maxWorkers: 6,
  },
});
