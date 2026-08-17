import { describe, expect, it } from 'vitest';
import { addUnit, findUnit, scenario } from './scenario.js';
import { applyCommand } from '../core/engine/engine.js';
import { legalAttacks, canStrike } from '../core/engine/targeting.js';
import { legalMoves, canMove, isSpent, canAttack } from '../core/engine/movement.js';
import { spawnObstacle } from '../core/engine/spawn.js';
import { makeCtx } from '../core/engine/context.js';
import { CARDS } from '../core/data/cards/index.js';
import { stableStringify } from './replay.js';
import type { GameState } from '../core/types/state.js';

/**
 * The three ways of fighting at range.
 *
 * Reach on a big board is just strength unless it costs something specific. Each of
 * these buys its range with a weakness the player can see and play around, and these
 * tests are about the weakness far more than the reach.
 */

function board(): GameState {
  return scenario({ width: 8, height: 8 });
}

const canHit = (state: GameState, attackerId: string, targetId: string): boolean =>
  legalAttacks(state, state.units[attackerId]!).some(
    (t) => t.kind === 'unit' && t.id === targetId,
  );

describe('the marksman fires down lines', () => {
  it('reaches clear across the board along a file', () => {
    const state = board();
    const shooter = addUnit(state, { def: 'longshot_stalker', side: 'player', at: { x: 3, y: 7 } });
    const far = addUnit(state, { def: 'scout_imp', side: 'enemy', at: { x: 3, y: 0 } });

    expect(canHit(state, shooter.id, far.id)).toBe(true);
  });

  it('reaches along a diagonal too', () => {
    const state = board();
    const shooter = addUnit(state, { def: 'longshot_stalker', side: 'player', at: { x: 1, y: 6 } });
    const far = addUnit(state, { def: 'scout_imp', side: 'enemy', at: { x: 5, y: 2 } });

    expect(canHit(state, shooter.id, far.id)).toBe(true);
  });

  it('cannot touch anything off the line, however close', () => {
    // A single sidestep is the whole counter, and it works at any distance.
    const state = board();
    const shooter = addUnit(state, { def: 'longshot_stalker', side: 'player', at: { x: 3, y: 7 } });
    const offset = addUnit(state, { def: 'scout_imp', side: 'enemy', at: { x: 5, y: 4 } });

    expect(canHit(state, shooter.id, offset.id)).toBe(false);
  });

  it('is stopped by a body standing on the line', () => {
    const state = board();
    const shooter = addUnit(state, { def: 'longshot_stalker', side: 'player', at: { x: 3, y: 7 } });
    const far = addUnit(state, { def: 'scout_imp', side: 'enemy', at: { x: 3, y: 0 } });
    expect(canHit(state, shooter.id, far.id)).toBe(true);

    const ctx = makeCtx(state);
    spawnObstacle(ctx, 'stone_barricade', 'player', { x: 3, y: 3 });

    expect(canHit(state, shooter.id, far.id), 'the wall must eat the shot').toBe(false);
  });
});

describe('the mortar lobs over everything', () => {
  it('shoots straight over a wall', () => {
    const state = board();
    const lobber = addUnit(state, { def: 'cinder_lobber', side: 'player', at: { x: 3, y: 6 } });
    const foe = addUnit(state, { def: 'scout_imp', side: 'enemy', at: { x: 3, y: 3 } });

    const ctx = makeCtx(state);
    spawnObstacle(ctx, 'stone_barricade', 'player', { x: 3, y: 5 });

    expect(canHit(state, lobber.id, foe.id), 'cover means nothing to a mortar').toBe(true);
  });

  it('cannot depress its aim onto an adjacent target', () => {
    // Walking into its face is the counter, and the reason its reach is affordable.
    const state = board();
    const lobber = addUnit(state, { def: 'cinder_lobber', side: 'player', at: { x: 3, y: 6 } });
    const close = addUnit(state, { def: 'scout_imp', side: 'enemy', at: { x: 3, y: 5 } });

    expect(canHit(state, lobber.id, close.id)).toBe(false);
  });

  it('drops off past its envelope', () => {
    const state = board();
    const lobber = addUnit(state, { def: 'cinder_lobber', side: 'player', at: { x: 3, y: 7 } });
    const atEdge = addUnit(state, { def: 'scout_imp', side: 'enemy', at: { x: 3, y: 3 } });
    const beyond = addUnit(state, { def: 'scout_imp', side: 'enemy', at: { x: 3, y: 2 } });

    expect(canHit(state, lobber.id, atEdge.id), 'range 4 exactly').toBe(true);
    expect(canHit(state, lobber.id, beyond.id), 'range 5 is too far').toBe(false);
  });
});

describe('the turret is bolted down', () => {
  it('never offers a move', () => {
    const state = board();
    const turret = addUnit(state, { def: 'arc_turret', side: 'player', at: { x: 3, y: 6 } });

    expect(legalMoves(state, state.units[turret.id]!)).toEqual([]);
    expect(canMove(state.units[turret.id]!)).toBe(false);
  });

  it('still shoots, and reads as spent once it has', () => {
    // The bug this guards: canMove ignored MOV, so a turret was forever "able to move"
    // and never counted as spent -- the board drew it as ready long after it had fired.
    const state = board();
    const turret = addUnit(state, { def: 'arc_turret', side: 'player', at: { x: 3, y: 6 } });
    const foe = addUnit(state, { def: 'scout_imp', side: 'enemy', at: { x: 3, y: 3 }, hp: 20 });

    expect(canAttack(state.units[turret.id]!)).toBe(true);
    expect(isSpent(state.units[turret.id]!), 'not spent before firing').toBe(false);

    const res = applyCommand(state, {
      type: 'attack',
      attacker: turret.id,
      target: { kind: 'unit', id: foe.id },
    });

    expect(isSpent(res.state.units[turret.id]!), 'spent once it has fired').toBe(true);
  });

  it('can be shoved out of position, since it cannot walk back', () => {
    const state = board();
    const turret = addUnit(state, { def: 'arc_turret', side: 'player', at: { x: 3, y: 4 } });
    const bully = addUnit(state, { def: 'scout_imp', side: 'enemy', at: { x: 3, y: 3 } });
    void bully;

    // Displacement does not consult MOV: being immobile is not being immovable.
    expect(canStrike(state, state.units[turret.id]!, [{ x: 3, y: 4 }], [{ x: 3, y: 3 }])).toBe(true);
  });
});

describe('the data behind them', () => {
  it('keeps the marksman range finite, so state still serialises', () => {
    // Infinity survives no JSON round-trip: it becomes null and takes the state hash
    // with it, which would break replay and saves in one stroke.
    const range = CARDS.longshot_stalker!.unit!.rangeMax;
    expect(Number.isFinite(range)).toBe(true);
    expect(stableStringify({ range })).toContain(String(range));
  });

  it('gives the mortar a real blind spot', () => {
    expect(CARDS.cinder_lobber!.unit!.rangeMin).toBeGreaterThan(1);
  });

  it('leaves ordinary units on free aim', () => {
    expect(CARDS.scout_imp!.unit!.attackProfile).toBeUndefined();
  });

  it('carries the profile through to the rendered snapshot', () => {
    const state = board();
    const lobber = addUnit(state, { def: 'cinder_lobber', side: 'player', at: { x: 3, y: 6 } });
    void lobber;
    const imp = findUnit(state, 'cinder_lobber', 'player');
    expect(state.units[imp.id]!.attackProfile).toBe('arcing');
  });
});
