/**
 * Draws the atlas's maps from the area files, so they cannot say anything the grids do not.
 *
 * The atlas used to carry four maps copied out of the first build by hand, and every area has
 * grown since -- the city wards to twice their size, the Wildlands out past their old rock rings.
 * A copied map is wrong the day after its area is next edited. So the maps are written from the
 * source instead: every outdoor area's grid row by row with the notes its file keeps beside each
 * row, its legend with the words its file uses for each tile, and what stands in it -- the spawn,
 * the ways out, the people and the hours they keep, the crews and how they work, the Wardens'
 * beats, the landmarks, the passers-by, the sights. And the crossings between outdoor places as
 * one table, so the numbers most likely to drift are the ones that are never typed.
 *
 * What it writes goes between marker comments in `docs/12_atlas_of_azo.md`, and nowhere else:
 * everything the atlas says about *why* a place is shaped the way it is stays hand-written.
 * `atlasMaps.test.ts` renders the same text and fails if the atlas has drifted from it.
 *
 *     npx tsx scripts/atlas-maps.ts           # rewrite the atlas's generated sections
 *     npx tsx scripts/atlas-maps.ts --check   # say whether it is current, and exit 1 if not
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, basename } from 'node:path';
import { AREAS, areaById } from '../src/district/areas/index.js';
import type { AreaDef, NpcSpec, PackSpec } from '../src/district/map.js';
import { packByEncounter } from '../src/core/data/packs.js';
import { sightsInArea } from '../src/district/sights.js';
import { areaFiles } from './grow-area.js';

/** The outdoor places, in the atlas's own order: the capital, the Middle Ring, the Wildlands. */
export const ATLAS_REGIONS: readonly { readonly title: string; readonly ids: readonly string[] }[] = [
  { title: 'Jolrek', ids: ['ashfall_ward', 'lamprow', 'bonemarket', 'cinderworks', 'highcourt', 'ward_seven'] },
  {
    title: 'The Middle Ring',
    ids: ['chalk_road', 'millharrow', 'tallow_levels', 'saltglass', 'brays_hollow', 'fenwicks_crossing', 'weeping_stile'],
  },
  { title: 'The Wildlands', ids: ['chalk_verge', 'caldera', 'ashwood', 'rimefields', 'storm_shelf', 'bone_bastion'] },
];

const MAPS_BEGIN = '<!-- atlas-maps:begin — written by scripts/atlas-maps.ts from the area files; do not edit by hand -->';
const MAPS_END = '<!-- atlas-maps:end -->';
const CROSS_BEGIN = '<!-- atlas-crossings:begin — written by scripts/atlas-maps.ts; do not edit by hand -->';
const CROSS_END = '<!-- atlas-crossings:end -->';

/** What a file says beside each grid row, and the words its legend comment uses for each tile. */
interface Source {
  readonly file: string;
  readonly notes: ReadonlyMap<number, string>;
  readonly words: ReadonlyMap<string, string>;
}

function readSource(area: AreaDef, file: string): Source {
  const src = readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
  const notes = new Map<number, string>();
  const grid = /const GRID: readonly string\[\] = \[\n([\s\S]*?)\n\];/.exec(src);
  if (grid) {
    const rows: string[] = [];
    for (const line of grid[1]!.split('\n')) {
      const m = /^\s*'([^']*)',\s*(?:\/\/\s*\d+\s*(.*))?$/.exec(line);
      if (!m) break;
      if (m[2]?.trim()) notes.set(rows.length, m[2].trim());
      rows.push(m[1]!);
    }
    // Notes only if the literal is the grid the area actually uses.
    if (rows.join('\n') !== area.grid.join('\n')) notes.clear();
  }
  const words = new Map<string, string>();
  const legend = /\/\*\*((?:(?!\*\/)[\s\S])*?)\*\/\s*const [A-Z_]*LEGEND\b/.exec(src);
  for (const line of (legend?.[1] ?? '').split('\n')) {
    const m = /^ \*   (\S)  (.+)$/.exec(line);
    if (m) words.set(m[1]!, m[2]!.replace(/\s{2,}/g, ' ').trim());
  }
  return { file: basename(file), notes, words };
}

