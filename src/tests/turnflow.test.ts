import { describe, expect, it } from 'vitest';
import {
  atTile,
  eventsOf,
  findUnit,
  giveCard,
  handCard,
  play,
  run,
  scenario,
} from './scenario.js';
import { applyCommand } from '../core/engine/engine.js';
import { IllegalCommandError } from '../core/types/commands.js';
import { PIP_CAP } from '../core/engine/deck.js';
import { canMove, legalMoves } from '../core/engine/movement.js';

describe('resources', () => {
  it('caps the pip bank at 8 only during end-of-turn cleanup', () => {
    const state = scenario({ pips: 12, sparks: 3 });
    // In-turn overflow is legal: the combined pool may exceed 8.
    expect(state.players.player.pips + state.players.player.sparks).toBe(15);

    const res = run(state, { type: 'endTurn' });
    expect(res.state.players.player.pips).toBe(PIP_CAP);
  });

  it('expires all sparks at end of turn', () => {
    const state = scenario({ pips: 2, sparks: 5 });
    const res = run(state, { type: 'endTurn' });
    expect(res.state.players.player.sparks).toBe(0);
  });

  it('spends sparks before pips, since sparks evaporate', () => {
    const state = scenario({ pips: 5, sparks: 2, hand: ['grave_sentinel'] });
    const res = run(state, play(handCard(state, 'player', 'grave_sentinel'), atTile(2, 4)));
    // Cost 2 taken entirely from sparks.
    expect(res.state.players.player.sparks).toBe(0);
    expect(res.state.players.player.pips).toBe(5);
  });

  it('burns an overdrawn card and grants a spark instead of overfilling the hand', () => {
    const state = scenario({ sparks: 0 });
    const cmd = state.players.player;
    // Aegis Ward has Retain, so these survive end-of-turn cleanup and the hand is still
    // full at the limit of 7 when next turn's draw step runs.
    for (let i = 0; i < 7; i++) giveCard(state, 'player', 'aegis_ward');
    const extra = giveCard(state, 'player', 'flame_surge');
    cmd.hand = cmd.hand.filter((id) => id !== extra);
    cmd.deck.push(extra);

    const res = run(state, { type: 'endTurn' }, { type: 'endTurn' });

    const burned = eventsOf(res.events, 'cardBurned').filter((e) => e.side === 'player');
    expect(burned.length).toBeGreaterThan(0);
    // The burned card converts into a Spark rather than being lost outright.
    expect(res.state.players.player.sparks).toBeGreaterThan(0);
  });

  it('reshuffles the discard pile for free when the deck runs out', () => {
    const state = scenario({});
    const cmd = state.players.player;
    cmd.hand = [];
    cmd.deck = [];
    for (let i = 0; i < 4; i++) {
      const id = giveCard(state, 'player', 'scout_imp');
      cmd.hand = cmd.hand.filter((h) => h !== id);
      cmd.discard.push(id);
    }

    const res = run(state, { type: 'endTurn' }, { type: 'endTurn' });

    const reshuffles = eventsOf(res.events, 'deckReshuffled').filter((e) => e.side === 'player');
    expect(reshuffles.length).toBeGreaterThan(0);
    // No fatigue damage: the commander is untouched.
    expect(res.state.players.player.hp).toBe(40);
  });

  it('keeps Retain cards in hand through end-of-turn cleanup', () => {
    const state = scenario({ hand: ['aegis_ward', 'scout_imp'] });
    const retained = handCard(state, 'player', 'aegis_ward');
    const discarded = handCard(state, 'player', 'scout_imp');

    const res = run(state, { type: 'endTurn' });

    expect(res.state.players.player.hand).toContain(retained);
    expect(res.state.players.player.hand).not.toContain(discarded);
  });
});

