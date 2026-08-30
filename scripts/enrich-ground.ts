/**
 * Breaks up the areas that are one texture repeated.
 *
 * Five of the nineteen were a single character over most of their grid — the Ashwood 73% of 780
 * cells, the Storm Shelf 72%, Weeping Stile 71%, the Bone Bastion and Rimefields 63% — against
 * Ashfall, where the commonest character is 29% and every one of its seven clears 8%. Legend
 * *size* hid this: the Rimefields already had six characters and still read as one snowfield,
 * because four of them were rare.
 *
 * The substitutions are spatial, not random. Sulphur blooms where a vent is; leaf litter lies
 * where the canopy is; drift piles along the edges the wind runs at. Scattering a second
 * texture uniformly would raise the numbers and change nothing you can see — the eye reads
 * noise as one surface.
 *
 *     npx tsx scripts/enrich-ground.ts          # report
 *     npx tsx scripts/enrich-ground.ts --write  # rewrite the grids
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { AREAS } from '../src/district/areas/index.js';
import type { AreaDef } from '../src/district/map.js';

/** Deterministic, so a rerun produces the same map. Seeded per area, not globally. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Rule {
  /** The character being replaced, and the one replacing it. */
  readonly from: string;
  readonly to: string;
  /** Given the grid and a cell, should it change? */
  readonly when: (g: readonly string[], c: number, r: number, rand: () => number) => boolean;
}

/** How many of `chars` sit in the eight cells around this one. */
const near = (g: readonly string[], c: number, r: number, chars: string, reach = 1): number => {
  let n = 0;
  for (let dr = -reach; dr <= reach; dr++) {
    for (let dc = -reach; dc <= reach; dc++) {
      if (!dr && !dc) continue;
      const ch = g[r + dr]?.[c + dc];
      if (ch && chars.includes(ch)) n++;
    }
  }
  return n;
};

const PLAN: Record<string, { seed: number; rules: Rule[] }> = {
  caldera: {
    seed: 101,
    rules: [
      // Sulphur blooms on the ash skirt around a vent, because that is what a vent does to the
      // ground it breathes on. Tied to `V` rather than sprinkled, so the patches have a cause.
      { from: 'a', to: 'f', when: (g, c, r) => near(g, c, r, 'V', 2) > 0 },
      // Crust across the middle of the floor: the sheets that set hard rather than shattering.
      // Away from the walls, so the skirt stays ash and the transition survives.
      // A smooth field, not a coin flip per tile.
      //
      // The first cut was `rand() < 0.55` over the floor, and a 55/45 random mix at tile scale
      // does not read as two surfaces — it reads as a **checkerboard**, because the eye finds
      // the 4-unit grid the moment neighbours alternate. Crust set in sheets, so it wants
      // patches several tiles across, which is what a low-frequency field gives.
      {
        from: 's',
        to: 'c',
        when: (g, c, r) =>
          near(g, c, r, 'R', 2) === 0 && Math.sin(c * 0.5) + Math.cos(r * 0.42) > 0.15,
      },
    ],
  },
  rimefields: {
    seed: 202,
    rules: [
      // Drift piles against anything standing, and along the top and bottom edges where the
      // wind runs the length of the field.
      { from: 'n', to: 'd', when: (g, c, r) => near(g, c, r, 'RI', 2) > 0 },
      { from: 'n', to: 'd', when: (g, _c, r, rand) => (r < 4 || r > g.length - 5) && rand() < 0.45 },
    ],
  },
  ashwood: {
    seed: 303,
    rules: [
      // Litter under the canopy, bare ground in the open. The largest grid in the game and 73%
      // one character; this is the rule that turns the clearings into clearings.
      { from: 'w', to: 'l', when: (g, c, r) => near(g, c, r, 'T') >= 3 },
      { from: 'w', to: 'l', when: (g, c, r, rand) => near(g, c, r, 'T') >= 1 && rand() < 0.6 },
    ],
  },
  bone_bastion: {
    seed: 404,
    rules: [
      // Turf over the mounds and nowhere else: bone dust is what lies between them.
      { from: 'o', to: 't', when: (g, c, r) => near(g, c, r, 'M', 2) > 0 },
      { from: '#', to: 't', when: (g, c, r) => near(g, c, r, 'M', 2) > 0 },
    ],
  },
  storm_shelf: {
    seed: 505,
    rules: [
      // Heath where the pylons are not. The scorched rock belongs to the footings; anything far
      // enough from one has had time to grow something back.
      // Reach 1, not 3. The ranks repeat every four rows and every seven columns, so at reach
      // 3 there is no cell on the Shelf that is not near a footing and the rule fired nowhere.
      // Same field treatment as the Caldera's crust, and for the same reason.
      {
        from: 'b',
        to: 'h',
        when: (g, c, r) =>
          near(g, c, r, 'P', 1) === 0 && Math.sin(c * 0.38) + Math.cos(r * 0.46) > 0.1,
      },
    ],
  },
};

