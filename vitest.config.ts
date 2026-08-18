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
 * catch a hang or a divergence, never to measure a machine — and the worker count is
 * capped so the heavy files are not all racing each other at once.
 */
export default defineConfig({
  test: {
    testTimeout: 180_000,
    hookTimeout: 60_000,
    minWorkers: 1,
    maxWorkers: 2,
  },
});
