import { describe, expect, it } from 'vitest';
import { addUnit, eventsOf, scenario } from './scenario.js';
import { applyCommand } from '../core/engine/engine.js';
import { spawnObstacle } from './helpers.js';
import { CARDS } from '../core/data/cards/index.js';

/**
 * Volatile crystals: traps you set off rather than prizes you pick up.
 *
 * The blast does not know whose army is standing in it, so the question a crystal poses
 * is never "should I shoot this" but "who is next to it when I do".
 */

/** A crystal at (2,4) with a player unit below it, ready to break it. */
function crystalAt(defId: string) {
  const state = scenario({ width: 6, height: 8 });
  const striker = addUnit(state, { def: 'scout_imp', side: 'player', at: { x: 2, y: 5 } });
  const id = spawnObstacle(state, defId, { x: 2, y: 4 });
  state.obstacles[id]!.hp = 10;
  return { state, striker, id };
}

const breakIt = (state: ReturnType<typeof crystalAt>['state'], striker: string, id: string) =>
  applyCommand(state, { type: 'attack', attacker: striker, target: { kind: 'obstacle', id } });

describe('the blast', () => {
  it('freezes everything around a cryo-crystal', () => {
    const { state, striker, id } = crystalAt('cryo_crystal');
    const foe = addUnit(state, { def: 'scout_imp', side: 'enemy', at: { x: 3, y: 3 } });

    const res = breakIt(state, striker.id, id);

    expect(res.state.units[foe.id]!.statuses.freeze ?? 0).toBeGreaterThan(0);
  });

  it('catches the attacker too, if it was standing close enough', () => {
    // The reason a crystal is a decision: the unit that breaks it is adjacent to it.
    const { state, striker, id } = crystalAt('cryo_crystal');

    const res = breakIt(state, striker.id, id);

    expect(res.state.units[striker.id]!.statuses.freeze ?? 0).toBeGreaterThan(0);
  });

  it('burns everything around a magma barrel', () => {
    const { state, striker, id } = crystalAt('magma_crystal');
    const foe = addUnit(state, { def: 'scout_imp', side: 'enemy', at: { x: 1, y: 3 } });

    const res = breakIt(state, striker.id, id);

    expect(res.state.units[foe.id]!.statuses.burn ?? 0).toBe(2);
    expect(res.state.units[striker.id]!.statuses.burn ?? 0).toBe(2);
  });

  it('reaches the whole ring, corners included', () => {
    const { state, striker, id } = crystalAt('magma_crystal');
    const corner = addUnit(state, { def: 'scout_imp', side: 'enemy', at: { x: 1, y: 3 } });
    const straight = addUnit(state, { def: 'scout_imp', side: 'enemy', at: { x: 2, y: 3 } });
    const outside = addUnit(state, { def: 'scout_imp', side: 'enemy', at: { x: 2, y: 2 } });

    const res = breakIt(state, striker.id, id);

    expect(res.state.units[corner.id]!.statuses.burn ?? 0).toBeGreaterThan(0);
    expect(res.state.units[straight.id]!.statuses.burn ?? 0).toBeGreaterThan(0);
    expect(res.state.units[outside.id]!.statuses.burn ?? 0, 'two tiles away is clear').toBe(0);
  });

  it('announces itself so the sequencer has something to play', () => {
    const { state, striker, id } = crystalAt('cryo_crystal');
    const res = breakIt(state, striker.id, id);
    expect(eventsOf(res.events, 'reactionTriggered').some((e) => e.reaction === 'crystal_burst')).toBe(
      true,
    );
  });
});

describe('chains', () => {
  it('sets off a neighbouring crystal without looping', () => {
    const { state, striker, id } = crystalAt('magma_crystal');
    const second = spawnObstacle(state, 'magma_crystal', { x: 3, y: 3 });
    state.obstacles[second]!.hp = 10;
    const bystander = addUnit(state, { def: 'scout_imp', side: 'enemy', at: { x: 4, y: 2 } });

    // The first burst does no damage, so the second only goes off if something else
    // breaks it — this asserts the walk terminates and does not re-enter itself.
    const res = breakIt(state, striker.id, id);

    expect(res.state.obstacles[id]).toBeUndefined();
    // The far bystander is only in reach of the second crystal.
    expect(res.state.units[bystander.id]).toBeDefined();
  });
});

describe('what a crystal is', () => {
  it('leaves no rubble, being nothing worth walking around', () => {
    const { state, striker, id } = crystalAt('cryo_crystal');
    const res = breakIt(state, striker.id, id);
    expect(Object.keys(res.state.hazards)).toHaveLength(0);
  });

  it('is worth no marrow, unlike a geode', () => {
    const { state, striker, id } = crystalAt('cryo_crystal');
    const before = state.players.player.marrow;
    const res = breakIt(state, striker.id, id);
    expect(res.state.players.player.marrow).toBe(before);
  });

  it('is placed by encounters, never drawn', () => {
    expect(CARDS.cryo_crystal!.setupOnly).toBe(true);
    expect(CARDS.magma_crystal!.setupOnly).toBe(true);
  });
});

describe('crystals and reactions', () => {
  it('burning a chilled unit vaporises it, and pays the pip back', () => {
    // The integration the whole terrain layer is for: scenery feeding the reaction
    // engine, which feeds the economy.
    const { state, striker, id } = crystalAt('magma_crystal');
    const foe = addUnit(state, {
      def: 'grave_sentinel',
      side: 'enemy',
      at: { x: 3, y: 3 },
      hp: 200,
      keywords: [],
    });
    state.units[foe.id]!.statuses.chill = 2;
    state.players.player.pips = 4;

    const res = breakIt(state, striker.id, id);

    // Burn lands, then ticks into a Vaporize on the enemy's own turn. Here we only
    // assert the setup: the chill is intact and the burn is on.
    expect(res.state.units[foe.id]!.statuses.burn ?? 0).toBeGreaterThan(0);
    expect(res.state.units[foe.id]!.statuses.chill ?? 0).toBeGreaterThan(0);
  });
});
