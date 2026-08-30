/**
 * Finds a wall face you could paint a line on, in every area that has no graffiti.
 *
 * `GraffitiSpec` anchors to a wall position and a facing, not to a free-floating coordinate,
 * because a scrawl hanging in mid-air is worse than no scrawl. So the question "where can this
 * area take a line" is really "where is there a solid tile with walkable ground in front of
 * it", and that is answerable from the grid.
 *
 *     npx tsx scripts/find-walls.ts
 */

import { AREAS } from '../src/district/areas/index.js';
import { TILE, isWalkable, xOfCol, zOfRow, type AreaDef } from '../src/district/map.js';

/**
 * Which solids are actually walls.
 *
 * A thicket is solid and so is a rock face, and neither takes paint. This is the judgement the
 * grid cannot make for itself: `T` is a stall row in the Bonemarket and a tree in the Ashwood.
 */
const PAINTABLE: Record<string, string> = {
  millharrow: 'B',
  tallow_levels: '',
  saltglass: 'T',
  brays_hollow: '',
  weeping_stile: '',
  chalk_verge: '',
  chalk_road: '',
  caldera: 'R',
  ashwood: '',
  rimefields: 'R',
  storm_shelf: 'PR',
  bone_bastion: 'MX',
};

/** Faces where a solid tile has walkable ground immediately south of it. */
function faces(area: AreaDef, chars: string): { x: number; z: number }[] {
  const out: { x: number; z: number }[] = [];
  if (!chars) return out;
  for (let r = 0; r < area.rows - 1; r++) {
    for (let c = 0; c < area.cols; c++) {
      const ch = area.grid[r]![c]!;
      if (!chars.includes(ch)) continue;
      if (!area.legend[ch]?.solid) continue;
      const x = xOfCol(area, c);
      const zWall = zOfRow(area, r);
      // The tile in front of it, which is where a reader would stand.
      if (!isWalkable(area, x, zWall + TILE)) continue;
      // Terrace runs are fine and in fact ideal — Ashfall's four lines are all on one — so a
      // solid neighbour is not disqualifying. What is disqualifying is the map's own boundary
      // wall: a line painted at the extreme edge is one nobody walks past.
      const edge = Math.abs(x) > area.halfX - TILE * 2 || Math.abs(zWall) > area.halfZ - TILE * 2;
      if (edge) continue;
      out.push({ x, z: zWall + TILE / 2 - 0.05 });
    }
  }
  return out;
}

for (const area of AREAS) {
  if ((area.props.graffiti ?? []).length > 0) continue;
  const chars = PAINTABLE[area.id];
  if (chars === undefined) {
    console.log(`${area.id.padEnd(18)} (not surveyed)`);
    continue;
  }
  const f = faces(area, chars);
  if (f.length === 0) {
    console.log(`${area.id.padEnd(18)} no paintable wall — needs a waystone or nothing`);
    continue;
  }
  // Spread the picks, so two lines are never on the same stretch of wall.
  const picks = [0, Math.floor(f.length / 2), f.length - 1]
    .filter((v, i, a) => a.indexOf(v) === i)
    .map((i) => f[i]!);
  console.log(
    `${area.id.padEnd(18)} ${f.length} faces -> ` +
      picks.map((p) => `(${p.x}, ${p.z.toFixed(2)})`).join('  '),
  );
}
