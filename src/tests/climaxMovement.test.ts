import { describe, expect, it } from 'vitest';
import { addUnit, damageTo, eventsOf, scenario } from './scenario.js';
import { applyCommand } from '../core/engine/engine.js';
import { OVERLOAD_PHASE_DAMAGE } from '../core/engine/engine.js';
import { legalMoves, licenseFor } from '../core/engine/movement.js';
import { pushUnit } from '../core/engine/displacement.js';
import { makeCtx } from '../core/engine/context.js';
import { climaxTraitOf } from '../core/engine/growth.js';
import { checkInvariants } from './replay.js';
import type { GameState } from '../core/types/state.js';
import type { Unit } from '../core/types/units.js';

/**
 * The two Climax traits that bend movement.
 *
 * Both were deliberately deferred when the Aura system landed, because they are the only
 * ones that touch pathing rather than a stat. They bend the placement rule in different
 * directions — Overload ignores bodies, Heavy Footprint ignores walls — so they are two
 * independent flags rather than one "is special" case.
 */

/** A unit wearing a fully-grown Aura, without waiting three rounds for it. */
function climaxed(state: GameState, unitId: string, aura: string): Unit {
  const unit = state.units[unitId]!;
  unit.aura = { defId: aura, stacks: 3 };
  return unit;
}

const board = () => scenario({ width: 7, height: 8, playerHp: 500, enemyHp: 500 });

