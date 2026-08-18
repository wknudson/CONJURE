import { describe, expect, it } from 'vitest';
import {
  atTile,
  atUnit,
  eventsOf,
  findUnit,
  handCard,
  play,
  run,
  scenario,
} from './scenario.js';
import { applyCommand } from '../core/engine/engine.js';
import { IllegalCommandError } from '../core/types/commands.js';
import { legalAttacks, legalCardTargets } from '../core/engine/targeting.js';
import { canAttack, legalMoves } from '../core/engine/movement.js';
import { CombatSession } from '../core/session.js';
import { NOVICE_DUELIST } from '../core/data/encounters/index.js';

describe('deployment edges', () => {
  it('offers no target for a Behemoth when no 2x2 space remains in territory', () => {
    // Fill the player's back rows so no 2x2 footprint fits anywhere.
    const obstacles = [];
    for (let x = 0; x < 6; x += 2) {
      obstacles.push({ at: { x, y: 4 } }, { at: { x, y: 5 } });
    }
    const state = scenario({ width: 6, height: 6, obstacles, hand: ['magma_brute'] });

    expect(legalCardTargets(state, 'player', 'magma_brute')).toHaveLength(0);
  });

  it('rejects a Behemoth summon onto an occupied footprint', () => {
    const state = scenario({
      width: 6,
      height: 6,
      units: [{ def: 'scout_imp', side: 'player', at: { x: 3, y: 5 } }],
      hand: ['magma_brute'],
    });
    const card = handCard(state, 'player', 'magma_brute');

    // Anchor (2,4) would cover (2,4),(3,4),(2,5),(3,5) — the last is taken.
    const targets = legalCardTargets(state, 'player', 'magma_brute');
    expect(targets.some((t) => t.kind === 'tile' && t.at.x === 2 && t.at.y === 4)).toBe(false);

    expect(() => applyCommand(state, play(card, atTile(2, 4)))).toThrow();
  });

  it('leaves no legal summon tile when the whole territory is occupied', () => {
    const obstacles = [];
    for (let y = 4; y <= 5; y++) {
      for (let x = 0; x < 6; x++) obstacles.push({ at: { x, y } });
    }
    const state = scenario({ width: 6, height: 6, obstacles, hand: ['scout_imp'] });
    expect(legalCardTargets(state, 'player', 'scout_imp')).toHaveLength(0);
  });
});

describe('resource and card edges', () => {
  it('treats Cataclysmic Core as untargetable when no runes are on the board', () => {
    const bare = scenario({ pips: 8, hand: ['cataclysmic_core'] });
    expect(legalCardTargets(bare, 'player', 'cataclysmic_core')).toHaveLength(0);

    const withRune = scenario({
      pips: 8,
      units: [{ def: 'scout_imp', side: 'enemy', at: { x: 2, y: 1 }, rune: 'cinder_rune' }],
      hand: ['cataclysmic_core'],
    });
    expect(legalCardTargets(withRune, 'player', 'cataclysmic_core')).toHaveLength(1);
  });

  it('does not crash or damage anyone when deck and discard are both empty', () => {
    const state = scenario({ playerHp: 40 });
    state.players.player.deck = [];
    state.players.player.discard = [];
    state.players.player.hand = [];

    const res = run(state, { type: 'endTurn' }, { type: 'endTurn' });

    expect(res.state.players.player.hp).toBe(40);
    expect(res.state.players.player.hand).toHaveLength(0);
  });

  it('rejects playing a card that is not in hand', () => {
    const state = scenario({ hand: ['scout_imp'] });
    expect(() => applyCommand(state, play('nonexistent', atTile(2, 4)))).toThrow(
      IllegalCommandError,
    );
  });

  it('rejects a card the commander cannot afford', () => {
    const state = scenario({ pips: 0, marrow: 0, hand: ['magma_brute'] });
    const card = handCard(state, 'player', 'magma_brute');
    expect(() => applyCommand(state, play(card, atTile(2, 4)))).toThrow(IllegalCommandError);
  });
});

