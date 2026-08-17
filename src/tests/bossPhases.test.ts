import { describe, expect, it } from 'vitest';
import { addUnit, eventsOf, findUnit, run, scenario } from './scenario.js';
import { CombatSession } from '../core/session.js';
import { applyCommand } from '../core/engine/engine.js';
import { createCombat } from '../core/engine/setup.js';
import { IGNIS_TRIAL, NOVICE_DUELIST } from '../core/data/encounters/index.js';
import { planTurn } from '../core/ai/controller.js';
import { CARDS } from '../core/data/cards/index.js';
import type { GameState } from '../core/types/state.js';

/** Puts a scenario onto the Ignis trial script. */
function ignisScenario(opts: Parameters<typeof scenario>[0] = {}): GameState {
  const state = scenario(opts);
  state.encounter.id = 'ignis_trial';
  state.encounter.name = 'Subjugation Trial: Ignis';
  state.players.enemy.maxHp = 44;
  return state;
}

describe('Ignis trial phase gates', () => {
  it('clamps the boss to exactly 50% and nullifies the rest of the chain', () => {
    // Boss at 24/44. Halfway is 22. A 12-damage hit would take it to 12, but the gate
    // clamps it to exactly 22.
    const state = ignisScenario({
      enemyHp: 24,
      units: [{ def: 'scout_imp', side: 'player', at: { x: 2, y: 0 }, atk: 12 }],
    });
    const imp = findUnit(state, 'scout_imp', 'player');

    const res = run(state, {
      type: 'attack',
      attacker: imp.id,
      target: { kind: 'portrait', side: 'enemy' },
    });

    expect(res.state.players.enemy.hp).toBe(22);
    expect(res.state.encounter.bossPhase).toBe(2);
    expect(eventsOf(res.events, 'bossPhaseShift')).toHaveLength(1);
  });

  it('fires the phase shift exactly once', () => {
    const state = ignisScenario({
      enemyHp: 24,
      units: [{ def: 'scout_imp', side: 'player', at: { x: 2, y: 0 }, atk: 12 }],
    });
    const imp = findUnit(state, 'scout_imp', 'player');

    const first = applyCommand(state, {
      type: 'attack',
      attacker: imp.id,
      target: { kind: 'portrait', side: 'enemy' },
    });

    // Reset the attacker so it can swing again, then hit through the threshold.
    const next = first.state;
    next.units[imp.id]!.attackedThisTurn = false;

    const second = applyCommand(next, {
      type: 'attack',
      attacker: imp.id,
      target: { kind: 'portrait', side: 'enemy' },
    });

    expect(eventsOf(second.events, 'bossPhaseShift')).toHaveLength(0);
    // Now it takes real damage: 22 - 12 = 10.
    expect(second.state.players.enemy.hp).toBe(10);
  });

  it('spawns a phase-2 add, evicting a player minion and refunding a spark', () => {
    // A player minion is squatting on the first spawn site (1,1).
    const state = ignisScenario({
      enemyHp: 24,
      units: [
        { def: 'scout_imp', side: 'player', at: { x: 2, y: 0 }, atk: 12 },
        { def: 'grave_sentinel', side: 'player', at: { x: 1, y: 1 }, hp: 6 },
      ],
    });
    const imp = findUnit(state, 'scout_imp', 'player');
    const squatter = findUnit(state, 'grave_sentinel', 'player');

    const res = run(state, {
      type: 'attack',
      attacker: imp.id,
      target: { kind: 'portrait', side: 'enemy' },
    });

    // Forced Eviction returns it to hand with a spark refund.
    expect(res.state.units[squatter.id]).toBeUndefined();
    const returned = eventsOf(res.events, 'cardReturnedToHand');
    expect(returned).toHaveLength(1);
    expect(returned[0]!.refundedSparks).toBe(1);

    // An enemy add now occupies the spawn site.
    const add = Object.values(res.state.units).find(
      (u) => u.side === 'enemy' && u.anchor.x === 1 && u.anchor.y === 1,
    );
    expect(add).toBeDefined();
  });

  it('injects the Rite of Binding at 25% boss HP', () => {
    // Boss at 12/44. 25% is 11. A 2-damage hit takes it to 10, crossing the threshold.
    const state = ignisScenario({
      enemyHp: 12,
      units: [{ def: 'scout_imp', side: 'player', at: { x: 2, y: 0 }, atk: 2 }],
    });
    state.encounter.firedGates.push('phase2'); // already past the 50% gate
    const imp = findUnit(state, 'scout_imp', 'player');

    const res = run(state, {
      type: 'attack',
      attacker: imp.id,
      target: { kind: 'portrait', side: 'enemy' },
    });

    const injected = eventsOf(res.events, 'cardInjected');
    expect(injected).toHaveLength(1);
    expect(injected[0]!.card.defId).toBe('rite_of_binding');
    expect(injected[0]!.card.cost).toBe(0);
  });

  it('adds the Rite as an undiscardable overlay when the hand is full', () => {
    const state = ignisScenario({
      enemyHp: 12,
      units: [{ def: 'scout_imp', side: 'player', at: { x: 2, y: 0 }, atk: 2 }],
      hand: [
        'scout_imp',
        'scout_imp',
        'scout_imp',
        'scout_imp',
        'scout_imp',
        'scout_imp',
        'scout_imp',
      ],
    });
    state.encounter.firedGates.push('phase2');
    const imp = findUnit(state, 'scout_imp', 'player');

    const res = run(state, {
      type: 'attack',
      attacker: imp.id,
      target: { kind: 'portrait', side: 'enemy' },
    });

    const injected = eventsOf(res.events, 'cardInjected')[0]!;
    expect(injected.card.ephemeral).toBe(true);

    // End-of-turn cleanup discards the ordinary cards but never the overlay.
    const cleaned = run(res.state, { type: 'endTurn' });
    const riteId = injected.card.instanceId;
    expect(cleaned.state.players.player.hand).toContain(riteId);
  });

  it('wins the trial by binding rather than killing when the Rite is played', () => {
    const state = ignisScenario({ enemyHp: 10 });
    const cmd = state.players.player;
    const riteId = 'rite1';
    cmd.cards[riteId] = { instanceId: riteId, defId: 'rite_of_binding' };
    cmd.hand.push(riteId);

    const res = run(state, { type: 'playCard', card: riteId, target: { kind: 'global' } });

    expect(res.state.result).toBe('bound');
    // The boss survives — it was bound, not killed.
    expect(res.state.players.enemy.hp).toBe(10);
  });
});

