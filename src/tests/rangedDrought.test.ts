import { describe, expect, it } from 'vitest';
import { CARDS } from '../core/data/cards/index.js';
import { PLAYABLE_SCHOOLS, minionPool, rosterUnlocksFor, startingRosterFor } from '../core/data/pools.js';
import { rosterPointsOf, rosterPool } from '../core/data/roster.js';
import { channelYieldFor } from '../core/data/economy.js';
import { startingCollection } from '../core/data/collection.js';

/**
 * The drought. Four of the eight schools had no 3-point body, and the card-draw Channel
 * belongs to the 3-point class alone, so five of the six opening warbands could never sit
 * a body down for a card; and one fieldable Behemoth existed in the whole game. These hold
 * both fixed, and hold the derivation that hands out the opening lines to what it now
 * promises.
 */
const isRanged = (id: string): boolean => rosterPointsOf(CARDS[id]!) === 3;

describe('every school can draw', () => {
  it('gives each playable school at least one 3-point body that Sights for a card', () => {
    for (const school of PLAYABLE_SCHOOLS) {
      const ranged = minionPool(school).filter((d) => rosterPointsOf(d) === 3);
      expect(ranged.length, `${school} has no ranged body`).toBeGreaterThan(0);
      for (const d of ranged) expect(channelYieldFor(d)?.draw, `${d.id} does not draw`).toBe(1);
    }
  });

  it('puts a ranged body in every opening warband', () => {
    for (const school of PLAYABLE_SCHOOLS) {
      const line = startingRosterFor(school);
      expect(line.some(isRanged), `${school} opens with no way to draw: ${line.join(', ')}`).toBe(true);
      // And still a body of its own beyond the ranged one.
      const own = line.filter((id) => CARDS[id]!.school === school);
      expect(own.length, `${school} line: ${line.join(', ')}`).toBeGreaterThanOrEqual(2);
    }
  });

  it('unlocks the colourless ranged bodies for a character who has caught nothing', () => {
    const fresh = rosterUnlocksFor([]);
    expect(fresh).toContain('hedge_slinger');
    expect(fresh).toContain('glass_arbalest');
    // And a new collection carries them, since no fight teaches a colourless card.
    const unlocked = startingCollection().unlocked;
    expect(unlocked).toContain('hedge_slinger');
    expect(unlocked).toContain('glass_arbalest');
  });
});

describe('two Behemoths', () => {
  it('ships at least two fieldable 2x2 bodies, in different schools', () => {
    const big = rosterPool().filter((d) => d.unit?.footprint === 2);
    expect(big.map((d) => d.id)).toContain('magma_brute');
    expect(big.map((d) => d.id)).toContain('bastion_golem');
    expect(new Set(big.map((d) => d.school)).size).toBeGreaterThanOrEqual(2);
    for (const d of big) {
      expect(rosterPointsOf(d), `${d.id} is priced as a Behemoth`).toBe(6);
      expect(channelYieldFor(d), `${d.id} is too big to sit down`).toBeNull();
    }
  });
});