describe('Overload: it stops going around things', () => {
  it('paths straight through a body that would otherwise block it', () => {
    const state = board();
    const mover = addUnit(state, { def: 'voltaic_hound', side: 'player', at: { x: 3, y: 5 }, fresh: false });
    // A wall of one, directly in the way.
    addUnit(state, { def: 'scout_imp', side: 'enemy', at: { x: 3, y: 4 } });

    // Measured on the route rather than the destination: (3,3) is reachable either way,
    // because an ordinary unit walks around. What Climax buys is the straight line.
    const routes = (st: GameState) =>
      legalMoves(st, st.units[mover.id]!).some((m) => m.path.some((c) => c.x === 3 && c.y === 4));

    expect(routes(state), 'blocked before Climax').toBe(false);

    climaxed(state, mover.id, 'aura_static_charge');
    expect(routes(state), 'straight through it after').toBe(true);
  });

  it('still may not stop inside a body', () => {
    // Passing through is not the same as standing in. Two units on a tile is a state the
    // whole engine assumes cannot happen.
    const state = board();
    const mover = addUnit(state, { def: 'voltaic_hound', side: 'player', at: { x: 3, y: 5 }, fresh: false });
    addUnit(state, { def: 'scout_imp', side: 'enemy', at: { x: 3, y: 4 } });
    climaxed(state, mover.id, 'aura_static_charge');

    const moves = legalMoves(state, state.units[mover.id]!);
    expect(moves.some((m) => m.to.x === 3 && m.to.y === 4)).toBe(false);
  });

  it('deals 1 unblockable damage to each enemy it passes through', () => {
    const state = board();
    const mover = addUnit(state, { def: 'voltaic_hound', side: 'player', at: { x: 3, y: 5 }, fresh: false });
    const victim = addUnit(state, { def: 'scout_imp', side: 'enemy', at: { x: 3, y: 4 }, hp: 9 });
    climaxed(state, mover.id, 'aura_static_charge');

    const res = applyCommand(state, { type: 'moveUnit', unit: mover.id, to: { x: 3, y: 3 } });

    expect(damageTo(res.events, victim.id)).toBe(OVERLOAD_PHASE_DAMAGE);
    expect(res.state.units[mover.id]!.anchor).toEqual({ x: 3, y: 3 });
  });

  it('cuts through armor, which is what unblockable means', () => {
    const state = board();
    const mover = addUnit(state, { def: 'voltaic_hound', side: 'player', at: { x: 3, y: 5 }, fresh: false });
    const victim = addUnit(state, { def: 'scout_imp', side: 'enemy', at: { x: 3, y: 4 }, hp: 9 });
    state.units[victim.id]!.armor = 10;
    const hpBefore = state.units[victim.id]!.hp;
    climaxed(state, mover.id, 'aura_static_charge');

    const res = applyCommand(state, { type: 'moveUnit', unit: mover.id, to: { x: 3, y: 3 } });

    expect(res.state.units[victim.id]!.hp).toBe(hpBefore - OVERLOAD_PHASE_DAMAGE);
    expect(res.state.units[victim.id]!.armor, 'and the plate is not spent on it').toBe(10);
  });

  it('bills a body once, however many of its cells the route crossed', () => {
    const state = board();
    const mover = addUnit(state, { def: 'voltaic_hound', side: 'player', at: { x: 3, y: 6 }, fresh: false });
    const victim = addUnit(state, { def: 'scout_imp', side: 'enemy', at: { x: 3, y: 5 }, hp: 9 });
    climaxed(state, mover.id, 'aura_static_charge');

    const res = applyCommand(state, { type: 'moveUnit', unit: mover.id, to: { x: 3, y: 4 } });

    expect(damageTo(res.events, victim.id)).toBe(OVERLOAD_PHASE_DAMAGE);
  });

  it('walks through its own line without hurting it', () => {
    // A manoeuvre, not an attack.
    const state = board();
    const mover = addUnit(state, { def: 'voltaic_hound', side: 'player', at: { x: 3, y: 6 }, fresh: false });
    const ally = addUnit(state, { def: 'scout_imp', side: 'player', at: { x: 3, y: 5 } });
    climaxed(state, mover.id, 'aura_static_charge');

    const res = applyCommand(state, { type: 'moveUnit', unit: mover.id, to: { x: 3, y: 4 } });

    expect(damageTo(res.events, ally.id)).toBe(0);
    expect(res.state.units[ally.id]!.hp).toBe(state.units[ally.id]!.hp);
  });

  it('does nothing of the sort before the Aura has climaxed', () => {
    const state = board();
    const mover = addUnit(state, { def: 'voltaic_hound', side: 'player', at: { x: 3, y: 5 }, fresh: false });
    state.units[mover.id]!.aura = { defId: 'aura_static_charge', stacks: 2 };
    addUnit(state, { def: 'scout_imp', side: 'enemy', at: { x: 3, y: 4 } });

    expect(climaxTraitOf(state.units[mover.id]!)).toBeUndefined();
    expect(licenseFor(state.units[mover.id]!).throughUnits).toBe(false);
    // Asserted on the *route*, not the destination: (3,3) is reachable either way, because
    // an ordinary unit simply walks around the blocker. What Climax changes is whether it
    // may go straight through, so that is what the test has to look at.
    const crossed = legalMoves(state, state.units[mover.id]!).some((m) =>
      m.path.some((c) => c.x === 3 && c.y === 4),
    );
    expect(crossed, 'an unclimaxed body never routes through a body').toBe(false);
  });
});

