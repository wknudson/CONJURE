import { describe, expect, it } from 'vitest';
import {
  BASE_PACT_HP,
  HP_ROLL_MAX,
  HP_ROLL_MIN,
  levelCompanion,
  syncPactCeiling,
  tameCompanion,
  type CompanionInstance,
} from '../core/overworld/vivarium.js';
import { COMPANION_TRAITS, traitsFor } from '../core/data/companionTraits.js';
import { emptyLoadout, newRun, type GlobalGameState } from '../core/overworld/state.js';
import { carryFor } from '../core/overworld/run.js';
import { createCombat } from '../core/engine/setup.js';
import { NOVICE_DUELIST } from '../core/data/encounters/index.js';
import { COMPANIONS } from '../core/data/companions.js';
import { makeRng } from '../core/util/rng.js';

/**
 * The taming roll.
 *
 * Two beasts of the same species differ by constitution and knack and nothing else, so
 * these are mostly about that difference actually reaching the board — a roll the fight
 * ignores is a slot machine with no payout.
 */

const character = (): GlobalGameState => ({ overworld: newRun(1), combat: null });

describe('rolling a wild one', () => {
  it('lands inside the band, every time', () => {
    for (let seed = 1; seed < 200; seed++) {
      const beast = tameCompanion(makeRng(seed), 'ignis', seed);
      expect(beast.baseHpRoll, `seed ${seed}`).toBeGreaterThanOrEqual(HP_ROLL_MIN);
      expect(beast.baseHpRoll, `seed ${seed}`).toBeLessThanOrEqual(HP_ROLL_MAX);
    }
  });

  it('actually varies — both ends of the band come up', () => {
    // A roll that always returned the midpoint would pass every other test here.
    const rolls = new Set<number>();
    for (let seed = 1; seed < 300; seed++) {
      rolls.add(tameCompanion(makeRng(seed), 'ignis', seed).baseHpRoll);
    }
    expect(rolls.size, 'more than one outcome').toBeGreaterThan(4);
    expect(Math.min(...rolls)).toBe(HP_ROLL_MIN);
    expect(Math.max(...rolls)).toBe(HP_ROLL_MAX);
  });

  it('is the same beast for the same seed', () => {
    expect(tameCompanion(makeRng(42), 'ignis', 1)).toEqual(
      tameCompanion(makeRng(42), 'ignis', 1),
    );
  });

  it('only ever rolls a knack its bloodline has', () => {
    for (let seed = 1; seed < 120; seed++) {
      for (const species of COMPANIONS) {
        const beast = tameCompanion(makeRng(seed), species.id, seed);
        if (beast.traitId === '') continue;
        expect(COMPANION_TRAITS[beast.traitId]!.baseId, species.id).toBe(species.id);
      }
    }
  });

  it('gives every species something to roll', () => {
    for (const species of COMPANIONS) {
      expect(traitsFor(species.id).length, species.name).toBeGreaterThan(1);
    }
  });

  it('opens at level one, unlevelled', () => {
    const beast = tameCompanion(makeRng(3), 'ignis', 1);
    expect(beast.level).toBe(1);
    expect(beast.bonusMaxHp).toBe(0);
  });
});

describe('the roll reaching the Pact', () => {
  const withRoll = (roll: number, over: Partial<CompanionInstance> = {}): CompanionInstance => ({
    ...tameCompanion(makeRng(1), 'ignis', 1),
    baseHpRoll: roll,
    ...over,
  });

  it('sets the gauge from this beast, not from a constant', () => {
    const g = character();
    syncPactCeiling(g.overworld, withRoll(HP_ROLL_MAX));
    expect(g.overworld.pact.maxHp).toBe(HP_ROLL_MAX);

    syncPactCeiling(g.overworld, withRoll(HP_ROLL_MIN));
    expect(g.overworld.pact.maxHp, 'a runt is a smaller Pact').toBe(HP_ROLL_MIN);
  });

  it('adds levels on top of the roll', () => {
    const g = character();
    g.overworld.economy = { ducats: 5000, marrowShards: 50, reagents: {} };
    const beast = withRoll(38);

    levelCompanion(g, beast, true);

    expect(beast.bonusMaxHp).toBeGreaterThan(0);
    expect(g.overworld.pact.maxHp).toBe(38 + beast.bonusMaxHp);
  });

  it('opens the fight on this beast constitution', () => {
    const g = character();
    const beast = withRoll(430);
    syncPactCeiling(g.overworld, beast);

    const { state } = createCombat(NOVICE_DUELIST, 7, undefined, undefined, carryFor(g.overworld, beast));
    expect(state.players.player.maxHp).toBe(430);
    // Not 43: the character was standing at 40 and a bigger beast is a bigger gauge, not
    // a heal. Growth of your own is what `levelCompanion` hands over; this is somebody
    // else's constitution.
    expect(state.players.player.hp).toBe(400);
  });

  it('falls back to the standard body for a companion with no roll', () => {
    // A save from before the roster, or a bare progress object in a test.
    const g = character();
    syncPactCeiling(g.overworld, { level: 1, bonusMaxHp: 0, startingArmor: 0, bonusPips: 0 });
    expect(g.overworld.pact.maxHp).toBe(BASE_PACT_HP);
  });
});

describe('the knack reaching the board', () => {
  const wearing = (traitId: string): CompanionInstance => ({
    ...tameCompanion(makeRng(1), 'ignis', 1),
    traitId,
  });

  it('turns Ash-Walker into an immunity the engine understands', () => {
    const g = character();
    const carry = carryFor(g.overworld, wearing('ash_walker'));
    expect(carry.boons?.immuneToBurn).toBe(true);

    const { state } = createCombat(NOVICE_DUELIST, 7, undefined, undefined, carry);
    expect(state.players.player.immuneToBurn).toBe(true);
    expect(state.players.enemy.immuneToBurn, 'and the enemy gets nothing').toBe(false);
  });

  it('turns Searing Gaze into sight the engine understands', () => {
    const g = character();
    const carry = carryFor(g.overworld, wearing('searing_gaze'));
    const { state } = createCombat(NOVICE_DUELIST, 7, undefined, undefined, carry);
    expect(state.players.player.ignoresFog).toBe(true);
  });

  it('hands the engine capabilities, never a trait id', () => {
    // The same boundary relics and brews keep.
    const g = character();
    const carry = carryFor(g.overworld, wearing('banked_coals'));
    expect(carry.boons?.armor).toBe(20);
    expect(JSON.stringify(carry)).not.toContain('banked_coals');
  });

  it('stacks a knack with gear rather than replacing it', () => {
    const g = character();
    g.overworld.relics = ['relic_coat'];
    g.overworld.equippedRelics = { ...emptyLoadout(), vestment: 'relic_coat' };

    expect(carryFor(g.overworld, wearing('banked_coals')).boons?.armor, '3 coat + 2 coals').toBe(50);
  });

  it('takes the higher ceiling when gear and knack both raise it', () => {
    const g = character();
    g.overworld.relics = ['relic_battery'];
    g.overworld.equippedRelics = { ...emptyLoadout(), trinket: 'relic_battery' };
    const beast: CompanionInstance = { ...tameCompanion(makeRng(1), 'boreas', 1), traitId: 'deep_reserve' };

    expect(carryFor(g.overworld, beast).boons?.maxPips, 'not 18').toBe(9);
  });

  it('has no knack that touches a damage number', () => {
    for (const trait of Object.values(COMPANION_TRAITS)) {
      expect(Object.keys(trait.boons), trait.name).not.toContain('damage');
    }
  });
});
