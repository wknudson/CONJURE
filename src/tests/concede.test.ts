import { describe, expect, it } from 'vitest';
import { eventsOf, findUnit, run, scenario } from './scenario.js';
import { enumerateActions } from '../core/ai/enumerate.js';

/**
 * Concede is the exit that always works. A fight was the one place in the game with no
 * way out: reloading was the only escape, and the boot-time forfeit then collected on the
 * Pact as if the player had fled. Now the player can ring the bell themselves, and it is
 * the same bell every other ending rings.
 */
describe('concede', () => {
  it('ends the fight as a defeat, through the ordinary bell', () => {
    const res = run(scenario(), { type: 'concede' });
    expect(res.state.result).toBe('defeat');
    expect(res.state.phase).toBe('over');
    const bells = eventsOf(res.events, 'combatEnded');
    expect(bells).toHaveLength(1);
    expect(bells[0]!.result).toBe('defeat');
  });

  it('is legal on the enemy\'s turn, which is when a player most needs an exit', () => {
    const state = scenario();
    state.activeSide = 'enemy';
    const res = run(state, { type: 'concede' });
    expect(res.state.result).toBe('defeat');
  });

  it('is legal during deployment, before turn one', () => {
    const state = scenario();
    state.phase = 'deployment';
    const res = run(state, { type: 'concede' });
    expect(res.state.result).toBe('defeat');
  });

  it('changes nothing once the fight is already decided', () => {
    const state = scenario({
      enemyHp: 20,
      units: [
        { def: 'scout_imp', side: 'player', at: { x: 2, y: 1 }, atk: 50 },
        { def: 'scout_imp', side: 'enemy', at: { x: 2, y: 0 }, keywords: ['BoundForm'] },
      ],
    });
    const imp = findUnit(state, 'scout_imp', 'player');
    const body = findUnit(state, 'scout_imp', 'enemy');
    const won = run(state, { type: 'attack', attacker: imp.id, target: { kind: 'unit', id: body.id } });
    expect(won.state.result).toBe('victory');

    // Refused like every other command after the bell, rather than quietly ignored: the
    // screens check `isOver()` before they ask, so reaching this is a caller's bug and
    // should say so.
    expect(() => run(won.state, { type: 'concede' })).toThrow('already over');
    expect(won.state.result, 'a won fight stays won').toBe('victory');
  });

  it('is never something the enemy considers', () => {
    const state = scenario({
      units: [
        { def: 'scout_imp', side: 'player', at: { x: 2, y: 4 } },
        { def: 'scout_imp', side: 'enemy', at: { x: 2, y: 0 } },
      ],
    });
    state.activeSide = 'enemy';
    const options = enumerateActions(state, 'enemy');
    expect(options.some((c) => c.type === 'concede')).toBe(false);
  });
});
