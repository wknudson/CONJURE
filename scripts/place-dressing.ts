/**
 * Works out where an area's furniture can legally stand, and writes it into the area file.
 *
 * The alternative was picking six hundred coordinates by hand off `area-map.ts`, which is how
 * you end up with a barrel inside a wall and a fence across the only route to the gate. The
 * rules a prop has to satisfy are already written down — in `district.test.ts` and in
 * `DRESSING` — so this searches against them rather than trusting an eye.
 *
 * What it does NOT do is choose the props. Which trade stands in which ward is a reading of the
 * atlas and is authored below by hand; this only answers "where in the north half of Saltglass
 * can a net rack go". Generic clutter spread evenly is exactly what this pass is not.
 *
 *     npx tsx scripts/place-dressing.ts          # print
 *     npx tsx scripts/place-dressing.ts --write  # insert into the area files
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { AREAS, areaById } from '../src/district/areas/index.js';
import { TILE, isSafeAt, isWalkable, type AreaDef } from '../src/district/map.js';
import { DRESSING, type DressingId } from '../src/district/dressing.js';

/** Where in the area a prop belongs, coarsely. The trade decides this, not the geometry. */
type Region = 'any' | 'north' | 'south' | 'east' | 'west' | 'centre' | 'edge';

interface Want {
  readonly kind: DressingId;
  readonly n: number;
  readonly where?: Region;
  /** Carved lines, dealt out in order. `waystone` only. */
  readonly texts?: readonly string[];
  /** Panels are given a yaw; this is it, in radians. */
  readonly yaw?: number;
}

const inRegion = (a: AreaDef, x: number, z: number, r: Region = 'any'): boolean => {
  const nx = x / a.halfX;
  const nz = z / a.halfZ;
  if (r === 'north') return nz < -0.25;
  if (r === 'south') return nz > 0.25;
  if (r === 'east') return nx > 0.25;
  if (r === 'west') return nx < -0.25;
  if (r === 'centre') return Math.abs(nx) < 0.45 && Math.abs(nz) < 0.45;
  if (r === 'edge') return Math.abs(nx) > 0.55 || Math.abs(nz) > 0.55;
  return true;
};

/** Everything already standing, so nothing is placed on top of anything. */
function occupied(a: AreaDef): { x: number; z: number; r: number }[] {
  const out: { x: number; z: number; r: number }[] = [];
  for (const n of a.props.npcs ?? []) out.push({ x: n.x, z: n.z, r: 3.2 });
  for (const c of a.props.crates ?? []) out.push({ x: c.x, z: c.z, r: 2.2 });
  for (const l of a.props.lamps ?? []) out.push({ x: l.x, z: l.z, r: 2.2 });
  for (const t of a.props.trees ?? []) out.push({ x: t.x, z: t.z, r: 2.2 });
  for (const d of a.props.doors ?? []) out.push({ x: d.x, z: d.z, r: 5.6 });
  for (const e of a.exits) out.push({ x: e.x, z: e.z, r: 6.0 });
  if (a.props.board) out.push({ x: a.props.board.x, z: a.props.board.z, r: 5.6 });
  if (a.props.huntSignpost) out.push({ x: a.props.huntSignpost.x, z: a.props.huntSignpost.z, r: 5.6 });
  for (const beat of a.props.patrols ?? []) for (const w of beat) out.push({ x: w.x, z: w.z, r: 4.0 });
  for (const p of a.props.packs ?? []) out.push({ x: p.x, z: p.z, r: p.roam + 1 });
  out.push({ x: a.spawn.x, z: a.spawn.z, r: 5.0 });
  return out;
}

/**
 * How many props an area of this size wants, against how many the plan below asks for.
 *
 * The counts in `PLAN` are written as *proportions* — four barrels to three carts to two
 * braziers — because that is the part a person can judge. How many of each actually fit is a
 * function of the map, and the maps differ by a factor of two: Ashfall is 400 cells and the
 * Ashwood is 780. Written as absolutes, the same plan makes a ward look busy and a wildland
 * look empty, which is exactly the failure this pass exists to fix.
 *
 * One prop per eighteen cells, measured off Ashfall — which carries thirty-four things over
 * four hundred cells once its lamps, trees and crates are counted, and is the only area anyone
 * has ever called dressed.
 */
