/**
 * A townsperson's day, and the street's: where somebody who keeps hours is at an hour, and how
 * many people are only passing through.
 *
 * Pure and free of the DOM, so a test can walk a whole day through it. The screen asks it on the
 * clock tick -- the same tick that lights the lamps and brings the crews on shift -- and leaves the
 * walking to `NPC.goTo` and the nav grid.
 */

import { DAY_HOURS, daylightAt } from './daylight.js';
import type { NpcSpec, Vec2 } from './map.js';

/**
 * Where somebody is meant to be at this hour.
 *
 * The post with the latest `from` at or before the hour of the day; before the day's first post,
 * the last one of yesterday. Somebody who keeps no hours is where they were put.
 */
export function npcPostAt(spec: NpcSpec, hour: number): Vec2 {
  const posts = spec.hours;
  if (!posts || posts.length === 0) return { x: spec.x, z: spec.z };
  const h = ((hour % DAY_HOURS) + DAY_HOURS) % DAY_HOURS;
  let now = null as (typeof posts)[number] | null;
  let latest = posts[0]!;
  for (const p of posts) {
    if (p.from > latest.from) latest = p;
    if (p.from <= h && (!now || p.from > now.from)) now = p;
  }
  const at = now ?? latest;
  return { x: at.x, z: at.z };
}

/**
 * The light below which the night crews are out -- `packOutAt` says `night` is `daylight < 0.75`.
 * The street is empty before it gets there, so a passer-by never shares a road with a crew that
 * is working it.
 */
const CREWS_OUT = 0.75;

/** How full the street is at an hour, 0 to 1: full by day, thinning as the light goes. */
export function streetAt(hour: number): number {
  return Math.max(0, Math.min(1, (daylightAt(hour) - CREWS_OUT) / 0.2));
}

/** How many of a street's passers-by are out at an hour. Never more than `peak`. */
export function passersAt(peak: number, hour: number): number {
  return Math.round(peak * streetAt(hour));
}

/** How long a lane is, end to end. */
export function laneLength(lane: readonly Vec2[]): number {
  let n = 0;
  for (let i = 1; i < lane.length; i++) n += Math.hypot(lane[i]!.x - lane[i - 1]!.x, lane[i]!.z - lane[i - 1]!.z);
  return n;
}

/**
 * Where on a lane somebody is who has walked `s` along it, there and back: out to the far end
 * over the first length, home again over the second, and round.
 */
export function alongLane(lane: readonly Vec2[], s: number): Vec2 {
  const len = laneLength(lane);
  if (lane.length < 2 || len <= 0) return { x: lane[0]?.x ?? 0, z: lane[0]?.z ?? 0 };
  let d = ((s % (2 * len)) + 2 * len) % (2 * len);
  if (d > len) d = 2 * len - d;
  for (let i = 1; i < lane.length; i++) {
    const a = lane[i - 1]!;
    const b = lane[i]!;
    const seg = Math.hypot(b.x - a.x, b.z - a.z);
    if (d <= seg || i === lane.length - 1) {
      const t = seg > 0 ? Math.min(1, d / seg) : 0;
      return { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t };
    }
    d -= seg;
  }
  return { x: lane[lane.length - 1]!.x, z: lane[lane.length - 1]!.z };
}
