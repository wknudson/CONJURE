import { describe, expect, it } from 'vitest';
import { findUnit, run, scenario } from './scenario.js';
import { planTurn, NOVICE_AI } from '../core/ai/controller.js';
import { deepClone, stableStringify } from '../core/util/clone.js';

/** Puts the enemy AI on turn so planTurn operates on its side. */
function enemyTurn(state: ReturnType<typeof scenario>) {
  const s = deepClone(state);
  s.activeSide = 'enemy';
  s.phase = 'action';
  return s;
}

describe('novice AI', () => {
  it('always takes a lethal line when one exists', () => {
    // Player commander at 2 HP, enemy minion in the player home rows with 5 ATK.
    const state = enemyTurn(
      scenario({
        playerHp: 2,
        units: [{ def: 'scout_imp', side: 'enemy', at: { x: 2, y: 4 }, atk: 5 }],
      }),
    );

    const plan = planTurn(state, 'enemy', NOVICE_AI);
    const res = run(state, ...plan);

    expect(res.state.result).toBe('defeat');
  });

  it('never chooses an action that hands the player the win (Lethal Veto)', () => {
    // The enemy commander is at 1 HP. Its own Cinder Rune host sits adjacent to nothing
    // that would help; any self-destructive line must be rejected.
    const state = enemyTurn(
      scenario({
        enemyHp: 1,
        playerHp: 40,
        units: [
          { def: 'scout_imp', side: 'enemy', at: { x: 2, y: 1 } },
          { def: 'grave_sentinel', side: 'player', at: { x: 2, y: 3 }, hp: 10 },
        ],
      }),
    );

    const plan = planTurn(state, 'enemy', NOVICE_AI);
    const res = run(state, ...plan);

    // The AI may fail to win, but it must never lose on its own turn.
    expect(res.state.result).not.toBe('victory');
  });

  it('respects the per-turn action cap', () => {
    const state = enemyTurn(
      scenario({
        pips: 8,
        units: [
          { def: 'scout_imp', side: 'enemy', at: { x: 0, y: 1 } },
          { def: 'scout_imp', side: 'enemy', at: { x: 1, y: 1 } },
          { def: 'scout_imp', side: 'enemy', at: { x: 2, y: 1 } },
          { def: 'scout_imp', side: 'enemy', at: { x: 3, y: 1 } },
        ],
      }),
    );
    state.players.enemy.pips = 8;

    const plan = planTurn(state, 'enemy', NOVICE_AI);
    // Cap of 8 actions plus the trailing endTurn.
    expect(plan.length).toBeLessThanOrEqual(NOVICE_AI.actionCap + 1);
    expect(plan[plan.length - 1]!.type).toBe('endTurn');
  });

  it('is fully reproducible from a seed', () => {
    const base = enemyTurn(
      scenario({
        seed: 12345,
        units: [
          { def: 'scout_imp', side: 'enemy', at: { x: 1, y: 1 } },
          { def: 'grave_sentinel', side: 'enemy', at: { x: 3, y: 1 } },
          { def: 'scout_imp', side: 'player', at: { x: 2, y: 3 } },
        ],
      }),
    );

    const planA = planTurn(deepClone(base), 'enemy', NOVICE_AI);
    const planB = planTurn(deepClone(base), 'enemy', NOVICE_AI);

    expect(stableStringify(planA)).toBe(stableStringify(planB));

    // Replaying the same plan produces an identical resulting state.
    const resA = run(deepClone(base), ...planA);
    const resB = run(deepClone(base), ...planB);
    expect(stableStringify(resA.state)).toBe(stableStringify(resB.state));
  });

  it('advances toward the player rather than idling', () => {
    const state = enemyTurn(
      scenario({
        units: [{ def: 'scout_imp', side: 'enemy', at: { x: 2, y: 0 } }],
      }),
    );
    const imp = findUnit(state, 'scout_imp', 'enemy');

    const plan = planTurn(state, 'enemy', NOVICE_AI);
    const res = run(state, ...plan);

    // The enemy advances down the board (increasing y) toward the player's side.
    expect(res.state.units[imp.id]!.anchor.y).toBeGreaterThan(0);
  });

  it('prefers killing a Guardian over an equivalent plain minion', () => {
    const state = enemyTurn(
      scenario({
        units: [
          { def: 'scout_imp', side: 'enemy', at: { x: 2, y: 2 }, atk: 20 },
          // Both are one hit from death; the Guardian carries a +60 threat bonus.
          { def: 'grave_sentinel', side: 'player', at: { x: 2, y: 3 }, hp: 2 },
          { def: 'scout_imp', side: 'player', at: { x: 1, y: 2 }, hp: 2 },
        ],
      }),
    );
    const guardian = findUnit(state, 'grave_sentinel', 'player');

    const plan = planTurn(state, 'enemy', NOVICE_AI);
    const first = plan[0]!;

    expect(first.type).toBe('attack');
    if (first.type === 'attack') {
      expect(first.target).toEqual({ kind: 'unit', id: guardian.id });
    }
  });
});