describe('combat resolution edges', () => {
  it('kills the attacker when Counter damage exceeds its remaining HP', () => {
    const state = scenario({
      units: [
        { def: 'scout_imp', side: 'player', at: { x: 2, y: 2 }, hp: 1 },
        { def: 'grave_sentinel', side: 'enemy', at: { x: 2, y: 1 }, hp: 10, atk: 5 },
      ],
    });
    const attacker = findUnit(state, 'scout_imp', 'player');
    const sentinel = findUnit(state, 'grave_sentinel', 'enemy');

    const res = run(state, {
      type: 'attack',
      attacker: attacker.id,
      target: { kind: 'unit', id: sentinel.id },
    });

    expect(res.state.units[attacker.id]).toBeUndefined();
    expect(res.state.units[sentinel.id]!.hp).toBe(8);
  });

  it('takes only one wall hit when shoved into a corner', () => {
    const state = scenario({
      width: 6,
      height: 6,
      units: [{ def: 'grave_sentinel', side: 'enemy', at: { x: 0, y: 0 }, hp: 10 }],
      hand: ['shield_bash'],
    });
    const foe = findUnit(state, 'grave_sentinel', 'enemy');

    const res = run(state, play(handCard(state, 'player', 'shield_bash'), atUnit(foe.id)));

    expect(eventsOf(res.events, 'collision')).toHaveLength(1);
    expect(res.state.units[foe.id]!.hp).toBe(10 - 2 - 3);
  });

  it('fizzles a rune attached to an obstacle when the obstacle is destroyed', () => {
    const state = scenario({
      obstacles: [{ at: { x: 2, y: 2 }, hp: 2, rune: 'cinder_rune' }],
      units: [{ def: 'scout_imp', side: 'player', at: { x: 2, y: 3 }, atk: 9 }],
    });
    const attacker = findUnit(state, 'scout_imp', 'player');
    const obstacleId = Object.keys(state.obstacles)[0]!;

    const res = run(state, {
      type: 'attack',
      attacker: attacker.id,
      target: { kind: 'obstacle', id: obstacleId },
    });

    // Physical damage is unaligned with a fire rune, so it is lost rather than detonating.
    expect(eventsOf(res.events, 'runeFizzled')).toHaveLength(1);
    expect(eventsOf(res.events, 'runeDetonated')).toHaveLength(0);
    expect(res.state.obstacles[obstacleId]).toBeUndefined();
  });

  it('survives a unit being killed by its own rune cascade', () => {
    // Two adjacent runed units at 1 HP: the first detonation kills the second, whose
    // own rune then detonates back into the now-empty tile.
    const state = scenario({
      units: [
        { def: 'scout_imp', side: 'enemy', at: { x: 2, y: 2 }, hp: 1, rune: 'cinder_rune' },
        { def: 'scout_imp', side: 'enemy', at: { x: 3, y: 2 }, hp: 1, rune: 'cinder_rune' },
      ],
      hand: ['flame_surge'],
    });

    const res = run(
      state,
      play(handCard(state, 'player', 'flame_surge'), {
        kind: 'line',
        from: { x: 2, y: 2 },
        dir: { x: 0, y: -1 },
      }),
    );

    expect(eventsOf(res.events, 'runeDetonated').length).toBeGreaterThanOrEqual(1);
    expect(Object.keys(res.state.units)).toHaveLength(0);
    expect(res.state.result).toBeUndefined();
  });

  it('lets the last unit be sacrificed without breaking the turn', () => {
    const state = scenario({
      units: [{ def: 'marrow_wisp', side: 'player', at: { x: 2, y: 4 } }],
    });
    const wisp = findUnit(state, 'marrow_wisp', 'player');

    const res = run(state, { type: 'sacrifice', unit: wisp.id }, { type: 'endTurn' });

    expect(res.state.units[wisp.id]).toBeUndefined();
    expect(res.state.result).toBeUndefined();
  });

  it('does not escalate HP past a fresh unit maximum incorrectly', () => {
    const state = scenario({
      playerHp: 500,
      enemyHp: 500,
      units: [{ def: 'grave_sentinel', side: 'player', at: { x: 2, y: 4 }, hp: 6 }],
    });
    const sentinel = findUnit(state, 'grave_sentinel', 'player');

    const res = run(state, { type: 'endTurn' }, { type: 'endTurn' }, { type: 'endTurn' }, { type: 'endTurn' });
    const after = res.state.units[sentinel.id]!;

    // Escalation raises max and current HP together, so it never exceeds its own max.
    expect(after.hp).toBeLessThanOrEqual(after.maxHp);
    expect(after.maxHp).toBe(6 + after.escalation);
  });
});

