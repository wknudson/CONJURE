import { describe, expect, it } from 'vitest';
import { addUnit, eventsOf, findUnit, run, scenario } from './scenario.js';
import { CombatSession } from '../core/session.js';
import { applyCommand } from '../core/engine/engine.js';
import { createCombat } from '../core/engine/setup.js';
import { IGNIS_TRIAL, NOVICE_DUELIST } from '../core/data/encounters/index.js';
import { planTurn } from '../core/ai/controller.js';
import { CARDS } from '../core/data/cards/index.js';
import type { GameState } from '../core/types/state.js';
import { canAct } from '../core/engine/movement.js';
import { makeCtx } from '../core/engine/context.js';
import { killEntity } from '../core/engine/death.js';
import { beginSubjugation } from '../core/engine/subjugation.js';
import { summonUnit } from '../core/engine/spawn.js';

/** Puts a scenario onto the Ignis trial script. */
function ignisScenario(opts: Parameters<typeof scenario>[0] = {}): GameState {
  const state = scenario(opts);
  state.encounter.id = 'ignis_trial';
  state.encounter.name = 'Subjugation Trial: Ignis';
  state.players.enemy.maxHp = 44;
  return state;
}

/**
 * A sealed trial with a Rite in hand and something to tether.
 *
 * Built by calling the protocol directly rather than by beating the boss down to a
 * quarter: the threshold is the encounter's business and is tested on its own above, and
 * routing every tether test through a damage race would make them all depend on it.
 */
