import { describe, expect, it } from 'vitest';
import { addUnit, eventsOf, run, scenario } from './scenario.js';

/**
 * The blood tithe was the one action the enemy could plan that the intent layer never
 * drew: `enumerateActions` offers it, `declareIntents` had no case for it, and a Novice —
 * the tier whose whole premise is that nothing is hidden — watched a body get bled with no
 * warning. It is declared now, at both tiers, like a Channel.
 */
describe('a declared tithe', () => {
  const declare = (telegraph: 'all' | 'attacks') => {
    const state = scenario({ width: 6, height: 8 });
    const body = addUnit(state, { def: 'vanguard_footman', side: 'enemy', at: { x: 2, y: 2 } });
    state.activeSide = 'enemy';
    const res = run(state, {
      type: 'declareIntents',
      plan: [{ type: 'bloodTithe', unit: body.id }],
      telegraph,
    });
    return { intents: res.state.intents, declared: eventsOf(res.events, 'intentDeclared'), body };
  };

  it('is drawn where the body stands, as a spend rather than a threat', () => {
    const { intents, declared, body } = declare('all');
    expect(intents).toHaveLength(1);
    expect(intents[0]).toMatchObject({ unitId: body.id, kind: 'tithe', at: { x: 2, y: 2 }, damage: 0 });
    expect(declared.map((e) => e.kind)).toEqual(['tithe']);
  });

  it('is declared at Adept too, since it is a spend and not a card', () => {
    const { intents } = declare('attacks');
    expect(intents.map((i) => i.kind)).toEqual(['tithe']);
  });
});
