/**
 * Grows an area by the same number of tiles on each side, without moving anything in it.
 *
 * Positions in this world are measured from the middle of the map (`xOfCol = col * TILE - halfX
 * + TILE / 2`), and every registry -- notices, caches, forage, benches, rests, sites, errands --
 * stores them as absolute numbers in other files. Padding a grid **evenly on both sides** keeps
 * the middle where it was, so every one of those numbers still lands on the tile it was written
 * for. PR #39 grew all nineteen areas that way by hand; this does the mechanical part of it, so
 * the area passes can spend their time on what goes into the new ground.
 *
 * What it rewrites, in the grown area's own file:
 *
 * - **The grid.** Each row is extended by repeating its own edge character outward, and the new
 *   rows above and below repeat the (extended) edge rows. So a treeline stays a treeline, a
 *   canal stays a canal, and a road that ran off the old edge runs on to the new one. Rows are
 *   written back as plain literals -- the area pass edits them by hand -- with their index
 *   comments renumbered and their notes kept. Row constants the grid no longer uses (`BOWL`,
 *   `P26`) are removed, because the compiler refuses unused locals.
 * - **`xOfCol(n)` / `zOfRow(n)`**, which count tiles from the old corner: `n` gains the padding,
 *   so the same call names the same tile.
 * - **`WATER_ROWS`**, when the canal is along the north edge and the north side grew: the new
 *   rows are water, so the canal is that much wider.
 *
 * What moves on purpose: an exit written against the edge (`x: -HALF_X + 2`) follows the edge
 * out, because that is what it says. The **arrival** of the exit coming the other way lives in
 * the neighbouring area's file as a literal, so it is found and moved by the same amount --
 * otherwise you would step through and land in the middle of the new ground instead of beside
 * the way back. `district.test.ts` has a net for this; this is what keeps things out of it.
 *
 * What it does not touch, and says so: header comments that state the old size, and any test
 * that pins an area's dimensions or a coordinate near its old edge.
 *
 *     npx tsx scripts/grow-area.ts <areaId> <cols-per-side> <rows-per-side>          # report
 *     npx tsx scripts/grow-area.ts <areaId> <cols-per-side> <rows-per-side> --write  # rewrite
 */

import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { AREAS, areaById } from '../src/district/areas/index.js';
import { TILE, type AreaDef } from '../src/district/map.js';

/** The grid padded by `kc` columns and `kr` rows on every side, each edge repeated outward. */
export function padGrid(grid: readonly string[], kc: number, kr: number): string[] {
  const wide = grid.map((row) => row[0]!.repeat(kc) + row + row[row.length - 1]!.repeat(kc));
  const top = wide[0]!;
  const bottom = wide[wide.length - 1]!;
  return [...Array<string>(kr).fill(top), ...wide, ...Array<string>(kr).fill(bottom)];
}

/** An exit that follows the edge out, and by how much. `index` counts exits to the same place. */
export interface MovedExit {
  readonly to: string;
  readonly index: number;
  readonly dx: number;
  readonly dz: number;
}

export interface GrownSource {
  readonly text: string;
  readonly moved: MovedExit[];
  readonly notes: string[];
}

const EOL_OF = (src: string): string => (src.includes('\r\n') ? '\r\n' : '\n');
const num = (n: number): string => String(Number(n.toFixed(4)));

/**
 * Identifiers a grid row's expression reads: row constants (`BOWL`), repeat counts (`P26`).
 * String contents are dropped first -- a row of `'TTTT'` is not a constant called `TTTT` -- but
 * the `${...}` holes of a template literal are kept, because that is where the constants are.
 */
