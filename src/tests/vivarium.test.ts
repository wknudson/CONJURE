import { describe, expect, it } from 'vitest';
import {
  BASE_PACT_HP,
  HP_PER_LEVEL,
  levelCompanion,
  levelCost,
  levelRefusal,
  newCompanion,
  syncPactCeiling,
} from '../core/overworld/vivarium.js';
import { newRun, type GlobalGameState } from '../core/overworld/state.js';
import { carryFor, resolveCombat } from '../core/overworld/run.js';
import { createCombat } from '../core/engine/setup.js';
import { NOVICE_DUELIST } from '../core/data/encounters/index.js';

/**
 * Companion levelling.
 *
 * The bonus is health on the Pact, which makes this the one purchase that has to be true
 * in four places at once: the gauge in the hub, the clamp after a fight, the tonic's cap,
 * and the board itself. Most of what follows is checking it did not stop being true
 * somewhere along that chain.
 */

const flush = (): GlobalGameState => {
  const overworld = newRun(1);
  overworld.economy = { ducats: 5000, marrowShards: 50 };
  return { overworld, combat: null };
};

describe('feeding a Companion', () => {
  it('takes both currencies and raises the level', () => {
    const g = flush();
    const pet = newCompanion();
    const cost = levelCost(pet);

    expect(levelCompanion(g, pet, true)).toBe(true);
    expect(pet.level).toBe(2);
    expect(g.overworld.economy.ducats).toBe(5000 - cost.ducats);
    expect(g.overworld.economy.marrowShards).toBe(50 - cost.marrowShards);
  });

  it('raises the Pact ceiling by the level it bought', () => {
    const g = flush();
    const pet = newCompanion();

    levelCompanion(g, pet, true);

    expect(pet.bonusMaxHp).toBe(HP_PER_LEVEL);
    expect(g.overworld.pact.maxHp, 'and the gauge moved with it').toBe(
      BASE_PACT_HP + HP_PER_LEVEL,
    );
  });

  it('costs more each time', () => {
    const pet = newCompanion();
    const first = levelCost(pet);
    pet.level = 3;
    const later = levelCost(pet);

    expect(later.ducats).toBeGreaterThan(first.ducats);
    expect(later.marrowShards).toBeGreaterThan(first.marrowShards);
  });

  it('charges nothing when the purse is short', () => {
    const g = flush();
    const pet = newCompanion();
    g.overworld.economy = { ducats: 0, marrowShards: 50 };

    expect(levelRefusal(g, pet)).toBe('too-poor');
    expect(levelCompanion(g, pet, true)).toBe(false);
    expect(pet.level, 'and did not level').toBe(1);
    expect(g.overworld.economy.marrowShards, 'nor took the Shards it could').toBe(50);
  });

  it('is barred once a contract is open', () => {
    // A bigger gauge bought after the board was built would be a Pact the fight was not
    // committed against.
    const g = flush();
    g.overworld.activeEncounter = { bountyId: 'x', spoils: { ducats: 10 } };

    expect(levelRefusal(g, newCompanion())).toBe('in-combat');
    expect(levelCompanion(g, newCompanion(), true)).toBe(false);
  });

  it('refuses a Companion the player does not have', () => {
    const g = flush();
    expect(levelRefusal(g, undefined)).toBe('unknown-companion');
    expect(levelCompanion(g, undefined, true)).toBe(false);
  });

  it('does not move the gauge for a Companion left in its tank', () => {
    const g = flush();
    const bench = newCompanion();

    levelCompanion(g, bench, false);

    expect(bench.bonusMaxHp, 'it still got stronger').toBe(HP_PER_LEVEL);
    expect(g.overworld.pact.maxHp, 'but it is not the one standing there').toBe(BASE_PACT_HP);
  });
});

describe('swapping who stands beside you', () => {
  it("carries the new Companion's ceiling, not the old one's", () => {
    const g = flush();
    const strong = newCompanion();
    levelCompanion(g, strong, true);
    levelCompanion(g, strong, true);
    expect(g.overworld.pact.maxHp).toBe(BASE_PACT_HP + HP_PER_LEVEL * 2);

    syncPactCeiling(g.overworld, newCompanion());
    expect(g.overworld.pact.maxHp).toBe(BASE_PACT_HP);
  });

  it('clamps health down to a smaller gauge, and never heals on the way back', () => {
    const g = flush();
    const strong = newCompanion();
    levelCompanion(g, strong, true);
    g.overworld.pact.currentHp = BASE_PACT_HP + HP_PER_LEVEL;

    syncPactCeiling(g.overworld, newCompanion());
    expect(g.overworld.pact.currentHp, 'the overflow is gone').toBe(BASE_PACT_HP);

    syncPactCeiling(g.overworld, strong);
    expect(g.overworld.pact.currentHp, 'and swapping back is not free healing').toBe(
      BASE_PACT_HP,
    );
  });
});

describe('the level reaching the board', () => {
  it('opens the fight on the raised ceiling', () => {
    const g = flush();
    const pet = newCompanion();
    levelCompanion(g, pet, true);

    const { state } = createCombat(
      NOVICE_DUELIST,
      7,
      undefined,
      undefined,
      carryFor(g.overworld, pet),
    );

    expect(state.players.player.maxHp).toBe(BASE_PACT_HP + HP_PER_LEVEL);
    expect(state.players.player.hp, 'and full, since the character was').toBe(
      BASE_PACT_HP + HP_PER_LEVEL,
    );
  });

  it('is an ordinary fight for a Companion at level one', () => {
    const g = flush();
    const { state } = createCombat(
      NOVICE_DUELIST,
      7,
      undefined,
      undefined,
      carryFor(g.overworld, newCompanion()),
    );
    expect(state.players.player.maxHp).toBe(BASE_PACT_HP);
  });

  it('does not lose the extra health on the way back out', () => {
    // The clamp in `resolveCombat` reads `pact.maxHp`. If the ceiling had been left as a
    // derived number, a player finishing at 42 would have been written back at 40.
    const g = flush();
    const pet = newCompanion();
    levelCompanion(g, pet, true);
    g.combat = {};

    resolveCombat(g, { pactHp: BASE_PACT_HP + HP_PER_LEVEL }, 'victory');

    expect(g.overworld.pact.currentHp).toBe(BASE_PACT_HP + HP_PER_LEVEL);
  });

  it('adds to a brew rather than replacing it', () => {
    // A levelled Companion and an Ironbrew are two separate purchases.
    const g = flush();
    const pet = newCompanion();
    pet.startingArmor = 2;
    g.overworld.activeBuff = 'ironbrew';

    const carry = carryFor(g.overworld, pet);
    expect(carry.boons?.armor).toBe(5 + 2);
  });
});
