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
import { GROWTH_CAP, GROWTH_CAP_BEHEMOTH } from '../core/engine/growth.js';

describe('resources', () => {
  it('caps the pip bank at 8 only during end-of-turn cleanup', () => {
    const state = scenario({ pips: 12, marrow: 3 });
    // In-turn overflow is legal: the combined pool may exceed 8.
    expect(state.players.player.pips + state.players.player.marrow).toBe(15);

    const res = run(state, { type: 'endTurn' });
    expect(res.state.players.player.pips).toBe(PIP_CAP);
  });

  it('expires all marrow at end of turn', () => {
    const state = scenario({ pips: 2, marrow: 5 });
    const res = run(state, { type: 'endTurn' });
    expect(res.state.players.player.marrow).toBe(0);
  });

  it('spends marrow before pips, since marrow evaporate', () => {
    const state = scenario({ pips: 5, marrow: 2, hand: ['grave_sentinel'] });
    const res = run(state, play(handCard(state, 'player', 'grave_sentinel'), atTile(2, 4)));
    // Cost 2 taken entirely from marrow.
    expect(res.state.players.player.marrow).toBe(0);
    expect(res.state.players.player.pips).toBe(5);
  });

  it('burns an overdrawn card and grants a marrow instead of overfilling the hand', () => {
    const state = scenario({ marrow: 0 });
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
    // The burned card converts into a Marrow rather than being lost outright.
    expect(res.state.players.player.marrow).toBeGreaterThan(0);
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
    expect(res.state.players.player.hp).toBe(400);
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
        { def: 'scout_imp', side: 'enemy', at: { x: 2, y: 1 }, hp: 90 },
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
        { def: 'scout_imp', side: 'enemy', at: { x: 2, y: 1 }, hp: 90 },
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
        { def: 'scout_imp', side: 'enemy', at: { x: 2, y: 1 }, hp: 200 },
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
    // Through the enemy's Bound Form, which is the only route to a Pact: the body keeps
    // no health of its own, so the blow is Pact damage and the clock stays at zero.
    const state = scenario({
      units: [
        { def: 'scout_imp', side: 'player', at: { x: 2, y: 1 }, atk: 10 },
        { def: 'scout_imp', side: 'enemy', at: { x: 2, y: 0 }, keywords: ['BoundForm'] },
      ],
    });
    const imp = findUnit(state, 'scout_imp', 'player');
    const body = findUnit(state, 'scout_imp', 'enemy');

    const res = run(
      state,
      { type: 'attack', attacker: imp.id, target: { kind: 'unit', id: body.id } },
      { type: 'endTurn' },
      { type: 'endTurn' },
    );

    expect(res.state.stalledRounds).toBe(0);
  });

  it('stays silent through five idle rounds, then punishes both commanders', () => {
    let cur = scenario({ playerHp: 400, enemyHp: 400 });

    // The threshold is deliberately high: competent play should never reach it.
    for (let i = 0; i < 5; i++) {
      cur = run(cur, { type: 'endTurn' }, { type: 'endTurn' }).state;
    }
    expect(cur.players.player.hp).toBe(400);
    expect(cur.players.enemy.hp).toBe(400);

    cur = run(cur, { type: 'endTurn' }, { type: 'endTurn' }).state;
    expect(cur.stalledRounds).toBeGreaterThanOrEqual(6);
    expect(cur.players.player.hp).toBeLessThan(400);
    expect(cur.players.enemy.hp).toBeLessThan(400);
  });

  it('guarantees an idle game eventually ends', () => {
    let cur = scenario({ playerHp: 400, enemyHp: 400 });
    let guard = 0;
    while (!cur.result && guard++ < 40) {
      cur = run(cur, { type: 'endTurn' }, { type: 'endTurn' }).state;
    }
    expect(cur.result).toBeDefined();
  });
});

