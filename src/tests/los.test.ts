import { describe, expect, it } from 'vitest';
import { scenario, findUnit } from './scenario.js';
import { hasLoS, supercoverLine } from '../core/engine/los.js';
import { legalAttacks } from '../core/engine/targeting.js';

/**
 * Occluders are obstacles, Guardian units, and 2x2 Behemoths — the doc's shadow-cone
 * casters. Melee (range 1-2) needs no line at all; ranged (3+) needs a clear straight or
 * diagonal vector.
 */
describe('line of sight', () => {
  it('returns only the cells strictly between two points', () => {
    const line = supercoverLine({ x: 0, y: 0 }, { x: 0, y: 3 });
    expect(line).toEqual([
      { x: 0, y: 1 },
      { x: 0, y: 2 },
    ]);
  });

  it('lets a clear diagonal vector through', () => {
    const state = scenario({});
    expect(hasLoS(state, { x: 0, y: 0 }, { x: 3, y: 3 })).toBe(true);
  });

  it('is blocked by an obstacle sitting on the line', () => {
    const state = scenario({ obstacles: [{ at: { x: 2, y: 2 } }] });
    expect(hasLoS(state, { x: 2, y: 4 }, { x: 2, y: 0 })).toBe(false);
    // A parallel lane beside the pillar is still clear.
    expect(hasLoS(state, { x: 3, y: 4 }, { x: 3, y: 0 })).toBe(true);
  });

  it('is blocked by a Guardian unit but not by an ordinary minion', () => {
    const guarded = scenario({
      units: [{ def: 'grave_sentinel', side: 'enemy', at: { x: 2, y: 2 } }],
    });
    expect(hasLoS(guarded, { x: 2, y: 4 }, { x: 2, y: 0 })).toBe(false);

    const open = scenario({
      units: [{ def: 'scout_imp', side: 'enemy', at: { x: 2, y: 2 } }],
    });
    expect(hasLoS(open, { x: 2, y: 4 }, { x: 2, y: 0 })).toBe(true);
  });

  it('is blocked across both columns of a 2x2 Behemoth', () => {
    // Magma Brute at (1,2) covers (1,2),(2,2),(1,3),(2,3).
    const state = scenario({
      units: [{ def: 'magma_brute', side: 'enemy', at: { x: 1, y: 2 } }],
    });
    expect(hasLoS(state, { x: 1, y: 4 }, { x: 1, y: 0 })).toBe(false);
    expect(hasLoS(state, { x: 2, y: 4 }, { x: 2, y: 0 })).toBe(false);
    expect(hasLoS(state, { x: 4, y: 4 }, { x: 4, y: 0 })).toBe(true);
  });

  it('reopens line of sight once a barricade is destroyed', () => {
    const state = scenario({ obstacles: [{ at: { x: 2, y: 2 }, hp: 60 }] });
    expect(hasLoS(state, { x: 2, y: 4 }, { x: 2, y: 0 })).toBe(false);

    delete state.obstacles[Object.keys(state.obstacles)[0]!];
    expect(hasLoS(state, { x: 2, y: 4 }, { x: 2, y: 0 })).toBe(true);
  });

  /**
   * A Commander is not a thing that can be swung at. The Hero stands off the grid as the
   * Architect and has no body; the way to a Pact is its Companion's Bound Form, whose
   * wounds are redirected to the portrait by `dealDamage`.
   *
   * This used to be a reach rule — melee from the enemy's home rows, ranged down a clear
   * vector to a virtual portrait row — so the cases below are deliberately the ones that
   * *used to succeed*. If a portrait branch is ever put back behind a profile check, this
   * is what says so.
   */
  describe('portrait targeting', () => {
    it('offers no portrait to a melee unit, wherever it stands', () => {
      // Row 0 is the enemy's back row: standing here was the whole of the old requirement.
      for (const y of [0, 1, 2, 3, 4]) {
        const state = scenario({
          units: [{ def: 'scout_imp', side: 'player', at: { x: 2, y } }],
        });
        const imp = findUnit(state, 'scout_imp', 'player');
        expect(
          legalAttacks(state, imp).some((t) => t.kind === 'portrait'),
          `melee from row ${y}`,
        ).toBe(false);
      }
    });

    it('offers no portrait to a ranged unit down a wholly clear lane', () => {
      const state = scenario({
        units: [{ def: 'marrow_wisp', side: 'player', at: { x: 2, y: 3 }, rangeMax: 4 }],
      });
      const wisp = findUnit(state, 'marrow_wisp', 'player');
      expect(legalAttacks(state, wisp).some((t) => t.kind === 'portrait')).toBe(false);
    });
  });
});
