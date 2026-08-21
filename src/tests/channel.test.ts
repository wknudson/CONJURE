import { describe, expect, it } from 'vitest';
import { addUnit, eventsOf, findUnit, giveCard, run, scenario } from './scenario.js';
import { applyCommand } from '../core/engine/engine.js';
import { IllegalCommandError } from '../core/types/commands.js';
import { CHANNEL_MARROW, channelRefusal } from '../core/engine/engine.js';
import { enumerateActions } from '../core/ai/enumerate.js';
import { canAttack } from '../core/engine/movement.js';

/**
 * Channel: spend a unit's swing to bank a Marrow.
 *
 * The floor under a bad hand. A turn with nothing worth attacking and nothing affordable
 * used to be a turn spent passing; every idle body is now worth something.
 */

describe('channelling', () => {
  it('banks a marrow and spends the swing', () => {
    const state = scenario({ marrow: 0 });
    const unit = addUnit(state, { def: 'scout_imp', side: 'player', at: { x: 2, y: 4 } });

    const res = applyCommand(state, { type: 'channel', unit: unit.id });

    expect(res.state.players.player.marrow).toBe(CHANNEL_MARROW);
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
        { def: 'scout_imp', side: 'enemy', at: { x: 2, y: 2 }, hp: 200 },
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

  it('refuses the Bound Form, which would bank a marrow at no risk', () => {
    const state = scenario({});
    const body = addUnit(state, {
      def: 'ignis_bound',
      side: 'player',
      at: { x: 2, y: 4 },
      titheBonus: 0,
    });

    expect(() => applyCommand(state, { type: 'channel', unit: body.id })).toThrow(
      IllegalCommandError,
    );
  });

  it('can be done by several units in a turn', () => {
    const state = scenario({ marrow: 0 });
    const a = addUnit(state, { def: 'scout_imp', side: 'player', at: { x: 1, y: 4 } });
    const b = addUnit(state, { def: 'scout_imp', side: 'player', at: { x: 3, y: 4 } });

    const res = run(
      state,
      { type: 'channel', unit: a.id },
      { type: 'channel', unit: b.id },
    );

    expect(res.state.players.player.marrow).toBe(CHANNEL_MARROW * 2);
  });
});

describe('the AI and channelling', () => {
  /** A side with an unaffordable card, one idle unit, and no enemy in reach. */
  function starved(pips: number) {
    const state = scenario({ width: 6, height: 8, pips: 0 });
    const cmd = state.players.enemy;
    cmd.pips = pips;
    cmd.marrow = 0;
    giveCard(state, 'enemy', 'grave_sentinel'); // costs 2
    addUnit(state, { def: 'scout_imp', side: 'enemy', at: { x: 2, y: 1 } });
    state.activeSide = 'enemy';
    return state;
  }

  it('offers a channel when the marrow completes a purchase', () => {
    const actions = enumerateActions(starved(1), 'enemy');
    expect(actions.some((a) => a.type === 'channel')).toBe(true);
  });

  it('refuses to hoard marrow that would expire unspent', () => {
    // The bug this guards: marrow are wiped at end of turn, so banking one that buys
    // nothing costs a swing for nothing. Left ungated the AI channels every idle unit
    // until it hits its action cap, and quadruples its own planning time doing it.
    const actions = enumerateActions(starved(0), 'enemy');
    expect(actions.some((a) => a.type === 'channel')).toBe(false);
  });

  it('offers at most one channel, since every unit banks the same marrow', () => {
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

/**
 * The predicate the reducer and the UI both ask. If these two ever disagree the button
 * offers an action the engine then refuses, which is the bug this exists to prevent.
 */
describe('channel legality', () => {
  it('agrees with the reducer on every refusal it reports', () => {
    const state = scenario({ marrow: 0 });
    const cases = [
      { name: 'a fresh unit', id: addUnit(state, { def: 'scout_imp', side: 'player', at: { x: 1, y: 4 } }).id },
      { name: 'an enemy unit', id: addUnit(state, { def: 'scout_imp', side: 'enemy', at: { x: 1, y: 0 } }).id },
      { name: 'a frozen unit', id: addUnit(state, { def: 'scout_imp', side: 'player', at: { x: 2, y: 4 } }).id },
      { name: 'a spent unit', id: addUnit(state, { def: 'scout_imp', side: 'player', at: { x: 3, y: 4 } }).id },
      { name: 'no unit at all', id: 'u-nonexistent' },
    ];
    state.units[cases[2]!.id]!.statuses.freeze = 1;
    state.units[cases[3]!.id]!.attackedThisTurn = true;

    for (const c of cases) {
      const refusal = channelRefusal(state, c.id);
      let threw: string | null = null;
      try {
        applyCommand(state, { type: 'channel', unit: c.id });
      } catch (err) {
        threw = err instanceof IllegalCommandError ? err.message : 'wrong error type';
      }
      // Null means allowed, and the reducer must then accept it; a string means refused,
      // and the reducer must throw with exactly that reason.
      expect(threw, `${c.name}`).toBe(refusal);
    }
  });

  it('still allows a unit that has moved but not yet attacked', () => {
    // `exhausted` on the snapshot conflates the two, which is why the UI cannot use it.
    const state = scenario({ marrow: 0 });
    const unit = addUnit(state, { def: 'scout_imp', side: 'player', at: { x: 2, y: 4 } });
    state.units[unit.id]!.movedThisTurn = true;

    expect(channelRefusal(state, unit.id)).toBeNull();
    const res = applyCommand(state, { type: 'channel', unit: unit.id });
    expect(res.state.players.player.marrow).toBe(CHANNEL_MARROW);
  });
});
