/**
 * Writes `src/render/folkContent.generated.ts` — where each of the forty-eight townsfolk
 * actually is inside their sheet.
 *
 * Measured rather than hand-written, and measured rather than divided. Both alternatives
 * were tried against the art and both are wrong:
 *
 * - **Divided.** The three large sheets are nominally a 3x4 grid of 448x773 cells, and it is
 *   tempting to slice on that. Their content does not respect it. Per column the four figures
 *   occupy blocks of 530-660px separated by irregular gaps, several figures cross a nominal
 *   cell boundary, and there are faint 24-47px **name labels** floating between some rows.
 *   A uniform division clips heads and blits "Apothecary" under somebody's boots.
 * - **Hand-written.** Forty-eight boxes typed by hand is forty-eight chances to be silently
 *   wrong — a bad box does not throw, it just draws a person slightly beheaded, and nothing
 *   in the build would ever mention it.
 *
 * So: read the alpha channel, find the real blocks, write them down. A test re-runs this and
 * compares, so redrawing a sheet without regenerating fails the build rather than shipping.
 *
 * Run with `npm run folk:measure`.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

/* ------------------------------------------------------------------------------------ *
 * A PNG decoder, because we only need one channel of it.
 *
 * Eight-bit RGBA, non-interlaced — checked against all four sheets and every hero sprite in
 * the folder. Anything else throws rather than guessing, since a decoder that quietly
 * mis-reads a bit depth would produce boxes that look plausible and are not.
 * ------------------------------------------------------------------------------------ */

export interface Bitmap {
  width: number;
  height: number;
  /** One byte per pixel: the alpha channel, row-major. The colour is of no interest here. */
  alpha: Uint8Array;
}

export function decodePngAlpha(file: string): Bitmap {
  const buf = readFileSync(file);
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error(`${file}: not a PNG`);

  let width = 0;
  let height = 0;
  const idat: Buffer[] = [];

  // Walk the chunks. IDAT may be split across any number of them and must be concatenated
  // before inflating — the zlib stream spans them.
  for (let at = 8; at + 8 <= buf.length; ) {
    const len = buf.readUInt32BE(at);
    const type = buf.toString('ascii', at + 4, at + 8);
    const body = buf.subarray(at + 8, at + 8 + len);

    if (type === 'IHDR') {
      width = body.readUInt32BE(0);
      height = body.readUInt32BE(4);
      const depth = body[8];
      const colorType = body[9];
      const interlace = body[12];
      if (depth !== 8 || colorType !== 6 || interlace !== 0) {
        throw new Error(
          `${file}: need 8-bit RGBA non-interlaced, got depth=${depth} colour=${colorType} interlace=${interlace}`,
        );
      }
    } else if (type === 'IDAT') {
      idat.push(Buffer.from(body));
    } else if (type === 'IEND') {
      break;
    }
    at += 12 + len; // length + type + body + CRC
  }

  const raw = inflateSync(Buffer.concat(idat));
  const bpp = 4;
  const stride = width * bpp;
  const alpha = new Uint8Array(width * height);

  // Un-filter in place, one scanline at a time. Each line is prefixed by its filter byte and
  // may refer back to the line above, so this has to run start to finish over the whole image
  // even though only the alpha byte of each pixel is kept.
  const line = new Uint8Array(stride);
  const prev = new Uint8Array(stride);
  for (let y = 0; y < height; y++) {
    const start = y * (stride + 1);
    const filter = raw[start];
    line.set(raw.subarray(start + 1, start + 1 + stride));

    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? line[i - bpp]! : 0;
      const b = prev[i]!;
      const c = i >= bpp ? prev[i - bpp]! : 0;
      const x = line[i]!;
      if (filter === 1) line[i] = (x + a) & 0xff;
      else if (filter === 2) line[i] = (x + b) & 0xff;
      else if (filter === 3) line[i] = (x + ((a + b) >> 1)) & 0xff;
      else if (filter === 4) line[i] = (x + paeth(a, b, c)) & 0xff;
      else if (filter !== 0) throw new Error(`${file}: unknown row filter ${filter}`);
    }

    for (let x = 0; x < width; x++) alpha[y * width + x] = line[x * bpp + 3]!;
    prev.set(line);
  }

  return { width, height, alpha };
}

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

/* ------------------------------------------------------------------------------------ *
 * Finding the figures.
 * ------------------------------------------------------------------------------------ */

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * The alpha at or above which a pixel counts as part of a figure.
 *
 * Deliberately `ACTOR_ALPHA_TEST * 255` — the same threshold the material cuts at
 * (`src/district/textures.ts:81`). Measuring at a lower one would include haze the renderer
 * then discards, and every box would be a few pixels of nothing larger than the figure it
 * describes.
 */
const OPAQUE = 89;

