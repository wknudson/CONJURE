/**
 * The ground clutter's scatter, asked of every area there is.
 *
 * The drawing is instanced and looked at in the browser; what can be wrong silently is where it
 * lies -- a tuft on a canal, a stone under a door's prompt, a different field of it every visit.
 */

import { describe, expect, it } from 'vitest';
import { AREAS } from '../district/areas/index.js';
import { CLUTTER, scatterClutter } from '../district/clutter.js';
import { tileAt } from '../district/map.js';

describe('the ground clutter', () => {
  for (const area of AREAS) {
    it(`${area.id}: lies only on ground that sheds it, clear of what it is kept off, the same every visit`, () => {
      const avoid = area.exits.map((e) => ({ x: e.x, z: e.z, r: 1.6 }));
      const a = scatterClutter(area, avoid);
      const b = scatterClutter(area, avoid);
      expect(b).toEqual(a);
      if (area.indoor) {
        expect(a, 'a room has no clutter').toHaveLength(0);
        return;
      }
      // Enough that a meadow has something in it, not so much that a map is a particle system.
      expect(a.length, area.id).toBeLessThan(9000);
      for (const p of a) {
        const t = tileAt(area, p.x, p.z);
        expect(t.walk, `${area.id}: ${p.kind} off the ground at ${p.x},${p.z}`).toBe(true);
        expect(CLUTTER[t.tex]?.some(([k]) => k === p.kind), `${area.id}: ${p.kind} on ${t.tex}`).toBe(true);
        for (const k of avoid) expect(Math.hypot(p.x - k.x, p.z - k.z)).toBeGreaterThan(k.r);
      }
    });
  }

  it('gives the grassy places something growing in them', () => {
    for (const id of ['chalk_verge', 'brays_hollow', 'millharrow']) {
      const area = AREAS.find((x) => x.id === id)!;
      const tufts = scatterClutter(area, []).filter((p) => p.kind === 'tuft');
      expect(tufts.length, id).toBeGreaterThan(30);
    }
  });
});
