/**
 * The caches, and the three things that can go wrong with one: it pays in a currency the
 * economy does not have, it stands where nobody can reach it, or it can be opened twice.
 */

import { describe, expect, it } from 'vitest';
import { CACHES, cacheById, cachesInArea, describeLoot } from '../district/caches.js';
import { gateOpen, type Chronicle } from '../district/chronicle.js';
import { areaById } from '../district/areas/index.js';
import { ColliderSet } from '../district/collision.js';
import { staticFootprints } from '../district/footprints.js';
import { isWalkable } from '../district/map.js';
import { DRESSING, isDressingId } from '../district/dressing.js';
import { reagentById } from '../core/data/splicing.js';
import { isBuffId } from '../core/overworld/state.js';
import { ENCOUNTERS } from '../core/data/encounters/index.js';

const walked = (...ids: string[]): Chronicle => ({ campaign: ids, flags: [] });

describe('the caches', () => {
  it('names itself the way sites do, and never twice', () => {
    const ids = CACHES.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const c of CACHES) expect(c.id.startsWith(`${c.areaId}:`), c.id).toBe(true);
    expect(cacheById(CACHES[0]!.id)).toBe(CACHES[0]);
    expect(cachesInArea('ashfall_ward').length).toBeGreaterThan(0);
  });

  it('pays in the currencies the purse has, and pays something', () => {
    for (const c of CACHES) {
      const { ducats = 0, marrowShards = 0, reagents = {}, brew } = c.loot;
      expect(ducats, c.id).toBeGreaterThanOrEqual(0);
      expect(marrowShards, c.id).toBeGreaterThanOrEqual(0);
      for (const [id, n] of Object.entries(reagents)) {
        expect(reagentById(id), `${c.id} pays an unknown reagent '${id}'`).toBeDefined();
        expect(n, `${c.id}: ${id}`).toBeGreaterThan(0);
      }
      if (brew) expect(isBuffId(brew), `${c.id} pays an unknown brew '${brew}'`).toBe(true);
      const total = ducats + marrowShards + Object.keys(reagents).length + (brew ? 1 : 0);
      expect(total, `${c.id} is empty`).toBeGreaterThan(0);
    }
  });

  it('stands in a real area, on ground a person can stand on, beside its own furniture', () => {
    for (const c of CACHES) {
      const area = areaById(c.areaId);
      expect(area, c.id).toBeDefined();
      expect(isWalkable(area!, c.at.x, c.at.z), `${c.id} at`).toBe(true);
      expect(isDressingId(c.prop.kind), `${c.id}: ${c.prop.kind}`).toBe(true);
      if (DRESSING[c.prop.kind].collides) {
        expect(isWalkable(area!, c.prop.x, c.prop.z), `${c.id}: prop in a wall`).toBe(true);
      }
      const set = new ColliderSet(area!);
      for (const f of staticFootprints(area!)) set.add(f.x, f.z, f.w, f.d, f.tag);
      expect(set.blocked(c.at.x, c.at.z, 0.4), `${c.id}: furniture where you open it`).toBe(false);
      expect(Math.hypot(c.prop.x - c.at.x, c.prop.z - c.at.z), `${c.id}: prop far from opener`).toBeLessThanOrEqual(3);
    }
  });

  it('gates only on contracts that exist, and every gate can open', () => {
    const ids = new Set(ENCOUNTERS.map((e) => e.id));
    for (const c of CACHES) {
      for (const id of [...(c.gate?.after ?? []), ...(c.gate?.before ?? [])]) {
        expect(ids.has(id), `${c.id} gates on '${id}'`).toBe(true);
      }
      if (c.gate?.after) expect(gateOpen(c.gate, walked(...c.gate.after))).toBe(true);
    }
  });

  it('says what you found in words, not ids', () => {
    expect(describeLoot({ ducats: 25, reagents: { core_pyre: 1 } })).toBe('Found: 25 Ducats, 1 Pyre Core.');
    expect(describeLoot({ marrowShards: 2 })).toBe('Found: 2 Marrow Shards.');
    expect(describeLoot({ marrowShards: 1, brew: 'ironbrew' })).toMatch(/^Found: 1 Marrow Shard, [A-Z]/);
    expect(describeLoot({})).toBe('Empty.');
  });
});
