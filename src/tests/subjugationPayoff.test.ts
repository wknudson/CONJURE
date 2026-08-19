import { describe, expect, it } from 'vitest';
import type { GlobalGameState } from '../core/overworld/state.js';
import { newRun } from '../core/overworld/state.js';
import { resolveCombat } from '../core/overworld/run.js';
import type { CompanionInstance } from '../core/overworld/vivarium.js';
import { companionById } from '../core/data/companions.js';
import { traitsFor } from '../core/data/companionTraits.js';
import { tameCompanion } from '../core/overworld/vivarium.js';
import { makeRng } from '../core/util/rng.js';
import { ENCOUNTERS } from '../core/data/encounters/index.js';
import { IGNIS_TRIAL } from '../core/data/encounters/ignis.trial.js';

/**
 * The Harpoon Protocol's payoff.
 *
 * The whole apparatus — the seal, the Rite, the anchor, three rounds of holding it — was
 * finished, tested, drawn in the HUD and hunted by the AI, and produced the same purse a
 * kill produced. `bound` was a differently-spelled victory. This is the ending it was
 * built for.
 */

function fresh(): GlobalGameState {
  const g: GlobalGameState = { overworld: newRun(7), combat: null };
  g.overworld.activeEncounter = { bountyId: 'b1', spoils: { ducats: 10 } };
  return g;
}

describe('binding a beast', () => {
  it('puts it on the roster', () => {
    const roster: CompanionInstance[] = [];
    const tamed = resolveCombat(
      fresh(),
      { pactHp: 12 },
      'bound',
      undefined,
      { prize: 'ignis', roster },
    );

    expect(tamed, 'a binding must produce an animal').not.toBeNull();
    expect(roster).toHaveLength(1);
    expect(roster[0]).toBe(tamed);
    expect(tamed!.baseId).toBe('ignis');
  });

  it('rolls a real one — its own constitution and its own knack', () => {
    // A taming is a roll, not a copy. Two bound Ignis are different animals, which is
    // what stops the prize being a duplicate of whatever the player already fields.
    const roster: CompanionInstance[] = [];
    const tamed = resolveCombat(
      fresh(),
      { pactHp: 1 },
      'bound',
      undefined,
      { prize: 'ignis', roster },
    )!;

    expect(tamed.baseHpRoll).toBeGreaterThan(0);
    expect(tamed.level).toBe(1);

    // The knack has to come from that species' pool, or the Vivarium would show a beast
    // wearing a trait it cannot have.
    const pool = traitsFor('ignis').map((t) => t.id);
    expect(pool, 'rolled a knack outside the species pool').toContain(tamed.traitId);
  });

  it('numbers the instance so a second taming cannot collide with the first', () => {
    const roster: CompanionInstance[] = [];
    const g = fresh();

    resolveCombat(g, { pactHp: 5 }, 'bound', undefined, { prize: 'ignis', roster });
    g.overworld.activeEncounter = { bountyId: 'b2', spoils: {} };
    resolveCombat(g, { pactHp: 5 }, 'bound', undefined, { prize: 'ignis', roster });

    expect(roster).toHaveLength(2);
    expect(roster[0]!.instanceId).not.toBe(roster[1]!.instanceId);
  });

  it('rolls off the board that offered the fight, not the one replacing it', () => {
    // The seed is read *before* `nextBountySeed` advances it. Both orderings are
    // deterministic, so a same-input-same-output test cannot tell them apart — this pins
    // the actual stream, by rolling the same beast by hand from the pre-advance seed.
    const g = fresh();
    const seedAtFightTime = g.overworld.bountySeed;

    const roster: CompanionInstance[] = [];
    const tamed = resolveCombat(g, { pactHp: 7 }, 'bound', undefined, {
      prize: 'ignis',
      roster,
    })!;

    const expected = tameCompanion(makeRng((seedAtFightTime + 1 * 7919) >>> 0), 'ignis', 1);
    expect(tamed.baseHpRoll).toBe(expected.baseHpRoll);
    expect(tamed.traitId).toBe(expected.traitId);
    expect(g.overworld.bountySeed, 'the board still moves on').not.toBe(seedAtFightTime);
  });

  it('replays to the same animal from the same board', () => {
    // Seeded off the bounty seed *before* it advances, so the beast a given fight yields
    // is fixed by the board that offered the fight rather than the one replacing it.
    const rollOnce = (): CompanionInstance => {
      const roster: CompanionInstance[] = [];
      resolveCombat(fresh(), { pactHp: 7 }, 'bound', undefined, { prize: 'ignis', roster });
      return roster[0]!;
    };

    const a = rollOnce();
    const b = rollOnce();
    expect(a.baseHpRoll).toBe(b.baseHpRoll);
    expect(a.traitId).toBe(b.traitId);
  });
});

describe('what does not produce a beast', () => {
  it('an ordinary victory', () => {
    const roster: CompanionInstance[] = [];
    const tamed = resolveCombat(
      fresh(),
      { pactHp: 20 },
      'victory',
      undefined,
      { prize: 'ignis', roster },
    );

    expect(tamed).toBeNull();
    expect(roster).toHaveLength(0);
  });

  it('a defeat', () => {
    const roster: CompanionInstance[] = [];
    resolveCombat(fresh(), { pactHp: 0 }, 'defeat', undefined, { prize: 'ignis', roster });
    expect(roster).toHaveLength(0);
  });

  it('a binding in an encounter that names no species', () => {
    // Every ordinary fight is this case. Binding something the catalogue has no species
    // for pays like a victory rather than crashing or inventing one.
    const roster: CompanionInstance[] = [];
    const tamed = resolveCombat(fresh(), { pactHp: 3 }, 'bound', undefined, { roster });

    expect(tamed).toBeNull();
    expect(roster).toHaveLength(0);
  });

  it('a fight resolved without a roster at all', () => {
    // Tests and standalone bouts call `resolveCombat` with four arguments. A binding
    // still has to close the contract rather than throw.
    expect(() => resolveCombat(fresh(), { pactHp: 3 }, 'bound')).not.toThrow();
  });
});

describe('the spoils still settle', () => {
  it('pays a binding like the win it is, and banks the beast besides', () => {
    const roster: CompanionInstance[] = [];
    const g = fresh();
    const before = g.overworld.economy.ducats;

    resolveCombat(g, { pactHp: 9 }, 'bound', undefined, { prize: 'ignis', roster });

    expect(g.overworld.economy.ducats).toBe(before + 10);
    expect(g.overworld.activeEncounter, 'the contract must close').toBeNull();
    expect(roster).toHaveLength(1);
  });
});

describe('the prize is a species the game can actually field', () => {
  it('names a real Companion wherever an encounter offers one', () => {
    // A prize id that is not in the roster would tame a beast with no definition behind
    // it: no name, no bound form, no trait pool.
    for (const enc of ENCOUNTERS) {
      if (!enc.subjugationPrize) continue;
      expect(
        companionById(enc.subjugationPrize),
        `${enc.id} offers unknown species ${enc.subjugationPrize}`,
      ).toBeDefined();
      expect(
        traitsFor(enc.subjugationPrize).length,
        `${enc.subjugationPrize} has no knacks to roll`,
      ).toBeGreaterThan(0);
    }
  });

  it('offers one on the fight that actually seals', () => {
    // The Trial is the only encounter calling `beginSubjugation`. If it stopped naming a
    // prize, the protocol would quietly go back to paying like a victory.
    expect(IGNIS_TRIAL.subjugationPrize).toBe('ignis');
  });
});
