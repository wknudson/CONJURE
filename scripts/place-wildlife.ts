/**
 * Works out where an area's animals and plants can stand, and writes them into the area file.
 *
 * The sibling of `place-dressing.ts`, on exactly the same terms and for the same reason: the
 * rules a thing has to satisfy to stand somewhere are already written down — in
 * `district.test.ts`, in `DRESSING` and in `CRITTERS` — so this searches against them rather
 * than trusting an eye over `area-map.ts`. Picking two hundred coordinates by hand is how you
 * get a heron inside a wall.
 *
 * What it does NOT do is choose the animals. Which creature belongs in which place is a reading
 * of the atlas and is authored in `PLAN` below by hand; this only answers "where in the north
 * half of the Levels can a heron stand". A stoat spread evenly over nineteen areas would be
 * exactly the failure this pass exists to fix — the same one the three-prop world had.
 *
 *     npx tsx scripts/place-wildlife.ts          # print
 *     npx tsx scripts/place-wildlife.ts --write  # insert into the area files
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { AREAS, areaById } from '../src/district/areas/index.js';
import { TILE, isSafeAt, isWalkable, type AreaDef } from '../src/district/map.js';
import { DRESSING, type DressingId } from '../src/district/dressing.js';
import { CRITTERS, type CritterId } from '../src/district/wildlife.js';
import type { SkyId } from '../src/district/skies.js';

type Region = 'any' | 'north' | 'south' | 'east' | 'west' | 'centre' | 'edge';

/** A group of animals: how many groups, how many to a group, and how far each wanders. */
interface Fauna {
  readonly kind: CritterId;
  /** How many separate groups. Each gets its own home and drifts independently. */
  readonly n: number;
  /** Bodies to a group. A flight of rooks is one authored line; a lone fox is another. */
  readonly count?: number;
  readonly roam?: number;
  readonly where?: Region;
}

