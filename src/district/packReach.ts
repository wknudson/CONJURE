/**
 * Where on a map a pack goes about its business -- the ground a placement rule has to keep clear
 * of, or keep in reach of.
 *
 * It used to be a circle, because every pack roamed one, and the rules were written against a
 * pack's `roam` directly: nobody standing inside a roam circle, every pair of circles on a shared
 * road overlapping. A beat walks a line and a sentry stands on a spot, so the rules ask this
 * instead. A prowler goes everywhere, and says so by having no reach at all -- see `packReach`.
 */

import type { PackSpec, Vec2 } from './map.js';

/** A set of segments, each thickened by `radius`. A circle is a segment of no length. */
export interface Reach {
  readonly segments: readonly (readonly [Vec2, Vec2])[];
  readonly radius: number;
}

/** How far a beat strays from its line while walking it, and a sentry from its post. */
const BEAT_SLACK = 1.5;
const SENTRY_SLACK = 1.5;

/**
 * The ground a pack spends its time on, or null for a prowler, which has the whole area.
 *
 * A roaming pack's circle; a sentry's post; a beat's route, closed back to its first post,
 * because it walks round.
 */
export function packReach(spec: PackSpec): Reach | null {
  const home = { x: spec.x, z: spec.z };
  if (spec.behaviour === 'prowl') return null;
  if (spec.behaviour === 'sentry') return { segments: [[home, home]], radius: SENTRY_SLACK };
  if (spec.behaviour === 'beat' && spec.route && spec.route.length >= 2) {
    const r = spec.route;
    const segments: [Vec2, Vec2][] = [];
    for (let i = 0; i < r.length; i++) segments.push([r[i]!, r[(i + 1) % r.length]!]);
    return { segments, radius: BEAT_SLACK };
  }
  return { segments: [[home, home]], radius: spec.roam };
}

/** Distance from a point to a segment. */
function toSegment(p: Vec2, a: Vec2, b: Vec2): number {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const len2 = dx * dx + dz * dz;
  const t = len2 > 0 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / len2)) : 0;
  return Math.hypot(p.x - (a.x + dx * t), p.z - (a.z + dz * t));
}

/** Distance between two segments (zero where they cross). */
function segmentToSegment(a: Vec2, b: Vec2, c: Vec2, d: Vec2): number {
  const cross = (p: Vec2, q: Vec2, r: Vec2): number => (q.x - p.x) * (r.z - p.z) - (q.z - p.z) * (r.x - p.x);
  const d1 = cross(a, b, c);
  const d2 = cross(a, b, d);
  const d3 = cross(c, d, a);
  const d4 = cross(c, d, b);
  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) return 0;
  return Math.min(toSegment(a, c, d), toSegment(b, c, d), toSegment(c, a, b), toSegment(d, a, b));
}

/** How far a point stands outside a reach; negative when it is inside. */
export function outsideReach(r: Reach, p: Vec2): number {
  let best = Infinity;
  for (const [a, b] of r.segments) best = Math.min(best, toSegment(p, a, b));
  return best - r.radius;
}

/** The gap between two reaches; negative when they overlap. */
export function reachGap(r: Reach, s: Reach): number {
  let best = Infinity;
  for (const [a, b] of r.segments) for (const [c, d] of s.segments) best = Math.min(best, segmentToSegment(a, b, c, d));
  return best - r.radius - s.radius;
}
