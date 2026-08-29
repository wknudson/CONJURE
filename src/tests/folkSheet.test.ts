/**
 * The townsfolk sheets, and the table that says where everybody is on them.
 *
 * Two failure modes, neither of which throws on its own:
 *
 * 1. **The path drifts.** A sheet is renamed, or the case changes, or one of the two
 *    filenames with a space in it stops being encoded. On Windows the dev server serves it
 *    anyway and everything looks fine; the 404 arrives once it is served from Linux. This is
 *    the same trap `spriteAssets.test.ts` was written for after a bound Chimera took a whole
 *    ward down, and it is checked the same way — against the real path builder.
 * 2. **The art moves and the table does not.** Redraw a sheet, shift a figure forty pixels,
 *    and the boxes still point at the old rectangles. Nothing fails. People are drawn
 *    beheaded, or with a name label under their boots, and the first anyone hears of it is a
 *    screenshot. So this re-measures the PNGs and compares against what is committed.
 */

import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  FOLK_HEIGHT,
  FOLK_IDS,
  FOLK_SCALE,
  FOLK_SHEETS,
  folkBox,
  folkHeight,
  folkSheetOf,
  folkSheetSrc,
  isFolkId,
  type FolkId,
  type FolkSheetId,
} from '../render/folk.js';
import { FOLK_BOXES } from '../render/folkContent.generated.js';
import { GENERATED, SHEETS, SPRITES_DIR, measureAll, render } from '../../scripts/measure-folk-sheets.js';

const SHEET_IDS = Object.keys(FOLK_SHEETS) as FolkSheetId[];

/** `/assets/...` as the browser asks for it -> the file on disk that serves it. */
const onDisk = (src: string): string => `public${decodeURI(src)}`;

describe('the townsfolk sheets', () => {
  it('are all on disk, under exactly the name the loader asks for', () => {
    const missing = SHEET_IDS.filter((id) => !existsSync(onDisk(folkSheetSrc(id))));
    expect(missing.map((id) => `${id} -> ${folkSheetSrc(id)}`)).toEqual([]);
  });

  it('encodes the two filenames that contain a space', () => {
    // The specific bug this guards: a raw space in a URL is served happily by the dev server
    // and rejected by stricter static hosts, so it cannot fail until it is deployed.
    expect(folkSheetSrc('alts')).toContain('%20');
    for (const id of SHEET_IDS) expect(folkSheetSrc(id)).not.toContain(' ');
  });

  it('holds forty-eight people, each on exactly one sheet', () => {
    expect(FOLK_IDS).toHaveLength(48);
    expect(new Set(FOLK_IDS).size).toBe(48);
    for (const id of FOLK_IDS) expect(SHEET_IDS).toContain(folkSheetOf(id));
  });

  it('lists each sheet in the order its own filename does', () => {
    // The filenames are the manifest. If the generator's `folk` arrays ever stop agreeing
    // with them, every id on that sheet silently points at the wrong person — which is the
    // one kind of wrong that still renders a plausible-looking townsperson.
    for (const sheet of SHEETS) {
      const ids = FOLK_IDS.filter((id) => folkSheetOf(id) === sheet.id);
      expect(ids, sheet.id).toEqual(sheet.folk);
    }
  });

  it('knows a real id from a made-up one', () => {
    expect(isFolkId('blacksmith')).toBe(true);
    expect(isFolkId('night_watchman')).toBe(true);
    expect(isFolkId('not_a_person')).toBe(false);
  });
});

