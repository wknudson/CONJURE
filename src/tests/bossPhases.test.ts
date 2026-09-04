import { describe, expect, it } from 'vitest';
import { addUnit, eventsOf, findUnit, run, scenario } from './scenario.js';
import { CombatSession } from '../core/session.js';
import { applyCommand } from '../core/engine/engine.js';
import { createCombat } from '../core/engine/setup.js';
import { IGNIS_TRIAL, NOVICE_DUELIST } from '../core/data/encounters/index.js';
import { evictAndSpawn } from '../core/data/encounters/bossPhases.js';
import { planTurn } from '../core/ai/controller.js';
import { CARDS } from '../core/data/cards/index.js';
import type { GameState } from '../core/types/state.js';
import { canAct } from '../core/engine/movement.js';
import { makeCtx } from '../core/engine/context.js';
import { killEntity } from '../core/engine/death.js';
import { beginSubjugation } from '../core/engine/subjugation.js';
import { summonUnit } from '../core/engine/spawn.js';
import { dealDamage } from '../core/engine/damage.js';

/** Puts a scenario onto the Ignis trial script. */
function ignisScenario(opts: Parameters<typeof scenario>[0] = {}): GameState {
  const state = scenario(opts);
  state.encounter.id = 'ignis_trial';
  state.encounter.name = 'Subjugation Trial: Ignis';
  state.players.enemy.maxHp = 440;
  return state;
}

/**
 * The Alpha's body on the grid.
 *
 * Every fight with a Commander fields one, and it is the only route to the Pact behind
 * it: no attack may name a portrait, so a test that wants to damage the boss has to have
 * something to swing at.
 */
function alphaBody(state: GameState, at = { x: 2, y: 1 }) {
  const ctx = makeCtx(state);
  const id = summonUnit(ctx, 'ignis_drake_bound', 'enemy', at)!;
  state.players.enemy.companionUnitId = id;
  state.players.enemy.companionUnitDefId = 'ignis_drake_bound';
  return state.units[id]!;
}

/**
 * A sealed trial with a Rite in hand and something to tether.
 *
 * Built by calling the protocol directly rather than by beating the boss down to a
 * quarter: the threshold is the encounter's business and is tested on its own above, and
 * routing every tether test through a damage race would make them all depend on it.
 */
