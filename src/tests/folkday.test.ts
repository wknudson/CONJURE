/**
 * Townsfolk who keep hours, and the people only passing through.
 *
 * The day functions first, walked round the clock; then every area's keepers held to the rules a
 * standing townsperson is held to, at every post; then every street's passers-by -- towns only,
 * lanes a body can walk in a straight line, off the ground any crew works while they are out, and
 * never out while the night crews are.
 */

import { describe, expect, it } from 'vitest';
import { AREAS } from '../district/areas/index.js';
import { ColliderSet } from '../district/collision.js';
import { daylightAt, packOutAt } from '../district/daylight.js';
import { alongLane, laneLength, npcPostAt, passersAt, streetAt } from '../district/folkday.js';
import { registryHotspots, staticFootprints } from '../district/footprints.js';
import { isWalkable, type NpcSpec } from '../district/map.js';
import { NavGrid } from '../district/nav.js';
import { outsideReach, packReach, reachGap } from '../district/packReach.js';
import { isFolkId } from '../render/folk.js';

const HOURS = Array.from({ length: 24 * 4 }, (_, i) => i / 4);

describe('a day', () => {
  const baker: NpcSpec = {
    id: 'baker',
    x: 0,
    z: 0,
    hours: [
      { from: 5, x: 10, z: 0 },
      { from: 11, x: 20, z: 0 },
      { from: 19, x: 30, z: 0 },
    ],
  };

  it('puts somebody at the post whose hour has come, and at yesterday’s before the first', () => {
    expect(npcPostAt(baker, 5)).toEqual({ x: 10, z: 0 });
    expect(npcPostAt(baker, 10.9)).toEqual({ x: 10, z: 0 });
    expect(npcPostAt(baker, 11)).toEqual({ x: 20, z: 0 });
    expect(npcPostAt(baker, 23)).toEqual({ x: 30, z: 0 });
    expect(npcPostAt(baker, 2), 'before dawn, still where the evening left them').toEqual({ x: 30, z: 0 });
    expect(npcPostAt(baker, 24 * 3 + 12), 'the clock is hours since the start, not the hour').toEqual({ x: 20, z: 0 });
  });

  it('leaves somebody who keeps no hours where they were put', () => {
    for (const h of HOURS) expect(npcPostAt({ id: 'x', x: 3, z: 4 }, h)).toEqual({ x: 3, z: 4 });
  });

  it('fills the street by day and empties it before any night crew is out', () => {
    expect(streetAt(12)).toBe(1);
    expect(streetAt(1)).toBe(0);
    for (const h of HOURS) {
      expect(passersAt(6, h)).toBeLessThanOrEqual(6);
      if (passersAt(6, h) > 0) expect(packOutAt('night', h), `${h}: a passer-by out with the night crews`).toBe(false);
    }
    // And thins as the light goes rather than all at once.
    const counts = new Set(HOURS.map((h) => passersAt(6, h)));
    expect(counts.size, 'more than full and empty').toBeGreaterThan(2);
    expect(daylightAt(12)).toBe(1);
  });

  it('walks a lane end to end and back', () => {
    const lane = [
      { x: 0, z: 0 },
      { x: 10, z: 0 },
      { x: 10, z: 5 },
    ];
    expect(laneLength(lane)).toBe(15);
    expect(alongLane(lane, 0)).toEqual({ x: 0, z: 0 });
    expect(alongLane(lane, 12)).toEqual({ x: 10, z: 2 });
    expect(alongLane(lane, 15)).toEqual({ x: 10, z: 5 });
    expect(alongLane(lane, 18), 'on the way back').toEqual({ x: 10, z: 2 });
    expect(alongLane(lane, 30), 'home').toEqual({ x: 0, z: 0 });
    expect(alongLane(lane, 42)).toEqual({ x: 10, z: 2 });
  });
});

