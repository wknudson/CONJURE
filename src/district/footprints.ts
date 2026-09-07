/**
 * Everything an area's props put on the ground that a body cannot walk through.
 *
 * One list, read by two callers that used to keep their own: `world.ts`, which turns it into
 * colliders, and `district.test.ts`, which floods from the spawn to every exit through it. The
 * test's copy drifted three times -- a crate hardcoded at 1.1 while the world read `c.size`,
 * lamps and the board simply missing -- and each time it drifted the walk got quietly weaker
 * than it read. A footprint declared once cannot disagree with itself.
 *
 * Pure: no three.js, no DOM. The one thing it cannot know is a prop's picture, and a box or
 * panel is as wide as its picture is. `aspectOf` is how the world hands that in; the test
 * passes nothing and gets square footprints, which is the shape it always walked against.
 *
 * Buildings are not here. They are solid tiles, read out of the grid by `extractRects`, and
 * the tile layer of `ColliderSet` already refuses them without a box.
 */

import { DRESSING } from './dressing.js';
import type { AreaDef, DressingSpec } from './map.js';
import { BENCHES } from './benches.js';
import { NOTICES } from './notices.js';
import { CACHES } from './caches.js';
import { FORAGE_KINDS, FORAGE_NODES, foragePropAt } from './forage.js';
import { RESTS } from './rests.js';

/**
 * The furniture the registries hang in an area, beside what the area file lists itself.
 *
 * A bench's own workbench, a notice's lectern, a cache's chest: the thing you interact with
 * and the thing you see are one entry in one file, and this is where the world and the tests
 * both learn that the entry also stands on the floor. Gates are ignored on purpose -- a shut
 * strongbox is still a strongbox in the room -- so the footprint never comes and goes.
 */
export function registryProps(areaId: string): DressingSpec[] {
  const out: DressingSpec[] = [];
  for (const b of BENCHES) if (b.areaId === areaId && b.prop) out.push(b.prop);
  for (const n of NOTICES) if (n.areaId === areaId && n.prop) out.push(n.prop);
  for (const c of CACHES) if (c.areaId === areaId) out.push(c.prop);
  for (const n of FORAGE_NODES) {
    if (n.areaId === areaId) out.push({ kind: FORAGE_KINDS[n.kind].prop, ...foragePropAt(n) });
  }
  for (const r of RESTS) if (r.areaId === areaId) out.push({ kind: 'bed', ...r.prop });
  return out;
}

/** Everything standing in an area: the area file's own list, then the registries'. */
export function allDressing(area: AreaDef): readonly DressingSpec[] {
  return [...(area.props.dressing ?? []), ...registryProps(area.id)];
}

/** Every place a registry puts a prompt in an area, for the clearance rules the tests keep. */
export function registryHotspots(areaId: string): { what: string; x: number; z: number }[] {
  return [
    ...BENCHES.filter((b) => b.areaId === areaId).map((b) => ({ what: `the ${b.kind} bench`, x: b.at.x, z: b.at.z })),
    ...NOTICES.filter((n) => n.areaId === areaId).map((n) => ({ what: `notice ${n.id}`, x: n.at.x, z: n.at.z })),
    ...CACHES.filter((c) => c.areaId === areaId).map((c) => ({ what: `cache ${c.id}`, x: c.at.x, z: c.at.z })),
    ...FORAGE_NODES.filter((n) => n.areaId === areaId).map((n) => ({ what: `node ${n.id}`, x: n.at.x, z: n.at.z })),
    ...RESTS.filter((r) => r.areaId === areaId).map((r) => ({ what: `bed ${r.id}`, x: r.at.x, z: r.at.z })),
  ];
}

export interface Footprint {
  readonly x: number;
  readonly z: number;
  readonly w: number;
  readonly d: number;
  readonly tag: string;
}

/** A gate's collider spans the whole opening; see `world.ts`, "the gates". */
export const GATE_FOOTPRINT = { w: 8, d: 1.2 } as const;
export const LAMP_FOOTPRINT = 0.5;
export const BOARD_FOOTPRINT = { w: 0.9, d: 0.5 } as const;
export const DEFAULT_CRATE = 1.1;

export function staticFootprints(
  area: AreaDef,
  aspectOf: (spec: DressingSpec) => number = () => 1,
): Footprint[] {
  const out: Footprint[] = [];
  const p = area.props;

  for (const c of p.crates ?? []) {
    const s = c.size ?? DEFAULT_CRATE;
    out.push({ x: c.x, z: c.z, w: s, d: s, tag: 'crate' });
  }
  for (const l of p.lamps ?? []) {
    out.push({ x: l.x, z: l.z, w: LAMP_FOOTPRINT, d: LAMP_FOOTPRINT, tag: 'lamp' });
  }
  if (p.board) {
    out.push({ x: p.board.x, z: p.board.z, w: BOARD_FOOTPRINT.w, d: BOARD_FOOTPRINT.d, tag: 'board' });
  }
  for (const spec of allDressing(area)) {
    const kind = DRESSING[spec.kind];
    if (!kind.collides) continue;
    const size = spec.size ?? kind.size;
    // The footprint of the *rotated* box, because `ColliderSet` is axis-aligned only. Without
    // this a fence turned forty-five degrees would collide as though it still ran east-west,
    // and the art would be lying about where the wall is.
    const w = size * aspectOf(spec);
    const yaw = spec.yaw ?? 0;
    const cos = Math.abs(Math.cos(yaw));
    const sin = Math.abs(Math.sin(yaw));
    out.push({ x: spec.x, z: spec.z, w: w * cos + size * sin, d: w * sin + size * cos, tag: spec.kind });
  }
  for (const exit of area.exits) {
    if (exit.gate) {
      out.push({ x: exit.gate.x, z: exit.gate.z, w: GATE_FOOTPRINT.w, d: GATE_FOOTPRINT.d, tag: 'gate' });
    }
  }
  return out;
}
