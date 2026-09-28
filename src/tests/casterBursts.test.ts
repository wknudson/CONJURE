/**
 * Companion cards with no target of their own, centred on the beast that casts them.
 *
 * Elmo's Fire, Hoarfrost Veil and Static Bristle all say "everything adjacent to the caster",
 * and until the engine read the caster's anchor for a `none` target every area under them was
 * empty. These pin that the burst lands where the beast stands, on the eight tiles around it
 * and not on the beast itself.
 */

import { describe, expect, it } from 'vitest';
import { addUnit, damageTo, handCard, play, run, scenario } from './scenario.js';
import type { GameState } from '../core/types/state.js';

function setup(card: string, bound: string): { state: GameState; bodyId: string; foeId: string; farId: string } {
  const state = scenario({ hand: [card], bones: 5 });
  const body = addUnit(state, { def: bound, side: 'player', at: { x: 2, y: 3 } });
  state.players.player.companionUnitId = body.id;
  const foe = addUnit(state, { def: 'vanguard_footman', side: 'enemy', at: { x: 2, y: 2 } });
  const far = addUnit(state, { def: 'vanguard_footman', side: 'enemy', at: { x: 2, y: 0 } });
  return { state, bodyId: body.id, foeId: foe.id, farId: far.id };
}

describe('a burst centred on the caster', () => {
  it("lands Elmo's Fire on what stands beside the beast, and nowhere else", () => {
    const { state, bodyId, foeId, farId } = setup('elmos_fire', 'voltara_bound');
    const r = run(state, play(handCard(state, 'player', 'elmos_fire')));
    expect(damageTo(r.events, foeId), 'the adjacent enemy').toBe(20);
    expect(r.state.units[foeId]?.statuses.charged ?? 0, 'left Charged').toBeGreaterThan(0);
    expect(damageTo(r.events, farId), 'two tiles off').toBe(0);
    expect(damageTo(r.events, bodyId), 'the caster itself').toBe(0);
  });

  it('forms the Hoarfrost Veil chill around the beast', () => {
    const { state, foeId, farId } = setup('hoarfrost_veil', 'boreas_bound');
    const r = run(state, play(handCard(state, 'player', 'hoarfrost_veil')));
    expect(r.state.units[foeId]?.statuses.chill ?? 0).toBe(1);
    expect(r.state.units[farId]?.statuses.chill ?? 0).toBe(0);
  });

  it('charges everything beside the Lynx with Static Bristle', () => {
    const { state, bodyId, foeId, farId } = setup('static_bristle', 'voltara_bound');
    const r = run(state, play(handCard(state, 'player', 'static_bristle')));
    expect(r.state.units[foeId]?.statuses.charged ?? 0).toBe(1);
    expect(r.state.units[farId]?.statuses.charged ?? 0).toBe(0);
    expect(r.state.units[bodyId]?.statuses.charged ?? 0, 'not the Lynx itself').toBe(0);
  });
});