describe('Growth is the enemy clock only', () => {
  it('does not grow an enemy unit on the turn it arrived', () => {
    const state = scenario({
      playerHp: 5000,
      enemyHp: 5000,
      units: [{ def: 'scout_imp', side: 'enemy', at: { x: 2, y: 1 }, fresh: true }],
    });
    const imp = findUnit(state, 'scout_imp', 'enemy');
    expect(state.units[imp.id]!.escalation).toBe(0);

    // One full round later it has survived a player phase and starts scaling.
    const cycled = run(state, { type: 'endTurn' }, { type: 'endTurn' });
    expect(cycled.state.units[imp.id]!.escalation).toBe(0);

    const twice = run(cycled.state, { type: 'endTurn' }, { type: 'endTurn' });
    expect(twice.state.units[imp.id]!.escalation).toBe(1);
  });

  it('never grows a player unit, however long it stands', () => {
    // The whole point of the split. A player body that kept the keyword would be growing
    // on two clocks at once, and the uncapped one would win.
    const state = scenario({
      playerHp: 5000,
      enemyHp: 5000,
      units: [{ def: 'scout_imp', side: 'player', at: { x: 2, y: 4 }, fresh: false }],
    });
    const imp = findUnit(state, 'scout_imp', 'player');
    const atkBefore = state.units[imp.id]!.atk;

    let cur = state;
    for (let i = 0; i < 6; i++) {
      cur = run(cur, { type: 'endTurn' }, { type: 'endTurn' }).state;
    }

    expect(cur.units[imp.id]!.escalation).toBe(0);
    expect(cur.units[imp.id]!.atk).toBe(atkBefore);
  });

  it('caps a 1x1 enemy at +3 stacks', () => {
    // High commander HP so the Pacifist Lockout, which fires after three idle rounds,
    // does not end the game before growth reaches its cap.
    const state = scenario({
      playerHp: 5000,
      enemyHp: 5000,
      units: [{ def: 'scout_imp', side: 'enemy', at: { x: 2, y: 1 }, fresh: false }],
    });
    let cur = state;
    for (let i = 0; i < 8; i++) {
      cur = run(cur, { type: 'endTurn' }, { type: 'endTurn' }).state;
    }
    const imp = findUnit(cur, 'scout_imp', 'enemy');
    expect(cur.units[imp.id]!.escalation).toBe(GROWTH_CAP);
  });

  it('gives a Behemoth a finite ceiling that survives a save', () => {
    // `Infinity` used to sit here and is not JSON: a saved fight came back with the
    // ceiling replaced by `null`. The number matters less than its being writable.
    expect(Number.isFinite(GROWTH_CAP_BEHEMOTH)).toBe(true);
    expect(JSON.parse(JSON.stringify({ cap: GROWTH_CAP_BEHEMOTH })).cap).toBe(GROWTH_CAP_BEHEMOTH);
    expect(GROWTH_CAP_BEHEMOTH).toBeGreaterThan(GROWTH_CAP);
  });
});

describe('movement costs', () => {
  it('charges one per step while every tile is open ground', () => {
    const state = scenario({
      width: 6,
      height: 8,
      units: [{ def: 'scout_imp', side: 'player', at: { x: 2, y: 4 } }],
    });
    const imp = findUnit(state, 'scout_imp', 'player');

    for (const move of legalMoves(state, imp)) {
      // The path includes the starting tile, so a cost of N is N+1 waypoints.
      expect(move.cost, `path to ${move.to.x},${move.to.y}`).toBe(move.path.length - 1);
      expect(move.cost).toBeLessThanOrEqual(state.units[imp.id]!.mov);
    }
  });

  it('reaches everything within its allowance on an empty board', () => {
    const state = scenario({
      width: 6,
      height: 8,
      units: [{ def: 'scout_imp', side: 'player', at: { x: 2, y: 4 } }],
    });
    const imp = findUnit(state, 'scout_imp', 'player');
    const mov = state.units[imp.id]!.mov;

    const reached = new Set(legalMoves(state, imp).map((m) => `${m.to.x},${m.to.y}`));
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 6; x++) {
        const steps = Math.max(Math.abs(x - 2), Math.abs(y - 4));
        if (steps === 0 || steps > mov) continue;
        expect(reached.has(`${x},${y}`), `should reach ${x},${y}`).toBe(true);
      }
    }
  });
});