function identifiersIn(expr: string): string[] {
  const holes: string[] = [];
  const stripped = expr
    .replace(/`([^`]*)`/g, (_m, body: string) => {
      for (const h of body.matchAll(/\$\{([^}]*)\}/g)) holes.push(h[1]!);
      return '';
    })
    .replace(/'[^']*'/g, '');
  return [...`${stripped} ${holes.join(' ')}`.matchAll(/\b[A-Z][A-Z0-9_]+\b/g)].map((m) => m[0]);
}

/**
 * The `exits: [ ... ]` entries of an area file, as source text, in order.
 *
 * Split on brace depth rather than parsed, because the entries are plain object literals and
 * the only thing wanted from each is its destination and whether its hotspot is written against
 * the map edge.
 */
function exitEntries(lines: readonly string[]): { start: number; end: number; body: string }[] {
  const open = lines.findIndex((l) => /^\s*exits:\s*\[/.test(l));
  if (open < 0) return [];
  const out: { start: number; end: number; body: string }[] = [];
  let depth = 0;
  let start = -1;
  for (let i = open; i < lines.length; i++) {
    const line = i === open ? lines[i]!.slice(lines[i]!.indexOf('[') + 1) : lines[i]!;
    for (const ch of line.replace(/\/\/.*$/, '').replace(/'[^']*'/g, "''")) {
      if (ch === '{') {
        if (depth === 0) start = i;
        depth++;
      } else if (ch === '}') {
        depth--;
        if (depth === 0) out.push({ start, end: i, body: lines.slice(start, i + 1).join('\n') });
      } else if (ch === ']' && depth === 0) {
        return out;
      }
    }
  }
  return out;
}

/** How far an exit's hotspot moves when the edge it is written against moves out. */
function edgeShift(body: string, kc: number, kr: number): { dx: number; dz: number } {
  const x = /^\s*x:\s*(-?)\s*HALF_X\b/m.exec(body);
  const z = /^\s*z:\s*(-?)\s*HALF_Z\b/m.exec(body);
  return {
    dx: x ? (x[1] === '-' ? -1 : 1) * kc * TILE : 0,
    dz: z ? (z[1] === '-' ? -1 : 1) * kr * TILE : 0,
  };
}

/**
 * The grown area's own file, rewritten. Pure: the caller decides whether to write it.
 *
 * Throws rather than guessing when the file is not in the shape every area file is in today --
 * one grid row per line, literal helper arguments -- because a half-applied rewrite of a map is
 * worse than none.
 */
export function growAreaSource(src: string, area: AreaDef, kc: number, kr: number): GrownSource {
  const eol = EOL_OF(src);
  const lines = src.split(/\r?\n/);
  const notes: string[] = [];

  // The grid block.
  const head = lines.findIndex((l) => /^const GRID(: readonly string\[\])? = \[/.test(l));
  if (head < 0) throw new Error(`${area.id}: no \`const GRID = [\` block`);
  const tail = lines.findIndex((l, i) => i > head && /^\];/.test(l));
  const rowLines = lines.slice(head + 1, tail);
  if (rowLines.length !== area.rows) {
    throw new Error(`${area.id}: ${rowLines.length} grid lines for ${area.rows} rows -- rows must be one per line`);
  }
  const used = new Set<string>();
  const notesByRow = rowLines.map((line) => {
    const cut = line.search(/,\s*\/\//);
    const expr = cut >= 0 ? line.slice(0, cut) : line.replace(/,\s*$/, '');
    for (const id of identifiersIn(expr)) used.add(id);
    const comment = cut >= 0 ? line.slice(line.indexOf('//', cut) + 2) : '';
    return comment.replace(/^\s*\d+/, '').trim();
  });
  const grown = padGrid(area.grid, kc, kr);
  const width = String(grown.length - 1).length;
  const gridOut = grown.map((row, i) => {
    const note = i >= kr && i < kr + area.rows ? notesByRow[i - kr]! : '';
    return `  '${row}', // ${String(i).padStart(width)}${note ? '  ' + note : ''}`;
  });
  lines.splice(head + 1, rowLines.length, ...gridOut);

  // Tile-counting helpers, everywhere else in the file.
  const helper = (name: 'xOfCol' | 'zOfRow', k: number) => (line: string): string =>
    line.replace(new RegExp(`\\b${name}\\(\\s*(-?[0-9.]+)\\s*\\)`, 'g'), (_m, n: string) => `${name}(${num(Number(n) + k)})`);
  const shiftX = helper('xOfCol', kc);
  const shiftZ = helper('zOfRow', kr);
  for (let i = 0; i < lines.length; i++) {
    if (i > head && i <= head + gridOut.length) continue;
    const before = lines[i]!;
    const after = shiftZ(shiftX(before));
    if (/\b(xOfCol|zOfRow)\((?!\s*-?[0-9.]+\s*\))/.test(after) && !/const (xOfCol|zOfRow)\s*=/.test(after)) {
      throw new Error(`${area.id}: line ${i + 1} calls a tile helper with something other than a number`);
    }
    lines[i] = after;
  }

  // The canal, if the north side grew.
  if ((area.props.waterRows ?? 0) > 0 && kr > 0) {
    const w = lines.findIndex((l) => /^const WATER_ROWS = \d+;/.test(l));
    if (w < 0) throw new Error(`${area.id}: declares waterRows but no \`const WATER_ROWS = n;\``);
    const was = Number(/(\d+)/.exec(lines[w]!)![1]);
    lines[w] = lines[w]!.replace(/\d+/, String(was + kr));
    notes.push(`canal widened: WATER_ROWS ${was} -> ${was + kr}`);
  }

  // Row constants nothing reads any more -- and, once one goes, any constant only it read.
  const queue = [...used];
  while (queue.length > 0) {
    const id = queue.shift()!;
    const refs = lines.filter((l) => new RegExp(`\\b${id}\\b`).test(l));
    const decl = lines.findIndex((l) => new RegExp(`^const ${id}\\b[^=]*=.*;\\s*$`).test(l));
    if (decl >= 0 && refs.length === 1) {
      const [gone] = lines.splice(decl, 1);
      queue.push(...identifiersIn(gone!.slice(gone!.indexOf('=') + 1)));
      notes.push(`removed row constant ${id} (the grid is literal rows now)`);
    }
  }

  // Exits written against the edge follow it.
  const moved: MovedExit[] = [];
  const seen = new Map<string, number>();
  for (const e of exitEntries(lines)) {
    const to = /\bto:\s*'([^']+)'/.exec(e.body)?.[1];
    if (!to) continue;
    const index = seen.get(to) ?? 0;
    seen.set(to, index + 1);
    const { dx, dz } = edgeShift(e.body, kc, kr);
    if (dx || dz) moved.push({ to, index, dx, dz });
  }

  return { text: lines.join(eol), moved, notes };
}

