import { describe, expect, it } from 'vitest';
import { addUnit, findUnit, scenario } from './scenario.js';
import { applyCommand } from '../core/engine/engine.js';
import { legalMoves, stepCost, tileMoveCost, RUBBLE_MOVE_COST } from '../core/engine/movement.js';
import { hasLoS } from '../core/engine/los.js';
import { spawnObstacle, spawnHazardAt } from './helpers.js';
import { coordKey } from '../contract/ids.js';
import type { GameState } from '../core/types/state.js';

/**
 * Rubble: what a broken wall leaves behind.
 *
 * Knocking a wall down opens a route without making it a fast one, which is the point —
 * the lane is available, and taking it still costs something.
 */

const costTo = (state: GameState, unitId: string, at: { x: number; y: number }) =>
  legalMoves(state, state.units[unitId]!).find((m) => m.to.x === at.x && m.to.y === at.y)?.cost;

describe('what breaking a wall leaves', () => {
  it('leaves rubble where masonry stood', () => {
    const state = scenario({ width: 6, height: 8 });
    const brute = addUnit(state, { def: 'magma_brute', side: 'player', at: { x: 2, y: 5 } });
    const wall = spawnObstacle(state, 'stone_barricade', { x: 2, y: 4 });
    state.obstacles[wall]!.hp = 1; // one blow away from falling

    const res = applyCommand(state, {
      type: 'attack',
      attacker: brute.id,
      target: { kind: 'obstacle', id: wall },
    });

    expect(res.state.obstacles[wall]).toBeUndefined();
    expect(res.state.hazards[coordKey({ x: 2, y: 4 })]?.kind).toBe('rubble');
  });

  it('leaves nothing behind when a geode shatters', () => {
    // A geode is not masonry. Nothing worth walking around survives it.
    const state = scenario({ width: 6, height: 8 });
    const imp = addUnit(state, { def: 'scout_imp', side: 'player', at: { x: 2, y: 5 } });
    const geode = spawnObstacle(state, 'spark_geode', { x: 2, y: 4 });

    const res = applyCommand(state, {
      type: 'attack',
      attacker: imp.id,
      target: { kind: 'obstacle', id: geode },
    });

    expect(res.state.hazards[coordKey({ x: 2, y: 4 })]).toBeUndefined();
  });
});

describe('crossing it', () => {
  it('costs double to enter', () => {
    const state = scenario({ width: 6, height: 8 });
    const imp = addUnit(state, { def: 'scout_imp', side: 'player', at: { x: 2, y: 5 } });
    spawnHazardAt(state, { x: 2, y: 4 }, 'rubble');

    expect(tileMoveCost(state, { x: 2, y: 4 })).toBe(RUBBLE_MOVE_COST);
    expect(costTo(state, imp.id, { x: 2, y: 4 })).toBe(RUBBLE_MOVE_COST);
  });

  it('can put a tile out of reach that open ground would not', () => {
    // A Rimeguard walks one tile a turn, so a single stretch of rubble stops it dead.
    const state = scenario({ width: 6, height: 8 });
    const slow = addUnit(state, { def: 'rimeguard', side: 'player', at: { x: 2, y: 5 } });
    expect(costTo(state, slow.id, { x: 2, y: 4 })).toBe(1);

    spawnHazardAt(state, { x: 2, y: 4 }, 'rubble');
    expect(costTo(state, slow.id, { x: 2, y: 4 })).toBeUndefined();
  });

  it('finds the longer way round when it is cheaper', () => {
    // The whole reason the pathfinder had to start relaxing: two steps of open ground
    // beat one step of rubble, and a search that took the first arrival would have
    // reported the far tile as costing 2 by the short road and never looked again.
    const state = scenario({ width: 6, height: 8 });
    const imp = addUnit(state, { def: 'scout_imp', side: 'player', at: { x: 2, y: 6 } });
    spawnHazardAt(state, { x: 2, y: 5 }, 'rubble');
    spawnHazardAt(state, { x: 2, y: 4 }, 'rubble');

    // Straight up the middle is 2 + 2 = 4. Around the side is 1 + 1 + 1 = 3.
    const cost = costTo(state, imp.id, { x: 2, y: 4 });
    expect(cost).toBe(3);
  });

  it('charges a Behemoth for the worst ground under it', () => {
    // Tested through stepCost rather than a real move: the only 2x2 in the game walks
    // one tile a turn, so it could never afford a rubble step to demonstrate the rule.
    const state = scenario({ width: 6, height: 8 });
    const brute = addUnit(state, { def: 'magma_brute', side: 'player', at: { x: 1, y: 5 } });
    const unit = state.units[brute.id]!;

    expect(stepCost(state, unit, { x: 1, y: 2 })).toBe(1);

    // One foot of the 2x2 lands on rubble; the other three are clear.
    spawnHazardAt(state, { x: 2, y: 3 }, 'rubble');
    expect(stepCost(state, unit, { x: 1, y: 2 })).toBe(RUBBLE_MOVE_COST);
  });
});

describe('what rubble is not', () => {
  it('does not block sight', () => {
    const state = scenario({ width: 6, height: 8 });
    spawnHazardAt(state, { x: 2, y: 4 }, 'rubble');
    expect(hasLoS(state, { x: 2, y: 6 }, { x: 2, y: 2 })).toBe(true);
  });

  it('does not stop a unit standing on it', () => {
    const state = scenario({ width: 6, height: 8 });
    const imp = addUnit(state, { def: 'scout_imp', side: 'player', at: { x: 2, y: 5 } });
    spawnHazardAt(state, { x: 2, y: 4 }, 'rubble');

    const res = applyCommand(state, { type: 'moveUnit', unit: imp.id, to: { x: 2, y: 4 } });
    expect(res.state.units[imp.id]!.anchor).toEqual({ x: 2, y: 4 });
  });

  it('never ages away', () => {
    const state = scenario({ width: 6, height: 8 });
    spawnHazardAt(state, { x: 2, y: 4 }, 'rubble');

    let cur = state;
    for (let i = 0; i < 6; i++) {
      cur = applyCommand(cur, { type: 'endTurn' }).state;
    }

    expect(cur.hazards[coordKey({ x: 2, y: 4 })]?.kind).toBe('rubble');
  });

  it('is stored without Infinity, so the state still hashes', () => {
    const state = scenario({ width: 6, height: 8 });
    spawnHazardAt(state, { x: 2, y: 4 }, 'rubble');
    const hazard = state.hazards[coordKey({ x: 2, y: 4 })]!;

    expect(hazard.permanent).toBe(true);
    expect(Number.isFinite(hazard.turns)).toBe(true);
  });
});

describe('fog still behaves', () => {
  it('ages and clears as before', () => {
    const state = scenario({ width: 6, height: 8 });
    spawnHazardAt(state, { x: 2, y: 4 }, 'steam_fog', 2);
    expect(hasLoS(state, { x: 2, y: 6 }, { x: 2, y: 2 })).toBe(false);

    let cur = state;
    for (let i = 0; i < 6; i++) {
      cur = applyCommand(cur, { type: 'endTurn' }).state;
    }

    expect(cur.hazards[coordKey({ x: 2, y: 4 })]).toBeUndefined();
  });
});

// Keeps findUnit referenced for the shared import surface.
void findUnit;