function sealedTrial(): { state: GameState; anchor: { id: string }; riteId: string } {
  const state = ignisScenario({ enemyHp: 10 });
  const ctx = makeCtx(state);
  // The Alpha's body, which is what the seal and the punitive stack both attach to.
  const boss = summonUnit(ctx, 'ignis_drake_bound', 'enemy', { x: 2, y: 1 });
  state.players.enemy.companionUnitId = boss!;
  state.players.enemy.companionUnitDefId = 'ignis_drake_bound';

  beginSubjugation(ctx);

  const anchor = addUnit(state, { def: 'grave_sentinel', side: 'player', at: { x: 2, y: 5 } });
  // The Rite was dealt to the top of the deck; move it to hand so it can be cast.
  const riteId = state.players.player.deck.shift()!;
  state.players.player.hand.push(riteId);

  return { state, anchor, riteId };
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

  it('spawns a phase-2 add, evicting a player minion and refunding a marrow', () => {
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

    // Forced Eviction returns it to hand with a marrow refund.
    expect(res.state.units[squatter.id]).toBeUndefined();
    const returned = eventsOf(res.events, 'cardReturnedToHand');
    expect(returned).toHaveLength(1);
    expect(returned[0]!.refundedMarrow).toBe(1);

    // An enemy add now occupies the spawn site.
    const add = Object.values(res.state.units).find(
      (u) => u.side === 'enemy' && u.anchor.x === 1 && u.anchor.y === 1,
    );
    expect(add).toBeDefined();
  });

  it('seals itself and deals the Rite at 25% boss HP', () => {
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

    expect(eventsOf(res.events, 'subjugationBegan')).toHaveLength(1);

    const injected = eventsOf(res.events, 'cardInjected');
    expect(injected).toHaveLength(1);
    expect(injected[0]!.card.defId).toBe('rite_of_subjugation');
    expect(injected[0]!.card.cost).toEqual({ pips: 0, marrow: 0 });

    // On top of the draw pile, not in hand: it is guaranteed, but still has to be drawn.
    const player = res.state.players.player;
    expect(player.deck[0]).toBe(injected[0]!.card.instanceId);
    expect(player.hand).not.toContain(injected[0]!.card.instanceId);
  });

  it('stops taking damage once it is sealed, by either route', () => {
    const state = ignisScenario({
      enemyHp: 12,
      units: [{ def: 'scout_imp', side: 'player', at: { x: 2, y: 0 }, atk: 2 }],
    });
    state.encounter.firedGates.push('phase2');
    const imp = findUnit(state, 'scout_imp', 'player');

    const sealed = run(state, {
      type: 'attack',
      attacker: imp.id,
      target: { kind: 'portrait', side: 'enemy' },
    });
    const after = sealed.state.players.enemy.hp;

    // A second swing at the face, and a swing at the beast's own body, which redirects
    // onto the same pool. Neither may move the number.
    const again = run(sealed.state, { type: 'endTurn' }, { type: 'endTurn' });
    const stillThere = again.state.units[imp.id];
    if (stillThere) {
      const hit = run(again.state, {
        type: 'attack',
        attacker: imp.id,
        target: { kind: 'portrait', side: 'enemy' },
      });
      expect(hit.state.players.enemy.hp).toBe(after);
    }
  });

  it('tethers the chosen unit and takes its turn away', () => {
    const { state, anchor, riteId } = sealedTrial();
    const res = run(state, {
      type: 'playCard',
      card: riteId,
      target: { kind: 'entity', ref: { kind: 'unit', id: anchor.id } },
    });

    const sub = res.state.encounter.subjugation;
    expect(sub.active).toBe(true);
    expect(sub.anchorUnitId).toBe(anchor.id);
    expect(sub.turnsSurvived).toBe(0);

    const tethered = res.state.units[anchor.id]!;
    expect(tethered.statuses.anchor).toBe(1);
    expect(canAct(tethered), 'it can only brace').toBe(false);
  });

  it('claims the companion when the anchor endures three rounds', () => {
    const { state, anchor, riteId } = sealedTrial();
    let cur = run(state, {
      type: 'playCard',
      card: riteId,
      target: { kind: 'entity', ref: { kind: 'unit', id: anchor.id } },
    }).state;

    const seen: number[] = [];
    for (let round = 0; round < 3 && !cur.result; round++) {
      const res = run(cur, { type: 'endTurn' }, { type: 'endTurn' });
      cur = res.state;
      const progress = eventsOf(res.events, 'subjugationProgress');
      if (progress.length > 0) seen.push(progress[progress.length - 1]!.turnsSurvived);
    }

    expect(seen).toEqual([1, 2, 3]);
    expect(cur.result).toBe('bound');
  });

  it('snaps the tether when the anchor dies, and the beast comes back angrier', () => {
    const { state, anchor, riteId } = sealedTrial();
    const tethered = run(state, {
      type: 'playCard',
      card: riteId,
      target: { kind: 'entity', ref: { kind: 'unit', id: anchor.id } },
    }).state;

    const boss = tethered.units[tethered.players.enemy.companionUnitId!]!;
    const before = boss.atk;

    // Kill the anchor outright.
    const ctx = makeCtx(tethered);
    killEntity(ctx, tethered.units[anchor.id]!, 'spell');

    const sub = tethered.encounter.subjugation;
    expect(sub.active).toBe(false);
    expect(sub.anchorUnitId).toBeNull();
    expect(ctx.events.some((e) => e.t === 'tetherSnapped')).toBe(true);

    const angrier = tethered.units[tethered.players.enemy.companionUnitId!]!;
    expect(angrier.escalation, 'one punitive stack').toBe(boss.escalation);
    expect(angrier.atk).toBeGreaterThan(before - 1);

    // And a fresh Rite is dealt, so the loop can be tried again.
    expect(ctx.events.filter((e) => e.t === 'cardInjected').length).toBe(1);
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

/**
 * The AI half of the protocol.
 *
 * A sealed Alpha cannot win by damage and cannot lose to it, so a planner that keeps
 * chipping the player's face would leave the phase to resolve itself. These check that
 * the override actually redirects the beast rather than merely scoring higher on paper.
 */
describe('the beast hunting its anchor', () => {
  /** A tethered board where the enemy can reach both the anchor and the player's face. */
  const hunt = () => {
    const state = ignisScenario({ enemyHp: 10, width: 6, height: 8 });
    const ctx = makeCtx(state);
    beginSubjugation(ctx);

    const anchor = addUnit(state, { def: 'grave_sentinel', side: 'player', at: { x: 1, y: 6 } });
    // A hunter standing where the player's territory rows are already in melee reach of
    // the portrait, so face damage is genuinely on the table as an alternative.
    const hunter = addUnit(state, { def: 'scout_imp', side: 'enemy', at: { x: 1, y: 7 }, atk: 3 });

    const sub = state.encounter.subjugation;
    sub.active = true;
    sub.anchorUnitId = anchor.id;
    state.units[anchor.id]!.statuses.anchor = 1;
    state.activeSide = 'enemy';
    return { state, anchor, hunter };
  };

  it('strikes the anchor rather than the face it could reach instead', () => {
    const { state, anchor, hunter } = hunt();
    const plan = planTurn(state, 'enemy');

    const strike = plan.find((c) => c.type === 'attack' && c.attacker === hunter.id);
    expect(strike, 'it must swing at something').toBeDefined();
    expect(
      strike && strike.type === 'attack' && strike.target,
      'the tether, not the Pact behind it',
    ).toEqual({ kind: 'unit', id: anchor.id });
  });

  it('goes back to the face once the tether is gone', () => {
    // The same board with the tether released: the override must be the only thing that
    // was redirecting it, not some accident of the geometry.
    const { state, hunter } = hunt();
    state.encounter.subjugation.active = false;
    state.encounter.subjugation.anchorUnitId = null;

    const plan = planTurn(state, 'enemy');
    const strike = plan.find((c) => c.type === 'attack' && c.attacker === hunter.id);
    expect(strike && strike.type === 'attack' && strike.target).toEqual({
      kind: 'portrait',
      side: 'player',
    });
  });
});