describe('Heavy Footprint: nothing shoves it, and walls do not stop it', () => {
  it('is immune to a shove', () => {
    const state = board();
    const mover = addUnit(state, { def: 'slag_iron_golem', side: 'player', at: { x: 3, y: 5 }, fresh: false });
    climaxed(state, mover.id, 'aura_petrifying_mantle');
    const at = { ...state.units[mover.id]!.anchor };

    const ctx = makeCtx(state);
    const result = pushUnit(ctx, state.units[mover.id]!, { x: 0, y: -1 }, 2);

    expect(state.units[mover.id]!.anchor).toEqual(at);
    expect(result.path, 'a blocked displacement reports a zero-length path').toHaveLength(1);
  });

  it('is immune to a pull, and to a current, by the same one rule', () => {
    // All displacement goes through one chokepoint, so a single check covers every source.
    const state = board();
    const mover = addUnit(state, { def: 'slag_iron_golem', side: 'player', at: { x: 3, y: 5 }, fresh: false });
    climaxed(state, mover.id, 'aura_petrifying_mantle');
    const at = { ...state.units[mover.id]!.anchor };

    const ctx = makeCtx(state);
    pushUnit(ctx, state.units[mover.id]!, { x: 0, y: 1 }, 1);
    pushUnit(ctx, state.units[mover.id]!, { x: 1, y: 0 }, 1);

    expect(state.units[mover.id]!.anchor).toEqual(at);
  });

  it('is shoved perfectly well before the Aura climaxes', () => {
    const state = board();
    const mover = addUnit(state, { def: 'slag_iron_golem', side: 'player', at: { x: 3, y: 5 }, fresh: false });
    state.units[mover.id]!.aura = { defId: 'aura_petrifying_mantle', stacks: 2 };

    const ctx = makeCtx(state);
    pushUnit(ctx, state.units[mover.id]!, { x: 0, y: -1 }, 1);

    expect(state.units[mover.id]!.anchor).toEqual({ x: 3, y: 4 });
  });

  it('shatters a destructible obstacle by walking into it, and takes the tile', () => {
    const state = scenario({
      width: 7,
      height: 8,
      playerHp: 500,
      enemyHp: 500,
      obstacles: [{ at: { x: 3, y: 4 } }],
    });
    const mover = addUnit(state, { def: 'slag_iron_golem', side: 'player', at: { x: 3, y: 5 }, fresh: false });

    const plain = legalMoves(state, state.units[mover.id]!);
    expect(plain.some((m) => m.to.x === 3 && m.to.y === 4), 'walled off before Climax').toBe(false);

    climaxed(state, mover.id, 'aura_petrifying_mantle');
    const res = applyCommand(state, { type: 'moveUnit', unit: mover.id, to: { x: 3, y: 4 } });

    expect(eventsOf(res.events, 'obstacleDestroyed')).toHaveLength(1);
    expect(res.state.units[mover.id]!.anchor).toEqual({ x: 3, y: 4 });
    expect(Object.values(res.state.obstacles).some((o) => o.anchor.y === 4)).toBe(false);
    expect(checkInvariants(res.state, 'after shattering a wall')).toEqual([]);
  });

  it('does not stop at the wall — it keeps going past it', () => {
    // "It does not stop" is the whole trait. A body that broke the wall and then stood in
    // the rubble would be a slower version of attacking it.
    const state = scenario({
      width: 7,
      height: 8,
      playerHp: 500,
      enemyHp: 500,
      obstacles: [{ at: { x: 3, y: 4 } }],
    });
    const mover = addUnit(state, { def: 'voltaic_hound', side: 'player', at: { x: 3, y: 5 }, fresh: false });
    climaxed(state, mover.id, 'aura_petrifying_mantle');

    const res = applyCommand(state, { type: 'moveUnit', unit: mover.id, to: { x: 3, y: 3 } });

    expect(res.state.units[mover.id]!.anchor).toEqual({ x: 3, y: 3 });
    expect(eventsOf(res.events, 'obstacleDestroyed')).toHaveLength(1);
  });

  it('leaves bodies alone: it breaks walls, not people', () => {
    const state = board();
    const mover = addUnit(state, { def: 'slag_iron_golem', side: 'player', at: { x: 3, y: 5 }, fresh: false });
    addUnit(state, { def: 'scout_imp', side: 'enemy', at: { x: 3, y: 4 } });
    climaxed(state, mover.id, 'aura_petrifying_mantle');

    expect(licenseFor(state.units[mover.id]!).throughUnits).toBe(false);
    const crossed = legalMoves(state, state.units[mover.id]!).some((m) =>
      m.path.some((c) => c.x === 3 && c.y === 4),
    );
    expect(crossed, 'a wall-breaker still goes around people').toBe(false);
  });
});

describe('the licence, as data', () => {
  it('gives each trait exactly the one exception it is meant to have', () => {
    const state = board();
    const u = addUnit(state, { def: 'slag_iron_golem', side: 'player', at: { x: 3, y: 5 }, fresh: false });

    climaxed(state, u.id, 'aura_static_charge');
    expect(licenseFor(state.units[u.id]!)).toEqual({ throughUnits: true, throughObstacles: false });

    climaxed(state, u.id, 'aura_petrifying_mantle');
    expect(licenseFor(state.units[u.id]!)).toEqual({ throughUnits: false, throughObstacles: true });

    delete state.units[u.id]!.aura;
    expect(licenseFor(state.units[u.id]!)).toEqual({ throughUnits: false, throughObstacles: false });
  });
});