const DENSITY = 18;

function place(a: AreaDef, wants: readonly Want[]): string[] {
  const taken = occupied(a);
  const lines: string[] = [];
  const asked = wants.reduce((t, w) => t + w.n, 0);
  const target = Math.round((a.cols * a.rows) / DENSITY);
  const scale = asked > 0 ? Math.max(1, target / asked) : 1;

  for (const want of wants) {
    const kind = DRESSING[want.kind];
    let placed = 0;
    // A stable sweep rather than a random one: the same area always produces the same street,
    // which matters because these coordinates are committed to a file and read in review.
    const cells: { x: number; z: number }[] = [];
    for (let r = 0; r < a.rows; r++) {
      for (let c = 0; c < a.cols; c++) {
        cells.push({ x: c * TILE - a.halfX + TILE / 2, z: r * TILE - a.halfZ + TILE / 2 });
      }
    }
    // Every legal cell first, then a spread through them.
    //
    // The first cut of this walked the sweep with a stride and stopped at `n`, which put every
    // prop in the Caldera into one northern band: an uneven scramble over a row-major list is
    // still a row-major list. Collecting the candidates and then stepping through them at an
    // even interval spreads across whatever shape the region actually is, which is the thing
    // that was wanted.
    const free = cells.filter((cell) => {
      const { x, z } = cell;
      if (!inRegion(a, x, z, want.where)) return false;
      // Colliding props must stand on ground a body could have stood on. The rest need only be
      // in the map, which is what lets an awning hang over a stall row and washing cross a lane.
      const overhead = want.kind === 'awning' || want.kind === 'washing';
      if (!overhead && !isWalkable(a, x, z)) return false;
      // Never on the sanctioned walkway. The flags are the safe zone, and the one promise the
      // ward makes is that its business can be done without stepping off them.
      if (a.safety === 'sidewalk' && isSafeAt(a, x, z) && kind.collides) return false;
      return !taken.some((t) => Math.hypot(x - t.x, z - t.z) < t.r);
    });

    const n = Math.round(want.n * scale);
    const step = free.length / Math.max(1, n);
    for (let k = 0; k < n; k++) {
      // Re-checked against `taken` as we go, because each placement adds to it.
      const clear = (c: { x: number; z: number }): boolean =>
        !taken.some((t) => Math.hypot(c.x - t.x, c.z - t.z) < t.r);
      const first = free[Math.floor(k * step)];
      const cell = first && clear(first) ? first : free.find(clear);
      if (!cell) break;
      const { x, z } = cell;
      taken.push({ x, z, r: Math.max(2.4, kind.size * 1.2) });
      const bits = [`kind: '${want.kind}'`, `x: ${x}`, `z: ${z}`];
      if (want.yaw !== undefined) bits.push(`yaw: ${want.yaw}`);
      if (want.texts) bits.push(`text: '${want.texts[placed % want.texts.length]}'`);
      lines.push(`      { ${bits.join(', ')} },`);
      placed++;
    }

    if (placed < n) {
      console.warn(`  ! ${a.id}: only ${placed}/${n} ${want.kind} fit in '${want.where ?? 'any'}'`);
    }
  }
  return lines;
}

/* ------------------------------------------------------------------------------------ *
 * What stands where. Read off `docs/12_atlas_of_azo.md` and each area's own header.
 * ------------------------------------------------------------------------------------ */

