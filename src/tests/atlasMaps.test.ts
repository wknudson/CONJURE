/**
 * The atlas's maps, held to the area files they are drawn from.
 *
 * `scripts/atlas-maps.ts` writes every outdoor place's grid, legend and furniture into the atlas
 * between marker comments. This draws them again and asks whether the atlas still says the same:
 * when an area is edited and the atlas is not, this is what says so, and the fix is to run the
 * script, not to edit the atlas by hand.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { AREAS } from '../district/areas/index.js';
import { ATLAS_REGIONS, applyAtlasMaps, renderAtlasMaps } from '../../scripts/atlas-maps.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const ATLAS = resolve(ROOT, 'docs', '12_atlas_of_azo.md');

describe('the atlas maps', () => {
  it('draw every place under the sky, once, and no room', () => {
    const drawn = ATLAS_REGIONS.flatMap((r) => r.ids);
    expect(new Set(drawn).size, 'a place drawn twice').toBe(drawn.length);
    const outdoor = AREAS.filter((a) => !a.indoor).map((a) => a.id);
    expect([...drawn].sort()).toEqual([...outdoor].sort());
  });

  it('say what the area files say (if not: npx tsx scripts/atlas-maps.ts)', () => {
    const atlas = readFileSync(ATLAS, 'utf8');
    const drawn = applyAtlasMaps(atlas, renderAtlasMaps(ROOT));
    expect(drawn === atlas, 'the atlas maps are out of date: run npx tsx scripts/atlas-maps.ts').toBe(true);
  });
});
