import { describe, expect, it } from 'vitest';
import { createCombat } from '../core/engine/setup.js';
import { NOVICE_DUELIST } from '../core/data/encounters/index.js';
import {
  addConsumable,
  isRunOver,
  newRun,
  INVENTORY_LIMIT,
  type BuffId,
  type Consumable,
  type GlobalGameState,
} from '../core/overworld/state.js';
import {
  carryFor,
  consumableRefusal,
  resolveCombat,
  useConsumable,
  type CombatOutcome,
} from '../core/overworld/run.js';

/**
 * The run that persists between fights.
 *
 * These are mostly about the constraints rather than the happy path: three items, one
 * buff, no items in combat, and a Pact that does not heal on its own. Each of those is a
 * balance rule, and a balance rule with no test is a suggestion.
 */

const global = (): GlobalGameState => ({
  overworld: newRun(['scout_imp', 'grave_sentinel']),
  combat: null,
});

const potion = (value = 10): Consumable => ({
  id: 'field_dressing',
  name: 'Field Dressing',
  type: 'healing',
  value,
});

const brew = (id: BuffId): Consumable => ({
  id,
  name: id,
  type: 'buff',
  value: 0,
});

describe('the satchel', () => {
  it('carries three and refuses a fourth', () => {
    const g = global();
    for (let i = 0; i < INVENTORY_LIMIT; i++) {
      expect(addConsumable(g.overworld, potion()), `item ${i + 1}`).toBe(true);
    }
    expect(addConsumable(g.overworld, potion()), 'the fourth').toBe(false);
    expect(g.overworld.inventory).toHaveLength(INVENTORY_LIMIT);
  });
});

describe('using an item', () => {
  it('heals the Pact and spends the item', () => {
    const g = global();
    g.overworld.pact.currentHp = 20;
    addConsumable(g.overworld, potion(10));

    expect(useConsumable(g, 0)).toBe(true);
    expect(g.overworld.pact.currentHp).toBe(30);
    expect(g.overworld.inventory).toHaveLength(0);
  });

  it('does not overheal past the Pact maximum', () => {
    const g = global();
    g.overworld.pact.currentHp = 38;
    addConsumable(g.overworld, potion(10));

    useConsumable(g, 0);
    expect(g.overworld.pact.currentHp).toBe(g.overworld.pact.maxHp);
  });

  it('refuses outright during a fight', () => {
    // The rule that keeps healing inside the deterministic reducer: an item drunk
    // mid-fight would undo a lethal turn the engine had already committed to.
    const g = global();
    g.overworld.pact.currentHp = 10;
    addConsumable(g.overworld, potion(10));
    g.combat = { pretend: 'a live fight' };

    expect(consumableRefusal(g, 0)).toBe('in-combat');
    expect(useConsumable(g, 0)).toBe(false);
    expect(g.overworld.pact.currentHp, 'nothing happened').toBe(10);
    expect(g.overworld.inventory, 'and nothing was spent').toHaveLength(1);
  });

  it('refuses an index that holds nothing', () => {
    const g = global();
    expect(consumableRefusal(g, 2)).toBe('no-such-item');
    expect(useConsumable(g, 2)).toBe(false);
  });

  it('replaces a held brew rather than stacking a second', () => {
    // One buff, always. The question is which, never how many.
    const g = global();
    addConsumable(g.overworld, brew('ironbrew'));
    addConsumable(g.overworld, brew('quicksilver'));

    useConsumable(g, 0);
    expect(g.overworld.activeBuff).toBe('ironbrew');
    useConsumable(g, 0);
    expect(g.overworld.activeBuff, 'overwritten, not added to').toBe('quicksilver');
  });
});

describe('carrying a run into a fight', () => {
  it('starts the Pact where the run left it, against the full maximum', () => {
    const g = global();
    g.overworld.pact.currentHp = 12;

    const { state } = createCombat(NOVICE_DUELIST, 7, undefined, undefined, carryFor(g.overworld));

    expect(state.players.player.hp).toBe(12);
    // The gauge has to show what was already lost, so the maximum is untouched.
    expect(state.players.player.maxHp).toBe(NOVICE_DUELIST.playerHp);
  });

  it('is an ordinary full-health fight when nothing is carried', () => {
    const { state } = createCombat(NOVICE_DUELIST, 7);
    expect(state.players.player.hp).toBe(NOVICE_DUELIST.playerHp);
  });

  it('cannot begin above full, however stale the carried number', () => {
    const g = global();
    g.overworld.pact.currentHp = 9999;
    const { state } = createCombat(NOVICE_DUELIST, 7, undefined, undefined, carryFor(g.overworld));
    expect(state.players.player.hp).toBe(state.players.player.maxHp);
  });

  describe('the brews', () => {
    const withBuff = (id: BuffId) => {
      const g = global();
      addConsumable(g.overworld, brew(id));
      useConsumable(g, 0);
      return createCombat(NOVICE_DUELIST, 7, undefined, undefined, carryFor(g.overworld)).state;
    };

    it('ironbrew opens with armour', () => {
      expect(withBuff('ironbrew').players.player.armor).toBe(5);
      expect(createCombat(NOVICE_DUELIST, 7).state.players.player.armor, 'baseline').toBe(0);
    });

    it('kinetic_capacitor opens with a bigger bank', () => {
      const plain = createCombat(NOVICE_DUELIST, 7).state.players.player.pips;
      expect(withBuff('kinetic_capacitor').players.player.pips).toBe(plain + 2);
    });

    it('quicksilver opens with a wider hand', () => {
      const plain = createCombat(NOVICE_DUELIST, 7).state.players.player.hand.length;
      expect(withBuff('quicksilver').players.player.hand.length).toBe(plain + 2);
    });

    it('gives the enemy nothing', () => {
      const plain = createCombat(NOVICE_DUELIST, 7).state;
      const buffed = withBuff('kinetic_capacitor');
      expect(buffed.players.enemy.pips).toBe(plain.players.enemy.pips);
      expect(buffed.players.enemy.armor).toBe(plain.players.enemy.armor);
    });
  });
});