/** A stand of plants. Straight into the area's existing `dressing` array. */
interface Flora {
  readonly kind: DressingId;
  readonly n: number;
  readonly where?: Region;
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

/**
 * Everything already standing, so nothing is placed on top of anything.
 *
 * Wider margins than `place-dressing`'s for the packs and the exits, because an animal is not
 * where you put it — it wanders a radius, and a hare homed just outside a pack's patch spends
 * its life inside it. The exits matter for a different reason: a deer standing on the crossing
 * is the first thing you see when you arrive, and it will be gone before you have focused on it.
 */
function occupied(a: AreaDef): { x: number; z: number; r: number }[] {
  const out: { x: number; z: number; r: number }[] = [];
  for (const n of a.props.npcs ?? []) out.push({ x: n.x, z: n.z, r: 3.4 });
  for (const c of a.props.crates ?? []) out.push({ x: c.x, z: c.z, r: 2.2 });
  for (const l of a.props.lamps ?? []) out.push({ x: l.x, z: l.z, r: 2.2 });
  for (const t of a.props.trees ?? []) out.push({ x: t.x, z: t.z, r: 2.4 });
  for (const d of a.props.dressing ?? []) out.push({ x: d.x, z: d.z, r: 2.2 });
  for (const d of a.props.doors ?? []) out.push({ x: d.x, z: d.z, r: 5.6 });
  for (const e of a.exits) out.push({ x: e.x, z: e.z, r: 7.0 });
  if (a.props.board) out.push({ x: a.props.board.x, z: a.props.board.z, r: 5.6 });
  if (a.props.huntSignpost) out.push({ x: a.props.huntSignpost.x, z: a.props.huntSignpost.z, r: 5.6 });
  for (const beat of a.props.patrols ?? []) for (const w of beat) out.push({ x: w.x, z: w.z, r: 4.0 });
  for (const p of a.props.packs ?? []) out.push({ x: p.x, z: p.z, r: p.roam + 3 });
  out.push({ x: a.spawn.x, z: a.spawn.z, r: 6.0 });
  return out;
}

/** Every tile centre in the area, in a stable order, so a rerun produces the same street. */
function cells(a: AreaDef): { x: number; z: number }[] {
  const out: { x: number; z: number }[] = [];
  for (let r = 0; r < a.rows; r++) {
    for (let c = 0; c < a.cols; c++) {
      out.push({ x: c * TILE - a.halfX + TILE / 2, z: r * TILE - a.halfZ + TILE / 2 });
    }
  }
  return out;
}

/**
 * Steps evenly through the legal cells rather than taking the first N.
 *
 * `place-dressing` learned this the hard way and the note is worth repeating: an uneven
 * scramble over a row-major list is still a row-major list, and taking the first N put every
 * prop in the Caldera into one northern band.
 */
function spread<T>(free: T[], n: number, clear: (c: T) => boolean): T[] {
  const step = free.length / Math.max(1, n);
  const out: T[] = [];
  for (let k = 0; k < n; k++) {
    const first = free[Math.floor(k * step)];
    const cell = first && clear(first) ? first : free.find(clear);
    if (!cell) break;
    out.push(cell);
  }
  return out;
}

function placeFauna(a: AreaDef, wants: readonly Fauna[]): string[] {
  const taken = occupied(a);
  const lines: string[] = [];

  for (const want of wants) {
    const kind = CRITTERS[want.kind];
    const roam = want.roam ?? (kind.flies ? 22 : 7);
    const free = cells(a).filter(({ x, z }) => {
      if (!inRegion(a, x, z, want.where)) return false;
      // A flying kind is homed anywhere in the map: it never touches the collider set, and
      // rejecting a rook because there is a chimney under it would put every bird in the ward
      // over the one clear corner of it.
      if (!kind.flies && !isWalkable(a, x, z)) return false;
      // Never homed on the sanctioned walkway. The flags are the safe zone and their whole
      // promise is that the ward's business can be done without stepping off them; a hare that
      // bolts across one is fine, and a hare that lives on one is in the way.
      if (!kind.flies && a.safety === 'sidewalk' && isSafeAt(a, x, z)) return false;
      return !taken.some((t) => Math.hypot(x - t.x, z - t.z) < t.r);
    });

    const clear = (c: { x: number; z: number }): boolean =>
      !taken.some((t) => Math.hypot(c.x - t.x, c.z - t.z) < t.r);

    const homes = spread(free, want.n, clear);
    for (const { x, z } of homes) {
      // Reserved by its whole patch, not by its body: two groups whose radii overlap are one
      // group that looks like it cannot make up its mind.
      taken.push({ x, z, r: roam * 0.8 });
      const bits = [`kind: '${want.kind}'`, `x: ${x}`, `z: ${z}`, `roam: ${roam}`];
      if (want.count && want.count > 1) bits.push(`count: ${want.count}`);
      lines.push(`      { ${bits.join(', ')} },`);
    }
    if (homes.length < want.n) {
      console.warn(`  ! ${a.id}: only ${homes.length}/${want.n} ${want.kind} fit`);
    }
  }
  return lines;
}

function placeFlora(a: AreaDef, wants: readonly Flora[]): string[] {
  const taken = occupied(a);
  const lines: string[] = [];

  for (const want of wants) {
    const kind = DRESSING[want.kind];
    const free = cells(a).filter(({ x, z }) => {
      if (!inRegion(a, x, z, want.where)) return false;
      if (!isWalkable(a, x, z)) return false;
      if (a.safety === 'sidewalk' && isSafeAt(a, x, z) && kind.collides) return false;
      return !taken.some((t) => Math.hypot(x - t.x, z - t.z) < t.r);
    });

    const clear = (c: { x: number; z: number }): boolean =>
      !taken.some((t) => Math.hypot(c.x - t.x, c.z - t.z) < t.r);

    for (const { x, z } of spread(free, want.n, clear)) {
      // Tighter than furniture. Plants grow in stands, and a metre and a half of clearance
      // between two clumps of bracken is a botanical garden.
      taken.push({ x, z, r: 2.0 });
      lines.push(`      { kind: '${want.kind}', x: ${x}, z: ${z} },`);
    }
  }
  return lines;
}

/* ------------------------------------------------------------------------------------ *
 * What lives where, and what falls on it.
 *
 * Read off `docs/12_atlas_of_azo.md` and each area's own header, to one rule: **an animal
 * that could stand anywhere says nothing about where it is standing.** So there are no
 * pigeons. The wards get rats and rooks because a foundry ward has rats and rooks; the
 * Caldera gets moths and nothing else because nothing else could live on it; and the
 * Rimefields get wolves that do not run, because that is the one thing a snowfield can do
 * that a field cannot.
 *
 * The seven areas with no people in them get the most, which is the point. The atlas says
 * nobody *lives* out there and a test pins it — but nobody ever said the Ashwood was empty,
 * and an uninhabited wood with nothing in it is a claim about the world nobody made.
 * ------------------------------------------------------------------------------------ */

interface Plan {
  readonly note: string;
  readonly sky: SkyId;
  readonly fauna?: readonly Fauna[];
  readonly flora?: readonly Flora[];
}

const PLAN: Record<string, Plan> = {
  /* --- Jolrek ---------------------------------------------------------------------- */
  ashfall_ward: {
    note: 'The ward is named for what falls on it. Rats in the yards, rooks over the terraces.',
    sky: 'ash',
    fauna: [
      { kind: 'rat', n: 3, count: 2, roam: 5 },
      { kind: 'rook', n: 2, count: 4, roam: 24 },
    ],
  },
  lamprow: {
    note: 'A canal ward. Gulls off the water, rats in the Sink, rooks over both.',
    sky: 'ash',
    fauna: [
      { kind: 'gull', n: 2, count: 3, roam: 22 },
      { kind: 'rat', n: 3, count: 2, roam: 5 },
      { kind: 'rook', n: 1, count: 3, roam: 24 },
    ],
  },
  bonemarket: {
    note: 'Everything here is about food that is out in the open. Gulls follow a market inland.',
    sky: 'ash',
    fauna: [
      { kind: 'gull', n: 2, count: 3, roam: 20 },
      { kind: 'rat', n: 4, count: 2, roam: 5 },
      { kind: 'rook', n: 1, count: 4, roam: 22 },
    ],
  },
  cinderworks: {
    note: 'Moths at the furnace mouths, which is the one thing that comes *to* a foundry.',
    sky: 'ash',
    fauna: [
      { kind: 'moth', n: 4, count: 3, roam: 7 },
      { kind: 'rat', n: 2, count: 2, roam: 5 },
      { kind: 'rook', n: 1, count: 3, roam: 24 },
    ],
  },
  ward_seven: {
    note: 'Built over a cistern that stopped draining, so: reeds, a heron, and rats.',
    sky: 'drizzle',
    fauna: [
      { kind: 'heron', n: 1, roam: 6, where: 'north' },
      { kind: 'rat', n: 4, count: 2, roam: 5 },
      { kind: 'gull', n: 1, count: 2, roam: 20 },
    ],
    flora: [{ kind: 'reeds', n: 6, where: 'north' }],
  },
  highcourt: {
    note: 'Rooks over the Spire and nothing at ground level. Nothing lives on dressed stone.',
    sky: 'drizzle',
    fauna: [{ kind: 'rook', n: 2, count: 5, roam: 26 }],
  },

  /* --- the Middle Ring ------------------------------------------------------------- */
  chalk_verge: {
    note: 'The first ground outside the ward, and it shows: hares, and a verge that flowers.',
    sky: 'pollen',
    fauna: [
      { kind: 'hare', n: 2, roam: 8 },
      { kind: 'rook', n: 1, count: 3, roam: 24 },
    ],
    flora: [
      { kind: 'wildflowers', n: 6 },
      { kind: 'bramble', n: 3, where: 'edge' },
    ],
  },
  chalk_road: {
    note: 'Farmland either side of a corridor. The longest sightline in the game, so: birds.',
    sky: 'pollen',
    fauna: [
      { kind: 'hare', n: 3, roam: 9 },
      { kind: 'rook', n: 2, count: 4, roam: 26 },
      { kind: 'fox', n: 1, roam: 10 },
    ],
    flora: [
      { kind: 'wildflowers', n: 7 },
      { kind: 'bramble', n: 4, where: 'edge' },
    ],
  },
  millharrow: {
    note: 'A crossroads town in worked country. Stock in the fields, rats at the mill.',
    sky: 'pollen',
    fauna: [
      { kind: 'sheep', n: 3, count: 4, roam: 7 },
      { kind: 'goat', n: 2, count: 2, roam: 7 },
      { kind: 'rat', n: 2, count: 2, roam: 5 },
      { kind: 'rook', n: 1, count: 4, roam: 22 },
    ],
    flora: [
      { kind: 'wildflowers', n: 5 },
      { kind: 'bramble', n: 3, where: 'edge' },
    ],
  },
  tallow_levels: {
    note: 'Drained country losing the argument. Reeds in the cuts and a heron standing in them.',
    sky: 'drizzle',
    fauna: [
      { kind: 'heron', n: 2, roam: 6 },
      { kind: 'hare', n: 2, roam: 8 },
      { kind: 'gull', n: 1, count: 3, roam: 22 },
    ],
    flora: [
      { kind: 'reeds', n: 9 },
      { kind: 'bramble', n: 2, where: 'edge' },
    ],
  },
  saltglass: {
    note: 'Flats and fused panes. Gulls and crabs, and nothing that needs cover.',
    sky: 'drizzle',
    fauna: [
      { kind: 'gull', n: 3, count: 4, roam: 24 },
      { kind: 'crab', n: 5, count: 2, roam: 4 },
    ],
    flora: [{ kind: 'reeds', n: 4, where: 'north' }],
  },
  brays_hollow: {
    note: 'A bowl with hedges on the rim. The most alive place in the Ring, and the least worked.',
    sky: 'pollen',
    fauna: [
      { kind: 'sheep', n: 2, count: 4, roam: 7 },
      { kind: 'goat', n: 3, count: 2, roam: 8 },
      { kind: 'hare', n: 2, roam: 8 },
      { kind: 'fox', n: 1, roam: 10 },
    ],
    flora: [
      { kind: 'wildflowers', n: 7 },
      { kind: 'bramble', n: 5, where: 'edge' },
      { kind: 'bracken', n: 4 },
    ],
  },
  fenwicks_crossing: {
    note: 'A bridge town on a river. Everything here belongs to the water.',
    sky: 'drizzle',
    fauna: [
      { kind: 'gull', n: 2, count: 4, roam: 22 },
      { kind: 'heron', n: 1, roam: 6, where: 'north' },
      { kind: 'crab', n: 3, count: 2, roam: 4 },
      { kind: 'rat', n: 2, count: 2, roam: 5 },
    ],
    flora: [{ kind: 'reeds', n: 6, where: 'north' }],
  },
  weeping_stile: {
    note: 'Small, close and overgrown — the tightest map in the game, and the wettest.',
    sky: 'drizzle',
    fauna: [
      { kind: 'heron', n: 1, roam: 5 },
      { kind: 'fox', n: 1, roam: 8 },
      { kind: 'hare', n: 2, roam: 6 },
      { kind: 'moth', n: 2, count: 3, roam: 6 },
    ],
    flora: [
      { kind: 'reeds', n: 5 },
      { kind: 'bracken', n: 5 },
      { kind: 'bramble', n: 4 },
      { kind: 'mushrooms', n: 4 },
      { kind: 'deadfall', n: 3 },
    ],
  },

  /* --- the Wildlands --------------------------------------------------------------- */
  caldera: {
    note: 'Moths and nothing else, which is the whole statement. Nothing else could live on it.',
    sky: 'embers',
    fauna: [{ kind: 'moth', n: 6, count: 3, roam: 9 }],
  },
  ashwood: {
    note: 'The largest map and the most alive. Deer in the clearings, wolves between them.',
    sky: 'leaves',
    fauna: [
      { kind: 'deer', n: 3, count: 2, roam: 10 },
      { kind: 'hare', n: 3, roam: 8 },
      { kind: 'fox', n: 2, roam: 10 },
      { kind: 'wolf', n: 2, count: 2, roam: 12 },
      { kind: 'rook', n: 2, count: 4, roam: 26 },
    ],
    flora: [
      { kind: 'bracken', n: 9 },
      { kind: 'mushrooms', n: 7 },
      { kind: 'deadfall', n: 6 },
      { kind: 'bramble', n: 5 },
    ],
  },
  rimefields: {
    note: 'Hares that break at fifty yards, and wolves that do not break at all.',
    sky: 'snow',
    fauna: [
      { kind: 'hare', n: 4, roam: 10 },
      { kind: 'wolf', n: 3, count: 2, roam: 14 },
      { kind: 'rook', n: 1, count: 3, roam: 26 },
    ],
    flora: [
      { kind: 'bracken', n: 4 },
      { kind: 'bramble', n: 2, where: 'edge' },
    ],
  },
  storm_shelf: {
    note: 'Goats on the footings — the one animal that will stand where the sky comes down.',
    sky: 'drizzle',
    fauna: [
      { kind: 'goat', n: 3, count: 2, roam: 9 },
      { kind: 'hare', n: 2, roam: 9 },
      { kind: 'rook', n: 1, count: 3, roam: 26 },
    ],
    flora: [
      { kind: 'bracken', n: 6 },
      { kind: 'bramble', n: 3 },
    ],
  },
  bone_bastion: {
    note: 'Still air, deliberately. Rooks over the mounds and nothing on the ground under them.',
    sky: 'none',
    fauna: [{ kind: 'rook', n: 3, count: 4, roam: 26 }],
    flora: [{ kind: 'bracken', n: 4 }],
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

let animals = 0;
let plants = 0;
for (const area of AREAS) {
  const plan = PLAN[area.id];
  if (!plan) {
    console.warn(`  ! ${area.id} has no plan`);
    continue;
  }
  const fauna = plan.fauna ? placeFauna(area, plan.fauna) : [];
  const flora = plan.flora ? placeFlora(area, plan.flora) : [];
  animals += fauna.length;
  plants += flora.length;
  console.log(`${area.id}: ${fauna.length} groups, ${flora.length} plants, sky ${plan.sky}`);
  if (!write) continue;

  const file = resolve(here, '..', 'src', 'district', 'areas', `${FILES[area.id]}.ts`);
  let src = readFileSync(file, 'utf8');
  if (src.includes('sky:')) {
    console.warn(`  ! ${area.id} already has a sky, skipping`);
    continue;
  }

  // The plants go into the array that is already there, not into one of their own: a stand of
  // reeds is furniture and belongs beside the barrels, and a second list would be a second
  // place for `world.ts` to look.
  if (flora.length > 0) {
    const at = src.indexOf('    dressing: [');
    const end = src.indexOf('\n    ],', at);
    src = `${src.slice(0, end)}\n${flora.join('\n')}${src.slice(end)}`;
  }

  const block =
    `    /** ${plan.note} */\n` +
    `    sky: '${plan.sky}',\n` +
    (fauna.length > 0 ? `    wildlife: [\n${fauna.join('\n')}\n    ],\n` : '');
  // Matched by pattern rather than by the literal `'  props: {\n'`, because one of these
  // nineteen files is tracked from before the rest and carries CRLF. A literal match failed on
  // exactly that file, silently -- the Chalk Verge got its plants and no weather at all, and
  // the only thing that caught it was the test asking every area to declare one.
  const opening = /^ {2}props: \{\r?\n/m;
  if (!opening.test(src)) {
    console.warn(`  ! ${area.id}: no props block found`);
    continue;
  }
  src = src.replace(opening, (m) => `${m}${block}`);
  writeFileSync(file, src, 'utf8');
}

console.log(`\n${animals} groups and ${plants} plants across ${Object.keys(PLAN).length} areas`);
if (!areaById('ashfall_ward')) process.exit(1);
