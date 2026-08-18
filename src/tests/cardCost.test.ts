import { describe, expect, it } from 'vitest';
import { scenario } from './scenario.js';
import { makeCtx } from '../core/engine/context.js';
import { affordable, canAfford, costBreakdown, spendResources } from '../core/engine/deck.js';
import { cardCostTotal } from '../core/types/cards.js';

/**
 * Two demands, not one price.
 *
 * `pips` is generic energy that Marrow may substitute for; `marrow` is strict and Pips
 * cannot touch it. The asymmetry is the whole design, so these are mostly about the
 * things that are NOT symmetrical.
 */
describe('paying for a card', () => {
  const pools = (pips: number, marrow: number) => {
    const state = scenario({});
    state.players.player.pips = pips;
    state.players.player.marrow = marrow;
    return state;
  };

  describe('the generic half', () => {
    it('lets Marrow stand in for Pips entirely, so ramp still works', () => {
      // The rule that keeps sacrifice viable: an empty bank is not an empty turn.
      const state = pools(0, 3);
      expect(canAfford(state, 'player', { pips: 3, marrow: 0 })).toBe(true);

      spendResources(makeCtx(state), 'player', { pips: 3, marrow: 0 });
      expect(state.players.player.marrow).toBe(0);
      expect(state.players.player.pips).toBe(0);
    });

    it('spends Marrow before Pips, because Marrow is the half that expires', () => {
      const state = pools(5, 2);
      spendResources(makeCtx(state), 'player', { pips: 3, marrow: 0 });
      expect(state.players.player.marrow, 'both Marrow spent first').toBe(0);
      expect(state.players.player.pips, 'only the remainder off the bank').toBe(4);
    });
  });

  describe('the strict half', () => {
    it('cannot be bought with Pips at any total', () => {
      // The point of the whole change: patience is not a substitute for volatility.
      const state = pools(8, 1);
      expect(canAfford(state, 'player', { pips: 0, marrow: 2 })).toBe(false);
      expect(affordable(999, 1, { pips: 0, marrow: 2 })).toBe(false);
    });

    it('is taken from Marrow before the generic half looks at what is left', () => {
      const state = pools(4, 3);
      spendResources(makeCtx(state), 'player', { pips: 2, marrow: 2 });
      // 2 Marrow strictly, then 1 Marrow left covers 1 of the 2 generic, Pips pay 1.
      expect(state.players.player.marrow).toBe(0);
      expect(state.players.player.pips).toBe(3);
    });

    it('leaves a card unaffordable when the Marrow is there but the total is not', () => {
      const state = pools(0, 2);
      // Strict half satisfied, generic half is not: nothing is left to pay the Pips.
      expect(canAfford(state, 'player', { pips: 1, marrow: 2 })).toBe(false);
    });

    it('refuses to spend anything when the cost cannot be met', () => {
      const state = pools(1, 0);
      const before = { ...state.players.player };
      expect(spendResources(makeCtx(state), 'player', { pips: 0, marrow: 1 })).toBe(false);
      expect(state.players.player.pips).toBe(before.pips);
      expect(state.players.player.marrow).toBe(before.marrow);
    });
  });

  describe('the breakdown shown before committing', () => {
    it('matches what spending actually does', () => {
      // The preview and the payment must not be able to disagree.
      for (const [pips, marrow] of [[8, 0], [4, 3], [0, 5], [2, 2], [6, 1]] as const) {
        for (const cost of [
          { pips: 3, marrow: 0 },
          { pips: 2, marrow: 2 },
          { pips: 0, marrow: 1 },
          { pips: 5, marrow: 0 },
        ]) {
          const state = pools(pips, marrow);
          if (!canAfford(state, 'player', cost)) continue;

          const predicted = costBreakdown(marrow, cost);
          spendResources(makeCtx(state), 'player', cost);

          expect(pips - state.players.player.pips, `pips for ${JSON.stringify(cost)}`).toBe(predicted.pips);
          expect(marrow - state.players.player.marrow, `marrow for ${JSON.stringify(cost)}`).toBe(predicted.marrow);
        }
      }
    });
  });

  it('totals both halves for rarity and sorting', () => {
    expect(cardCostTotal({ pips: 1, marrow: 2 })).toBe(3);
    expect(cardCostTotal({ pips: 3, marrow: 0 })).toBe(3);
  });
});