const PLAN: Record<string, { note: string; wants: Want[] }> = {
  ashfall_ward: {
    note: 'The hub, kept working: stores in the yard, washing over the terraces, a fire on the cross-street.',
    wants: [
      { kind: 'barrel', n: 3, where: 'north' },
      { kind: 'washing', n: 3, yaw: 0 },
      { kind: 'brazier', n: 2, where: 'centre' },
      { kind: 'cart', n: 2, where: 'north' },
    ],
  },
  lamprow: {
    note: 'The lighting ward. Oil on the quay, a fire below the kerb, washing over the Sink.',
    wants: [
      { kind: 'barrel', n: 4, where: 'north' },
      { kind: 'washing', n: 3, yaw: 0 },
      { kind: 'brazier', n: 2, where: 'south' },
      { kind: 'bollard', n: 4, where: 'north' },
    ],
  },
  bonemarket: {
    note: 'The stall rows are the legend (`T`), so this is what hangs off them, not the stalls themselves.',
    wants: [
      { kind: 'awning', n: 5, yaw: 0 },
      { kind: 'rack', n: 4 },
      { kind: 'sacks', n: 3 },
      { kind: 'barrel', n: 2 },
    ],
  },
  cinderworks: {
    note: 'Foundry belt: what comes out of the furnace, what carries it, and what it leaves on the floor.',
    wants: [
      { kind: 'spoilheap', n: 4 },
      { kind: 'cart', n: 3 },
      { kind: 'brazier', n: 3 },
      { kind: 'scorch', n: 4 },
      { kind: 'barrel', n: 2 },
    ],
  },
  ward_seven: {
    note: 'Built over a cistern that stopped draining. Everything here is about water nobody wants.',
    wants: [
      { kind: 'well', n: 2 },
      { kind: 'trough', n: 2 },
      { kind: 'washing', n: 3, yaw: 0 },
      { kind: 'barrel', n: 3 },
    ],
  },
  highcourt: {
    note: 'Dressed stone and rank. Bollards and braziers on the processional; nothing on the service end.',
    wants: [
      { kind: 'bollard', n: 6, where: 'north' },
      { kind: 'brazier', n: 3, where: 'north' },
      { kind: 'awning', n: 2, where: 'north', yaw: 0 },
    ],
  },
  chalk_verge: {
    note: 'Spoil and abandoned kit, and the first waystones the road puts up.',
    wants: [
      { kind: 'spoilheap', n: 4 },
      { kind: 'cairn', n: 3 },
      { kind: 'waystone', n: 2, texts: ['THE WARD ENDS HERE', 'NO WRIT PAST THIS STONE'] },
      { kind: 'fence', n: 2, yaw: 0 },
    ],
  },
  chalk_road: {
    note: 'The artery. The atlas puts waystone pairs on it, so here they are, plus what falls off a cart.',
    wants: [
      { kind: 'waystone', n: 4, texts: ['JOLREK — VIII', 'MILLHARROW — III', 'THE RIME — XI', 'FENWICK — V'] },
      { kind: 'fence', n: 5, yaw: 0 },
      { kind: 'cart', n: 2 },
      { kind: 'cairn', n: 2 },
    ],
  },
  millharrow: {
    note: 'Mill town at the crossroads: grain in, beer out, and a toll on the best road.',
    wants: [
      { kind: 'sacks', n: 4 },
      { kind: 'haybale', n: 3 },
      { kind: 'cart', n: 2 },
      { kind: 'fence', n: 4, yaw: 0 },
      { kind: 'waystone', n: 1, texts: ['BY ORDER — TOLL PAYABLE'] },
      { kind: 'well', n: 1 },
    ],
  },
  tallow_levels: {
    note: 'Rendering country. Vats, drying frames, and hurdles keeping stock off the cuts.',
    wants: [
      { kind: 'barrel', n: 4 },
      { kind: 'rack', n: 4 },
      { kind: 'fence', n: 3, yaw: 0 },
      { kind: 'haybale', n: 2 },
    ],
  },
  saltglass: {
    note: 'Fishing town with a shut harbour: nets that are not being used, salt that is not being sold.',
    wants: [
      { kind: 'rack', n: 5, where: 'north' },
      { kind: 'spoilheap', n: 3, where: 'north' },
      { kind: 'bollard', n: 4, where: 'north' },
      { kind: 'barrel', n: 3 },
    ],
  },
  brays_hollow: {
    note: 'Livestock, and the licences that cost more than the herd. Fences, a well, and fodder.',
    wants: [
      { kind: 'pens', n: 5, yaw: 0 },
      { kind: 'fence', n: 4, yaw: 0 },
      { kind: 'haybale', n: 3 },
      { kind: 'well', n: 1 },
      { kind: 'trough', n: 2 },
    ],
  },
  fenwicks_crossing: {
    note: 'Coach inn and bridge. Beer, horses, and somewhere to tie them.',
    wants: [
      { kind: 'barrel', n: 5 },
      { kind: 'trough', n: 2 },
      { kind: 'cart', n: 2 },
      { kind: 'fence', n: 3, yaw: 0 },
      { kind: 'haybale', n: 2 },
    ],
  },
  weeping_stile: {
    note: 'A village that stopped answering. Everything here is something somebody left.',
    wants: [
      { kind: 'pens', n: 4, yaw: 0 },
      { kind: 'fence', n: 3, yaw: 0 },
      { kind: 'logpile', n: 2 },
      { kind: 'cairn', n: 2 },
      { kind: 'waystone', n: 1, texts: ['RELOCATED — LABOUR — 61'] },
    ],
  },
  caldera: {
    note: 'The thinnest area in the game had one crate on it. Nothing lives here, so nothing here is built — only left.',
    wants: [
      { kind: 'scorch', n: 6 },
      { kind: 'cairn', n: 5 },
      { kind: 'spoilheap', n: 4 },
      { kind: 'waystone', n: 1, texts: ['THE TAP FIELD — KEEP OUT'] },
    ],
  },
  ashwood: {
    note: 'Deep timber. Cut wood, and the marks left by whoever cut it.',
    wants: [
      { kind: 'logpile', n: 5 },
      { kind: 'cairn', n: 3 },
      { kind: 'scorch', n: 3 },
      { kind: 'fence', n: 2, yaw: 0 },
    ],
  },
  rimefields: {
    note: 'Two crates on a snowfield was the whole area. Cairns are what people leave on ice.',
    wants: [
      { kind: 'cairn', n: 6 },
      { kind: 'waystone', n: 3, texts: ['THE ROAD — EAST', 'NO SHELTER PAST HERE', 'COUNT YOUR PARTY'] },
      { kind: 'spoilheap', n: 3 },
    ],
  },
  storm_shelf: {
    note: 'Pylon country. Scorch where the sky has been down, and cairns where shepherds have been.',
    wants: [
      { kind: 'scorch', n: 6 },
      { kind: 'cairn', n: 4 },
      { kind: 'spoilheap', n: 3 },
      { kind: 'waystone', n: 1, texts: ['PYLON IX — DO NOT SHELTER'] },
    ],
  },
  bone_bastion: {
    note: 'Barrow country behind an enormous wall. Standing stones, and cairns on the mounds.',
    wants: [
      { kind: 'cairn', n: 6 },
      { kind: 'waystone', n: 3, texts: ['THE BASTION HOLDS', 'COUNT THE MOUNDS', 'NOTHING IS BURIED SHALLOW'] },
      { kind: 'spoilheap', n: 3 },
      { kind: 'logpile', n: 2 },
    ],
  },
};