describe('action economy', () => {
  it('spends both actions on move-then-attack, blocking a further move', () => {
    const state = scenario({
      units: [
        { def: 'scout_imp', side: 'player', at: { x: 2, y: 3 } },
        { def: 'scout_imp', side: 'enemy', at: { x: 2, y: 1 }, hp: 9 },
      ],
    });
    const imp = findUnit(state, 'scout_imp', 'player');
    const foe = findUnit(state, 'scout_imp', 'enemy');

    // Move adjacent, then attack — both legal.
    const afterMove = applyCommand(state, { type: 'moveUnit', unit: imp.id, to: { x: 2, y: 2 } });
    const afterAttack = applyCommand(afterMove.state, {
      type: 'attack',
      attacker: imp.id,
      target: { kind: 'unit', id: foe.id },
    });

    // Both actions are now spent, so a second move is rejected.
    expect(() =>
      applyCommand(afterAttack.state, { type: 'moveUnit', unit: imp.id, to: { x: 3, y: 2 } }),
    ).toThrow(IllegalCommandError);
  });

  it('allows attack-then-move, so a unit can strike and withdraw', () => {
    const state = scenario({
      units: [
        { def: 'scout_imp', side: 'player', at: { x: 2, y: 2 } },
        { def: 'scout_imp', side: 'enemy', at: { x: 2, y: 1 }, hp: 9 },
      ],
    });
    const imp = findUnit(state, 'scout_imp', 'player');
    const foe = findUnit(state, 'scout_imp', 'enemy');

    const afterAttack = applyCommand(state, {
      type: 'attack',
      attacker: imp.id,
      target: { kind: 'unit', id: foe.id },
    });

    // Independent actions: attacking spends only the attack, so the retreat is legal.
    const attacker = afterAttack.state.units[imp.id]!;
    expect(attacker.attackedThisTurn).toBe(true);
    expect(canMove(attacker)).toBe(true);

    const afterRetreat = applyCommand(afterAttack.state, {
      type: 'moveUnit',
      unit: imp.id,
      to: { x: 2, y: 4 },
    });
    expect(afterRetreat.state.units[imp.id]!.anchor).toEqual({ x: 2, y: 4 });

    // But only one of each: no second attack, and no second move.
    expect(() =>
      applyCommand(afterRetreat.state, { type: 'moveUnit', unit: imp.id, to: { x: 2, y: 3 } }),
    ).toThrow(IllegalCommandError);
  });

  it('refuses a second attack even when the unit has not moved', () => {
    const state = scenario({
      units: [
        { def: 'scout_imp', side: 'player', at: { x: 2, y: 2 } },
        { def: 'scout_imp', side: 'enemy', at: { x: 2, y: 1 }, hp: 20 },
      ],
    });
    const imp = findUnit(state, 'scout_imp', 'player');
    const foe = findUnit(state, 'scout_imp', 'enemy');
    const cmd = { type: 'attack' as const, attacker: imp.id, target: { kind: 'unit' as const, id: foe.id } };

    const once = applyCommand(state, cmd);
    expect(() => applyCommand(once.state, cmd)).toThrow(IllegalCommandError);
  });

  it('never lets a 2x2 Behemoth squeeze through a 1x1 gap', () => {
    // A wall of barricades across row 2 with a single 1-wide hole at x=2.
    const state = scenario({
      units: [{ def: 'magma_brute', side: 'player', at: { x: 1, y: 3 } }],
      obstacles: [
        { at: { x: 0, y: 2 } },
        { at: { x: 1, y: 2 } },
        { at: { x: 3, y: 2 } },
        { at: { x: 4, y: 2 } },
      ],
    });
    const brute = findUnit(state, 'magma_brute', 'player');

    const moves = legalMoves(state, brute);
    // Nothing it can reach crosses the wall into rows 0-1.
    expect(moves.every((m) => m.to.y >= 2)).toBe(true);
  });
});

describe('pacifist lockout', () => {
  it('does nothing while commanders are trading damage', () => {
    const state = scenario({
      units: [{ def: 'scout_imp', side: 'player', at: { x: 2, y: 0 }, atk: 1 }],
    });
    const imp = findUnit(state, 'scout_imp', 'player');

    const res = run(
      state,
      { type: 'attack', attacker: imp.id, target: { kind: 'portrait', side: 'enemy' } },
      { type: 'endTurn' },
      { type: 'endTurn' },
    );

    expect(res.state.stalledRounds).toBe(0);
  });

  it('stays silent through five idle rounds, then punishes both commanders', () => {
    let cur = scenario({ playerHp: 40, enemyHp: 40 });

    // The threshold is deliberately high: competent play should never reach it.
    for (let i = 0; i < 5; i++) {
      cur = run(cur, { type: 'endTurn' }, { type: 'endTurn' }).state;
    }
    expect(cur.players.player.hp).toBe(40);
    expect(cur.players.enemy.hp).toBe(40);

    cur = run(cur, { type: 'endTurn' }, { type: 'endTurn' }).state;
    expect(cur.stalledRounds).toBeGreaterThanOrEqual(6);
    expect(cur.players.player.hp).toBeLessThan(40);
    expect(cur.players.enemy.hp).toBeLessThan(40);
  });

  it('guarantees an idle game eventually ends', () => {
    let cur = scenario({ playerHp: 40, enemyHp: 40 });
    let guard = 0;
    while (!cur.result && guard++ < 40) {
      cur = run(cur, { type: 'endTurn' }, { type: 'endTurn' }).state;
    }
    expect(cur.result).toBeDefined();
  });
});

describe('escalation', () => {
  it('does not escalate a unit on the turn it was deployed', () => {
    const state = scenario({ hand: ['scout_imp'], pips: 5 });
    const played = run(state, play(handCard(state, 'player', 'scout_imp'), atTile(2, 4)));
    const imp = findUnit(played.state, 'scout_imp', 'player');
    expect(played.state.units[imp.id]!.escalation).toBe(0);

    // One full round later it has survived the enemy phase and starts scaling.
    const cycled = run(played.state, { type: 'endTurn' }, { type: 'endTurn' });
    expect(cycled.state.units[imp.id]!.escalation).toBe(0);

    const twice = run(cycled.state, { type: 'endTurn' }, { type: 'endTurn' });
    expect(twice.state.units[imp.id]!.escalation).toBe(1);
    expect(twice.state.units[imp.id]!.atk).toBe(3);
  });

  it('caps 1x1 escalation at +3 stacks', () => {
    // High commander HP so the Pacifist Lockout, which fires after three idle rounds,
    // does not end the game before escalation reaches its cap.
    const state = scenario({
      playerHp: 500,
      enemyHp: 500,
      units: [{ def: 'scout_imp', side: 'player', at: { x: 2, y: 4 } }],
    });
    let cur = state;
    for (let i = 0; i < 8; i++) {
      cur = run(cur, { type: 'endTurn' }, { type: 'endTurn' }).state;
    }
    const imp = findUnit(cur, 'scout_imp', 'player');
    expect(cur.units[imp.id]!.escalation).toBe(3);
  });
});
