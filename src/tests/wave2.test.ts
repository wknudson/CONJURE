/**
 * The Combat Ring's second wave, in the arena.
 *
 * The overworld decides who got dragged in; everything below is what the fight then owes.
 * Three promises, and each one fails silently in its own way if it is the one that breaks:
 *
 *  1. the squads actually arrive, or the ring showed the player an army that never came;
 *  2. the compensation is paid, or being jumped by two packs is strictly worse than one
 *     with nothing given back;
 *  3. **the rout is held** — a pack fight ends when the board is clear, so clearing the
 *     opening line on round one would hand over a victory before the pulled mobs existed.
 *     This is the one a player would actually hit, and the one nothing else guards.
 */

import { describe, expect, it } from 'vitest';
import { CombatSession } from '../core/session.js';
import { applyCommand } from '../core/engine/engine.js';
import { checkLethal } from '../core/engine/death.js';
import { makeCtx } from '../core/engine/context.js';
import { encounterById } from '../core/data/encounters/index.js';
import { PACKS, reinforceSquad } from '../core/data/packs.js';
import { DRAW_PER_TURN } from '../core/engine/deck.js';
import { hashState, replay, type Step } from './replay.js';
import type { GameState } from '../core/types/state.js';
import { NOVICE_AI, planTurn } from '../core/ai/controller.js';

/** The pulled squads for the first `n` packs other than the host. */
function pullsFor(hostId: string, n: number): string[][] {
  return PACKS.filter((p) => p.encounterId !== hostId)
    .slice(0, n)
    .map(reinforceSquad);
}

function fight(hostId: string, pulls: number): CombatSession {
  const encounter = encounterById(hostId)!;
  return new CombatSession(
    encounter,
    7,
    NOVICE_AI,
    'ignis',
    undefined,
    undefined,
    undefined,
    pullsFor(hostId, pulls),
  );
}

const enemyBodies = (state: GameState): number =>
  Object.values(state.units).filter((u) => u.side === 'enemy').length;

/** Wipes the enemy board the way a lethal turn would, without playing one. */
function clearEnemies(state: GameState): void {
  for (const u of Object.values(state.units)) {
    if (u.side === 'enemy') delete state.units[u.id];
  }
  checkLethal(makeCtx(state));
}

describe('the ring delivers what it showed', () => {
  for (const host of PACKS) {
    for (const pulls of [1, 2]) {
      it(`${host.encounterId}: ${pulls} pulled squad(s) arrive on round two`, () => {
        const session = fight(host.encounterId, pulls);
        const before = enemyBodies(session.debugState);
        const expected = pullsFor(host.encounterId, pulls).flat().length;
        expect(expected, 'a pulled pack must be worth some bodies').toBeGreaterThan(0);

        // Round one: nothing yet. The wave is a round-two promise, not an opening board.
        expect(session.debugState.encounter.firedGates).not.toContain('wave2:arrived');

        let state = session.debugState;
        state = applyCommand(state, { type: 'endTurn' }).state; // player 1 -> enemy 1
        state = applyCommand(state, { type: 'endTurn' }).state; // enemy 1 -> player 2
        state = applyCommand(state, { type: 'endTurn' }).state; // player 2 -> enemy 2

        expect(state.encounter.firedGates).toContain('wave2:arrived');
        expect(enemyBodies(state)).toBe(before + expected);
      });
    }
  }

  it('suppresses the random wander-in, so there is only ever one surprise', () => {
    const host = PACKS[0]!;
    const pulled = fight(host.encounterId, 1).debugState;
    expect(pulled.encounter.firedGates).toContain('reinforce:rolled:never');
  });

  it('leaves an ordinary pack fight exactly as it was', () => {
    // The field is absent, so the state shape, the gates and the roll are all untouched.
    const plain = new CombatSession(encounterById(PACKS[0]!.encounterId)!, 7, NOVICE_AI, 'ignis');
    expect(plain.debugState.encounter.wave2).toBeUndefined();
    expect(
      plain.debugState.encounter.firedGates.some((g) => g.startsWith('reinforce:rolled')),
      'the coin is still flipped when no ring pulled anyone in',
    ).toBe(true);
  });
});