describe('encounter definitions', () => {
  it('builds a playable Novice Duelist combat', () => {
    const { state, events } = createCombat(NOVICE_DUELIST, 42);

    expect(state.phase).toBe('action');
    expect(state.activeSide).toBe('player');
    expect(state.players.player.hp).toBe(40);
    // The opening hand of 5 serves as turn one's draw, so nothing is burned.
    expect(state.players.player.hand.length).toBe(5);
    expect(events.some((e) => e.t === 'combatStarted')).toBe(true);
  });

  it('gives every deck card a real definition', () => {
    for (const encounter of [NOVICE_DUELIST, IGNIS_TRIAL]) {
      for (const defId of encounter.enemyDeck) {
        expect(CARDS[defId], `${encounter.id} references unknown card ${defId}`).toBeDefined();
      }
      for (const [defId] of encounter.enemyOpeningBoard) {
        expect(CARDS[defId]?.unit, `${encounter.id} opening board ${defId}`).toBeDefined();
      }
    }
  });

  it('plays a full game to completion without throwing', () => {
    let { state } = createCombat(NOVICE_DUELIST, 7);
    let guard = 0;

    while (!state.result && guard++ < 200) {
      const side = state.activeSide;
      const plan = planTurn(state, side);
      for (const command of plan) {
        if (state.result) break;
        state = applyCommand(state, command).state;
      }
    }

    // Either someone won, or the game is still legally running after 200 turns.
    expect(guard).toBeLessThan(200);
    expect(['victory', 'defeat', 'bound']).toContain(state.result);
    // A whole game driven by the planner, on a board that now carries wildlife and
    // scenery as well as two armies. The default 5s budget is for unit tests, not this.
  }, 60_000);
});

