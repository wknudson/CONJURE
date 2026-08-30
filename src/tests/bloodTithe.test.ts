import { describe, expect, it } from 'vitest';
import { addUnit, eventsOf, handCard, play, run, scenario } from './scenario.js';
import { applyCommand, bloodTitheRefusal } from '../core/engine/engine.js';
import { IllegalCommandError } from '../core/types/commands.js';
import { TITHE_DAMAGE, TITHE_MARROW } from '../core/engine/effects.js';
import { canAct } from '../core/engine/movement.js';
import { titheCandidates } from '../core/engine/targeting.js';
import { checkInvariants } from './replay.js';

/**
 * Blood Magic.
 *
 * The mechanic that replaced Sacrifice, and the difference is the whole point: the body
 * stays. What you spend is its turn and 3 of its health, not the unit — so the question
 * every turn is which of your own you can afford to open, rather than which you are
 * willing to lose.
 *
 * Two properties are load-bearing and get the most attention below. **Marrow is paid
 * before the wound**, so a lethal tithe still pays; and **Exhaustion is the once-per-turn
 * cap**, so it has to actually stop the second attempt rather than merely be set.
 */

/** A healthy body that has stood a round, so nothing refuses it for being fresh. */
function withVictim(def = 'grave_sentinel', extra: Record<string, unknown> = {}) {
  const state = scenario({ width: 6, height: 8, marrow: 0 });
  const victim = addUnit(state, {
    def,
    side: 'player',
    at: { x: 2, y: 5 },
    fresh: false,
    ...extra,
  });
  return { state, victim };
}

describe('a successful tithe', () => {
  it('pays Marrow, takes health, and exhausts the body', () => {
    const { state, victim } = withVictim();
    const hpBefore = state.units[victim.id]!.hp;

    const res = run(state, { type: 'bloodTithe', unit: victim.id });

    const body = res.state.units[victim.id]!;
    expect(res.state.players.player.marrow).toBe(TITHE_MARROW);
    expect(body.hp).toBe(hpBefore - TITHE_DAMAGE);
    expect(body.statuses.exhaust).toBe(1);
  });

  it('leaves the body standing where it was', () => {
    // The single sentence that separates this from the mechanic it replaced.
    const { state, victim } = withVictim();
    const at = { ...state.units[victim.id]!.anchor };

    const res = run(state, { type: 'bloodTithe', unit: victim.id });

    expect(res.state.units[victim.id]).toBeDefined();
    expect(res.state.units[victim.id]!.anchor).toEqual(at);
  });

  it('cuts through armor, so plate cannot make a body un-bleedable', () => {
    // `true` damage on purpose: a plated Bulwark line that could not be tithed would be a
    // school locked out of its own economy.
    const { state, victim } = withVictim();
    state.units[victim.id]!.armor = 100;
    const hpBefore = state.units[victim.id]!.hp;

    const res = run(state, { type: 'bloodTithe', unit: victim.id });

    expect(res.state.units[victim.id]!.hp).toBe(hpBefore - TITHE_DAMAGE);
    expect(res.state.units[victim.id]!.armor, 'and the plate is not spent on it').toBe(100);
  });

  it('announces itself with the Marrow it actually paid', () => {
    const { state, victim } = withVictim();
    const res = run(state, { type: 'bloodTithe', unit: victim.id });

    const tithed = eventsOf(res.events, 'unitTithed');
    expect(tithed.length).toBe(1);
    expect(tithed[0]!.unitId).toBe(victim.id);
    expect(tithed[0]!.side).toBe('player');
    // The event has to agree with the purse or the floater reports a different number.
    expect(tithed[0]!.marrow).toBe(res.state.players.player.marrow);
  });

  it('pays a premium for a body bred to bleed', () => {
    // The Marrow Wisp's whole identity now that being spent whole is not a thing.
    const { state, victim } = withVictim('marrow_wisp');
    const res = run(state, { type: 'bloodTithe', unit: victim.id });
    expect(res.state.players.player.marrow).toBe(TITHE_MARROW + 1);
  });

  it('holds every engine invariant afterwards', () => {
    const { state, victim } = withVictim();
    const res = run(state, { type: 'bloodTithe', unit: victim.id });
    expect(checkInvariants(res.state, 'after tithe')).toEqual([]);
  });
});

describe('a lethal tithe', () => {
  it('still pays the Marrow, in full, before the body drops', () => {
    // The rule the execution order exists for. A tithe that killed and paid nothing would
    // make every Blood Magic play a health check first.
    const { state, victim } = withVictim('grave_sentinel', { hp: 20 });

    const res = run(state, { type: 'bloodTithe', unit: victim.id });

    expect(res.state.units[victim.id], 'a 2 HP body does not survive 3 damage').toBeUndefined();
    expect(res.state.players.player.marrow).toBe(TITHE_MARROW);
  });

  it('is not refused for being lethal', () => {
    // Deliberately legal: bleeding something out is sometimes the right play, so the
    // warning belongs on the button rather than in the rule.
    const { state, victim } = withVictim('grave_sentinel', { hp: 10 });
    expect(bloodTitheRefusal(state, victim.id)).toBeNull();
  });

  it('leaves no body to exhaust, and no invariant broken', () => {
    const { state, victim } = withVictim('grave_sentinel', { hp: 10 });
    const res = run(state, { type: 'bloodTithe', unit: victim.id });

    expect(res.state.units[victim.id]).toBeUndefined();
    expect(eventsOf(res.events, 'unitDied').length).toBe(1);
    expect(checkInvariants(res.state, 'after lethal tithe')).toEqual([]);
  });
});