const fmt = (n: number): string => (Number.isInteger(n) ? String(n) : n.toFixed(1));
const at = (p: { x: number; z: number }): string => `(${fmt(p.x)}, ${fmt(p.z)})`;
const hour = (h: number): string => `${String(Math.floor(h)).padStart(2, '0')}:${String(Math.round((h % 1) * 60)).padStart(2, '0')}`;
const nameOf = (id: string): string => areaById(id)?.name ?? id;

function mapBlock(area: AreaDef, src: Source): string {
  const w = area.cols;
  const tens = Array.from({ length: w }, (_, c) => (c % 10 === 0 ? String(Math.floor(c / 10) % 10) : ' ')).join('');
  const units = Array.from({ length: w }, (_, c) => String(c % 10)).join('');
  const lines = ['```', `      ${tens}`.trimEnd(), `      ${units}`];
  area.grid.forEach((row, r) => {
    const note = src.notes.get(r);
    lines.push(`${String(r).padStart(4)}  ${row}${note ? `   ${note}` : ''}`.trimEnd());
  });
  lines.push('```');
  return lines.join('\n');
}

function legendTable(area: AreaDef, src: Source): string {
  const used = new Set(area.grid.join(''));
  const rows = ['| Tile | What it is | Walk | Safe | Stands |', '|---|---|---|---|---|'];
  for (const [ch, t] of Object.entries(area.legend)) {
    if (!used.has(ch)) continue;
    const s = t.solid;
    const stands = s ? `${s.style ?? 'block'}, ${fmt(s.minHeight)}${s.maxHeight !== s.minHeight ? `–${fmt(s.maxHeight)}` : ''} tall` : '';
    const what = (src.words.get(ch) ?? t.tex).replace(/\|/g, '\\|');
    rows.push(`| \`${ch}\` | ${what} | ${t.walk ? '✅' : '❌'} | ${t.safe ? '✅' : ''} | ${stands} |`);
  }
  return rows.join('\n');
}

function person(n: NpcSpec): string {
  const who = n.label ? n.label.replace(/^(Talk to|Hear|Listen to) /, '') : n.id === 'vex' ? 'Dispatcher Vex' : n.id;
  if (!n.hours?.length) return `${who} ${at(n)}`;
  const posts = [...n.hours].sort((a, b) => a.from - b.from).map((p) => `${hour(p.from)} ${at(p)}`);
  return `${who}, keeping hours: ${posts.join(' · ')}`;
}

function crew(p: PackSpec): string {
  const name = packByEncounter(p.encounterId)?.name ?? p.encounterId;
  const when = p.hours && p.hours !== 'any' ? `, by ${p.hours}` : '';
  const how =
    p.behaviour === 'beat' && p.route?.length
      ? `a beat ${p.route.map(at).join(' → ')}`
      : p.behaviour === 'sentry'
        ? `a sentry at ${at(p)}`
        : p.behaviour === 'prowl'
          ? `prowling the whole area`
          : `roaming ${at(p)}, ${fmt(p.roam)} out`;
  return `${name}${when}: ${how}`;
}

function standsIn(area: AreaDef): string {
  const lines: string[] = [];
  const out = area.exits.map((e) => {
    const room = areaById(e.to)?.indoor ? ' (a room)' : '';
    return `${nameOf(e.to)}${room} from ${at(e)}, arriving ${at(e.arrive)}`;
  });
  lines.push(`- **Spawn** ${at(area.spawn)}.`);
  lines.push(`- **Ways out:** ${out.join('; ')}.`);
  const npcs = area.props.npcs ?? [];
  if (npcs.length) lines.push(`- **People:** ${npcs.map(person).join('; ')}.`);
  const packs = area.props.packs ?? [];
  if (packs.length) lines.push(`- **Crews:** ${packs.map(crew).join('; ')}.`);
  const beats = area.props.patrols ?? [];
  if (beats.length) lines.push(`- **Wardens:** ${beats.length === 1 ? 'one beat' : `${beats.length} beats`}, ${beats.map((b) => b.map(at).join(' → ')).join('; ')}.`);
  const marks = area.props.landmarks ?? [];
  if (marks.length) lines.push(`- **Landmarks:** ${marks.map((l) => `${l.kind.replace(/_/g, ' ')} ${at(l)}`).join('; ')}.`);
  const pb = area.props.passersby;
  if (pb) lines.push(`- **Passers-by:** up to ${pb.peak} by day, on ${pb.lanes.length} lanes.`);
  const lamps = area.props.lamps?.length ?? 0;
  const sights = sightsInArea(area.id).length;
  lines.push(`- **Lamps** ${lamps}; **sights** ${sights}.`);
  return lines.join('\n');
}

