import { describe, expect, it } from 'vitest';
import type { Action } from '../contract/query.js';
import type { Coord } from '../contract/ids.js';
import { CombatSession } from '../core/session.js';
import { ENCOUNTERS } from '../core/data/encounters/index.js';
import { makeRng, nextInt } from '../core/util/rng.js';
import {
  checkCleanupInvariants,
  checkInvariants,
  eventSignature,
  hashState,
  replay,
  type Step,
} from './replay.js';

/**
 * Plays a game with a seeded pseudo-player that picks uniformly from whatever is legal.
 * Returns the recorded steps so the same game can be replayed and compared.
 */
function playRandomGame(
  encounterIndex: number,
  seed: number,
  maxTurns = 25,
  onState?: (session: CombatSession, where: string) => void,
): { steps: Step[]; session: CombatSession } {
  const encounter = ENCOUNTERS[encounterIndex]!;
  const session = new CombatSession(encounter, seed);
  const steps: Step[] = [];
  // The pseudo-player has its own RNG stream, deliberately separate from the game's, so
  // driving it never perturbs the shuffle order the engine depends on.
  const rng = makeRng(seed * 7919 + 13);

  const take = (action: Action, label: string): void => {
    session.dispatch(action);
    steps.push({ kind: 'action', action });
    onState?.(session, label);
  };

  const pick = <T>(items: T[]): T | undefined =>
    items.length === 0 ? undefined : items[nextInt(rng, items.length)];

  for (let turn = 0; turn < maxTurns && !session.isOver(); turn++) {
    // Play a few random affordable cards.
    for (let n = 0; n < 4; n++) {
      const playable = session.getPlayableCards();
      const cardId = pick(playable);
      if (!cardId) break;

      const spec = session.getLegalTargets(cardId);
      let target: Parameters<CombatSession['dispatch']>[0] | null = null;
      if (spec.kind === 'tiles') {
        const at = pick(spec.tiles);
        if (at) target = { type: 'playCard', card: cardId, target: { kind: 'tile', at } };
      } else if (spec.kind === 'entities') {
        const ref = pick(spec.refs);
        if (ref) target = { type: 'playCard', card: cardId, target: { kind: 'entity', ref } };
      } else if (spec.kind === 'lines') {
        const o = pick(spec.origins);
        if (o) target = { type: 'playCard', card: cardId, target: { kind: 'line', from: o.from, dir: o.dir } };
      } else if (spec.kind === 'global') {
        target = { type: 'playCard', card: cardId, target: { kind: 'global' } };
      }
      if (!target) break;
      take(target, `after playCard`);
      if (session.isOver()) break;
    }

    // Move and attack with a random subset of units, in a random order.
    if (!session.isOver()) {
      const mine = session.getBoard().units.filter((u) => u.side === 'player');
      for (const unit of mine) {
        if (session.isOver()) break;
        const attacks = session.getLegalAttacks(unit.id);
        const attack = pick(attacks);
        if (attack) take({ type: 'attack', attacker: unit.id, target: attack }, 'after attack');
        if (session.isOver()) break;

        const moves: Coord[] = session.getLegalMoves(unit.id);
        const to = pick(moves);
        if (to) take({ type: 'moveUnit', unit: unit.id, to }, 'after move');
      }
    }

    // Occasionally sacrifice something, exercising the marrow path.
    if (!session.isOver()) {
      const mine = session.getBoard().units.filter((u) => u.side === 'player');
      if (nextInt(rng, 5) === 0) {
        const victim = pick(mine);
        if (victim) {
          try {
            take({ type: 'bloodTithe', unit: victim.id }, 'after tithe');
          } catch {
            /* not every unit may be tithed; the legality check is the engine's job */
          }
        }
      }
    }

    // And occasionally channel, exercising the other marrow path.
    if (!session.isOver()) {
      const mine = session.getBoard().units.filter((u) => u.side === 'player');
      if (nextInt(rng, 4) === 0) {
        const caster = pick(mine);
        if (caster) {
          try {
            take({ type: 'channel', unit: caster.id }, 'after channel');
          } catch {
            /* an exhausted or bound unit cannot channel; legality is the engine's job */
          }
        }
      }
    }

    if (session.isOver()) break;
    take({ type: 'endTurn' }, 'after endTurn');
    onState?.(session, 'after player cleanup');

    if (session.isOver()) break;
    session.runAiTurn();
    steps.push({ kind: 'ai' });
    onState?.(session, 'after AI turn');
  }

  return { steps, session };
}