const FILES: Record<string, string> = {
  caldera: 'caldera',
  rimefields: 'rimefields',
  ashwood: 'ashwood',
  bone_bastion: 'boneBastion',
  storm_shelf: 'stormShelf',
};

/** What share of the grid the commonest character holds. The number this exists to move. */
function dominance(grid: readonly string[]): { ch: string; share: number } {
  const n = new Map<string, number>();
  let total = 0;
  for (const row of grid) for (const ch of row) (n.set(ch, (n.get(ch) ?? 0) + 1), total++);
  const [ch, count] = [...n.entries()].sort((a, b) => b[1] - a[1])[0]!;
  return { ch, share: count / total };
}

function rewrite(area: AreaDef, plan: { seed: number; rules: Rule[] }): string[] {
  const grid = [...area.grid];
  for (const rule of plan.rules) {
    const rand = rng(plan.seed + rule.to.charCodeAt(0));
    for (let r = 0; r < grid.length; r++) {
      let row = '';
      for (let c = 0; c < grid[r]!.length; c++) {
        const ch = grid[r]![c]!;
        row += ch === rule.from && rule.when(grid, c, r, rand) ? rule.to : ch;
      }
      grid[r] = row;
    }
  }
  return grid;
}

const here = dirname(fileURLToPath(import.meta.url));
const write = process.argv.includes('--write');

for (const area of AREAS) {
  const plan = PLAN[area.id];
  if (!plan) continue;
  // Refuse to run a rule twice.
  //
  // The rules are stated as "some `w` becomes `l`", so applying one to an already-enriched grid
  // eats further into what is left — a second pass took the Ashwood from 49% to 45% and the
  // Storm Shelf from 48% to 37%, and a third would keep going. A rule's target character being
  // present is the signal that it has already run.
  //
  // Per rule, not per area: the Caldera has two, and skipping the crust because the sulphur had
  // already landed is how a retuned rule silently does nothing.
  const todo = plan.rules.filter((rule) => !area.grid.some((row) => row.includes(rule.to)));
  if (todo.length === 0) {
    console.log(`${area.id.padEnd(15)} already enriched, skipped`);
    continue;
  }

  const before = dominance(area.grid);
  const grid = rewrite(area, { seed: plan.seed, rules: todo });
  const after = dominance(grid);
  const chars = new Set(grid.join(''));
  console.log(
    `${area.id.padEnd(15)} top ${before.ch} ${(before.share * 100).toFixed(0)}% -> ` +
      `${after.ch} ${(after.share * 100).toFixed(0)}%   chars ${new Set(area.grid.join('')).size} -> ${chars.size}`,
  );
  if (!write) continue;

  const file = resolve(here, '..', 'src', 'district', 'areas', `${FILES[area.id]}.ts`);
  const src = readFileSync(file, 'utf8').split(/\r?\n/);

  // By position, not by value. These grids repeat rows — the Storm Shelf has a dozen identical
  // spans between its pylon ranks — so replacing the first match of a row string would rewrite
  // the wrong line and quietly reshape the map.
  const rowLines: number[] = [];
  let inGrid = false;
  for (let i = 0; i < src.length; i++) {
    if (/^const GRID: readonly string\[\] = \[/.test(src[i]!)) inGrid = true;
    else if (inGrid && /^\s*\]/.test(src[i]!)) break;
    else if (inGrid && /^\s*'[^']*',/.test(src[i]!)) rowLines.push(i);
  }
  if (rowLines.length !== grid.length) {
    throw new Error(`${area.id}: found ${rowLines.length} grid lines, expected ${grid.length}`);
  }
  rowLines.forEach((line, i) => {
    src[line] = src[line]!.replace(/'[^']*'/, `'${grid[i]}'`);
  });
  writeFileSync(file, src.join('\n'), 'utf8');
}