for (const area of AREAS) {
  const npcs = area.props.npcs ?? [];
  const keepers = npcs.filter((n) => n.hours?.length);
  const passing = area.props.passersby;
  if (keepers.length === 0 && !passing) continue;

  describe(`${area.id}'s day`, () => {
    const set = new ColliderSet(area);
    for (const f of staticFootprints(area)) set.add(f.x, f.z, f.w, f.d, f.tag);
    const nav = new NavGrid(set);
    const packs = area.props.packs ?? [];
    const hotspots = [
      ...area.exits.map((e) => ({ what: `the ${e.to} exit`, x: e.x, z: e.z })),
      ...registryHotspots(area.id),
      ...(area.props.board ? [{ what: 'the board', ...area.props.board }] : []),
      ...(area.props.huntSignpost ? [{ what: 'the signpost', ...area.props.huntSignpost }] : []),
    ];

    if (keepers.length > 0) {
      it('keeps every post where a standing townsperson could stand, and walkable from home', () => {
        // Every rule `district.test` holds a townsperson to, asked of every post in their day:
        // open ground clear of the furniture, a stride from every prompt and every other person,
        // off every crew's ground whatever its hours, and a walk from where the file puts them.
        expect(area.props.lamplighter && keepers.some((k) => k.id === area.props.lamplighter), 'the lamplighter keeps the lamps’ hours').toBeFalsy();
        for (const n of keepers) {
          expect(new Set(n.hours!.map((p) => p.from)).size, `${n.id}: two posts from one hour`).toBe(n.hours!.length);
          for (const p of n.hours!) {
            const at = `${n.id}'s post from ${p.from}`;
            expect(p.from >= 0 && p.from < 24, `${at}: not an hour`).toBe(true);
            expect(isWalkable(area, p.x, p.z), `${at} is in a wall`).toBe(true);
            expect(set.blocked(p.x, p.z, 0.4), `${at} is inside the furniture`).toBe(false);
            for (const h of hotspots) expect(Math.hypot(p.x - h.x, p.z - h.z), `${at} stands on ${h.what}`).toBeGreaterThan(5.4);
            for (const o of npcs) {
              if (o === n) continue;
              const theirs = o.hours?.length ? o.hours : [{ from: 0, x: o.x, z: o.z }];
              for (const q of theirs) expect(Math.hypot(p.x - q.x, p.z - q.z), `${at} shares a prompt with ${o.id}`).toBeGreaterThan(5.6);
            }
            for (const pk of packs) {
              const reach = packReach(pk);
              expect(reach, `${area.id}: a prowler where people live`).not.toBeNull();
              expect(outsideReach(reach!, p), `${at} is inside ${pk.id ?? pk.encounterId}`).toBeGreaterThan(0);
            }
            const from = nav.walkable(p.x, p.z) ? p : nav.nearestOpen(p.x, p.z, 2);
            expect(from && nav.connected(from.x, from.z, n.x, n.z), `${at} cannot be walked to from home`).toBe(true);
          }
        }
      });

      it('has everybody who keeps hours somewhere at every hour', () => {
        for (const n of keepers) {
          for (const h of HOURS) {
            const at = npcPostAt(n, h);
            expect(n.hours!.some((p) => p.x === at.x && p.z === at.z), `${n.id} at ${h}`).toBe(true);
          }
        }
      });
    }

    if (passing) {
      it('sends its passers-by down lanes a body can walk, off the ground of any crew out by day', () => {
        expect(npcs.length, 'passers-by where nobody lives').toBeGreaterThan(0);
        expect(passing.peak).toBeGreaterThan(0);
        expect(passing.lanes.length).toBeGreaterThan(0);
        for (const f of passing.folk) expect(isFolkId(f), `${f} is not a townsperson`).toBe(true);
        for (const b of passing.barks ?? []) expect(b.length > 4 && b.length < 90, `a bark is a line, not a speech: ${b}`).toBe(true);
        // The night crews need no test here: nobody is out while they are (see `a day`, above).
        const dayCrews = packs.filter((p) => !p.hours || p.hours === 'any' || p.hours === 'day');
        passing.lanes.forEach((lane, i) => {
          expect(lane.length, `lane ${i}`).toBeGreaterThanOrEqual(2);
          for (const p of lane) expect(isWalkable(area, p.x, p.z), `lane ${i} at ${p.x},${p.z} is in a wall`).toBe(true);
          for (let j = 1; j < lane.length; j++) {
            const a = lane[j - 1]!;
            const b = lane[j]!;
            // Passers-by walk straight: they have no route to plan, so the line itself must be open.
            expect(nav.lineClear(a.x, a.z, b.x, b.z), `lane ${i}: ${a.x},${a.z} to ${b.x},${b.z} goes through something`).toBe(true);
            for (const pk of dayCrews) {
              const reach = packReach(pk);
              if (!reach) continue;
              expect(reachGap({ segments: [[a, b]], radius: 1 }, reach), `lane ${i} crosses ${pk.id ?? pk.encounterId}`).toBeGreaterThan(0);
            }
          }
        });
      });
    }
  });
}

describe('the passers-by', () => {
  it('are in the towns, and nowhere nobody lives', () => {
    for (const area of AREAS) {
      if (!area.props.passersby) continue;
      expect(area.indoor, `${area.id}: a crowd in a room`).toBeUndefined();
      expect(area.props.npcs?.length ?? 0, `${area.id}: a crowd where nobody lives`).toBeGreaterThan(0);
    }
  });
});
