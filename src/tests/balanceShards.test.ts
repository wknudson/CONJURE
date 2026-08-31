/**
 * The shards partition the catalogue.
 *
 * The one thing that can silently go wrong when a suite is split by index: an encounter
 * that belongs to no shard is never played, and nothing fails — the run just gets quietly
 * cheaper and stops testing something. That is a much worse failure than a slow suite, and
 * it is the only reason this file exists.
 *
 * Cheap: no playouts, only set arithmetic over the registry.
 */

import { describe, expect, it } from 'vitest';
import { ENCOUNTERS } from '../core/data/encounters/index.js';
import { encountersForShard, SHARDS } from './balanceSuite.js';

describe('the balance shards', () => {
  it('cover every encounter exactly once', () => {
    const seen = new Map<string, number>();
    for (let shard = 0; shard < SHARDS; shard++) {
      for (const e of encountersForShard(shard)) {
        seen.set(e.id, (seen.get(e.id) ?? 0) + 1);
      }
    }

    const missing = ENCOUNTERS.filter((e) => !seen.has(e.id)).map((e) => e.id);
    expect(missing, 'these encounters are in no shard and are never played').toEqual([]);

    const doubled = [...seen].filter(([, n]) => n > 1).map(([id]) => id);
    expect(doubled, 'these encounters are played twice').toEqual([]);
    expect(seen.size).toBe(ENCOUNTERS.length);
  });

  it('leaves no shard empty', () => {
    // A shard file with nothing in it is a file that passes for the wrong reason, and it
    // would mean SHARDS had been raised past the point where there is work to deal out.
    for (let shard = 0; shard < SHARDS; shard++) {
      expect(encountersForShard(shard).length, `shard ${shard + 1} has no arenas`).toBeGreaterThan(
        0,
      );
    }
  });

  it('deals them out evenly enough to be worth splitting', () => {
    // Not a balance guarantee — cost per arena varies by two orders of magnitude and no
    // static rule can know it. This only catches a sharding function that has stopped
    // dealing round-robin at all, which would put the whole catalogue back in one worker.
    const sizes = Array.from({ length: SHARDS }, (_, s) => encountersForShard(s).length);
    expect(Math.max(...sizes) - Math.min(...sizes), 'the shards are lopsided').toBeLessThanOrEqual(
      1,
    );
  });
});