describe('the drake on the board', () => {
  /** The Trial as it is really played, with the boss standing on the field. */
  function trial(seed = 5) {
    const session = new CombatSession(IGNIS_TRIAL, seed, undefined, 'ignis');
    return { session, st: session.debugState };
  }

  const bodyOf = (st: ReturnType<typeof trial>['st']) => {
    const id = st.players.enemy.companionUnitId;
    return id ? st.units[id] : undefined;
  };

  it('opens with the drake itself in reach', () => {
    const { st } = trial();
    const body = bodyOf(st);

    expect(body?.defId).toBe('ignis_drake_bound');
    expect(body?.keywords).toContain('BoundForm');
    expect(st.players.enemy.maxHp).toBe(44);
  });

  it('wounds the trial pool when the drake is struck', () => {
    const { st } = trial();
    const body = bodyOf(st)!;
    const striker = addUnit(st, {
      def: 'scout_imp',
      side: 'player',
      at: { x: body.anchor.x, y: body.anchor.y + 1 },
    });
    const before = st.players.enemy.hp;

    const res = applyCommand(st, {
      type: 'attack',
      attacker: striker.id,
      target: { kind: 'unit', id: body.id },
    });

    expect(res.state.players.enemy.hp).toBeLessThan(before);
    expect(res.state.units[body.id]!.hp).toBe(res.state.units[body.id]!.maxHp);
  });

  it('grows into its enraged shape at the halfway mark', () => {
    const { session, st } = trial();
    st.players.enemy.hp = 20; // under the 22 threshold

    session.dispatch({ type: 'endTurn' });
    const after = session.debugState;
    const body = bodyOf(after);

    expect(after.encounter.bossPhase).toBe(2);
    expect(body?.defId).toBe('ignis_behemoth_bound');
    expect(body?.footprint).toBe(2);
  });

  it('carries the same pool through the change', () => {
    // The transformation is a change of body, not a heal and not a second health bar.
    const { session, st } = trial();
    st.players.enemy.hp = 20;

    session.dispatch({ type: 'endTurn' });

    expect(session.debugState.players.enemy.hp).toBe(20);
  });

  it('leaves exactly one enemy body behind', () => {
    const { session, st } = trial();
    st.players.enemy.hp = 20;

    session.dispatch({ type: 'endTurn' });
    const after = session.debugState;

    const bodies = Object.values(after.units).filter(
      (u) => u.side === 'enemy' && u.keywords.includes('BoundForm'),
    );
    expect(bodies).toHaveLength(1);
    expect(after.units[after.players.enemy.companionUnitId!]).toBeDefined();
  });

  it('clears declared intents, which were aimed from a body that has moved', () => {
    const { session, st } = trial();
    st.players.enemy.hp = 20;
    st.intents = [
      { unitId: bodyOf(st)!.id, kind: 'attack', at: { x: 3, y: 3 }, damage: 4 },
    ];

    session.dispatch({ type: 'endTurn' });

    expect(session.debugState.intents).toHaveLength(0);
  });

  it('keeps its footing after sudden death, restoring the shape it now wears', () => {
    const { session, st } = trial();
    st.players.enemy.hp = 20;
    session.dispatch({ type: 'endTurn' });

    const grown = session.debugState;
    expect(grown.players.enemy.companionUnitDefId).toBe('ignis_behemoth_bound');

    grown.players.player.hp = 0;
    grown.players.enemy.hp = 0;
    const res = applyCommand(grown, { type: 'endTurn' });

    expect(res.state.suddenDeath).toBe(true);
    const restored = res.state.players.enemy.companionUnitId;
    expect(restored).toBeDefined();
    expect(res.state.units[restored!]!.defId, 'the enraged form, not the drake').toBe(
      'ignis_behemoth_bound',
    );
  });

  it('announces the shift once, even when it cannot grow immediately', () => {
    // A boxed-in drake still enters phase two; only the transformation waits.
    const { session, st } = trial();
    st.players.enemy.hp = 20;
    delete st.players.enemy.companionUnitId;

    const first = session.dispatch({ type: 'endTurn' });
    expect(eventsOf(first, 'bossPhaseShift')).toHaveLength(1);
    expect(session.debugState.encounter.bossPhase).toBe(2);

    const second = session.dispatch({ type: 'endTurn' });
    expect(eventsOf(second, 'bossPhaseShift'), 'must not re-announce').toHaveLength(0);
  });
});
