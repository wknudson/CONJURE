import { describe, expect, it } from 'vitest';
import { addUnit, eventsOf, run, scenario } from './scenario.js';
import { spawnObstacle } from './helpers.js';
import type { Coord } from '../contract/ids.js';
import type { GameState } from '../core/types/state.js';

/**
 * Conveyor currents: ground that carries whatever stands on it.
 *
 * A lane of these is territory both sides want and neither controls — it delivers your
 * units toward the enemy and theirs toward you, whether or not that was the plan.
 */

/** Marks a tile as a current flowing in `dir`. Currents are map furniture, not spells. */
function current(state: GameState, at: Coord, dir: Coord): void {
  state.hazards[`${at.x},${at.y}`] = {
    kind: 'current',
    at: { ...at },
    turns: 1,
    owner: 'player',
    permanent: true,
    dir: { ...dir },
  };
}

/** A full round: both sides pass, which is what triggers the sweep. */
const round = (state: GameState) => run(state, { type: 'endTurn' }, { type: 'endTurn' }).state;

describe('being carried', () => {
  it('moves a unit one tile at the end of the round', () => {
    const state = scenario({ width: 6, height: 8 });
    const rider = addUnit(state, { def: 'scout_imp', side: 'player', at: { x: 2, y: 5 } });
    current(state, { x: 2, y: 5 }, { x: 0, y: -1 });

    const after = round(state);

    expect(after.units[rider.id]!.anchor).toEqual({ x: 2, y: 4 });
  });

  it('does nothing to a unit standing beside the lane', () => {
    const state = scenario({ width: 6, height: 8 });
    const bystander = addUnit(state, { def: 'scout_imp', side: 'player', at: { x: 3, y: 5 } });
    current(state, { x: 2, y: 5 }, { x: 0, y: -1 });

    const after = round(state);

    expect(after.units[bystander.id]!.anchor).toEqual({ x: 3, y: 5 });
  });

  it('carries both sides alike', () => {
    const state = scenario({ width: 6, height: 8 });
    const mine = addUnit(state, { def: 'scout_imp', side: 'player', at: { x: 2, y: 5 } });
    const theirs = addUnit(state, { def: 'scout_imp', side: 'enemy', at: { x: 4, y: 3 } });
    current(state, { x: 2, y: 5 }, { x: 0, y: -1 });
    current(state, { x: 4, y: 3 }, { x: 0, y: 1 });

    const after = round(state);

    expect(after.units[mine.id]!.anchor).toEqual({ x: 2, y: 4 });
    expect(after.units[theirs.id]!.anchor).toEqual({ x: 4, y: 4 });
  });

  it('carries once a round, not once a turn', () => {
    // Per turn would carry a unit twice as far for whichever side acted first.
    const state = scenario({ width: 6, height: 8 });
    const rider = addUnit(state, { def: 'scout_imp', side: 'player', at: { x: 2, y: 6 } });
    current(state, { x: 2, y: 6 }, { x: 0, y: -1 });

    const afterOneTurn = run(state, { type: 'endTurn' }).state;
    expect(afterOneTurn.units[rider.id]!.anchor).toEqual({ x: 2, y: 6 });

    const afterRound = run(afterOneTurn, { type: 'endTurn' }).state;
    expect(afterRound.units[rider.id]!.anchor).toEqual({ x: 2, y: 5 });
  });
});

describe('what stops it', () => {
  it('bruises a unit shoved into the arena wall', () => {
    // A current running into a wall is a weapon, which is why the lane is worth taking.
    const state = scenario({ width: 6, height: 8 });
    const rider = addUnit(state, { def: 'scout_imp', side: 'player', at: { x: 2, y: 0 }, hp: 90 });
    current(state, { x: 2, y: 0 }, { x: 0, y: -1 });

    const before = state.units[rider.id]!.hp;
    const res = run(state, { type: 'endTurn' }, { type: 'endTurn' });

    expect(res.state.units[rider.id]!.hp).toBeLessThan(before);
    expect(eventsOf(res.events, 'collision').length).toBeGreaterThan(0);
  });

  it('bleeds the Pact when it slams the Bound Form', () => {
    const state = scenario({ width: 6, height: 8, playerHp: 400 });
    const body = addUnit(state, {
      def: 'ignis_bound',
      side: 'player',
      at: { x: 2, y: 7 },
      titheBonus: 0,
    });
    state.players.player.companionUnitId = body.id;
    current(state, { x: 2, y: 7 }, { x: 0, y: 1 });

    const after = round(state);

    expect(after.players.player.hp).toBeLessThan(400);
    expect(after.units[body.id]!.hp, 'the body keeps no health of its own').toBe(
      after.units[body.id]!.maxHp,
    );
  });

  it('stops against an obstacle rather than passing through it', () => {
    const state = scenario({ width: 6, height: 8 });
    // Tough enough to survive the impact: a Scout Imp is killed outright by it, which is
    // itself a fair fate for standing in a current facing a wall.
    const rider = addUnit(state, { def: 'grave_sentinel', side: 'player', at: { x: 2, y: 5 }, hp: 200 });
    spawnObstacle(state, 'stone_barricade', { x: 2, y: 4 });
    current(state, { x: 2, y: 5 }, { x: 0, y: -1 });

    const after = round(state);

    expect(after.units[rider.id]!.anchor).toEqual({ x: 2, y: 5 });
    expect(after.units[rider.id]!.hp).toBeLessThan(200);
  });
});

describe('the sweep itself', () => {
  it('does not chain a unit down a whole lane in one round', () => {
    // Snapshotting the tiles first is what keeps a ring of currents from spinning
    // forever, and a straight lane from teleporting a unit end to end.
    const state = scenario({ width: 6, height: 8 });
    const rider = addUnit(state, { def: 'scout_imp', side: 'player', at: { x: 2, y: 6 } });
    for (let y = 2; y <= 6; y++) current(state, { x: 2, y }, { x: 0, y: -1 });

    const after = round(state);

    expect(after.units[rider.id]!.anchor).toEqual({ x: 2, y: 5 });
  });

  it('carries a Behemoth once, by the tile under its anchor', () => {
    const state = scenario({ width: 6, height: 8 });
    const brute = addUnit(state, { def: 'magma_brute', side: 'player', at: { x: 2, y: 5 } });
    // Both tiles of its top row flow the same way; it must not be carried twice.
    current(state, { x: 2, y: 5 }, { x: 0, y: -1 });
    current(state, { x: 3, y: 5 }, { x: 0, y: -1 });

    const after = round(state);

    expect(after.units[brute.id]!.anchor).toEqual({ x: 2, y: 4 });
  });

  it('lays out the same way every replay', () => {
    const build = () => {
      const s = scenario({ width: 6, height: 8, seed: 4 });
      addUnit(s, { def: 'scout_imp', side: 'player', at: { x: 2, y: 5 } });
      addUnit(s, { def: 'scout_imp', side: 'player', at: { x: 3, y: 5 } });
      current(s, { x: 2, y: 5 }, { x: 0, y: -1 });
      current(s, { x: 3, y: 5 }, { x: -1, y: 0 });
      return s;
    };

    const a = round(build());
    const b = round(build());
    const anchors = (s: GameState) =>
      Object.values(s.units)
        .map((u) => `${u.anchor.x},${u.anchor.y}`)
        .sort()
        .join('|');

    expect(anchors(b)).toBe(anchors(a));
  });
});