describe('refusals', () => {
  it('refuses a unit that is already exhausted', () => {
    const { state, victim } = withVictim();
    const first = run(state, { type: 'bloodTithe', unit: victim.id });

    expect(first.state.units[victim.id]!.statuses.exhaust).toBe(1);
    expect(bloodTitheRefusal(first.state, victim.id)).toBe('unit is already exhausted');
    expect(() => applyCommand(first.state, { type: 'bloodTithe', unit: victim.id })).toThrow(
      IllegalCommandError,
    );
  });

  it('does not pay twice when the second tithe is refused', () => {
    // The cap has to hold the *purse*, not merely the status. A refusal that still paid
    // would make the once-per-turn rule decorative.
    const { state, victim } = withVictim();
    const first = run(state, { type: 'bloodTithe', unit: victim.id });
    const after = first.state.players.player.marrow;

    expect(() => applyCommand(first.state, { type: 'bloodTithe', unit: victim.id })).toThrow();
    expect(first.state.players.player.marrow).toBe(after);
  });

  it('refuses a Bound Form', () => {
    const state = scenario({ width: 6, height: 8, playerHp: 400 });
    const bound = addUnit(state, {
      def: 'vanguard_footman',
      side: 'player',
      at: { x: 2, y: 6 },
      keywords: ['BoundForm'],
      fresh: false,
    });

    expect(bloodTitheRefusal(state, bound.id)).toBe('the Bound Form cannot be tithed');
    expect(() => applyCommand(state, { type: 'bloodTithe', unit: bound.id })).toThrow(
      IllegalCommandError,
    );
  });

  it('refuses a unit that is not yours', () => {
    const state = scenario({ width: 6, height: 8 });
    const foe = addUnit(state, { def: 'scout_imp', side: 'enemy', at: { x: 2, y: 1 }, fresh: false });
    expect(bloodTitheRefusal(state, foe.id)).toBe('not your unit');
  });

  it('refuses a unit that does not exist', () => {
    const state = scenario({ width: 6, height: 8 });
    expect(bloodTitheRefusal(state, 'no-such-unit')).toBe('no unit no-such-unit');
  });

  it('refuses a unit that cannot act at all', () => {
    // Frozen, stunned, tethered, summoning-sick — `canAct` owns all of them, so the tithe
    // inherits every one without listing any of them itself.
    const { state, victim } = withVictim();
    state.units[victim.id]!.statuses.freeze = 1;

    expect(canAct(state.units[victim.id]!)).toBe(false);
    expect(bloodTitheRefusal(state, victim.id)).toBe('unit cannot act');
  });

  it('refuses a unit that has not shaken off being summoned', () => {
    const { state, victim } = withVictim();
    state.units[victim.id]!.summonedThisTurn = true;

    expect(bloodTitheRefusal(state, victim.id)).toBe('unit cannot act');
  });
});

describe('Exhaustion is the spend', () => {
  it('stops the body moving as well as bleeding', () => {
    // Broader than a spent attack on purpose: an exhausted unit cannot walk away either.
    const { state, victim } = withVictim();
    const res = run(state, { type: 'bloodTithe', unit: victim.id });

    expect(canAct(res.state.units[victim.id]!)).toBe(false);
    expect(() =>
      applyCommand(res.state, { type: 'moveUnit', unit: victim.id, to: { x: 2, y: 4 } }),
    ).toThrow();
  });

  it('stops the body channelling for more Marrow', () => {
    // Otherwise a body could be tithed and then channelled in the same turn, which is the
    // double-dip the once-per-turn rule exists to stop.
    const { state, victim } = withVictim();
    const res = run(state, { type: 'bloodTithe', unit: victim.id });

    expect(() => applyCommand(res.state, { type: 'channel', unit: victim.id })).toThrow();
  });

  it('clears by the start of the next friendly turn', () => {
    const { state, victim } = withVictim();
    const bled = run(state, { type: 'bloodTithe', unit: victim.id });
    expect(bled.state.units[victim.id]!.statuses.exhaust).toBe(1);

    // Round the turn back to the player, so the status tick runs.
    const later = run(bled.state, { type: 'endTurn' }, { type: 'endTurn' });

    expect(later.state.units[victim.id]!.statuses.exhaust).toBeUndefined();
    expect(canAct(later.state.units[victim.id]!)).toBe(true);
    expect(bloodTitheRefusal(later.state, victim.id), 'and may be bled again').toBeNull();
  });
});

describe('the card op and the command agree', () => {
  it('routes Dark Tithe through the same rule, including the Exhaustion', () => {
    const state = scenario({ width: 6, height: 8, hand: ['dark_tithe'], bones: 4, marrow: 0 });
    const victim = addUnit(state, {
      def: 'grave_sentinel',
      side: 'player',
      at: { x: 2, y: 5 },
      fresh: false,
    });

    const card = handCard(state, 'player', 'dark_tithe');
    const res = run(state, play(card, { kind: 'entity', ref: { kind: 'unit', id: victim.id } }));

    const body = res.state.units[victim.id]!;
    expect(body.statuses.exhaust, 'a card tithe exhausts too').toBe(1);
    expect(eventsOf(res.events, 'unitTithed').length).toBe(1);
  });

  it('will not offer an exhausted body to a tithe card', () => {
    // `requireUnexhausted` reads `canAct`, which now carries Exhaustion — so the once-per
    // turn rule reaches card targeting without the cards knowing about it.
    const state = scenario({ width: 6, height: 8, hand: ['dark_tithe'], bones: 4 });
    const victim = addUnit(state, {
      def: 'grave_sentinel',
      side: 'player',
      at: { x: 2, y: 5 },
      fresh: false,
    });

    const bled = run(state, { type: 'bloodTithe', unit: victim.id });
    const ids = titheCandidates(bled.state, 'player').map((u) => u.id);

    expect(ids).not.toContain(victim.id);
  });
});
