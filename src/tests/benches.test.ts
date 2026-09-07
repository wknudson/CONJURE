/**
 * The tills, and the rule that every one of them is somewhere you can stand.
 *
 * A bench is a hotspot on a room's floor addressed in from outside, like a contract site --
 * and like a site it can be authored onto a tile that does not exist. These are the checks
 * that turn that into a failure at the bench rather than a prompt that never appears.
 */

import { describe, expect, it } from 'vitest';
import { BENCHES, benchOfKind, benchesInArea, type BenchKind } from '../district/benches.js';
import { AREAS, areaById } from '../district/areas/index.js';
import { ColliderSet } from '../district/collision.js';
import { staticFootprints } from '../district/footprints.js';
import { isWalkable } from '../district/map.js';

const KINDS: BenchKind[] = ['artificer', 'apothecary', 'vivarium'];

describe('the benches', () => {
  it('has exactly one bench per trade', () => {
    // Three, not four: the Journal is carried (`J`), and the room that was the Journal is
    // the Records Office. A second Artificer would be a second place the tutorial could
    // point at, and it points at one.
    for (const kind of KINDS) {
      expect(BENCHES.filter((b) => b.kind === kind), kind).toHaveLength(1);
      expect(benchOfKind(kind)?.kind).toBe(kind);
    }
  });

  it('names itself the way sites do, and never twice', () => {
    const ids = BENCHES.map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const b of BENCHES) expect(b.id.startsWith(`${b.areaId}:`), b.id).toBe(true);
  });

  it('stands in a room that exists, and is a room', () => {
    for (const b of BENCHES) {
      const area = areaById(b.areaId);
      expect(area, b.id).toBeDefined();
      expect(area!.indoor, `${b.id} is on a street`).toBeDefined();
    }
  });

  it('stands where a person can stand, at the bench and after it', () => {
    for (const b of BENCHES) {
      const area = areaById(b.areaId)!;
      const set = new ColliderSet(area);
      for (const f of staticFootprints(area)) set.add(f.x, f.z, f.w, f.d, f.tag);
      expect(isWalkable(area, b.at.x, b.at.z), `${b.id} at`).toBe(true);
      expect(isWalkable(area, b.back.x, b.back.z), `${b.id} back`).toBe(true);
      expect(set.blocked(b.at.x, b.at.z, 0.4), `${b.id}: furniture on the bench`).toBe(false);
      expect(set.blocked(b.back.x, b.back.z, 0.4), `${b.id}: furniture where you step back to`).toBe(false);
    }
  });

  it("steps you back out of its own prompt, and out of everybody else's", () => {
    // `DoorSpec.returnZ`'s rule, kept: the room remounts when the screen closes, and a
    // remount with the player inside a hotspot's radius raises that prompt at once.
    for (const b of BENCHES) {
      const area = areaById(b.areaId)!;
      expect(Math.hypot(b.back.x - b.at.x, b.back.z - b.at.z), `${b.id} back sits on the bench`).toBeGreaterThan(2.6);
      for (const e of area.exits) {
        expect(Math.hypot(b.back.x - e.x, b.back.z - e.z), `${b.id} back sits on the ${e.to} exit`).toBeGreaterThan(2.6);
        expect(Math.hypot(b.at.x - e.x, b.at.z - e.z), `${b.id} shares a prompt with the ${e.to} exit`).toBeGreaterThan(5.2);
      }
      for (const other of benchesInArea(b.areaId)) {
        if (other === b) continue;
        expect(Math.hypot(b.at.x - other.at.x, b.at.z - other.at.z)).toBeGreaterThan(5.2);
      }
    }
  });

  it('keeps the guided lap one doorway long', () => {
    // The tutorial says "north up the walkway" and means it: the Artificer's room opens
    // straight off Ashfall's cross-street, and the way back lands on the pavement.
    const bench = benchOfKind('artificer')!;
    const room = areaById(bench.areaId)!;
    const ward = AREAS[0]!;
    expect(ward.id).toBe('ashfall_ward');
    expect(ward.exits.some((e) => e.to === room.id), 'no door from the ward').toBe(true);
    expect(room.exits.some((e) => e.to === ward.id), 'no door back').toBe(true);
  });
});