describe('the compensation for being jumped', () => {
  for (const pulls of [1, 2]) {
    it(`pays +${pulls} Pip and +${pulls} card at the start of the player's round two`, () => {
      const host = PACKS[0]!.encounterId;
      const withRing = fight(host, pulls);
      const without = new CombatSession(encounterById(host)!, 7, NOVICE_AI, 'ignis');

      const run = (session: CombatSession): GameState => {
        let state = session.debugState;
        state = applyCommand(state, { type: 'endTurn' }).state; // player 1 -> enemy 1
        state = applyCommand(state, { type: 'endTurn' }).state; // enemy 1 -> player 2
        return state;
      };

      const a = run(withRing);
      const b = run(without);

      // Measured against the same fight without a ring rather than against a literal, so
      // the assertion survives a change to Pip income or the per-turn draw.
      expect(a.players.player.pips - b.players.player.pips).toBe(pulls);
      expect(a.players.player.hand.length - b.players.player.hand.length).toBe(pulls);
      expect(a.encounter.firedGates).toContain('wave2:paid');
      // Sanity: the ordinary turn-two draw still happened underneath the bonus.
      expect(b.players.player.hand.length).toBeGreaterThanOrEqual(DRAW_PER_TURN);
    });
  }

  it('pays once, not every round', () => {
    const session = fight(PACKS[0]!.encounterId, 2);
    let state = session.debugState;
    for (let i = 0; i < 6; i++) state = applyCommand(state, { type: 'endTurn' }).state;
    expect(state.encounter.firedGates.filter((g) => g === 'wave2:paid')).toHaveLength(1);
  });
});

describe('the held rout', () => {
  it('does not end the fight while the pulled mobs are still owed', () => {
    // The case a player actually hits: a strong opening turn clears the pack that jumped
    // them, and the second pack has not walked in yet.
    const session = fight(PACKS[0]!.encounterId, 1);
    const state = session.debugState;

    clearEnemies(state);
    expect(state.result, 'the ring promised more than this').toBeUndefined();
  });

  it('ends it once the wave has arrived and been cleared', () => {
    const session = fight(PACKS[0]!.encounterId, 1);
    let state = session.debugState;

    clearEnemies(state);
    expect(state.result).toBeUndefined();

    // Round two: the wave lands, and now there is something to clear.
    state = applyCommand(state, { type: 'endTurn' }).state;
    state = applyCommand(state, { type: 'endTurn' }).state;
    state = applyCommand(state, { type: 'endTurn' }).state;
    expect(state.encounter.firedGates).toContain('wave2:arrived');
    expect(enemyBodies(state)).toBeGreaterThan(0);

    clearEnemies(state);
    expect(state.result).toBe('victory');
  });

  it('still routs an ordinary pack fight on the turn the board clears', () => {
    // The guard is scoped to a pending wave, not bolted onto the rout itself.
    const session = new CombatSession(encounterById(PACKS[0]!.encounterId)!, 7, NOVICE_AI, 'ignis');
    const state = session.debugState;
    clearEnemies(state);
    expect(state.result).toBe('victory');
  });
});

describe('it survives the round trip', () => {
  it('serialises and re-hashes identically', () => {
    // `Infinity` once made it into a unit field and a save round trip turned it into null.
    // Every field here is a plain string, and this is what says so.
    const session = fight(PACKS[1]!.encounterId, 2);
    const state = session.debugState;
    const revived = JSON.parse(JSON.stringify(state)) as GameState;
    expect(hashState(revived)).toBe(hashState(state));
    expect(revived.encounter.wave2).toEqual(state.encounter.wave2);
  });

  it('replays to the same state, wave and all', () => {
    const host = PACKS[0]!.encounterId;
    const encounter = encounterById(host)!;
    const wave2 = pullsFor(host, 2);
    // Alternating, because `runAiTurn` is a no-op while the player is active: the fight
    // only advances if somebody ends the player's turn.
    const steps: Step[] = Array.from({ length: 4 }, () => [
      { kind: 'action' as const, action: { type: 'endTurn' as const } },
      { kind: 'ai' as const },
    ]).flat();

    const a = replay(encounter, 11, steps, NOVICE_AI, { companionId: 'ignis', wave2 });
    const b = replay(encounter, 11, steps, NOVICE_AI, { companionId: 'ignis', wave2 });
    expect(a.finalHash).toBe(b.finalHash);
    expect(a.state.encounter.firedGates).toContain('wave2:arrived');

    // And a fight without the wave is a different fight, which is the point of carrying it
    // in the recording at all.
    const plain = replay(encounter, 11, steps, NOVICE_AI, { companionId: 'ignis' });
    expect(plain.finalHash).not.toBe(a.finalHash);
  });
});

describe('a two-pull fight is still a fight', () => {
  for (const host of PACKS) {
    it(`${host.encounterId} reaches a decision with both squads pulled in`, () => {
      // The stall guard balance.test.ts applies to every static encounter, applied here to
      // the shape it cannot see: a ring fight exists only at runtime.
      const encounter = encounterById(host.encounterId)!;
      let state = new CombatSession(
        encounter,
        3,
        NOVICE_AI,
        'ignis',
        undefined,
        undefined,
        undefined,
        pullsFor(host.encounterId, 2),
      ).debugState;

      let guard = 0;
      while (!state.result && guard++ < 120) {
        for (const command of planTurn(state, state.activeSide)) {
          if (state.result) break;
          try {
            state = applyCommand(state, command).state;
          } catch {
            break;
          }
        }
      }

      expect(state.result, `stalled after ${state.turn} turns`).toBeDefined();
      expect(state.encounter.firedGates, 'the wave has to have landed').toContain(
        'wave2:arrived',
      );
    });
  }
});