/**
 * The neighbour's file with the arrival of its exit into `grownId` moved by the edge's shift.
 *
 * Which of the neighbour's exits into the grown area is meant: the one whose arrival lands
 * nearest the grown area's moving exit, measured on the area data as it stands before growth.
 */
export function moveArrival(
  src: string,
  neighbour: AreaDef,
  grown: AreaDef,
  exit: MovedExit,
): { text: string; from: { x: number; z: number }; to: { x: number; z: number } } {
  const ours = grown.exits.filter((e) => e.to === exit.to)[exit.index];
  if (!ours) throw new Error(`${grown.id}: no exit ${exit.index} to ${exit.to}`);
  const theirs = neighbour.exits
    .map((e, i) => ({ e, i }))
    .filter(({ e }) => e.to === grown.id)
    .sort((a, b) => Math.hypot(a.e.arrive.x - ours.x, a.e.arrive.z - ours.z) - Math.hypot(b.e.arrive.x - ours.x, b.e.arrive.z - ours.z));
  if (theirs.length === 0) throw new Error(`${neighbour.id}: no exit back into ${grown.id}`);
  const nth = neighbour.exits.filter((e, i) => e.to === grown.id && i < theirs[0]!.i).length;

  const eol = EOL_OF(src);
  const lines = src.split(/\r?\n/);
  const entries = exitEntries(lines).filter((e) => new RegExp(`\\bto:\\s*'${grown.id}'`).test(e.body));
  const entry = entries[nth];
  if (!entry) throw new Error(`${neighbour.id}: could not find exit ${nth} into ${grown.id} in the source`);
  const from = theirs[0]!.e.arrive;
  const to = { x: from.x + exit.dx, z: from.z + exit.dz };
  let done = false;
  for (let i = entry.start; i <= entry.end; i++) {
    const line = lines[i]!;
    const m = /arrive:\s*\{\s*x:\s*(-?[0-9.]+),\s*z:\s*(-?[0-9.]+)\s*\}/.exec(line);
    if (!m) continue;
    lines[i] = line.replace(m[0], `arrive: { x: ${num(to.x)}, z: ${num(to.z)} }`);
    done = true;
    break;
  }
  if (!done) throw new Error(`${neighbour.id}: the arrival into ${grown.id} is not a literal { x, z }`);
  return { text: lines.join(eol), from, to };
}