/**
 * The shortest run of rows that can be a person.
 *
 * The measured figures are 150-660px tall depending on the sheet; the name labels printed
 * under some of them are 24-47px. Sixty separates the two by a wide margin in both
 * directions, and anything nearer either edge would be tuned to this art rather than to the
 * distinction.
 */
const MIN_FIGURE_ROWS = 60;

/** Vertical runs of rows that contain any opaque pixel within `x0..x1`. */
function rowBlocks(bm: Bitmap, x0: number, x1: number): { top: number; bottom: number }[] {
  const out: { top: number; bottom: number }[] = [];
  let start: number | null = null;
  for (let y = 0; y < bm.height; y++) {
    let any = false;
    for (let x = x0; x < x1; x++) {
      if (bm.alpha[y * bm.width + x]! >= OPAQUE) {
        any = true;
        break;
      }
    }
    if (any) {
      if (start === null) start = y;
    } else if (start !== null) {
      out.push({ top: start, bottom: y - 1 });
      start = null;
    }
  }
  if (start !== null) out.push({ top: start, bottom: bm.height - 1 });
  return out;
}

/** The figure blocks in one column, labels and other short runs discarded. */
function figureBlocks(bm: Bitmap, x0: number, x1: number): { top: number; bottom: number }[] {
  return rowBlocks(bm, x0, x1).filter((b) => b.bottom - b.top + 1 >= MIN_FIGURE_ROWS);
}

/**
 * How far either side of a nominal column line a seam may be looked for.
 *
 * Wide enough to reach the real gap — the measured valleys sit up to 37px off the line —
 * and narrow enough that it can never wander into the next figure.
 */
const SEAM_WINDOW = 45;

/**
 * Where to cut between two side-by-side figures, and what it costs.
 *
 * The nominal column line is the wrong place. Several of these figures stand shoulder to
 * shoulder with their neighbour and a few genuinely overlap: on the `alts` sheet the line at
 * x=448 runs through 112 rows of solid paint, so cutting there would take a slice off
 * somebody's arm and hand it to the person beside them. The column with the fewest opaque
 * pixels in the band is the least damaging place to cut, and where the figures are properly
 * separated its cost is zero and this reduces to finding the gap.
 *
 * `cost` is reported so `measureAll` can say out loud when a sheet has no clean seam, rather
 * than quietly clipping.
 */
function seamAt(
  bm: Bitmap,
  nominal: number,
  top: number,
  bottom: number,
): { x: number; cost: number } {
  let best = nominal;
  let bestCost = Infinity;
  const from = Math.max(1, nominal - SEAM_WINDOW);
  const to = Math.min(bm.width - 1, nominal + SEAM_WINDOW);
  for (let x = from; x <= to; x++) {
    let cost = 0;
    for (let y = top; y <= bottom; y++) if (bm.alpha[y * bm.width + x]! >= OPAQUE) cost++;
    // `<` not `<=`, so a tie keeps the leftmost — deterministic, and the generated table has
    // to be reproducible for the test that regenerates it to mean anything.
    if (cost < bestCost) {
      bestCost = cost;
      best = x;
    }
    if (cost === 0) break; // A clean gap cannot be beaten; stop at the first one.
  }
  return { x: best, cost: bestCost };
}

/** Tightens a box, so a narrow figure does not carry its column's whole width. */
function trim(bm: Bitmap, x0: number, x1: number, top: number, bottom: number): Box {
  let left = x1 - 1;
  let right = x0;
  let first = bottom;
  let last = top;
  for (let y = top; y <= bottom; y++) {
    let any = false;
    for (let x = x0; x < x1; x++) {
      if (bm.alpha[y * bm.width + x]! < OPAQUE) continue;
      any = true;
      if (x < left) left = x;
      if (x > right) right = x;
    }
    if (any) {
      if (y < first) first = y;
      if (y > last) last = y;
    }
  }
  return { x: left, y: first, w: right - left + 1, h: last - first + 1 };
}

export interface Measured {
  boxes: Box[];
  /** The worst seam cost on this sheet, in rows of paint cut through. Zero is clean. */
  worstSeam: number;
}

/**
 * Every figure on a sheet, in reading order: left to right, top to bottom.
 *
 * Two passes, because the two axes are not equally reliable. Rows are found per column and
 * unioned across the three, since one figure standing taller than its neighbours must not
 * shorten them. Columns are then cut per row band at the cheapest seam, since where two
 * figures meet varies from row to row — on the `trades` sheet the best cut sits at x=403 in
 * one band and x=458 in another, forty pixels either side of the same nominal line.
 */
