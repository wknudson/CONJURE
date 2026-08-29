/**
 * Where an area still has room to stand somebody.
 *
 * The companion to `area-map.ts`. That one shows you the ward; this one answers the actual
 * question — given everything already placed, which tiles could take one more person without
 * failing the rules `district.test.ts` enforces? Those rules are duplicated here on purpose:
 * the test is the authority and this is a search over the same predicate, so a spot this
 * prints is a spot that passes.
 *
 *     npx tsx scripts/area-vacancies.ts bonemarket 2
 */

import { AREAS, areaById } from '../src/district/areas/index.js';
import { TILE, isSafeAt, isWalkable } from '../src/district/map.js';
import type { AreaDef } from '../src/district/map.js';

/** `NPC.interactRadius` (2.8) doubled, as `district.test.ts` requires between two people. */
const NPC_CLEARANCE = 5.6;
/** `NPC.interactRadius` plus a `Hotspot`'s 2.6, as the same test requires. */
const PROP_CLEARANCE = 5.4;

function hotspots(area: AreaDef): { x: number; z: number }[] {
  return [
    ...(area.props.doors ?? []),
    ...area.exits,
    ...(area.props.board ? [area.props.board] : []),
    ...(area.props.huntSignpost ? [area.props.huntSignpost] : []),
  ];
}

/** Everything that would make this a bad place to stand, or null if it is a good one. */
function rejects(area: AreaDef, x: number, z: number): string | null {
  if (!isWalkable(area, x, z)) return 'not walkable';
  // Ashfall's promise is that its whole lap is doable without leaving the flags.
  if (area.safety === 'sidewalk' && !isSafeAt(area, x, z)) return 'off the pavement';

  for (const n of area.props.npcs ?? []) {
    if (Math.hypot(x - n.x, z - n.z) <= NPC_CLEARANCE) return `too close to ${n.id}`;
  }
  for (const h of hotspots(area)) {
    if (Math.hypot(x - h.x, z - h.z) <= PROP_CLEARANCE) return 'on a hotspot';
  }
  for (const pk of area.props.packs ?? []) {
    if (Math.hypot(x - pk.x, z - pk.z) <= pk.roam) return `inside ${pk.encounterId}`;
  }
  // Not a rule the test enforces, but a body sharing a tile with a lamp post or a crate
  // looks like a mistake even when it is legal.
  for (const p of [...(area.props.lamps ?? []), ...(area.props.crates ?? []), ...(area.props.trees ?? [])]) {
    if (Math.hypot(x - p.x, z - p.z) < TILE) return 'in the furniture';
  }
  for (const beat of area.props.patrols ?? []) {
    for (const w of beat) if (Math.hypot(x - w.x, z - w.z) < TILE * 1.5) return 'on a Warden beat';
  }
  return null;
}

const want = process.argv[2];
const howMany = Number(process.argv[3] ?? 3);
const areas = want ? [areaById(want)].filter((a) => !!a) : AREAS;

for (const area of areas) {
  const free: { x: number; z: number }[] = [];
  for (let r = 0; r < area.rows; r++) {
    for (let c = 0; c < area.cols; c++) {
      const x = c * TILE - area.halfX + TILE / 2;
      const z = r * TILE - area.halfZ + TILE / 2;
      if (rejects(area, x, z) === null) free.push({ x, z });
    }
  }

  // Nearest-legal-first, not farthest-point.
  //
  // The instinct is to spread suggestions across the ward, and it is wrong: the tiles
  // farthest from everybody are the map's four corners, and a butcher standing alone at the
  // edge of the world reads as a bug. A town fills up *outward from the people already in
  // it*, so candidates are ranked by how close they are to the existing cast, and taken
  // greedily subject to the same clearance the rules demand of each other. The result is the
  // ring of tiles just outside everybody's elbow room, which is where the next stall goes.
  const anchors = (area.props.npcs ?? []).map((n) => ({ x: n.x, z: n.z }));
  const nearest = (p: { x: number; z: number }, to: { x: number; z: number }[]): number =>
    to.length ? Math.min(...to.map((q) => Math.hypot(p.x - q.x, p.z - q.z))) : 0;

  const queue = [...free].sort((a, b) => nearest(a, anchors) - nearest(b, anchors));
  const picked: { x: number; z: number }[] = [];
  for (const cand of queue) {
    if (picked.length >= howMany) break;
    if (picked.length && nearest(cand, picked) <= NPC_CLEARANCE) continue;
    picked.push(cand);
  }

  console.log(
    `${area.id}: ${area.props.npcs?.length ?? 0} placed, ${picked.length} suggested -> ` +
      picked.map((p) => `(${p.x}, ${p.z})`).join('  '),
  );
}
