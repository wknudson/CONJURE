import { describe, expect, it } from 'vitest';
import { addUnit, eventsOf, findUnit, giveCard, run, scenario } from './scenario.js';
import { applyCommand } from '../core/engine/engine.js';
import { IllegalCommandError } from '../core/types/commands.js';
import { CHANNEL_MARROW, channelRefusal } from '../core/engine/engine.js';
import { enumerateActions } from '../core/ai/enumerate.js';
import { planTurn } from '../core/ai/controller.js';
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

  it('lets the Bound Form channel now that giving up a swing costs something', () => {
    // This asserted a refusal, and the reason given was that extracting Marrow with the one
    // body that cannot be traded away was "a turn with no downside at all". True while a swing
    // was free — giving up nothing costs nothing.
    //
    // A swing costs a Bone now, so channelling trades a paid action for a Bone and the downside
    // is the swing itself. Leaving the bar in place also made the endgame unresolvable: the
    // last body standing is usually the Bound Form, and one that cannot channel can only ever
    // spend. Four shipped encounters stopped reaching a decision because of it.
    const state = scenario({});
    const body = addUnit(state, {
      def: 'ignis_bound',
      side: 'player',
      at: { x: 2, y: 4 },
      titheBonus: 0,
    });

    const after = applyCommand(state, { type: 'channel', unit: body.id }).state;
    expect(after.units[body.id]!.attackedThisTurn, 'it gave up the swing').toBe(true);
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
  function starved(bones: number) {
    const state = scenario({ width: 6, height: 8, bones: 0 });
    const cmd = state.players.enemy;
    cmd.bones = bones;
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

  it('channels with nothing to spend it on, because Bones bank', () => {
    // This asserted the opposite, and was right to: Channel used to pay only Marrow, Marrow is
    // wiped at end of turn, and banking one that buys nothing cost a swing for nothing.
    //
    // Channel pays **Bones** now, and Bones carry over. At zero the side cannot attack at all, so
    // sitting a body down is not hoarding — it is the only way out of the hole, and refusing it
    // would leave the AI standing still until the fight timed out. That is exactly what it did
    // when this gate was left in place: attacks fell by 41% and channels did not move.
    const actions = enumerateActions(starved(0), 'enemy');
    expect(actions.some((a) => a.type === 'channel')).toBe(true);
  });

  it('offers at most one channel, since every unit banks the same marrow', () => {
    const state = starved(1);
    addUnit(state, { def: 'scout_imp', side: 'enemy', at: { x: 3, y: 1 } });
    addUnit(state, { def: 'scout_imp', side: 'enemy', at: { x: 4, y: 1 } });

    const channels = enumerateActions(state, 'enemy').filter((a) => a.type === 'channel');
    expect(channels).toHaveLength(1);
  });

  it('offers the swing and the channel for the same body, because that is the decision', () => {
    // The inverse of what this used to assert. Channel was a consolation for having nothing to
    // hit, so a body with a target was deliberately never offered as a channeller. Now that a
    // swing costs a Bone and sitting down makes one, "strike or fund the strike" is the choice
    // the turn is made of, and an enumeration that hides half of it cannot plan the turn.
    const state = starved(1);
    addUnit(state, { def: 'scout_imp', side: 'player', at: { x: 2, y: 2 } });

    const actions = enumerateActions(state, 'enemy');
    const swinger = Object.values(state.units).find(
      (u) => u.side === 'enemy' && u.anchor.x === 2 && u.anchor.y === 1,
    )!;
    expect(actions.some((a) => a.type === 'attack' && a.attacker === swinger.id)).toBe(true);
    expect(actions.some((a) => a.type === 'channel' && a.unit === swinger.id)).toBe(true);
  });

  it('still swings rather than channels when the swing is worth more than a Bone', () => {
    // The preference the old enumeration hard-coded now lives where it belongs: in the score.
    // `boneValue` sits under `face`, so a body with something worth hitting hits it.
    const state = starved(4);
    addUnit(state, { def: 'scout_imp', side: 'player', at: { x: 2, y: 2 } });

    const plan = planTurn(state, 'enemy');
    const attacks = plan.filter((c) => c.type === 'attack').length;
    const channels = plan.filter((c) => c.type === 'channel').length;
    expect(attacks).toBeGreaterThan(channels);
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