export function measureSheet(
  bm: Bitmap,
  cols: number,
  rows: number,
  gaps: readonly number[] = [],
): Measured {
  const colWidth = bm.width / cols;
  const gapSet = new Set(gaps);

  // Pass 1 — the row bands, unioned across the columns.
  //
  // A column with a declared gap legitimately holds fewer figures than the sheet has rows,
  // so its blocks are assigned to the rows it *does* hold, in order, and the band union
  // simply has one fewer voice for the missing row. The count is still checked exactly —
  // a gap is a statement about the art, and a column that disagrees with it is the same
  // error a miscounted full column always was.
  const perColumn: ({ top: number; bottom: number } | null)[][] = [];
  for (let c = 0; c < cols; c++) {
    const present = Array.from({ length: rows }, (_unused, r) => !gapSet.has(r * cols + c));
    const expected = present.filter(Boolean).length;
    const blocks = figureBlocks(bm, Math.round(c * colWidth), Math.round((c + 1) * colWidth));
    if (blocks.length !== expected) {
      throw new Error(`column ${c}: found ${blocks.length} figures, expected ${expected}`);
    }
    let at = 0;
    perColumn.push(present.map((has) => (has ? blocks[at++]! : null)));
  }
  const bands = Array.from({ length: rows }, (_unused, r) => {
    const here = perColumn.map((b) => b[r]).filter((b): b is { top: number; bottom: number } => !!b);
    if (here.length === 0) throw new Error(`row ${r}: every cell is a declared gap`);
    return {
      top: Math.min(...here.map((b) => b.top)),
      bottom: Math.max(...here.map((b) => b.bottom)),
    };
  });

  // Pass 2 — the seams, per band, and the boxes between them. A gap cell emits nothing, so
  // the boxes line up with the sheet's folk list rather than carrying a 1x1 where nobody is.
  const out: Box[] = [];
  let worstSeam = 0;
  bands.forEach((band, r) => {
    const edges = [0];
    for (let c = 1; c < cols; c++) {
      const seam = seamAt(bm, Math.round(c * colWidth), band.top, band.bottom);
      worstSeam = Math.max(worstSeam, seam.cost);
      edges.push(seam.x);
    }
    edges.push(bm.width);
    for (let c = 0; c < cols; c++) {
      if (gapSet.has(r * cols + c)) continue;
      out.push(trim(bm, edges[c]!, edges[c + 1]!, band.top, band.bottom));
    }
  });
  return { boxes: out, worstSeam };
}

/* ------------------------------------------------------------------------------------ *
 * The sheets, and what is on them.
 * ------------------------------------------------------------------------------------ */

interface SheetSource {
  /** Matches `FolkSheetId` in `src/render/folk.ts`. */
  id: string;
  file: string;
  cols: number;
  rows: number;
  /** The ids on it, in reading order — the same order the filename lists them. */
  folk: string[];
  /**
   * Cells with nobody drawn in them, as reading-order indices (`row * cols + col`).
   *
   * The duelists sheet ships eleven figures on a 3x4 grid, and the artist left the ninth
   * cell empty rather than padding it. Declared here so the measurer expects the shortfall
   * in exactly that column instead of refusing the sheet — and *only* here: an undeclared
   * missing figure is still the miscount error it always was.
   */
  gaps?: number[];
}

export const SHEETS: SheetSource[] = [
  {
    id: 'painted',
    file: 'Elder_Blacksmith_HealerPrincess_Shopkeeper_FarmerWife_FarmerDaughter_FemaleMercenary_ScribeScholar_MinerA_MinerB_Bard_TownGuard.png',
    cols: 3,
    rows: 4,
    folk: [
      'elder',
      'blacksmith',
      'healer',
      'shopkeeper',
      'farmer_wife',
      'farmer_daughter',
      'mercenary',
      'scribe_scholar',
      'miner_a',
      'miner_b',
      'bard',
      'town_guard',
    ],
  },
  {
    id: 'trades',
    file: 'Blacksmith_Weaver_Potter_Glassblower_Innkeeper_Baker_Grocer_Scribe_TownCrier_Herbalist_BardB_NightWatchman.png',
    cols: 3,
    rows: 4,
    folk: [
      'blacksmith_px',
      'weaver',
      'potter',
      'glassblower',
      'innkeeper',
      'baker',
      'grocer',
      'scribe',
      'town_crier',
      'herbalist',
      'bard_b',
      'night_watchman',
    ],
  },
  {
    id: 'crafts',
    file: 'Butcher_Seamstress_Carpenter_Fisherman_Brewer_Cobbler_Alchemist_Apothecary_Jeweler_Cartographer_ChildBeggar_Noblewoman.png',
    cols: 3,
    rows: 4,
    folk: [
      'butcher',
      'seamstress',
      'carpenter',
      'fisherman',
      'brewer',
      'cobbler',
      'alchemist',
      'apothecary',
      'jeweler',
      'cartographer',
      'child_beggar',
      'noblewoman',
    ],
  },
  {
    id: 'alts',
    file: 'ButcherB_BrewerB_Fishmonger_Taylor_CobblerB_Town GuardB_Miller_Harold_CartographerB_Tax Collector_Tanner_Street Urchin.png',
    cols: 3,
    rows: 4,
    folk: [
      'butcher_b',
      'brewer_b',
      'fishmonger',
      'taylor',
      'cobbler_b',
      'town_guard_b',
      'miller',
      'herald',
      'cartographer_b',
      'tax_collector',
      'tanner',
      'street_urchin',
    ],
  },
  {
    id: 'duelists',
    file: 'NoviceWandererA_NoviceWandererB_NoviceWandererC_NoviceWanderD_AdeptJourneymanA_AdeptJourneymanB_AdeptJourneymanC_AdeptJourneymanD_MasterDuelistA_MasterDuelistB_MasterDuelistC.png',
    cols: 3,
    rows: 4,
    // Eleven duelists on the campaign's own ladder — the wager fights' opponents, drawn at
    // last. The ninth cell (row 3, column 3) is empty on the sheet itself.
    gaps: [8],
    folk: [
      'novice_wanderer_a',
      'novice_wanderer_b',
      'novice_wanderer_c',
      'novice_wanderer_d',
      'adept_journeyman_a',
      'adept_journeyman_b',
      'adept_journeyman_c',
      'adept_journeyman_d',
      'master_duelist_a',
      'master_duelist_b',
      'master_duelist_c',
    ],
  },
];