function sealedTrial(): { state: GameState; anchor: { id: string }; riteId: string } {
  const state = ignisScenario({ enemyHp: 100 });
  // The Alpha's body, which is what the seal and the punitive stack both attach to.
  alphaBody(state);

  beginSubjugation(makeCtx(state));

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
      enemyHp: 240,
      units: [{ def: 'scout_imp', side: 'player', at: { x: 2, y: 0 }, atk: 120 }],
    });
    const imp = findUnit(state, 'scout_imp', 'player');
    const boss = alphaBody(state);

    const res = run(state, {
      type: 'attack',
      attacker: imp.id,
      target: { kind: 'unit', id: boss.id },
    });

    expect(res.state.players.enemy.hp).toBe(220);
    expect(res.state.encounter.bossPhase).toBe(2);
    expect(eventsOf(res.events, 'bossPhaseShift')).toHaveLength(1);
  });

  it('fires the phase shift exactly once', () => {
    const state = ignisScenario({
      enemyHp: 240,
      units: [{ def: 'scout_imp', side: 'player', at: { x: 2, y: 0 }, atk: 120 }],
    });
    const imp = findUnit(state, 'scout_imp', 'player');
    const boss = alphaBody(state);

    const first = applyCommand(state, {
      type: 'attack',
      attacker: imp.id,
      target: { kind: 'unit', id: boss.id },
    });

    // Reset the attacker so it can swing again, then hit through the threshold. The gate
    // grew the drake into its enraged form, so the body to swing at is a new one.
    const next = first.state;
    next.units[imp.id]!.attackedThisTurn = false;
    const grown = next.units[next.players.enemy.companionUnitId!]!;

    const second = applyCommand(next, {
      type: 'attack',
      attacker: imp.id,
      target: { kind: 'unit', id: grown.id },
    });

    expect(eventsOf(second.events, 'bossPhaseShift')).toHaveLength(0);
    // Now it takes real damage: 22 - 12 = 10.
    expect(second.state.players.enemy.hp).toBe(100);
  });

  it('grows the drake into its enraged form at the gate', () => {
    const state = ignisScenario({
      enemyHp: 240,
      units: [{ def: 'scout_imp', side: 'player', at: { x: 2, y: 0 }, atk: 120 }],
    });
    const imp = findUnit(state, 'scout_imp', 'player');
    const boss = alphaBody(state);

    const res = run(state, {
      type: 'attack',
      attacker: imp.id,
      target: { kind: 'unit', id: boss.id },
    });

    const grown = res.state.units[res.state.players.enemy.companionUnitId!];
    expect(grown?.defId).toBe('ignis_behemoth_bound');
    expect(grown?.footprint).toBe(2);
    expect(res.state.units[boss.id], 'the smaller body is gone').toBeUndefined();
  });

  it('spawns a phase-2 add instead when the drake is boxed in, refunding a marrow', () => {
    // Enemy bodies wall off every anchor a 2x2 could take, so the transformation has
    // nowhere to go and the phase calls for help instead. Enemy rather than terrain
    // deliberately: `evictAndSpawn` clears a *player* unit out of the way and refuses to
    // touch one of its own, which is what makes the drake genuinely stuck.
    //
    // The gate is crossed by damage dealt straight to the Pact rather than by a swing, so
    // the only player body on the board is the squatter whose eviction is under test.
    const state = ignisScenario({
      enemyHp: 240,
      // A player minion squatting on the first add site (1,1).
      units: [{ def: 'grave_sentinel', side: 'player', at: { x: 1, y: 1 }, hp: 60 }],
    });
    const squatter = findUnit(state, 'grave_sentinel', 'player');
    const boss = alphaBody(state);
    for (const at of [
      { x: 1, y: 0 },
      { x: 3, y: 1 },
      { x: 2, y: 2 },
      { x: 3, y: 2 },
    ]) {
      addUnit(state, { def: 'ember_moth', side: 'enemy', at });
    }

    const ctx = makeCtx(state);
    dealDamage(ctx, {
      target: { kind: 'portrait', side: 'enemy' },
      amount: 120,
      dtype: 'true',
      cause: 'spell',
    });

    expect(state.units[boss.id], 'it could not grow').toBeDefined();

    // Forced Eviction returns the squatter to hand with a marrow refund.
    expect(state.units[squatter.id]).toBeUndefined();
    const returned = eventsOf(ctx.events, 'cardReturnedToHand');
    expect(returned).toHaveLength(1);
    expect(returned[0]!.refundedMarrow).toBe(1);

    // An enemy add now occupies the spawn site.
    const add = Object.values(state.units).find(
      (u) => u.side === 'enemy' && u.anchor.x === 1 && u.anchor.y === 1,
    );
    expect(add).toBeDefined();
  });

  it('seals itself and deals the Rite at 25% boss HP', () => {
    // Boss at 12/44. 25% is 11. A 2-damage hit takes it to 10, crossing the threshold.
    const state = ignisScenario({
      enemyHp: 120,
      units: [{ def: 'scout_imp', side: 'player', at: { x: 2, y: 0 }, atk: 20 }],
    });
    state.encounter.firedGates.push('phase2'); // already past the 50% gate
    const imp = findUnit(state, 'scout_imp', 'player');
    const boss = alphaBody(state);

    const res = run(state, {
      type: 'attack',
      attacker: imp.id,
      target: { kind: 'unit', id: boss.id },
    });

    expect(eventsOf(res.events, 'subjugationBegan')).toHaveLength(1);

    const injected = eventsOf(res.events, 'cardInjected');
    expect(injected).toHaveLength(1);
    expect(injected[0]!.card.defId).toBe('rite_of_subjugation');
    expect(injected[0]!.card.cost).toEqual({ bones: 0, marrow: 0 });

    // On top of the draw pile, not in hand: it is guaranteed, but still has to be drawn.
    const player = res.state.players.player;
    expect(player.deck[0]).toBe(injected[0]!.card.instanceId);
    expect(player.hand).not.toContain(injected[0]!.card.instanceId);
  });

  it('stops taking damage once it is sealed', () => {
    const state = ignisScenario({
      enemyHp: 120,
      units: [{ def: 'scout_imp', side: 'player', at: { x: 2, y: 0 }, atk: 20 }],
    });
    state.encounter.firedGates.push('phase2');
    const imp = findUnit(state, 'scout_imp', 'player');
    const boss = alphaBody(state);

    const sealed = run(state, {
      type: 'attack',
      attacker: imp.id,
      target: { kind: 'unit', id: boss.id },
    });
    const after = sealed.state.players.enemy.hp;

    // The body is the only route to the pool, and the seal closes it. A second swing must
    // not move the number.
    const again = run(sealed.state, { type: 'endTurn' }, { type: 'endTurn' });
    const stillThere = again.state.units[imp.id];
    if (stillThere) {
      const hit = run(again.state, {
        type: 'attack',
        attacker: imp.id,
        target: { kind: 'unit', id: boss.id },
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
    // Strictly stronger. This read `before - 1` for a long time, which let a stack that
    // changed nothing pass — and for the Drake, whose Growth bonus is written as zero, it
    // did change nothing.
    expect(angrier.atk).toBeGreaterThan(before);

    // And a fresh Rite is dealt, so the loop can be tried again.
    expect(ctx.events.filter((e) => e.t === 'cardInjected').length).toBe(1);
  });

  it('snaps the tether when the growing boss evicts the anchor, instead of hanging the phase', () => {
    const { state, anchor, riteId } = sealedTrial();
    const tethered = run(state, {
      type: 'playCard',
      card: riteId,
      target: { kind: 'entity', ref: { kind: 'unit', id: anchor.id } },
    }).state;

    const boss = tethered.units[tethered.players.enemy.companionUnitId!]!;
    const before = boss.escalation;

    // The drake grows over the tile the anchor is bracing on. The anchor cannot step
    // aside — standing there is the whole of being an anchor — so the growth throws it
    // back to hand, a removal that never passes through `killEntity`.
    const ctx = makeCtx(tethered);
    const at = { ...tethered.units[anchor.id]!.anchor };
    expect(evictAndSpawn(ctx, at, false)).toBe(true);

    const sub = tethered.encounter.subjugation;
    expect(sub.active, 'the phase must not hang open').toBe(false);
    expect(sub.anchorUnitId).toBeNull();
    expect(ctx.events.some((e) => e.t === 'tetherSnapped')).toBe(true);

    // The beast is angrier, not merely free, and a fresh Rite is dealt so the bind can
    // be attempted again — the fight stays winnable.
    expect(boss.escalation, 'one punitive stack').toBe(before + 1);
    expect(ctx.events.filter((e) => e.t === 'cardInjected').length).toBe(1);
  });

  it('snaps rather than hangs when the anchor leaves the board by a route nothing anticipated', () => {
    const { state, anchor, riteId } = sealedTrial();
    const tethered = run(state, {
      type: 'playCard',
      card: riteId,
      target: { kind: 'entity', ref: { kind: 'unit', id: anchor.id } },
    }).state;

    // A removal that bypasses every pipeline — the class of future bug the tick's
    // backstop exists for. The alternative to snapping here is a fight that can neither
    // be won (the beast stays sealed) nor lost (the Pacifist Lockout is suspended).
    delete tethered.units[anchor.id];

    const res = run(tethered, { type: 'endTurn' }, { type: 'endTurn' });
    const sub = res.state.encounter.subjugation;
    expect(sub.active).toBe(false);
    expect(sub.anchorUnitId).toBeNull();
    expect(eventsOf(res.events, 'tetherSnapped')).toHaveLength(1);
    expect(eventsOf(res.events, 'subjugationProgress'), 'no round is counted').toHaveLength(0);
  });
});

describe('encounter definitions', () => {
  it('builds a playable Novice Duelist combat', () => {
    const { state, events } = createCombat(NOVICE_DUELIST, 42);

    expect(state.phase).toBe('action');
    expect(state.activeSide).toBe('player');
    expect(state.players.player.hp).toBe(400);
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
    expect(st.players.enemy.maxHp).toBe(440);
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
    st.players.enemy.hp = 200; // under the 22 threshold

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
    st.players.enemy.hp = 200;

    session.dispatch({ type: 'endTurn' });

    expect(session.debugState.players.enemy.hp).toBe(200);
  });

  it('leaves exactly one enemy body behind', () => {
    const { session, st } = trial();
    st.players.enemy.hp = 200;

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
    st.players.enemy.hp = 200;
    st.intents = [
      { unitId: bodyOf(st)!.id, kind: 'attack', at: { x: 3, y: 3 }, damage: 4 },
    ];

    session.dispatch({ type: 'endTurn' });

    expect(session.debugState.intents).toHaveLength(0);
  });

  it('keeps its footing after sudden death, restoring the shape it now wears', () => {
    const { session, st } = trial();
    st.players.enemy.hp = 200;
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
    st.players.enemy.hp = 200;
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
    const state = ignisScenario({ enemyHp: 100, width: 6, height: 8 });
    const ctx = makeCtx(state);
    beginSubjugation(ctx);

    const anchor = addUnit(state, { def: 'grave_sentinel', side: 'player', at: { x: 1, y: 6 } });
    // The player's Bound Form, and a hunter already in reach of it, so Pact damage is
    // genuinely on the table as an alternative to the tether.
    const body = addUnit(state, {
      def: 'scout_imp',
      side: 'player',
      at: { x: 2, y: 7 },
      keywords: ['BoundForm'],
    });
    state.players.player.companionUnitId = body.id;
    state.players.player.companionUnitDefId = 'ignis_bound';
    const hunter = addUnit(state, { def: 'scout_imp', side: 'enemy', at: { x: 1, y: 7 }, atk: 30 });

    const sub = state.encounter.subjugation;
    sub.active = true;
    sub.anchorUnitId = anchor.id;
    state.units[anchor.id]!.statuses.anchor = 1;
    state.activeSide = 'enemy';
    return { state, anchor, hunter, body };
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

  it('goes back to the Pact once the tether is gone', () => {
    // The same board with the tether released: the override must be the only thing that
    // was redirecting it, not some accident of the geometry. The Pact is reached through
    // the player's Bound Form, which is the only route there is.
    const { state, hunter, body } = hunt();
    state.encounter.subjugation.active = false;
    state.encounter.subjugation.anchorUnitId = null;

    const plan = planTurn(state, 'enemy');
    const strike = plan.find((c) => c.type === 'attack' && c.attacker === hunter.id);
    expect(strike && strike.type === 'attack' && strike.target).toEqual({
      kind: 'unit',
      id: body.id,
    });
  });
});

describe('the Sovereign, risen (grow-at-half via the shared builder)', () => {
  function sovereignScenario(opts: Parameters<typeof scenario>[0] = {}): GameState {
    const state = scenario(opts);
    state.encounter.id = 'bone_bastion';
    state.encounter.name = 'Apex Subjugation: The Bone Bastion Sovereign';
    state.players.enemy.maxHp = 460;
    return state;
  }

  function sovereignBody(state: GameState, at = { x: 2, y: 1 }) {
    const ctx = makeCtx(state);
    const id = summonUnit(ctx, 'sovereign_bound', 'enemy', at)!;
    state.players.enemy.companionUnitId = id;
    state.players.enemy.companionUnitDefId = 'sovereign_bound';
    return state.units[id]!;
  }

  it('rises into its 2x2 form at the halfway mark', () => {
    const state = sovereignScenario({
      enemyHp: 250,
      units: [{ def: 'scout_imp', side: 'player', at: { x: 2, y: 0 }, atk: 120 }],
    });
    const imp = findUnit(state, 'scout_imp', 'player');
    const boss = sovereignBody(state);

    const res = run(state, {
      type: 'attack',
      attacker: imp.id,
      target: { kind: 'unit', id: boss.id },
    });

    const shifts = eventsOf(res.state === res.state ? res.events : [], 'bossPhaseShift');
    expect(shifts.some((e) => e.name === 'The Bastion Wakes')).toBe(true);
    const grown = res.state.units[res.state.players.enemy.companionUnitId!];
    expect(grown?.defId).toBe('sovereign_behemoth_bound');
    expect(grown?.footprint).toBe(2);
    expect(res.state.players.enemy.hp, 'clamped to exactly half').toBe(230);
  });

  it('summons a sentinel instead when the ground refuses the risen form, without evicting', () => {
    // Player bodies wall the Sovereign in. The dead are patient — no Forced Eviction —
    // so the growth waits and the graves answer with a sentinel at the first free anchor.
    const state = sovereignScenario({
      width: 8,
      height: 8,
      enemyHp: 250,
      // The striker is part of the wall: adjacent enough to swing, player-owned enough
      // that the patient dead refuse to move it.
      units: [{ def: 'scout_imp', side: 'player', at: { x: 3, y: 1 }, atk: 120 }],
    });
    const boss = sovereignBody(state, { x: 2, y: 1 });
    // Wall every anchor a 2x2 could take around the boss with PLAYER bodies.
    for (const at of [
      { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 },
      { x: 1, y: 1 }, { x: 4, y: 1 },
      { x: 1, y: 2 }, { x: 2, y: 2 }, { x: 3, y: 2 }, { x: 4, y: 2 },
      { x: 4, y: 0 },
    ]) {
      addUnit(state, { def: 'ember_moth', side: 'player', at });
    }
    const imp = findUnit(state, 'scout_imp', 'player');
    const handBefore = state.players.player.hand.length;

    const res = run(state, {
      type: 'attack',
      attacker: imp.id,
      target: { kind: 'unit', id: boss.id },
    });

    const still = res.state.units[res.state.players.enemy.companionUnitId!];
    expect(still?.defId, 'the growth waits for room').toBe('sovereign_bound');
    expect(res.state.players.player.hand.length, 'nobody was evicted').toBe(handBefore);
    const sentinels = Object.values(res.state.units).filter(
      (u) => u.defId === 'grave_sentinel' && u.side === 'enemy',
    );
    expect(sentinels.length, 'the graves answered instead').toBeGreaterThan(0);
  });
});

describe('the Geist of Pylon Nine (starve it, not blast it)', () => {
  function geistScenario(): GameState {
    const state = scenario({ enemyHp: 400 });
    state.encounter.id = 'pylon_nine';
    state.encounter.name = 'The Geist of Pylon Nine';
    state.players.enemy.maxHp = 400;
    const ctx = makeCtx(state);
    const id = summonUnit(ctx, 'geist_bound', 'enemy', { x: 2, y: 1 })!;
    state.players.enemy.companionUnitId = id;
    state.players.enemy.companionUnitDefId = 'geist_bound';
    return state;
  }

  it('drinks shock: the blow lands as nothing and feeds it half', () => {
    const state = geistScenario();
    state.players.enemy.hp = 300;
    const ctx = makeCtx(state);
    dealDamage(ctx, {
      target: { kind: 'portrait', side: 'enemy' },
      amount: 40,
      dtype: 'shock',
      cause: 'spell',
    });
    expect(state.players.enemy.hp, '300 - 0 + heal 20').toBe(320);
  });

  it('announces the rule once, at the moment of the first mistake', () => {
    const state = geistScenario();
    state.players.enemy.hp = 300;
    const ctx = makeCtx(state);
    dealDamage(ctx, {
      target: { kind: 'portrait', side: 'enemy' },
      amount: 40,
      dtype: 'shock',
      cause: 'spell',
    });
    dealDamage(ctx, {
      target: { kind: 'portrait', side: 'enemy' },
      amount: 40,
      dtype: 'shock',
      cause: 'spell',
    });
    const shifts = ctx.events.filter(
      (e) => e.t === 'bossPhaseShift' && e.name === 'It Drinks the Charge',
    );
    expect(shifts).toHaveLength(1);
  });

  it('still bleeds to everything else, and seals at a quarter', () => {
    const state = geistScenario();
    state.players.enemy.hp = 120;
    const ctx = makeCtx(state);
    dealDamage(ctx, {
      target: { kind: 'portrait', side: 'enemy' },
      amount: 40,
      dtype: 'physical',
      cause: 'attack',
    });
    expect(state.players.enemy.hp).toBe(80);
    expect(state.encounter.subjugation.sealed, 'sealed below a quarter of 400').toBe(true);
  });
});