describe('the measured boxes', () => {
  it('match the art as it is on disk today', () => {
    // The whole point. Re-measures the four PNGs and renders the same file the generator
    // would, so redrawing a sheet without re-running `npm run folk:measure` fails here
    // instead of shipping.
    expect(render(measureAll(SPRITES_DIR))).toBe(
      // Read through the generated module rather than the file, so this also catches a
      // hand-edit of the "do not edit" table.
      renderCommitted(),
    );
  });

  it('never overlap on a sheet', () => {
    for (const sheet of SHEET_IDS) {
      const here = FOLK_IDS.filter((id) => folkSheetOf(id) === sheet).map(
        (id) => [id, folkBox(id)] as const,
      );
      for (let i = 0; i < here.length; i++) {
        for (let j = i + 1; j < here.length; j++) {
          const [aName, a] = here[i]!;
          const [bName, b] = here[j]!;
          const overlaps =
            a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
          expect(overlaps, `${aName} and ${bName} share pixels`).toBe(false);
        }
      }
    }
  });

  it('describes a person, not a sliver', () => {
    // A box that collapses is what a failed measurement looks like: the generator would
    // rather emit a 1x1 than throw, and a one-pixel townsperson is invisible rather than
    // obviously broken.
    for (const id of FOLK_IDS) {
      const b = folkBox(id);
      expect(b.w, `${id} width`).toBeGreaterThan(20);
      expect(b.h, `${id} height`).toBeGreaterThan(60);
      expect(b.x, `${id} x`).toBeGreaterThanOrEqual(0);
      expect(b.y, `${id} y`).toBeGreaterThanOrEqual(0);
    }
  });

  it('crops above the watermark on the painted sheet', () => {
    // There are stray marks at y 741-750 in the miner_b and town_guard columns of the first
    // sheet — a signature or an export artefact. Real figure content ends at y 738. A crop
    // taken to the nominal 189.5px cell height would blit those specks under two people's
    // boots, so this pins the fact that nothing reaches them.
    for (const id of FOLK_IDS.filter((f) => folkSheetOf(f) === 'painted')) {
      const b = folkBox(id);
      expect(b.y + b.h, `${id} bottom`).toBeLessThanOrEqual(739);
    }
  });
});

describe('how tall they stand', () => {
  it('scales only people holding something over their own head', () => {
    // The corrections are a claim about the drawings, so name them. Every one of these is a
    // pole, a banner or a raised bell adding height above the head that is not the person.
    expect(Object.keys(FOLK_SCALE).sort()).toEqual(
      ['herald', 'mercenary', 'night_watchman', 'town_crier', 'town_guard'].sort(),
    );
    for (const id of Object.keys(FOLK_SCALE) as FolkId[]) {
      expect(FOLK_SCALE[id], id).toBeGreaterThan(1);
      expect(FOLK_SCALE[id], id).toBeLessThan(1.25);
    }
  });

  it('stands every body between the Commander and their beast', () => {
    // `COMMANDER_HEIGHT` is 2.1 and `COMPANION_HEIGHT` 1.5 in `DistrictScreen`. A townsperson
    // outside that band reads as a giant or as a child.
    //
    // The check is on `FOLK_HEIGHT` rather than on `folkHeight(id)`, and the difference is
    // the whole reason `FOLK_SCALE` exists. The scale is applied to the *drawing*, whose top
    // edge is a halberd tip or a banner; scaling it up is what puts the person underneath
    // back on everyone else's eye line. So a corrected sprite is legitimately taller than the
    // Commander overall — the pole is above their head, which is where the artist drew it —
    // while the body inside it is not.
    expect(FOLK_HEIGHT).toBeLessThan(2.1);
    expect(FOLK_HEIGHT).toBeGreaterThan(1.5);
  });

  it('never lets a correction run away with the whole figure', () => {
    // The bound the scale is loose about. A pole is worth a tenth of a body; anything past a
    // quarter is not a correction any more, it is a mistake in the table.
    for (const id of FOLK_IDS) {
      expect(folkHeight(id), id).toBeLessThanOrEqual(FOLK_HEIGHT * 1.25);
      expect(folkHeight(id), id).toBeGreaterThanOrEqual(FOLK_HEIGHT);
    }
  });
});

/** The committed table, rendered back into the generator's own output format. */
function renderCommitted(): string {
  const measured: Record<string, { sheet: string; box: { x: number; y: number; w: number; h: number } }> = {};
  for (const id of FOLK_IDS) measured[id] = { sheet: folkSheetOf(id), box: folkBox(id) };
  // Referenced so a reader can see the generated module is what is under test here, and so
  // an empty table cannot pass by rendering two identical nothings.
  expect(Object.keys(FOLK_BOXES)).toHaveLength(48);
  expect(GENERATED).toContain('folkContent.generated.ts');
  return render(measured);
}
