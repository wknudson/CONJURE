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
import { STAT_SCALE } from '../core/scale.js';

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
  it('treats Cataclysmic Core as untargetable when no marks are on the board', () => {
    const bare = scenario({ pips: 8, hand: ['cataclysmic_core'] });
    expect(legalCardTargets(bare, 'player', 'cataclysmic_core')).toHaveLength(0);

    const withMark = scenario({
      pips: 8,
      units: [{ def: 'scout_imp', side: 'enemy', at: { x: 2, y: 1 }, mark: 'cinder_mark' }],
      hand: ['cataclysmic_core'],
    });
    expect(legalCardTargets(withMark, 'player', 'cataclysmic_core')).toHaveLength(1);
  });

  it('does not crash or damage anyone when deck and discard are both empty', () => {
    const state = scenario({ playerHp: 400 });
    state.players.player.deck = [];
    state.players.player.discard = [];
    state.players.player.hand = [];

    const res = run(state, { type: 'endTurn' }, { type: 'endTurn' });

    expect(res.state.players.player.hp).toBe(400);
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
        { def: 'scout_imp', side: 'player', at: { x: 2, y: 2 }, hp: 10 },
        { def: 'grave_sentinel', side: 'enemy', at: { x: 2, y: 1 }, hp: 100, atk: 50 },
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
    expect(res.state.units[sentinel.id]!.hp).toBe(80);
  });

  it('takes only one wall hit when shoved into a corner', () => {
    const state = scenario({
      width: 6,
      height: 6,
      units: [{ def: 'grave_sentinel', side: 'enemy', at: { x: 0, y: 0 }, hp: 100 }],
      hand: ['shield_bash'],
    });
    const foe = findUnit(state, 'grave_sentinel', 'enemy');

    const res = run(state, play(handCard(state, 'player', 'shield_bash'), atUnit(foe.id)));

    expect(eventsOf(res.events, 'collision')).toHaveLength(1);
    expect(res.state.units[foe.id]!.hp).toBe(100 - 20 - 30);
  });

  it('fizzles a mark attached to an obstacle when the obstacle is destroyed', () => {
    const state = scenario({
      obstacles: [{ at: { x: 2, y: 2 }, hp: 20, mark: 'cinder_mark' }],
      units: [{ def: 'scout_imp', side: 'player', at: { x: 2, y: 3 }, atk: 90 }],
    });
    const attacker = findUnit(state, 'scout_imp', 'player');
    const obstacleId = Object.keys(state.obstacles)[0]!;

    const res = run(state, {
      type: 'attack',
      attacker: attacker.id,
      target: { kind: 'obstacle', id: obstacleId },
    });

    // Physical damage is unaligned with a fire mark, so it is lost rather than detonating.
    expect(eventsOf(res.events, 'markFizzled')).toHaveLength(1);
    expect(eventsOf(res.events, 'markDetonated')).toHaveLength(0);
    expect(res.state.obstacles[obstacleId]).toBeUndefined();
  });

  it('survives a unit being killed by its own mark cascade', () => {
    // Two adjacent markd units at 1 HP: the first detonation kills the second, whose
    // own mark then detonates back into the now-empty tile.
    const state = scenario({
      units: [
        { def: 'scout_imp', side: 'enemy', at: { x: 2, y: 2 }, hp: 10, mark: 'cinder_mark' },
        { def: 'scout_imp', side: 'enemy', at: { x: 3, y: 2 }, hp: 10, mark: 'cinder_mark' },
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

    expect(eventsOf(res.events, 'markDetonated').length).toBeGreaterThanOrEqual(1);
    expect(Object.keys(res.state.units)).toHaveLength(0);
    expect(res.state.result).toBeUndefined();
  });

  it('lets the last unit be bled to death without breaking the turn', () => {
    const state = scenario({
      units: [{ def: 'marrow_wisp', side: 'player', at: { x: 2, y: 4 } }],
    });
    const wisp = findUnit(state, 'marrow_wisp', 'player');

    const res = run(state, { type: 'bloodTithe', unit: wisp.id }, { type: 'endTurn' });

    expect(res.state.units[wisp.id]).toBeUndefined();
    expect(res.state.result).toBeUndefined();
  });

  it('does not escalate HP past a fresh unit maximum incorrectly', () => {
    const state = scenario({
      playerHp: 5000,
      enemyHp: 5000,
      units: [{ def: 'grave_sentinel', side: 'player', at: { x: 2, y: 4 }, hp: 60 }],
    });
    const sentinel = findUnit(state, 'grave_sentinel', 'player');

    const res = run(state, { type: 'endTurn' }, { type: 'endTurn' }, { type: 'endTurn' }, { type: 'endTurn' });
    const after = res.state.units[sentinel.id]!;

    // Escalation raises max and current HP together, so it never exceeds its own max.
    expect(after.hp).toBeLessThanOrEqual(after.maxHp);
    // A stretched body, and a growth step that stretched with it.
    expect(after.maxHp).toBe(60 + after.escalation * STAT_SCALE);
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
      hand: ['soul_splinter_mark'],
    });
    const inLane = state.units[findUnit(state, 'scout_imp', 'enemy').id]!;
    const wisp = findUnit(state, 'marrow_wisp', 'player');
    const outOfLane = Object.values(state.units).find(
      (u) => u.side === 'enemy' && u.anchor.x === 0,
    )!;

    expect(state.players.player.companionColumn).toBe(4);

    const res = run(state, play(handCard(state, 'player', 'soul_splinter_mark'), atUnit(wisp.id)));

    expect(res.state.units[inLane.id]!.statuses.burn).toBe(1);
    expect(res.state.units[outOfLane.id]!.statuses.burn).toBeUndefined();
  });
});

describe('opening setup', () => {
  it('gives the enemy a free body and the player none', () => {
    // The player's half of the freebie is gone: the Vanguard Roster is the answer to
    // "turn one should be a real turn", and handing them a fifth body on top would pay
    // out points they never spent. The enemy is authored content and keeps its line.
    const session = new CombatSession(NOVICE_DUELIST, 5);
    const board = session.getBoard();

    const vanguards = board.units.filter((u) => u.defId === 'vanguard_footman');
    expect(vanguards).toHaveLength(1);
    expect(vanguards[0]!.side).toBe('enemy');

    // Turn one must still offer something to actually do.
    expect(session.getPlayableCards().length).toBeGreaterThan(0);
    expect(board.player.pips).toBeGreaterThanOrEqual(3);
  });

  it('lets a deployed Vanguard act immediately', () => {
    // The roster path, which is what replaced the freebie. A body placed before the bell
    // is not summoned — it was always there — so it may move on turn one.
    const session = new CombatSession(
      NOVICE_DUELIST, 5, undefined, undefined, undefined, undefined, ['vanguard_footman'],
    );
    const at = session.getBoard().anchors[0]!;
    session.dispatch({ type: 'deployUnit', defId: 'vanguard_footman', at });
    session.dispatch({ type: 'finishDeployment' });

    const body = session.getBoard().units.find(
      (u) => u.defId === 'vanguard_footman' && u.side === 'player',
    )!;
    expect(session.getLegalMoves(body.id).length).toBeGreaterThan(0);
  });
});