/** Everything the generator knows, as the generated module will state it. */
export function measureAll(
  spritesDir: string,
  report: (line: string) => void = () => {},
): Record<string, { sheet: string; box: Box }> {
  const out: Record<string, { sheet: string; box: Box }> = {};
  for (const sheet of SHEETS) {
    const bm = decodePngAlpha(resolve(spritesDir, sheet.file));
    let measured: Measured;
    try {
      measured = measureSheet(bm, sheet.cols, sheet.rows, sheet.gaps ?? []);
    } catch (err) {
      throw new Error(`${sheet.file}: ${(err as Error).message}`);
    }
    // Said out loud rather than swallowed. A non-zero worst seam means two figures on that
    // sheet overlap and one of them is losing a few pixels of arm at the cut — which is a
    // fact about the art, fixable only by redrawing it, and worth knowing before wondering
    // why somebody's hand looks short.
    report(
      `${sheet.id}: ${measured.boxes.length} figures, worst seam ${measured.worstSeam} rows` +
        (measured.worstSeam === 0 ? ' (clean)' : ' — figures touch here'),
    );
    sheet.folk.forEach((id, i) => {
      if (out[id]) throw new Error(`duplicate folk id '${id}'`);
      out[id] = { sheet: sheet.id, box: measured.boxes[i]! };
    });
  }
  return out;
}

function render(measured: Record<string, { sheet: string; box: Box }>): string {
  const L: string[] = [];
  L.push('/**');
  L.push(' * GENERATED by `npm run folk:measure`. Do not edit.');
  L.push(' *');
  L.push(' * Where each townsperson actually is inside their sheet, in sheet pixels, measured off');
  L.push(' * the alpha channel at the same threshold the material cuts at. See');
  L.push(' * `scripts/measure-folk-sheets.ts` for why these are measured rather than divided, and');
  L.push(' * `src/render/folk.ts` for what is hung off them.');
  L.push(' */');
  L.push('');
  L.push('export interface FolkBox {');
  L.push('  readonly sheet: string;');
  L.push('  readonly x: number;');
  L.push('  readonly y: number;');
  L.push('  readonly w: number;');
  L.push('  readonly h: number;');
  L.push('}');
  L.push('');
  L.push('export const FOLK_BOXES = {');
  for (const sheet of SHEETS) {
    L.push(`  // ${sheet.file}`);
    for (const id of sheet.folk) {
      const { box } = measured[id]!;
      L.push(
        `  ${id}: { sheet: '${sheet.id}', x: ${box.x}, y: ${box.y}, w: ${box.w}, h: ${box.h} },`,
      );
    }
  }
  L.push('} as const satisfies Record<string, FolkBox>;');
  L.push('');
  return L.join('\n');
}

const here = dirname(fileURLToPath(import.meta.url));

/** Where the sheets live, and where the table goes. Exported so a test can measure too. */
export const SPRITES_DIR = resolve(here, '..', 'public', 'assets', 'sprites');
export const GENERATED = resolve(here, '..', 'src', 'render', 'folkContent.generated.ts');

export { render };

// Only when run, never when imported. `folkSheet.test.ts` imports `measureAll` and `render`
// to check the committed table still matches the art, and a module that rewrote that table
// on import would make the test pass by fixing what it was asked to detect.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  writeFileSync(GENERATED, render(measureAll(SPRITES_DIR, (l) => console.log(l))), 'utf8');
  console.log(`wrote ${GENERATED}`);
}
