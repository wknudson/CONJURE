import { describe, expect, it } from 'vitest';
import { findUnit, scenario } from './scenario.js';
import { ADEPT_AI, NOVICE_AI, planTurn, profileByName, AI_PROFILES } from '../core/ai/controller.js';
import { ADEPT_WEIGHTS, NOVICE_WEIGHTS } from '../core/ai/score.js';
import { CombatSession } from '../core/session.js';
import { ENCOUNTERS } from '../core/data/encounters/index.js';
import { hashState, replay, type Step } from './replay.js';

/**
 * The Adept tier exists to fix one specific, visible weakness in the Novice AI: because
 * greedy scoring judges each action alone, a unit will walk out of range before it
 * remembers it could have swung first. One-action lookahead values what a move *leaves
 * available*, which is exactly what corrects the order.
 */
describe('lookahead fixes action ordering', () => {
  /**
   * The ordering trap: an enemy skirmisher stands beside a target, and the ground it
   * wants to advance into is far enough that moving first forfeits the swing. Greedy
   * scoring rates the advance (3 tiles gained) above the chip damage and loses the hit.
   *
   * The player unit's Counter is stripped so that attacking is not correctly suicidal,
   * which would make this a test of risk assessment rather than of ordering.
   */
  function skirmish() {
    const state = scenario({
      width: 8,
      height: 8,
      units: [
        { def: 'scout_imp', side: 'enemy', at: { x: 3, y: 2 } },
        { def: 'grave_sentinel', side: 'player', at: { x: 2, y: 2 }, hp: 200, keywords: [] },
      ],
    });
    state.activeSide = 'enemy';
    return state;
  }

  it('Novice moves without swinging, spending its turn for nothing', () => {
    const state = skirmish();
    const imp = findUnit(state, 'scout_imp', 'enemy');
    const commands = planTurn(state, 'enemy', NOVICE_AI);

    const attacked = commands.some((c) => c.type === 'attack' && c.attacker === imp.id);
    // Documented weakness, asserted so a future change to it is deliberate rather than
    // accidental: greedy scoring prefers the advance and forfeits the free hit.
    expect(attacked).toBe(false);
  });

  it('Adept takes the free swing first, then still moves', () => {
    const state = skirmish();
    const imp = findUnit(state, 'scout_imp', 'enemy');
    const commands = planTurn(state, 'enemy', ADEPT_AI);

    const attackIndex = commands.findIndex((c) => c.type === 'attack' && c.attacker === imp.id);
    const moveIndex = commands.findIndex((c) => c.type === 'moveUnit' && c.unit === imp.id);

    expect(attackIndex, 'the Adept should not waste its attack').toBeGreaterThanOrEqual(0);
    expect(moveIndex, 'and should still advance afterwards').toBeGreaterThanOrEqual(0);
    expect(attackIndex, 'attack must come before the move').toBeLessThan(moveIndex);
  });

  it('gets both actions out of a unit that Novice half-wastes', () => {
    // The property that actually matters, stated without reference to ordering.
    const imp = (s: ReturnType<typeof skirmish>) => findUnit(s, 'scout_imp', 'enemy').id;

    const noviceState = skirmish();
    const noviceId = imp(noviceState);
    const novice = planTurn(noviceState, 'enemy', NOVICE_AI).filter(
      (c) =>
        (c.type === 'attack' && c.attacker === noviceId) ||
        (c.type === 'moveUnit' && c.unit === noviceId),
    );

    const adeptState = skirmish();
    const adeptId = imp(adeptState);
    const adept = planTurn(adeptState, 'enemy', ADEPT_AI).filter(
      (c) =>
        (c.type === 'attack' && c.attacker === adeptId) ||
        (c.type === 'moveUnit' && c.unit === adeptId),
    );

    expect(adept.length).toBeGreaterThan(novice.length);
    expect(adept.length).toBe(2);
  });
});

