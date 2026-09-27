/**
 * What an area may say about the packs on it.
 *
 * The ones that fail silently: an `encounterId` with a typo in it is a pack that walks the road
 * and never fights; two crews of one kind with nothing to tell them apart share a cooldown and a
 * seed; a beat post inside a wall is a crew grinding at a wall for good; a pack whose patch covers
 * the spot a crossing drops you on is a fight the moment you arrive.
 */

import { describe, expect, it } from 'vitest';
import { AREAS, areaById } from '../district/areas/index.js';
import { isPack } from '../core/data/packs.js';
import { packClockKey } from '../core/data/hunts.js';
import { isWalkable } from '../district/map.js';
import { ColliderSet } from '../district/collision.js';
import { NavGrid } from '../district/nav.js';
import { staticFootprints } from '../district/footprints.js';
import { outsideReach, packReach, reachGap } from '../district/packReach.js';

/**
 * How far a pack's ground must keep from wherever the player is put down.
 *
 * Two units past the edge of its patch. Not more, because the Chalk Road is a corridor with three
 * crews sharing it end to end and the arrival from Millharrow sits 2.8 from the freight-pickers'
 * edge; not less, because arriving *inside* a patch is a fight before the screen has settled. The
 * street's arming delay and a pack's suspicion at the edge of its sight cover the first seconds.
 */
const ARRIVAL_CLEAR = 2;

for (const area of AREAS) {
  const specs = area.props.packs ?? [];
  if (specs.length === 0) continue;

  describe(`${area.id}'s packs`, () => {
    it('fight as a pack that exists, and are each their own crew', () => {
      const keys = new Set<string>();
      for (const s of specs) {
        expect(isPack(s.encounterId), `${area.id}: ${s.encounterId} is not a pack`).toBe(true);
        const key = packClockKey(s.encounterId, area.id, s.id);
        expect(keys.has(key), `${area.id}: two ${s.encounterId} with nothing to tell them apart`).toBe(false);
        keys.add(key);
      }
    });

    it('walk routes they can walk, and prowl only where nobody lives', () => {
      const set = new ColliderSet(area);
      for (const f of staticFootprints(area)) set.add(f.x, f.z, f.w, f.d, f.tag);
      const nav = new NavGrid(set);
      for (const s of specs) {
        if (s.behaviour === 'beat') {
          expect(s.route?.length ?? 0, `${area.id}: ${s.encounterId} walks a beat of fewer than two posts`).toBeGreaterThanOrEqual(2);
          for (const p of s.route ?? []) {
            expect(isWalkable(area, p.x, p.z), `${area.id}: ${s.encounterId} post ${p.x},${p.z} is in a wall`).toBe(true);
            const at = nav.walkable(p.x, p.z) ? p : nav.nearestOpen(p.x, p.z, 2);
            expect(at && nav.connected(at.x, at.z, s.x, s.z), `${area.id}: ${s.encounterId} post ${p.x},${p.z} cannot be walked to`).toBe(true);
          }
        }
        if (s.behaviour === 'prowl') {
          expect(area.props.npcs ?? [], `${area.id}: a prowler where people live`).toHaveLength(0);
          expect(area.safety, `${area.id}: a prowler on sanctioned ground`).toBe('none');
        }
      }
    });

    it('keep clear of the spawn, the ways out, and every place a crossing puts you down', () => {
      const drops = [
        { what: 'the spawn', ...area.spawn },
        ...area.exits.map((e) => ({ what: `the way to ${e.to}`, x: e.x, z: e.z })),
        ...AREAS.flatMap((other) =>
          other.exits.filter((e) => e.to === area.id).map((e) => ({ what: `the arrival from ${other.id}`, ...e.arrive })),
        ),
      ];
      for (const s of specs) {
        const reach = packReach(s);
        if (!reach) continue; // A prowler; the arming delay and the refuge are what cover it.
        for (const d of drops) {
          expect(outsideReach(reach, d), `${area.id}: ${s.encounterId} works ${d.what}`).toBeGreaterThan(ARRIVAL_CLEAR);
        }
      }
    });
  });
}

describe('the ground a pack works', () => {
  it('is a circle for a roamer, a post for a sentry, a closed line for a beat, and everything for a prowler', () => {
    const roam = packReach({ encounterId: 'x', x: 0, z: 0, roam: 5 })!;
    expect(outsideReach(roam, { x: 8, z: 0 })).toBeCloseTo(3);
    expect(outsideReach(roam, { x: 2, z: 0 })).toBeLessThan(0);
    const sentry = packReach({ encounterId: 'x', x: 0, z: 0, roam: 5, behaviour: 'sentry' })!;
    expect(outsideReach(sentry, { x: 3, z: 0 }), "a sentry does not have a roamer's patch").toBeGreaterThan(0);
    const beat = packReach({ encounterId: 'x', x: 0, z: 0, roam: 5, behaviour: 'beat', route: [{ x: 0, z: 0 }, { x: 20, z: 0 }, { x: 20, z: 10 }] })!;
    expect(outsideReach(beat, { x: 10, z: 1 }), 'on the first leg').toBeLessThan(0);
    expect(outsideReach(beat, { x: 10, z: 5 }), 'on the leg home, which closes the round').toBeLessThan(0);
    expect(outsideReach(beat, { x: 10, z: -6 })).toBeGreaterThan(0);
    expect(packReach({ encounterId: 'x', x: 0, z: 0, roam: 5, behaviour: 'prowl' })).toBeNull();
  });

  it('measures the gap between two patches, negative where they overlap', () => {
    const a = packReach({ encounterId: 'x', x: 0, z: 0, roam: 4 })!;
    const b = packReach({ encounterId: 'x', x: 10, z: 0, roam: 4 })!;
    expect(reachGap(a, b)).toBeCloseTo(2);
    const c = packReach({ encounterId: 'x', x: 6, z: 0, roam: 4 })!;
    expect(reachGap(a, c)).toBeLessThan(0);
  });
});

describe('the pack specs, as a whole', () => {
  it('name only areas that exist, through their arrivals', () => {
    for (const a of AREAS) for (const e of a.exits) expect(areaById(e.to), `${a.id} -> ${e.to}`).toBeDefined();
  });
});
