/**
 * Somewhere to sleep, and the one rule about it: it buys the morning and nothing else.
 */

import { describe, expect, it } from 'vitest';
import { RESTS, restById, restUntil, restsInArea } from '../district/rests.js';
import { areaById } from '../district/areas/index.js';
import { ColliderSet } from '../district/collision.js';
import { staticFootprints } from '../district/footprints.js';
import { isWalkable } from '../district/map.js';
import { DAY_HOURS } from '../district/daylight.js';

describe('the waking hour', () => {
  it('is the next one after the clock, never the one you are already at', () => {
    expect(restUntil(5, 6)).toBe(6);
    expect(restUntil(5.99, 6)).toBe(6);
    // Lying down at six sleeps a whole day. A free skip of the night would be a free skip of
    // every night crew.
    expect(restUntil(6, 6)).toBe(30);
    expect(restUntil(23.5, 6)).toBe(30);
    expect(restUntil(30, 6)).toBe(54);
  });

  it('keeps the day count, because the sky reads it', () => {
    const woke = restUntil(24 * 9 + 20, 6);
    expect(woke).toBe(24 * 10 + 6);
    expect(woke % DAY_HOURS).toBe(6);
  });
});

describe('the beds', () => {
  it('name themselves the way sites do, and never twice', () => {
    const ids = RESTS.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const r of RESTS) expect(r.id.startsWith(`${r.areaId}:`), r.id).toBe(true);
    expect(restById(RESTS[0]!.id)).toBe(RESTS[0]);
    expect(restsInArea(RESTS[0]!.areaId).length).toBeGreaterThan(0);
  });

  it('cost something, wake at an hour that exists, and say something on waking', () => {
    for (const r of RESTS) {
      expect(r.fee, r.id).toBeGreaterThan(0);
      expect(r.wakeHour, r.id).toBeGreaterThanOrEqual(0);
      expect(r.wakeHour, r.id).toBeLessThan(DAY_HOURS);
      expect(r.line.trim(), r.id).not.toBe('');
      expect(r.label.trim(), r.id).not.toBe('');
    }
  });

  it('stand in a real room, where a person can stand, beside the bed and not on it', () => {
    for (const r of RESTS) {
      const area = areaById(r.areaId);
      expect(area, r.id).toBeDefined();
      expect(isWalkable(area!, r.at.x, r.at.z), `${r.id} at`).toBe(true);
      expect(isWalkable(area!, r.prop.x, r.prop.z), `${r.id}: bed in a wall`).toBe(true);
      expect(Math.hypot(r.prop.x - r.at.x, r.prop.z - r.at.z), `${r.id}: bed far from sleeper`).toBeLessThanOrEqual(4.5);
      const set = new ColliderSet(area!);
      for (const f of staticFootprints(area!)) set.add(f.x, f.z, f.w, f.d, f.tag);
      expect(set.blocked(r.at.x, r.at.z, 0.4), `${r.id}: furniture where you stand`).toBe(false);
    }
  });
});
