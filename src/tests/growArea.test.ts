/**
 * `scripts/grow-area.ts`, asked about every area file there is.
 *
 * The script's promise is that nothing moves: a grid padded evenly keeps its middle, so every
 * absolute coordinate in every registry still names the tile it was written for, and the only
 * things that do move are exits written against the edge -- which carry their neighbour's
 * arrival with them. Run here on the real files at a small pad, in memory, so a file that has
 * drifted out of the shape the script can read fails now rather than at the start of an area
 * pass.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { AREAS, areaById } from '../district/areas/index.js';
import { TILE } from '../district/map.js';
import { areaFiles, growAreaSource, moveArrival, padGrid } from '../../scripts/grow-area.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const FILES = areaFiles(ROOT);
const KC = 3;
const KR = 2;

/** The numbers passed to one tile helper, in the order they appear outside the grid. */
const helperArgs = (text: string, name: string): number[] =>
  [...text.matchAll(new RegExp(`\\b${name}\\(\\s*(-?[0-9.]+)\\s*\\)`, 'g'))].map((m) => Number(m[1]));

describe('grow-area', () => {
  it('knows the file of every area', () => {
    for (const a of AREAS) expect(FILES.get(a.id), a.id).toBeDefined();
  });

  it('pads a grid without moving a single tile', () => {
    for (const a of AREAS) {
      const g = padGrid(a.grid, KC, KR);
      expect(g.length, a.id).toBe(a.rows + 2 * KR);
      for (const row of g) expect(row.length, a.id).toBe(a.cols + 2 * KC);
      for (let r = 0; r < a.rows; r++) {
        expect(g[r + KR]!.slice(KC, KC + a.cols), `${a.id} row ${r}`).toBe(a.grid[r]);
      }
      // The ring is the edge repeated outward: a road that ran off the old edge still does.
      for (let r = 0; r < a.rows; r++) {
        expect(g[r + KR]![0], `${a.id} row ${r} west`).toBe(a.grid[r]![0]);
        expect(g[r + KR]![a.cols + 2 * KC - 1], `${a.id} row ${r} east`).toBe(a.grid[r]![a.cols - 1]);
      }
    }
  });

  for (const area of AREAS) {
    describe(area.id, () => {
      const src = readFileSync(FILES.get(area.id)!, 'utf8');
      const out = growAreaSource(src, area, KC, KR);

      it('writes the padded grid back as literal rows', () => {
        const rows = [...out.text.matchAll(/^ {2}'([^']*)', \/\/ *\d+/gm)].map((m) => m[1]);
        expect(rows).toEqual(padGrid(area.grid, KC, KR));
      });

      it('shifts every tile-counting call by the padding, and nothing else', () => {
        const before = { x: helperArgs(src, 'xOfCol'), z: helperArgs(src, 'zOfRow') };
        const after = { x: helperArgs(out.text, 'xOfCol'), z: helperArgs(out.text, 'zOfRow') };
        expect(after.x).toEqual(before.x.map((n) => n + KC));
        expect(after.z).toEqual(before.z.map((n) => n + KR));
      });

      it('widens the canal by the rows the north side grew', () => {
        if (!area.props.waterRows) return;
        const m = /^const WATER_ROWS = (\d+);/m.exec(out.text);
        expect(Number(m?.[1])).toBe(area.props.waterRows + KR);
      });

      it('leaves no row constant declared and unread', () => {
        for (const n of out.notes) {
          const id = /removed row constant (\w+)/.exec(n)?.[1];
          if (id) expect(new RegExp(`\\b${id}\\b`).test(out.text), id).toBe(false);
        }
      });

      it('moves only exits on the edge, out to the new edge, carrying the arrival with them', () => {
        const halfX = area.halfX + KC * TILE;
        const halfZ = area.halfZ + KR * TILE;
        for (const m of out.moved) {
          const ours = area.exits.filter((e) => e.to === m.to)[m.index]!;
          const x = ours.x + m.dx;
          const z = ours.z + m.dz;
          // On the new edge: within a tile of it on the axis that moved.
          if (m.dx) expect(halfX - Math.abs(x), `${area.id} -> ${m.to}`).toBeLessThanOrEqual(TILE);
          if (m.dz) expect(halfZ - Math.abs(z), `${area.id} -> ${m.to}`).toBeLessThanOrEqual(TILE);

          const neighbour = areaById(m.to)!;
          const moved = moveArrival(readFileSync(FILES.get(neighbour.id)!, 'utf8'), neighbour, area, m);
          // The arrival keeps the same place relative to the exit it lands beside.
          expect(moved.to.x - moved.from.x).toBe(m.dx);
          expect(moved.to.z - moved.from.z).toBe(m.dz);
        }
      });
    });
  }
});
