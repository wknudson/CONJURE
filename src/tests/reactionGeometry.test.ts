import { describe, expect, it } from 'vitest';
import { addUnit, scenario } from './scenario.js';
import { dealDamage } from '../core/engine/damage.js';
import { makeCtx } from '../core/engine/context.js';
import { REACTIONS } from '../core/data/reactions.js';
import type { GameState } from '../core/types/state.js';
import type { DamageType } from '../contract/ids.js';

/**
 * Reaction geometry against a 2x2 host.
 *
 * Every reaction that reaches beyond its host — Shatter's shrapnel, Overload's throw,
 * Wildfire's bloom, Arc's jump — used to expand the eight neighbours of the host's *anchor
 * cell*. For a Behemoth that is wrong twice over: it misses every tile touching the other
 * three cells of the body, and its ring cuts through the body itself. `blastTiles` in
 * `marks.ts` had it right from the start; these hold the reactions to the same rule.
 *
 * The brute stands on (2,2)-(3,3). The far victim at (4,3) touches its bottom-right cell and
 * is two tiles from its anchor — the old ring never reached it. The stranger at (5,3) touches
 * nothing and must stay untouched either way.
 */

function arena(): { state: GameState; host: string; near: string; far: string; stranger: string } {
  const state = scenario({ width: 8, height: 8, playerHp: 5000, enemyHp: 5000 });
  const host = addUnit(state, { def: 'magma_brute', side: 'enemy', at: { x: 2, y: 2 }, fresh: false, hp: 500 });
  const near = addUnit(state, { def: 'scout_imp', side: 'player', at: { x: 1, y: 1 }, hp: 500 });
  const far = addUnit(state, { def: 'scout_imp', side: 'player', at: { x: 4, y: 3 }, hp: 500 });
  const stranger = addUnit(state, { def: 'scout_imp', side: 'player', at: { x: 5, y: 3 }, hp: 500 });
  expect(state.units[host.id]!.footprint, 'the host must be a Behemoth').toBe(2);
  return { state, host: host.id, near: near.id, far: far.id, stranger: stranger.id };
}

/** Lands a blow on the host and returns the reactions it set off. */
function strike(state: GameState, hostId: string, dtype: DamageType, amount = 50): string[] {
  const ctx = makeCtx(state);
  dealDamage(ctx, { target: { kind: 'unit', id: hostId }, amount, dtype, cause: 'attack' });
  return ctx.events.filter((e) => e.t === 'reactionTriggered').map((e) => (e as { reaction: string }).reaction);
}

const hpOf = (state: GameState, id: string) => state.units[id]!.hp;

/** A reaction's outcome, read off the table so the numbers here are never restated. */
function outcomeOf<T>(id: string): T {
  const def = REACTIONS.find((r) => r.id === id);
  if (!def) throw new Error(`no reaction ${id}`);
  return def.outcome as unknown as T;
}

describe('Shatter shrapnel flies from every edge of a Behemoth', () => {
  it('reaches a body touching the far cell, and spares one touching nothing', () => {
    const { state, host, near, far, stranger } = arena();
    state.units[host]!.statuses.freeze = 1;

    expect(strike(state, host, 'physical')).toContain('shatter');

    const { splash } = outcomeOf<{ splash: number }>('shatter');
    expect(500 - hpOf(state, far), 'adjacent to the bottom-right cell').toBe(splash);
    expect(500 - hpOf(state, near), 'adjacent to the anchor, as before').toBe(splash);
    expect(hpOf(state, stranger), 'two tiles off the body').toBe(500);
  });
});

describe('Overload throws every neighbour of a Behemoth, straight away from it', () => {
  it('throws a body under its right column straight down, not diagonally', () => {
    const { state, host } = arena();
    // Squarely below the host's bottom-right cell (3,3). From the anchor (2,2) the offset
    // reads (+1,+2), which the old code took as a diagonal throw to (4,5).
    const below = addUnit(state, { def: 'scout_imp', side: 'player', at: { x: 3, y: 4 }, hp: 500 });
    state.units[host]!.statuses.charged = 1;

    expect(strike(state, host, 'fire')).toContain('overload');

    const { shove } = outcomeOf<{ shove: number }>('overload');
    expect(state.units[below.id]!.anchor, 'directly away from the nearest cell').toEqual({ x: 3, y: 4 + shove });
  });

  it('reaches a body touching the far cell', () => {
    // Its own board rather than `arena()`: the far victim is thrown straight right into
    // (5,3), which is where the shared fixture parks its bystander, and a bystander in
    // the landing zone is a collision rather than a control. This one stands off the
    // body's corner at Chebyshev 2 and out of every throw's path.
    const state = scenario({ width: 8, height: 8, playerHp: 5000, enemyHp: 5000 });
    const host = addUnit(state, { def: 'magma_brute', side: 'enemy', at: { x: 2, y: 2 }, fresh: false, hp: 500 });
    const far = addUnit(state, { def: 'scout_imp', side: 'player', at: { x: 4, y: 3 }, hp: 500 });
    const stranger = addUnit(state, { def: 'scout_imp', side: 'player', at: { x: 5, y: 0 }, hp: 500 });
    state.units[host.id]!.statuses.charged = 1;

    expect(strike(state, host.id, 'fire')).toContain('overload');

    const { shove } = outcomeOf<{ shove: number }>('overload');
    expect(state.units[far.id]!.anchor, 'thrown straight off the far cell').toEqual({ x: 4 + shove, y: 3 });
    expect(state.units[stranger.id]!.anchor, 'never touched').toEqual({ x: 5, y: 0 });
    expect(hpOf(state, stranger.id)).toBe(500);
  });
});

describe('Wildfire blooms around the whole body', () => {
  it('burns a body touching the far cell, and spares one touching nothing', () => {
    const { state, host, far, stranger } = arena();
    state.units[host]!.statuses.toxin = 2;

    expect(strike(state, host, 'fire')).toContain('wildfire');

    const { perStack } = outcomeOf<{ perStack: number }>('wildfire');
    expect(500 - hpOf(state, far)).toBe(2 * perStack);
    expect(hpOf(state, stranger)).toBe(500);
  });
});

describe('Arc earths through every body touching a Behemoth', () => {
  it('jumps to a body touching the far cell, and no further', () => {
    const { state, host, far, stranger } = arena();
    state.encounter.weather = { kind: 'rain' } as GameState['encounter']['weather'];

    expect(strike(state, host, 'shock')).toContain('arc');

    const { damage: jolt } = outcomeOf<{ damage: number }>('arc');
    expect(500 - hpOf(state, far)).toBe(jolt);
    expect(hpOf(state, stranger)).toBe(500);
  });
});
