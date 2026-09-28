/**
 * The sights registry, held to what every registry is held to.
 *
 * A sight is a prompt on the street, so it must be somewhere a body can stand, clear of the
 * furniture, a stride from every other prompt so two never fight for Space, and inside an area
 * that exists. Its flag is built from its id, so ids must be unique or two sights are one.
 */

import { describe, expect, it } from 'vitest';
import { AREAS, areaById } from '../district/areas/index.js';
import { SIGHTS, sightFlag, sightsInArea } from '../district/sights.js';
import { ColliderSet } from '../district/collision.js';
import { registryHotspots, staticFootprints } from '../district/footprints.js';
import { isWalkable } from '../district/map.js';

describe('the sights', () => {
  it('each have their own id and flag, in an area that exists', () => {
    const ids = new Set<string>();
    for (const s of SIGHTS) {
      expect(ids.has(s.id), s.id).toBe(false);
      ids.add(s.id);
      expect(s.id.startsWith(`${s.areaId}:`), s.id).toBe(true);
      expect(areaById(s.areaId), s.id).toBeDefined();
      expect(sightFlag(s.id)).toBe(`sight:${s.id}`);
      expect(s.caption.length, `${s.id} says nothing`).toBeGreaterThan(20);
      expect(s.caption.length, `${s.id} is a reading, not a caption`).toBeLessThan(260);
    }
  });

  for (const area of AREAS) {
    const mine = sightsInArea(area.id);
    if (mine.length === 0) continue;
    it(`${area.id}: stands every sight on open ground, a stride from every other prompt`, () => {
      const set = new ColliderSet(area);
      for (const f of staticFootprints(area)) set.add(f.x, f.z, f.w, f.d, f.tag);
      const others = [
        ...registryHotspots(area.id).filter((h) => !h.what.startsWith('sight ')),
        ...area.exits.map((e) => ({ what: `the way to ${e.to}`, x: e.x, z: e.z })),
      ];
      for (const s of mine) {
        expect(isWalkable(area, s.at.x, s.at.z), `${s.id} is in a wall`).toBe(true);
        expect(set.blocked(s.at.x, s.at.z, 0.4), `${s.id} is inside the furniture`).toBe(false);
        for (const o of [...others, ...mine.filter((m) => m !== s).map((m) => ({ what: m.id, x: m.at.x, z: m.at.z }))]) {
          expect(Math.hypot(o.x - s.at.x, o.z - s.at.z), `${s.id} is on top of ${o.what}`).toBeGreaterThan(2.6);
        }
      }
    });
  }
});