describe('determinism', () => {
  it('reproduces the exact event stream and final state from a seed', () => {
    for (let seed = 1; seed <= 6; seed++) {
      const encounterIndex = seed % ENCOUNTERS.length;
      const encounter = ENCOUNTERS[encounterIndex]!;
      const { steps, session } = playRandomGame(encounterIndex, seed);

      const original = hashState(session.debugState);
      const again = replay(encounter, seed, steps);

      expect(again.finalHash, `seed ${seed} diverged on replay`).toBe(original);
    }
    // Every wall-clock budget in this suite is generous on purpose. They run in parallel
    // workers alongside the other AI-heavy files, and each board now carries more to
    // think about — geodes, crystals, rubble, currents, an extra action. A failure here
    // should mean "this hung", never "this machine was busy"; divergence is caught by
    // the hash above, which is the assertion that matters.
  }, 180_000);

  it('produces identical events when the same game is replayed twice', () => {
    const encounter = ENCOUNTERS[0]!;
    const { steps } = playRandomGame(0, 42);

    const a = replay(encounter, 42, steps);
    const b = replay(encounter, 42, steps);

    expect(eventSignature(b.events)).toBe(eventSignature(a.events));
    expect(b.finalHash).toBe(a.finalHash);
  }, 30_000);

  it('hashes are sensitive to any state change', () => {
    // A harness whose hash ignored some field would pass every replay test for the wrong
    // reason, so prove the hash actually notices a difference.
    const session = new CombatSession(ENCOUNTERS[0]!, 11);
    const before = hashState(session.debugState);

    session.debugState.players.player.hp -= 1;
    expect(hashState(session.debugState)).not.toBe(before);
    session.debugState.players.player.hp += 1;
    expect(hashState(session.debugState)).toBe(before);

    // Nested and array-valued changes count too.
    const unit = Object.values(session.debugState.units)[0]!;
    unit.anchor.x += 1;
    expect(hashState(session.debugState)).not.toBe(before);
  });

  it('gives different seeds different opening deals', () => {
    // If the seed did not reach the shuffle, every replay test would be trivially true.
    const hands = new Set<string>();
    for (let seed = 1; seed <= 5; seed++) {
      const s = new CombatSession(ENCOUNTERS[0]!, seed);
      hands.add(s.getHand().map((c) => c.defId).join(','));
    }
    expect(hands.size).toBeGreaterThan(1);
  });

  it('replays correctly through a boss phase transition', () => {
    // The Ignis trial mutates state outside the normal action flow (damage gates,
    // Forced Eviction, card injection), so it is the harness's real test.
    const trialIndex = ENCOUNTERS.findIndex((e) => e.id === 'ignis_trial');
    expect(trialIndex).toBeGreaterThanOrEqual(0);
    const encounter = ENCOUNTERS[trialIndex]!;

    for (let seed = 1; seed <= 4; seed++) {
      const { steps, session } = playRandomGame(trialIndex, seed, 30);
      const replayed = replay(encounter, seed, steps);
      expect(replayed.finalHash, `trial seed ${seed} diverged`).toBe(hashState(session.debugState));
    }
  }, 180_000);
});

describe('fuzz soak', () => {
  it('holds every engine invariant across many random games', () => {
    const violations: string[] = [];

    for (let seed = 1; seed <= 24; seed++) {
      const encounterIndex = seed % ENCOUNTERS.length;
      try {
        playRandomGame(encounterIndex, seed, 20, (session, where) => {
          violations.push(...checkInvariants(session.debugState, `seed ${seed} ${where}`));
          if (where.includes('cleanup') || where.includes('AI turn')) {
            violations.push(
              ...checkCleanupInvariants(session.debugState, `seed ${seed} ${where}`),
            );
          }
        });
      } catch (err) {
        violations.push(`seed ${seed} threw: ${(err as Error).message}`);
      }
    }

    expect(violations.slice(0, 10).join('\n')).toBe('');
    // No local deadline: this inherits the generous global one, like every other test in
    // this file. It carried 120s while the three lighter tests beside it carried 180s,
    // which left the heaviest test in the suite with the least headroom — it ran 109s of
    // its 120s budget on an idle machine and blew it the moment anything else wanted a
    // core. That is the exact flakiness vitest.config.ts describes and the exact remedy
    // its comment prescribes: this soak exists to catch a hang or a divergence, never to
    // measure how busy the machine was.
  });

  it('always reaches a terminal state or a legal ongoing one', () => {
    for (let seed = 1; seed <= 8; seed++) {
      const { session } = playRandomGame(seed % ENCOUNTERS.length, seed, 40);
      const state = session.debugState;

      if (state.result) {
        // A finished game must not still be handing out turns.
        expect(['victory', 'defeat', 'bound']).toContain(state.result);
      } else {
        // An unfinished one must be internally coherent.
        expect(state.players.player.hp).toBeGreaterThan(0);
        expect(state.players.enemy.hp).toBeGreaterThan(0);
      }
    }
  }, 180_000);
});
