/**
 * Prints an area's grid with world coordinates on it, and everything already standing there.
 *
 * A scratch tool, not part of the build. Placing a person in a ward means picking a spot that
 * is walkable, is clear of the doors and the board and the Warden's beat and the packs' roam
 * circles, and — in a warded area — is on pavement. All four of those facts are in the data
 * already; they are just spread across a character grid and five prop lists, and reading them
 * off by hand is how you end up with a shopkeeper standing inside a wall.
 *
 *     npx tsx scripts/area-map.ts bonemarket
 */

import { AREAS, areaById } from '../src/district/areas/index.js';
import { TILE, isSafeAt, isWalkable } from '../src/district/map.js';

const want = process.argv[2];
const areas = want ? [areaById(want)].filter((a) => !!a) : AREAS;
if (want && areas.length === 0) {
  console.error(`no area '${want}'. Known: ${AREAS.map((a) => a.id).join(', ')}`);
  process.exit(1);
}

for (const area of areas) {
  const marks = new Map<string, string>();
  const put = (x: number, z: number, ch: string): void => {
    const c = Math.floor((x + area.halfX) / TILE);
    const r = Math.floor((z + area.halfZ) / TILE);
    marks.set(`${c},${r}`, ch);
  };

  put(area.spawn.x, area.spawn.z, 'S');
  for (const d of area.props.doors ?? []) put(d.x, d.z, 'D');
  for (const e of area.exits) put(e.x, e.z, 'X');
  if (area.props.board) put(area.props.board.x, area.props.board.z, 'B');
  if (area.props.huntSignpost) put(area.props.huntSignpost.x, area.props.huntSignpost.z, 'H');
  for (const n of area.props.npcs ?? []) put(n.x, n.z, 'N');
  for (const l of area.props.lamps ?? []) put(l.x, l.z, 'l');
  for (const c of area.props.crates ?? []) put(c.x, c.z, 'c');
  for (const t of area.props.trees ?? []) put(t.x, t.z, 't');
  for (const beat of area.props.patrols ?? []) for (const w of beat) put(w.x, w.z, 'W');
  // A pack's whole roam circle, not just its home — walking into any of it starts a fight.
  for (const pk of area.props.packs ?? []) {
    for (let dx = -pk.roam; dx <= pk.roam; dx += TILE / 2) {
      for (let dz = -pk.roam; dz <= pk.roam; dz += TILE / 2) {
        if (Math.hypot(dx, dz) <= pk.roam) put(pk.x + dx, pk.z + dz, 'p');
      }
    }
    put(pk.x, pk.z, 'P');
  }

  console.log(`\n=== ${area.id} — ${area.name} (${area.cols}x${area.rows}, safety: ${area.safety})`);
  console.log('    . unwalkable  , walkable  = pavement  |  S spawn X exit D door B board');
  console.log('    N npc W warden-beat P/p pack l lamp c crate t tree H signpost\n');

  // Column ruler, world x of each column centre, tens digit then units.
  const xs = Array.from({ length: area.cols }, (_u, c) => c * TILE - area.halfX + TILE / 2);
  console.log('        ' + xs.map((x) => (x < 0 ? '-' : ' ')).join(''));
  console.log('        ' + xs.map((x) => String(Math.floor(Math.abs(x) / 10) % 10)).join(''));
  console.log('        ' + xs.map((x) => String(Math.abs(x) % 10)).join(''));

  for (let r = 0; r < area.rows; r++) {
    const z = r * TILE - area.halfZ + TILE / 2;
    let line = '';
    for (let c = 0; c < area.cols; c++) {
      const x = c * TILE - area.halfX + TILE / 2;
      const mark = marks.get(`${c},${r}`);
      line += mark ?? (!isWalkable(area, x, z) ? '.' : isSafeAt(area, x, z) ? '=' : ',');
    }
    console.log(String(z).padStart(6) + '  ' + line);
  }
}