describe('Adept profile', () => {
  it('sees collisions where a Novice does not', () => {
    expect(NOVICE_WEIGHTS.collision).toBe(0);
    expect(ADEPT_WEIGHTS.collision).toBeGreaterThan(0);
  });

  it('is more accurate than a Novice', () => {
    expect(ADEPT_AI.suboptimalChance).toBeLessThan(NOVICE_AI.suboptimalChance);
    expect(ADEPT_AI.lookahead).toBe(1);
    expect(NOVICE_AI.lookahead).toBe(0);
  });

  it('is reachable by name, and falls back for an unknown one', () => {
    expect(profileByName('Adept')).toBe(ADEPT_AI);
    expect(profileByName('adept')).toBe(ADEPT_AI);
    expect(profileByName('Grandmaster')).toBeUndefined();
    expect(AI_PROFILES.length).toBeGreaterThanOrEqual(2);
  });

  it('still takes a winning line without second-guessing it', () => {
    // Lookahead must never re-rank a lethal action out of first place.
    const state = scenario({
      width: 8,
      height: 8,
      playerHp: 20,
      units: [{ def: 'scout_imp', side: 'enemy', at: { x: 3, y: 6 } }],
    });
    state.activeSide = 'enemy';

    const commands = planTurn(state, 'enemy', ADEPT_AI);
    const lethal = commands.some(
      (c) => c.type === 'attack' && c.target.kind === 'portrait' && c.target.side === 'player',
    );
    expect(lethal).toBe(true);
  });
});

describe('compute budget', () => {
  it('plans a full turn on the largest arena well inside the time cap', () => {
    const trial = ENCOUNTERS.find((e) => e.id === 'ignis_trial')!;
    const session = new CombatSession(trial, 5, ADEPT_AI);

    const started = Date.now();
    session.dispatch({ type: 'endTurn' });
    session.runAiTurn();
    const elapsed = Date.now() - started;

    // AI thinking is capped at 1.2s, and a turn measures around that in isolation.
    //
    // This is the weakest guard in the suite and the bound is deliberately loose: it runs
    // alongside every other AI-heavy file, so it reads contention as much as code, and a
    // full turn plans twice — once to act, once to declare next turn's intents. The real
    // governors are deterministic and tested elsewhere: `simulationBudget` bounds the
    // search and `hangGuardMs` catches an actual hang. Read a failure here as "something
    // got dramatically slower", never as a performance budget.
    expect(elapsed).toBeLessThan(30_000);
  }, 30_000);

  it('degrades instead of stalling when the budget is tiny', () => {
    // A profile that runs out of budget almost immediately must still produce a legal,
    // terminated turn rather than looping or throwing.
    const starved = { ...ADEPT_AI, simulationBudget: 1 };
    const state = scenario({
      width: 8,
      height: 8,
      units: [
        { def: 'scout_imp', side: 'enemy', at: { x: 3, y: 3 } },
        { def: 'grave_sentinel', side: 'enemy', at: { x: 4, y: 3 } },
        { def: 'grave_sentinel', side: 'player', at: { x: 3, y: 5 }, keywords: [] },
      ],
    });
    state.activeSide = 'enemy';

    const commands = planTurn(state, 'enemy', starved);
    expect(commands.length).toBeGreaterThan(0);
    expect(commands[commands.length - 1]!.type).toBe('endTurn');
  });
});

describe('Adept determinism', () => {
  it('replays identically from a seed', () => {
    // Lookahead simulates on clones, so it must not perturb the shared RNG stream.
    const encounter = ENCOUNTERS[0]!;
    const steps: Step[] = [
      { kind: 'action', action: { type: 'endTurn' } },
      { kind: 'ai' },
      { kind: 'action', action: { type: 'endTurn' } },
      { kind: 'ai' },
    ];

    const a = replay(encounter, 31, steps, ADEPT_AI);
    const b = replay(encounter, 31, steps, ADEPT_AI);
    expect(b.finalHash).toBe(a.finalHash);
    // 90s, not 30s. This asserts *correctness* and borrowed its budget from the perf guard
    // above, which is a different kind of test. Two full Adept replays with lookahead take
    // about seven seconds of CPU between them; the number that matters is how little of a
    // core this file gets while eighty-seven others run beside it. At 30s it timed out under
    // full-suite load while passing in isolation, which is a clock reading contention rather
    // than a determinism failure -- and a determinism test that fails for being busy teaches
    // nobody anything.
  }, 90_000);

  it('plays a different game than Novice from the same seed', () => {
    const encounter = ENCOUNTERS[0]!;
    const steps: Step[] = [
      { kind: 'action', action: { type: 'endTurn' } },
      { kind: 'ai' },
      { kind: 'action', action: { type: 'endTurn' } },
      { kind: 'ai' },
    ];

    const novice = replay(encounter, 31, steps, NOVICE_AI);
    const adept = replay(encounter, 31, steps, ADEPT_AI);
    expect(adept.finalHash).not.toBe(novice.finalHash);
    expect(hashState(adept.state)).toBe(adept.finalHash);
    // Two full replays again, and the same reasoning as above.
  }, 90_000);
});