describe('resolving a fight back into the run', () => {
  const finished = (hp: number): CombatOutcome => ({ pactHp: hp });

  it('writes the surviving Pact back, wounds and all', () => {
    const g = global();
    g.combat = { pretend: 'a live fight' };

    resolveCombat(g, finished(13), 'victory', { ducats: 25 });

    expect(g.overworld.pact.currentHp, 'the Gauntlet does not heal you').toBe(13);
    expect(g.overworld.economy.ducats).toBe(25);
    expect(g.combat, 'and we are back in the overworld').toBeNull();
  });

  it('spends the brew whether the fight was won or lost', () => {
    // It was drunk on the way in. Handing it back on a loss would make retrying strictly
    // better than winning.
    for (const result of ['victory', 'defeat'] as const) {
      const g = global();
      addConsumable(g.overworld, brew('ironbrew'));
      useConsumable(g, 0);
      g.combat = {};

      resolveCombat(g, finished(result === 'victory' ? 10 : 0), result);
      expect(g.overworld.activeBuff, result).toBeNull();
    }
  });

  it('pays nothing for a defeat, and leaves the run over', () => {
    const g = global();
    g.combat = {};

    resolveCombat(g, finished(0), 'defeat', { ducats: 25 });

    expect(g.overworld.economy.ducats).toBe(0);
    expect(g.overworld.pact.currentHp).toBe(0);
    expect(isRunOver(g.overworld), 'the number and the flag agree').toBe(true);
  });

  it('pays out a win taken at one health', () => {
    const g = global();
    g.combat = {};
    resolveCombat(g, finished(1), 'bound', { ducats: 40, marrowShards: 2 });

    expect(g.overworld.pact.currentHp).toBe(1);
    expect(g.overworld.economy.ducats, 'binding is a win too').toBe(40);
    expect(g.overworld.economy.marrowShards).toBe(2);
    expect(isRunOver(g.overworld)).toBe(false);
  });

  it('round-trips: a wounded run fights, survives, and stays wounded', () => {
    const g = global();
    g.overworld.pact.currentHp = 30;

    const { state } = createCombat(NOVICE_DUELIST, 7, undefined, undefined, carryFor(g.overworld));
    g.combat = state;
    expect(state.players.player.hp).toBe(30);

    state.players.player.hp = 22;
    resolveCombat(g, { pactHp: state.players.player.hp }, 'victory');

    expect(g.overworld.pact.currentHp).toBe(22);
    expect(g.combat).toBeNull();
  });
});

describe('the loop, closed', () => {
  it('carries wounds and winnings from one fight into the next', () => {
    // The whole point of the Gauntlet in one test: fight, survive badly, get paid, and
    // arrive at the next door still hurt and richer.
    const g = global();
    g.overworld.pact.currentHp = 34;

    const first = createCombat(NOVICE_DUELIST, 7, undefined, undefined, carryFor(g.overworld));
    expect(first.state.players.player.hp, 'opens where the run left it').toBe(34);

    g.combat = first.state;
    resolveCombat(g, { pactHp: 19 }, 'victory', { ducats: 50, marrowShards: 1 });

    expect(g.overworld.pact.currentHp).toBe(19);
    expect(g.overworld.economy.ducats).toBe(50);
    expect(g.overworld.economy.marrowShards).toBe(1);

    const second = createCombat(NOVICE_DUELIST, 11, undefined, undefined, carryFor(g.overworld));
    expect(second.state.players.player.hp, 'the next room is fought at 19').toBe(19);
    expect(second.state.players.player.maxHp, 'against the full gauge').toBe(NOVICE_DUELIST.playerHp);
  });

  it('spends a brew on the fight it was carried into, not the one after', () => {
    const g = global();
    addConsumable(g.overworld, brew('ironbrew'));
    useConsumable(g, 0);

    const first = createCombat(NOVICE_DUELIST, 7, undefined, undefined, carryFor(g.overworld));
    expect(first.state.players.player.armor).toBe(5);

    resolveCombat(g, { pactHp: 20 }, 'victory');

    const second = createCombat(NOVICE_DUELIST, 7, undefined, undefined, carryFor(g.overworld));
    expect(second.state.players.player.armor, 'the bottle is empty').toBe(0);
  });

  it('hands the engine numbers, never a brew id', () => {
    // The import boundary in behavioural form: whatever `carryFor` produces has to be
    // readable by a `createCombat` that has never heard of a brew.
    const g = global();
    addConsumable(g.overworld, brew('kinetic_capacitor'));
    useConsumable(g, 0);

    const carry = carryFor(g.overworld);
    expect(carry.boons).toEqual({ pips: 2 });
    expect(JSON.stringify(carry)).not.toContain('kinetic_capacitor');
  });
});