const here = dirname(fileURLToPath(import.meta.url));
const write = process.argv.includes('--write');
const FILES: Record<string, string> = {
  ashfall_ward: 'ashfall', lamprow: 'lamprow', bonemarket: 'bonemarket', cinderworks: 'cinderworks',
  ward_seven: 'wardSeven', highcourt: 'highcourt', chalk_verge: 'chalkVerge', chalk_road: 'chalkRoad',
  millharrow: 'millharrow', tallow_levels: 'tallowLevels', saltglass: 'saltglass',
  brays_hollow: 'braysHollow', fenwicks_crossing: 'fenwicksCrossing', weeping_stile: 'weepingStile',
  caldera: 'caldera', ashwood: 'ashwood', rimefields: 'rimefields', storm_shelf: 'stormShelf',
  bone_bastion: 'boneBastion',
};

let total = 0;
for (const area of AREAS) {
  const plan = PLAN[area.id];
  if (!plan) continue;
  const lines = place(area, plan.wants);
  total += lines.length;
  console.log(`${area.id}: ${lines.length} props`);
  if (!write) continue;

  const file = resolve(here, '..', 'src', 'district', 'areas', `${FILES[area.id]}.ts`);
  let src = readFileSync(file, 'utf8');
  if (src.includes('dressing: [')) {
    console.warn(`  ! ${area.id} already dressed, skipping`);
    continue;
  }
  const block = `    /** ${plan.note} */\n    dressing: [\n${lines.join('\n')}\n    ],\n`;
  src = src.replace('  props: {\n', `  props: {\n${block}`);
  writeFileSync(file, src, 'utf8');
}
console.log(`\n${total} props across ${Object.keys(PLAN).length} areas`);
if (!areaById('ashfall_ward')) process.exit(1);