/** Every area file, by the id it declares. */
export function areaFiles(root: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const dir of [resolve(root, 'src', 'district', 'areas'), resolve(root, 'src', 'district', 'areas', 'interiors')]) {
    for (const name of readdirSync(dir)) {
      if (!name.endsWith('.ts') || name === 'index.ts') continue;
      const file = resolve(dir, name);
      const src = readFileSync(file, 'utf8');
      for (const a of AREAS) {
        if (new RegExp(`(_ID\\s*=|\\bid:)\\s*'${a.id}'`).test(src)) out.set(a.id, file);
      }
    }
  }
  return out;
}

const here = dirname(fileURLToPath(import.meta.url));

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [id, cs, rs] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  const write = process.argv.includes('--write');
  const area = id ? areaById(id) : undefined;
  const kc = Number(cs);
  const kr = Number(rs);
  if (!area || !Number.isInteger(kc) || !Number.isInteger(kr) || kc < 0 || kr < 0) {
    console.error('usage: npx tsx scripts/grow-area.ts <areaId> <cols-per-side> <rows-per-side> [--write]');
    process.exit(1);
  }
  const files = areaFiles(resolve(here, '..'));
  const file = files.get(area.id)!;
  const out = growAreaSource(readFileSync(file, 'utf8'), area, kc, kr);
  console.log(`${area.id}: ${area.cols}x${area.rows} -> ${area.cols + 2 * kc}x${area.rows + 2 * kr}`);
  for (const n of out.notes) console.log('  ' + n);

  const writes: [string, string][] = [[file, out.text]];
  const pending = new Map<string, string>();
  for (const m of out.moved) {
    const neighbour = areaById(m.to);
    const nfile = neighbour && files.get(neighbour.id);
    if (!neighbour || !nfile) {
      console.log(`  exit to ${m.to} moves (${m.dx}, ${m.dz}) -- no such area file, arrival NOT updated`);
      continue;
    }
    const moved = moveArrival(pending.get(nfile) ?? readFileSync(nfile, 'utf8'), neighbour, area, m);
    pending.set(nfile, moved.text);
    console.log(
      `  exit to ${m.to} follows the edge (${m.dx}, ${m.dz}); the arrival from ${m.to} ` +
        `(in ${m.to}'s file) moves (${moved.from.x}, ${moved.from.z}) -> (${moved.to.x}, ${moved.to.z})`,
    );
  }
  for (const entry of pending) writes.push(entry);
  console.log('  still yours: header comments that state the size, and tests that pin it or its old edge');
  if (write) {
    for (const [f, text] of writes) writeFileSync(f, text, 'utf8');
    console.log(`  wrote ${writes.length} file(s)`);
  } else {
    console.log('  (report only; --write to apply)');
  }
}