function areaEntry(area: AreaDef, src: Source): string {
  const facts = [
    `\`${src.file}\``,
    `${area.cols} × ${area.rows}`,
    `\`safety: '${area.safety}'\``,
    `\`horizon: '${area.props.horizon ?? 'none'}'\``,
    `\`sky: '${area.props.sky ?? 'none'}'\``,
  ];
  return [`##### ${area.name}`, '', facts.join(' — '), '', mapBlock(area, src), '', legendTable(area, src), '', standsIn(area)].join('\n');
}

/** The generated maps section, and the crossings table, as the atlas should carry them. */
export function renderAtlasMaps(root: string): { maps: string; crossings: string } {
  const files = areaFiles(root);
  const parts: string[] = [];
  for (const region of ATLAS_REGIONS) {
    parts.push(`#### ${region.title}`);
    for (const id of region.ids) {
      const area = areaById(id);
      const file = files.get(id);
      if (!area || !file) throw new Error(`atlas-maps: no area or file for ${id}`);
      parts.push(areaEntry(area, readSource(area, file)));
    }
  }
  const outdoor = new Set(ATLAS_REGIONS.flatMap((r) => r.ids));
  const cross = ['| From | To | Hotspot | Arrives at |', '|---|---|---|---|'];
  for (const region of ATLAS_REGIONS) {
    for (const id of region.ids) {
      for (const e of areaById(id)!.exits) {
        if (!outdoor.has(e.to)) continue;
        cross.push(`| ${nameOf(id)} | ${nameOf(e.to)} | ${at(e)} | ${at(e.arrive)} |`);
      }
    }
  }
  return { maps: parts.join('\n\n'), crossings: cross.join('\n') };
}

function splice(text: string, begin: string, end: string, body: string): string {
  const i = text.indexOf(begin);
  const j = text.indexOf(end);
  if (i < 0 || j < i) throw new Error(`atlas-maps: markers missing (${begin.slice(0, 24)}…)`);
  return `${text.slice(0, i + begin.length)}\n\n${body}\n\n${text.slice(j)}`;
}

/** The atlas with its generated sections replaced by what the area files say now. */
export function applyAtlasMaps(atlas: string, rendered: { maps: string; crossings: string }): string {
  const eol = atlas.includes('\r\n') ? '\r\n' : '\n';
  const lf = atlas.replace(/\r\n/g, '\n');
  const done = splice(splice(lf, MAPS_BEGIN, MAPS_END, rendered.maps), CROSS_BEGIN, CROSS_END, rendered.crossings);
  return eol === '\n' ? done : done.replace(/\n/g, eol);
}

export const ATLAS_MARKERS = { MAPS_BEGIN, MAPS_END, CROSS_BEGIN, CROSS_END };

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const path = resolve(root, 'docs', '12_atlas_of_azo.md');
  const atlas = readFileSync(path, 'utf8');
  const next = applyAtlasMaps(atlas, renderAtlasMaps(root));
  if (process.argv.includes('--check')) {
    const current = next === atlas;
    console.log(current ? 'the atlas maps are current' : 'the atlas maps are out of date: npx tsx scripts/atlas-maps.ts');
    process.exit(current ? 0 : 1);
  }
  writeFileSync(path, next);
  console.log(`wrote the atlas maps for ${ATLAS_REGIONS.flatMap((r) => r.ids).length} areas`);
}
