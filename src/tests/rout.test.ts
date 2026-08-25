/**
 * The rout: a fight won by clearing the board rather than by felling a commander.
 *
 * Victory was `enemy.hp <= 0` and nothing else, and a wandering pack has no commander to
 * reduce. Four things had to move together for that to work, and each of them is a different
 * way the feature fails silently if it is the one that gets forgotten:
 *
 *  1. the win rule itself;
 *  2. the enemy portrait becoming untargetable, or there is still an abstraction to punch;
 *  3. the Pacifist Lockout counting kills as progress, or the *player* dies on a clock in a
 *     fight where nothing can damage a portrait;
 *  4. the HUD hiding a bar it would otherwise divide by zero to draw.
 */

import { describe, expect, it } from 'vitest';
import type { GameState } from '../core/types/state.js';
import { checkLethal } from '../core/engine/death.js';
import { canHitPortrait } from '../core/engine/targeting.js';
import { makeCtx } from '../core/engine/context.js';
import { toBoardView } from '../core/engine/views.js';
import { addUnit, findUnit, run, scenario } from './scenario.js';

/** A 5x5 with one enemy body, decided by the rout rule. */
function routFight(): GameState {
  const state = scenario({
    units: [
      { def: 'vanguard_footman', side: 'player', at: { x: 2, y: 4 }, atk: 90 },
      { def: 'scout_imp', side: 'enemy', at: { x: 2, y: 3 }, hp: 10 },
    ],
  });
  state.encounter.rout = true;
  return state;
}

describe('winning by rout', () => {
  it('ends the moment the last body falls', () => {
    const state = routFight();
    const hero = findUnit(state, 'vanguard_footman', 'player');
    const foe = findUnit(state, 'scout_imp', 'enemy');
    expect(state.result).toBeUndefined();

    const after = run(state, {
      type: 'attack',
      attacker: hero.id,
      target: { kind: 'unit', id: foe.id },
    }).state;

    expect(after.result, 'clearing the pack is the win').toBe('victory');
  });

  it('does not end while anything is still standing', () => {
    const state = routFight();
    addUnit(state, { def: 'vanguard_footman', side: 'enemy', at: { x: 0, y: 3 } });
    checkLethal(makeCtx(state));
    expect(state.result).toBeUndefined();
  });

  it('is not held open by a Feral straggler', () => {
    // Wildlife is filed under the enemy because the engine has two sides and no third, but
    // it belongs to nobody and bites both. Counting it would make a rout wait on a wolf that
    // is also attacking the pack — a fight that cannot end.
    const state = routFight();
    for (const u of Object.values(state.units)) {
      if (u.side === 'enemy') delete state.units[u.id];
    }
    addUnit(state, {
      def: 'ridge_wolf',
      side: 'enemy',
      at: { x: 1, y: 2 },
      keywords: ['Feral'],
    });

    checkLethal(makeCtx(state));
    expect(state.result, 'a feral straggler is nobody’s soldier').toBe('victory');
  });

  it('still lets the player lose the ordinary way', () => {
    const state = routFight();
    state.players.player.hp = 0;
    checkLethal(makeCtx(state));
    expect(state.result).toBe('defeat');
  });

  it('leaves an ordinary fight alone', () => {
    // The flag is off by default and the old rule is untouched: an enemy with no units on the
    // board is not a loss for them, it is a fight they are losing.
    const state = scenario({
      units: [{ def: 'vanguard_footman', side: 'player', at: { x: 2, y: 4 } }],
    });
    checkLethal(makeCtx(state));
    expect(state.result, 'an empty board is not a rout unless the fight says so').toBeUndefined();
  });
});

describe('the missing commander', () => {
  it('cannot be attacked, because it is not there', () => {
    const state = routFight();
    const hero = findUnit(state, 'vanguard_footman', 'player');
    // Standing in the enemy's home row is what normally puts the portrait in reach.
    hero.anchor = { x: 2, y: 0 };
    expect(canHitPortrait(state, hero, 'enemy')).toBe(false);
  });

  it('is still reachable in an ordinary fight from the same spot', () => {
    // The guard is scoped to the rout rather than to the geometry — proof that turning the
    // flag off restores the behaviour exactly.
    const state = routFight();
    state.encounter.rout = false;
    const hero = findUnit(state, 'vanguard_footman', 'player');
    hero.anchor = { x: 2, y: 0 };
    expect(canHitPortrait(state, hero, 'enemy')).toBe(true);
  });

  it('tells the screen not to draw a bar for it', () => {
    const state = routFight();
    expect(toBoardView(state).rout).toBe(true);
    state.encounter.rout = false;
    expect(toBoardView(state).rout, 'absent rather than false on an ordinary fight').toBeUndefined();
  });
});

describe('the stall clock', () => {
  it('counts a felled body as progress', () => {
    // The Pacifist Lockout resets only on portrait damage, and a rout has no portrait to
    // damage. Left alone it would read six rounds of a player methodically clearing a pack
    // as six rounds of nobody doing anything, and start billing them for it.
    const state = routFight();
    addUnit(state, { def: 'vanguard_footman', side: 'enemy', at: { x: 0, y: 3 } });
    state.commanderDamagedThisRound = false;

    const hero = findUnit(state, 'vanguard_footman', 'player');
    const foe = findUnit(state, 'scout_imp', 'enemy');
    const after = run(state, {
      type: 'attack',
      attacker: hero.id,
      target: { kind: 'unit', id: foe.id },
    }).state;

    expect(after.commanderDamagedThisRound, 'a kill is something happening').toBe(true);
  });

  it('leaves the ordinary fight to the ordinary rule', () => {
    const state = routFight();
    state.encounter.rout = false;
    addUnit(state, { def: 'vanguard_footman', side: 'enemy', at: { x: 0, y: 3 } });
    state.commanderDamagedThisRound = false;

    const hero = findUnit(state, 'vanguard_footman', 'player');
    const foe = findUnit(state, 'scout_imp', 'enemy');
    const after = run(state, {
      type: 'attack',
      attacker: hero.id,
      target: { kind: 'unit', id: foe.id },
    }).state;

    expect(after.commanderDamagedThisRound, 'killing a minion is not commander damage').toBe(false);
  });
});
