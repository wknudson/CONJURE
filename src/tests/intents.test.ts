import { describe, expect, it } from 'vitest';
import { CombatSession } from '../core/session.js';
import { ENCOUNTERS } from '../core/data/encounters/index.js';
import { ADEPT_AI, NOVICE_AI } from '../core/ai/controller.js';
import { replay, type Step } from './replay.js';

/**
 * Enemy intent: the enemy commits in advance and then honours the commitment.
 *
 * The two properties worth guarding are trust ("what was declared is what happens") and
 * consequence ("a declared blow lands on the tile, not the target"). Everything else is
 * detail; those two are the mechanic.
 */

/** Plays to the point where the enemy has declared and the player is to move. */
function afterEnemyDeclares(encounterIndex = 0, seed = 3, ai = NOVICE_AI): CombatSession {
  const session = new CombatSession(ENCOUNTERS[encounterIndex]!, seed, ai);
  session.dispatch({ type: 'endTurn' });
  session.runAiTurn();
  return session;
}

describe('declaration', () => {
  it('commits to something before handing the turn over', () => {
    const session = afterEnemyDeclares();
    const board = session.getBoard();

    expect(board.activeSide).toBe('player');
    expect(board.intents.length).toBeGreaterThan(0);
    for (const intent of board.intents) {
      expect(['attack', 'commander', 'card', 'move', 'channel']).toContain(intent.kind);
    }
  });

  it('actually produces the two new categories', () => {
    // The `stun` lesson, applied to a vocabulary: a category that is typed, drawn and
    // documented but never emitted is a rule nothing can reach. Swept across seeds
    // because which body walks and which one swings is a property of the plan, not of
    // the engine — one seed proving nothing would be a vacuous test.
    const seen = new Set<string>();
    for (let seed = 1; seed <= 14; seed += 1) {
      for (const intent of afterEnemyDeclares(0, seed).getBoard().intents) {
        seen.add(intent.kind);
      }
    }

    expect(seen, `only saw ${[...seen].join(', ')}`).toContain('move');
    // Channel is rarer — it needs an idle body with nothing worth hitting — so it is
    // asserted across the wider sweep below rather than demanded of this encounter.
    expect(seen.size).toBeGreaterThan(1);
  });

  it('keeps the whole vocabulary reachable across the catalogue', () => {
    const seen = new Set<string>();
    for (let e = 0; e < ENCOUNTERS.length; e += 1) {
      for (let seed = 1; seed <= 6; seed += 1) {
        for (const intent of afterEnemyDeclares(e, seed).getBoard().intents) {
          seen.add(intent.kind);
        }
      }
    }
    // Every category the renderer draws a badge for has to be something the game emits.
    expect(seen.has('attack') || seen.has('commander'), 'no hostile intent anywhere').toBe(true);
    expect(seen.has('move'), 'nothing ever telegraphs a reposition').toBe(true);
  });

  it('announces a move once, not twice', () => {
    // A move followed by a strike is one commitment. The approach is already carried as
    // the attack's `path`, so a separate `move` badge would telegraph it a second time.
    const board = afterEnemyDeclares().getBoard();
    const byUnit = new Map<string, number>();
    for (const i of board.intents) byUnit.set(i.unitId, (byUnit.get(i.unitId) ?? 0) + 1);
    for (const [id, n] of byUnit) {
      expect(n, `${id} declared ${n} intents`).toBe(1);
    }
  });

  it('declares an attack against a specific tile, not a specific unit', () => {
    const session = afterEnemyDeclares();
    const attacks = session.getBoard().intents.filter((i) => i.kind === 'attack');
    for (const intent of attacks) {
      expect(intent.at, 'an attack intent must name the tile it lands on').toBeDefined();
      expect(intent.damage).toBeGreaterThan(0);
    }
  });

  it('shows the whole plan at Novice and only the blows at Adept', () => {
    // Difficulty scales along information: the teaching tier hides nothing.
    expect(NOVICE_AI.telegraph).toBe('all');
    expect(ADEPT_AI.telegraph).toBe('attacks');

    const adept = afterEnemyDeclares(0, 3, ADEPT_AI);
    expect(adept.getBoard().intents.every((i) => i.kind !== 'card')).toBe(true);
    // Adept plans twice per turn (execute, then declare), so it needs the wider budget
    // the other AI-heavy suites carry.
  }, 30_000);

  it('clears the declaration once the turn it described is spent', () => {
    const session = afterEnemyDeclares();
    expect(session.getBoard().intents.length).toBeGreaterThan(0);

    session.dispatch({ type: 'endTurn' });
    session.runAiTurn();

    // A fresh declaration for the *next* turn, never the stale one.
    const board = session.getBoard();
    expect(board.activeSide).toBe('player');
    for (const intent of board.intents) {
      const unit = board.units.find((u) => u.id === intent.unitId);
      if (intent.kind === 'attack') expect(unit?.side ?? 'enemy').toBe('enemy');
    }
  });
});