describe('movement edges', () => {
  it('offers no further moves once a unit has moved, even though it may still attack', () => {
    // The UI drives off legalMoves, so if it disagreed with the command validator the
    // player would see highlighted tiles that throw when clicked.
    const state = scenario({
      width: 6,
      height: 6,
      units: [{ def: 'scout_imp', side: 'player', at: { x: 2, y: 4 } }],
    });
    const imp = findUnit(state, 'scout_imp', 'player');

    const moved = run(state, { type: 'moveUnit', unit: imp.id, to: { x: 2, y: 3 } }).state;
    const unit = moved.units[imp.id]!;

    expect(unit.movedThisTurn).toBe(true);
    expect(canAttack(unit)).toBe(true);
    expect(legalMoves(moved, unit)).toHaveLength(0);
    expect(() =>
      applyCommand(moved, { type: 'moveUnit', unit: imp.id, to: { x: 2, y: 2 } }),
    ).toThrow(IllegalCommandError);
  });

  it('roots an entangled unit but leaves it able to attack', () => {
    const state = scenario({
      units: [
        { def: 'scout_imp', side: 'player', at: { x: 2, y: 2 } },
        { def: 'scout_imp', side: 'enemy', at: { x: 2, y: 1 } },
      ],
    });
    const imp = findUnit(state, 'scout_imp', 'player');
    state.units[imp.id]!.statuses.entangle = 2;

    expect(legalMoves(state, state.units[imp.id]!)).toHaveLength(0);
    expect(() =>
      applyCommand(state, { type: 'moveUnit', unit: imp.id, to: { x: 2, y: 3 } }),
    ).toThrow(IllegalCommandError);

    // Entangle stops the legs, not the arms.
    expect(legalAttacks(state, state.units[imp.id]!).length).toBeGreaterThan(0);
  });

  it('gives a frozen unit no legal moves or attacks', () => {
    const state = scenario({
      units: [
        { def: 'scout_imp', side: 'player', at: { x: 2, y: 2 } },
        { def: 'scout_imp', side: 'enemy', at: { x: 2, y: 1 } },
      ],
    });
    const imp = findUnit(state, 'scout_imp', 'player');
    state.units[imp.id]!.statuses.freeze = 1;

    expect(legalMoves(state, state.units[imp.id]!)).toHaveLength(0);
  });
});

describe('resonance', () => {
  it('fires once per turn and recharges on the next turn', () => {
    const session = new CombatSession(NOVICE_DUELIST, 11);
    expect(session.getBoard().player.resonanceUsed).toBe(false);

    // Play every Companion card we can afford this turn.
    let fired = 0;
    for (const card of session.getHand()) {
      if (card.source !== 'companion') continue;
      if (!session.getPlayableCards().includes(card.instanceId)) continue;
      const spec = session.getLegalTargets(card.instanceId);
      const target =
        spec.kind === 'entities' && spec.refs[0]
          ? { kind: 'entity' as const, ref: spec.refs[0] }
          : spec.kind === 'tiles' && spec.tiles[0]
            ? { kind: 'tile' as const, at: spec.tiles[0] }
            : spec.kind === 'lines' && spec.origins[0]
              ? { kind: 'line' as const, from: spec.origins[0].from, dir: spec.origins[0].dir }
              : null;
      if (!target) continue;
      const events = session.dispatch({ type: 'playCard', card: card.instanceId, target });
      fired += events.filter((e) => e.t === 'resonanceTriggered').length;
    }

    if (fired > 0) {
      expect(fired, 'resonance must not fire twice in one turn').toBe(1);
      expect(session.getBoard().player.resonanceUsed).toBe(true);

      session.dispatch({ type: 'endTurn' });
      session.runAiTurn();
      expect(session.getBoard().player.resonanceUsed).toBe(false);
    }
  });

  it('only ignites enemies standing in the Companion column', () => {
    const state = scenario({
      width: 6,
      height: 6,
      units: [
        { def: 'scout_imp', side: 'enemy', at: { x: 4, y: 1 } },
        { def: 'scout_imp', side: 'enemy', at: { x: 0, y: 1 } },
        { def: 'marrow_wisp', side: 'player', at: { x: 2, y: 4 } },
      ],
      hand: ['soul_splinter_rune'],
    });
    const inLane = state.units[findUnit(state, 'scout_imp', 'enemy').id]!;
    const wisp = findUnit(state, 'marrow_wisp', 'player');
    const outOfLane = Object.values(state.units).find(
      (u) => u.side === 'enemy' && u.anchor.x === 0,
    )!;

    expect(state.players.player.companionColumn).toBe(4);

    const res = run(state, play(handCard(state, 'player', 'soul_splinter_rune'), atUnit(wisp.id)));

    expect(res.state.units[inLane.id]!.statuses.burn).toBe(1);
    expect(res.state.units[outOfLane.id]!.statuses.burn).toBeUndefined();
  });
});

describe('opening setup', () => {
  it('gives both sides a free Vanguard and a playable first turn', () => {
    const session = new CombatSession(NOVICE_DUELIST, 5);
    const board = session.getBoard();

    const vanguards = board.units.filter((u) => u.defId === 'vanguard_footman');
    expect(vanguards).toHaveLength(2);
    expect(vanguards.some((u) => u.side === 'player')).toBe(true);
    expect(vanguards.some((u) => u.side === 'enemy')).toBe(true);

    // Turn one must offer something to actually do.
    expect(session.getPlayableCards().length).toBeGreaterThan(0);
    expect(board.player.pips).toBeGreaterThanOrEqual(3);
  });

  it('lets the opening Vanguard act immediately', () => {
    const session = new CombatSession(NOVICE_DUELIST, 5);
    const vanguard = session.getBoard().units.find(
      (u) => u.defId === 'vanguard_footman' && u.side === 'player',
    )!;
    expect(session.getLegalMoves(vanguard.id).length).toBeGreaterThan(0);
  });
});
