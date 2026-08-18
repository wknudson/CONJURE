import { describe, expect, it } from 'vitest';
import { scenario, findUnit } from './scenario.js';
import { hasLoS, hasLoSToPortrait, supercoverLine } from '../core/engine/los.js';
import { legalAttacks } from '../core/engine/targeting.js';

/**
 * Occluders are obstacles, Guardian units, and 2x2 Behemoths — the doc's shadow-cone
 * casters. Melee (range 1-2) may only strike the portrait from the enemy's home rows;
 * ranged (3+) needs a clear straight or diagonal vector.
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
    const state = scenario({ obstacles: [{ at: { x: 2, y: 2 }, hp: 6 }] });
    expect(hasLoS(state, { x: 2, y: 4 }, { x: 2, y: 0 })).toBe(false);

    delete state.obstacles[Object.keys(state.obstacles)[0]!];
    expect(hasLoS(state, { x: 2, y: 4 }, { x: 2, y: 0 })).toBe(true);
  });

  describe('portrait targeting', () => {
    it('denies a melee unit the portrait from the neutral clash row', () => {
      const state = scenario({
        units: [{ def: 'scout_imp', side: 'player', at: { x: 2, y: 2 } }],
      });
      const imp = findUnit(state, 'scout_imp', 'player');
      const targets = legalAttacks(state, imp);
      expect(targets.some((t) => t.kind === 'portrait')).toBe(false);
    });

    it('allows a melee unit the portrait from the enemy home rows', () => {
      const state = scenario({
        units: [{ def: 'scout_imp', side: 'player', at: { x: 2, y: 0 } }],
      });
      const imp = findUnit(state, 'scout_imp', 'player');
      const targets = legalAttacks(state, imp);
      expect(targets.some((t) => t.kind === 'portrait' && t.side === 'enemy')).toBe(true);
    });

    it('lets a ranged unit reach the portrait through a clear lane', () => {
      const state = scenario({
        units: [{ def: 'marrow_wisp', side: 'player', at: { x: 2, y: 3 }, rangeMax: 4 }],
      });
      expect(hasLoSToPortrait(state, { x: 2, y: 3 }, 'enemy')).toBe(true);
    });

    it('denies a ranged shot at the portrait when a Guardian screens every vector', () => {
      // Guardians on the shooter's column and both diagonal exits.
      const state = scenario({
        units: [
          { def: 'marrow_wisp', side: 'player', at: { x: 2, y: 3 }, rangeMax: 4 },
          { def: 'grave_sentinel', side: 'enemy', at: { x: 2, y: 0 } },
          { def: 'grave_sentinel', side: 'enemy', at: { x: 1, y: 0 } },
          { def: 'grave_sentinel', side: 'enemy', at: { x: 3, y: 0 } },
        ],
      });
      expect(hasLoSToPortrait(state, { x: 2, y: 3 }, 'enemy')).toBe(false);
    });
  });
});