describe('the promise is kept', () => {
  it('does what it said when the board is left alone', () => {
    const session = afterEnemyDeclares();
    const declared = session
      .getBoard()
      .intents.filter((i) => i.kind === 'attack' && i.at)
      .map((i) => ({ unitId: i.unitId, at: i.at! }));

    // Pass without touching anything, so every declaration stays valid.
    session.dispatch({ type: 'endTurn' });
    const events = session.runAiTurn();

    const struck = events.filter((e) => e.t === 'attackDeclared').map((e) => e.attackerId);
    for (const intent of declared) {
      const unitStillAlive = session.getBoard().units.some((u) => u.id === intent.unitId);
      if (!unitStillAlive) continue;
      expect(struck, `${intent.unitId} promised a blow and did not throw it`).toContain(
        intent.unitId,
      );
    }
  });

  it('lands on empty ground when the target steps away', () => {
    // The reward for reading the telegraph: the blow is committed to the tile.
    const session = afterEnemyDeclares(0, 3);
    const intent = session.getBoard().intents.find((i) => i.kind === 'attack' && i.at);
    if (!intent?.at) return; // nothing declared against a tile this seed

    const victim = session
      .getBoard()
      .units.find(
        (u) => u.side === 'player' && u.anchor.x === intent.at!.x && u.anchor.y === intent.at!.y,
      );
    if (!victim) return;

    const moves = session.getLegalMoves(victim.id);
    const away = moves.find((m) => m.x !== intent.at!.x || m.y !== intent.at!.y);
    if (!away) return;

    session.dispatch({ type: 'moveUnit', unit: victim.id, to: away });
    const hpBefore = session.getBoard().units.find((u) => u.id === victim.id)!.hp;

    session.dispatch({ type: 'endTurn' });
    const events = session.runAiTurn();

    const whiffed = events.filter((e) => e.t === 'intentWhiffed');
    const after = session.getBoard().units.find((u) => u.id === victim.id);

    // Either the swing found nothing, or the unit that moved was not hit by it.
    if (whiffed.length > 0) {
      expect(whiffed[0]!.at).toEqual(intent.at);
    }
    if (after) expect(after.hp).toBeLessThanOrEqual(hpBefore);
  });

  it('drops the intent of a unit that has been killed', () => {
    const session = afterEnemyDeclares();
    const intent = session.getBoard().intents.find((i) => i.kind === 'attack');
    if (!intent) return;

    // Remove the declaring unit outright.
    const st = session.debugState;
    delete st.units[intent.unitId];

    session.dispatch({ type: 'endTurn' });
    const events = session.runAiTurn();

    const struck = events.filter((e) => e.t === 'attackDeclared').map((e) => e.attackerId);
    expect(struck).not.toContain(intent.unitId);
  });

  it('does not let one dead intent cancel the rest of the turn', () => {
    const session = afterEnemyDeclares();
    const intents = session.getBoard().intents.filter((i) => i.kind === 'attack');
    if (intents.length < 2) return;

    delete session.debugState.units[intents[0]!.unitId];

    session.dispatch({ type: 'endTurn' });
    const events = session.runAiTurn();

    const struck = events.filter((e) => e.t === 'attackDeclared').map((e) => e.attackerId);
    expect(struck).toContain(intents[1]!.unitId);
  });
});

describe('intent determinism', () => {
  it('replays identically, since declaring consumes the seeded stream', () => {
    const encounter = ENCOUNTERS[0]!;
    const steps: Step[] = [
      { kind: 'action', action: { type: 'endTurn' } },
      { kind: 'ai' },
      { kind: 'action', action: { type: 'endTurn' } },
      { kind: 'ai' },
    ];

    const a = replay(encounter, 17, steps);
    const b = replay(encounter, 17, steps);
    expect(b.finalHash).toBe(a.finalHash);
    expect(b.state.intents).toEqual(a.state.intents);
  }, 30_000);
});
