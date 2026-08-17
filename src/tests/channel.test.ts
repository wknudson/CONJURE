import { describe, expect, it } from 'vitest';
import { addUnit, eventsOf, findUnit, giveCard, run, scenario } from './scenario.js';
import { applyCommand } from '../core/engine/engine.js';
import { IllegalCommandError } from '../core/types/commands.js';
import { CHANNEL_SPARKS } from '../core/engine/engine.js';
import { enumerateActions } from '../core/ai/enumerate.js';
import { canAttack } from '../core/engine/movement.js';

/**
 * Channel: spend a unit's swing to bank a Spark.
 *
 * The floor under a bad hand. A turn with nothing worth attacking and nothing affordable
 * used to be a turn spent passing; every idle body is now worth something.
 */

describe('channelling', () => {
  it('banks a spark and spends the swing', () => {
    const state = scenario({ sparks: 0 });
    const unit = addUnit(state, { def: 'scout_imp', side: 'player', at: { x: 2, y: 4 } });

    const res = applyCommand(state, { type: 'channel', unit: unit.id });

    expect(res.state.players.player.sparks).toBe(CHANNEL_SPARKS);
    expect(res.state.units[unit.id]!.attackedThisTurn).toBe(true);
    expect(eventsOf(res.events, 'unitChannelled')[0]?.unitId).toBe(unit.id);
  });

  it('leaves the unit free to move, since only the attack was spent', () => {
    // Channelling is not exhaustion in the old sense: the body still walks.
    const state = scenario({});
    const unit = addUnit(state, { def: 'scout_imp', side: 'player', at: { x: 2, y: 4 } });

    const res = applyCommand(state, { type: 'channel', unit: unit.id });
    const after = res.state.units[unit.id]!;

    expect(after.movedThisTurn).toBe(false);
    expect(canAttack(after)).toBe(false);
  });

  it('refuses a unit that has already attacked', () => {
    const state = scenario({
      units: [
        { def: 'scout_imp', side: 'player', at: { x: 2, y: 3 } },
        { def: 'scout_imp', side: 'enemy', at: { x: 2, y: 2 }, hp: 20 },
      ],
    });
    const mine = findUnit(state, 'scout_imp', 'player');
    const foe = findUnit(state, 'scout_imp', 'enemy');

    const struck = applyCommand(state, {
      type: 'attack',
      attacker: mine.id,
      target: { kind: 'unit', id: foe.id },
    });

    expect(() => applyCommand(struck.state, { type: 'channel', unit: mine.id })).toThrow(
      IllegalCommandError,
    );
  });

  it('refuses a frozen unit, which cannot perform the rite', () => {
    const state = scenario({});
    const unit = addUnit(state, { def: 'scout_imp', side: 'player', at: { x: 2, y: 4 } });
    state.units[unit.id]!.statuses.freeze = 1;

    expect(() => applyCommand(state, { type: 'channel', unit: unit.id })).toThrow(
      IllegalCommandError,
    );
  });

  it("refuses the enemy's units", () => {
    const state = scenario({});
    const foe = addUnit(state, { def: 'scout_imp', side: 'enemy', at: { x: 2, y: 1 } });

    expect(() => applyCommand(state, { type: 'channel', unit: foe.id })).toThrow(
      IllegalCommandError,
    );
  });

  it('refuses the Bound Form, which would bank a spark at no risk', () => {
    const state = scenario({});
    const body = addUnit(state, {
      def: 'ignis_bound',
      side: 'player',
      at: { x: 2, y: 4 },
      sacrificeValue: 0,
    });

    expect(() => applyCommand(state, { type: 'channel', unit: body.id })).toThrow(
      IllegalCommandError,
    );
  });

  it('can be done by several units in a turn', () => {
    const state = scenario({ sparks: 0 });
    const a = addUnit(state, { def: 'scout_imp', side: 'player', at: { x: 1, y: 4 } });
    const b = addUnit(state, { def: 'scout_imp', side: 'player', at: { x: 3, y: 4 } });

    const res = run(
      state,
      { type: 'channel', unit: a.id },
      { type: 'channel', unit: b.id },
    );

    expect(res.state.players.player.sparks).toBe(CHANNEL_SPARKS * 2);
  });
});

describe('the AI and channelling', () => {
  /** A side with an unaffordable card, one idle unit, and no enemy in reach. */
  function starved(pips: number) {
    const state = scenario({ width: 6, height: 8, pips: 0 });
    const cmd = state.players.enemy;
    cmd.pips = pips;
    cmd.sparks = 0;
    giveCard(state, 'enemy', 'grave_sentinel'); // costs 2
    addUnit(state, { def: 'scout_imp', side: 'enemy', at: { x: 2, y: 1 } });
    state.activeSide = 'enemy';
    return state;
  }

  it('offers a channel when the spark completes a purchase', () => {
    const actions = enumerateActions(starved(1), 'enemy');
    expect(actions.some((a) => a.type === 'channel')).toBe(true);
  });

  it('refuses to hoard sparks that would expire unspent', () => {
    // The bug this guards: sparks are wiped at end of turn, so banking one that buys
    // nothing costs a swing for nothing. Left ungated the AI channels every idle unit
    // until it hits its action cap, and quadruples its own planning time doing it.
    const actions = enumerateActions(starved(0), 'enemy');
    expect(actions.some((a) => a.type === 'channel')).toBe(false);
  });

  it('offers at most one channel, since every unit banks the same spark', () => {
    const state = starved(1);
    addUnit(state, { def: 'scout_imp', side: 'enemy', at: { x: 3, y: 1 } });
    addUnit(state, { def: 'scout_imp', side: 'enemy', at: { x: 4, y: 1 } });

    const channels = enumerateActions(state, 'enemy').filter((a) => a.type === 'channel');
    expect(channels).toHaveLength(1);
  });

  it('prefers swinging to channelling when a target is in reach', () => {
    const state = starved(1);
    addUnit(state, { def: 'scout_imp', side: 'player', at: { x: 2, y: 2 } });

    const actions = enumerateActions(state, 'enemy');
    expect(actions.some((a) => a.type === 'attack')).toBe(true);
    // The unit that can swing is not offered as a channeller.
    const channelled = actions.flatMap((a) => (a.type === 'channel' ? [a.unit] : []));
    for (const id of channelled) {
      expect(state.units[id]!.anchor).not.toEqual({ x: 2, y: 1 });
    }
  });
});
