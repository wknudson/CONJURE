import { describe, expect, it } from 'vitest';
import { findUnit, run, scenario } from './scenario.js';
import { GROWTH_CAP, GROWTH_CAP_BEHEMOTH } from '../core/engine/growth.js';

/**
 * A Behemoth's Growth ceiling is a real number that a real game reaches. The cap's value
 * and its survival through a save were tested; that a 2x2 body actually grows to it and
 * then stops was not — only the 1x1 case ran rounds. This runs them.
 *
 * The Pacifist Lockout would end a hundred rounds of nobody swinging long before the
 * ceiling, so the stall counter is reset each round: this is a test of Growth, not of the
 * lockout, which has its own.
 */
describe('a Behemoth grows to its own ceiling, and no further', () => {
  it('reaches GROWTH_CAP_BEHEMOTH and stops there', () => {
    const state = scenario({
      units: [{ def: 'magma_brute', side: 'enemy', at: { x: 1, y: 0 } }],
    });
    const brute = findUnit(state, 'magma_brute', 'enemy');
    expect(brute.footprint).toBe(2);

    let cur = state;
    let last = -1;
    // One more than the ceiling, so the last round proves the stop rather than the climb.
    for (let rounds = 0; rounds <= GROWTH_CAP_BEHEMOTH + 1; rounds++) {
      cur.stalledRounds = 0;
      cur.engagedThisRound = true;
      cur = run(cur, { type: 'endTurn' }, { type: 'endTurn' }).state;
      expect(cur.result, `the fight must still be running at round ${rounds}`).toBeUndefined();
      const now = cur.units[brute.id]!.escalation;
      if (now === last && now > 0) break;
      last = now;
    }
    expect(cur.units[brute.id]!.escalation).toBe(GROWTH_CAP_BEHEMOTH);
    expect(GROWTH_CAP_BEHEMOTH, 'a Behemoth outgrows a footman').toBeGreaterThan(GROWTH_CAP);
  });
});
