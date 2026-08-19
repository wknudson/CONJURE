import { describe, expect, it } from 'vitest';
import {
  RELICS,
  RELIC_SLOTS,
  allRelics,
  boonsOfRelics,
} from '../core/data/relics.js';
import {
  equipRefusal,
  equipRelic,
  newRun,
  unequipRelic,
  type GlobalGameState,
} from '../core/overworld/state.js';
import { carryFor, resolveCombat } from '../core/overworld/run.js';
import { createCombat } from '../core/engine/setup.js';
import { NOVICE_DUELIST } from '../core/data/encounters/index.js';
import { PIP_CAP } from '../core/engine/deck.js';

/**
 * Relics.
 *
 * The house rule is the thing under test: gear bends a rule and never moves a damage
 * number. Everything else here is about the seam — the engine is handed capabilities, and
 * has never heard of a Heavy Trenchcoat.
 */

const geared = (...owned: string[]): GlobalGameState => {
  const overworld = newRun(1);
  overworld.relics = [...owned];
  return { overworld, combat: null };
};

describe('the house rule', () => {
  it('has no relic that touches a damage number', () => {
    // A relic that added two damage would be worth exactly what a card that did is, which
    // is how a gear system eats a card game. The schema has nowhere to put one, and this
    // is what keeps it that way.
    for (const relic of allRelics()) {
      const keys = Object.keys(relic.boons);
      expect(keys, relic.name).not.toContain('damage');
      expect(keys.length, `${relic.name} does something`).toBeGreaterThan(0);
    }
  });

  it('describes each relic in the engine own vocabulary', () => {
    for (const relic of allRelics()) {
      for (const key of Object.keys(relic.boons)) {
        expect(
          ['armor', 'pips', 'extraOpeningCards', 'maxPips', 'ignoreFog'],
          `${relic.name} names ${key}`,
        ).toContain(key);
      }
    }
  });
});

describe('folding gear into capabilities', () => {
  it('adds armour across pieces', () => {
    expect(boonsOfRelics(['relic_coat', 'relic_coat']).armor).toBe(6);
  });

  it('takes the highest ceiling rather than summing it', () => {
    // Two batteries are one battery. Summing would make the ceiling a stacking stat,
    // which is the bloat the whole philosophy is against.
    expect(boonsOfRelics(['relic_battery', 'relic_battery']).maxPips).toBe(
      RELICS.relic_battery!.boons.maxPips,
    );
  });

  it('skips a relic that no longer exists rather than throwing', () => {
    // A save naming a cut relic should lose the relic, not the fight.
    expect(boonsOfRelics(['relic_coat', 'relic_that_was_cut']).armor).toBe(3);
  });

  it('is empty for bare slots', () => {
    expect(boonsOfRelics([])).toEqual({});
  });
});

describe('wearing them', () => {
  it('takes four and refuses a fifth', () => {
    const g = geared('relic_coat', 'relic_battery', 'relic_goggles');
    g.overworld.relics.push('a', 'b');
    g.overworld.equippedRelics = ['relic_coat', 'relic_battery', 'relic_goggles', 'a'];

    expect(equipRefusal(g, 'b', RELIC_SLOTS)).toBe('no-slot');
    expect(equipRelic(g, 'b', RELIC_SLOTS)).toBe(false);
    expect(g.overworld.equippedRelics).toHaveLength(RELIC_SLOTS);
  });

  it('refuses what is not owned, and what is already on', () => {
    const g = geared('relic_coat');
    expect(equipRefusal(g, 'relic_battery', RELIC_SLOTS)).toBe('not-owned');

    equipRelic(g, 'relic_coat', RELIC_SLOTS);
    expect(equipRefusal(g, 'relic_coat', RELIC_SLOTS)).toBe('already-worn');
    expect(g.overworld.equippedRelics).toEqual(['relic_coat']);
  });

  it('is barred once a contract is open', () => {
    // Changing what you are wearing after a bounty is accepted would change a fight the
    // board was already built against.
    const g = geared('relic_coat');
    g.overworld.activeEncounter = { bountyId: 'x', spoils: { ducats: 5 } };

    expect(equipRefusal(g, 'relic_coat', RELIC_SLOTS)).toBe('in-combat');
    expect(equipRelic(g, 'relic_coat', RELIC_SLOTS)).toBe(false);
    expect(unequipRelic(g, 'relic_coat'), 'and it cannot come off either').toBe(false);
  });

  it('comes off freely out of combat', () => {
    const g = geared('relic_coat');
    equipRelic(g, 'relic_coat', RELIC_SLOTS);

    expect(unequipRelic(g, 'relic_coat')).toBe(true);
    expect(g.overworld.equippedRelics).toEqual([]);
    expect(g.overworld.relics, 'taken off, not thrown away').toContain('relic_coat');
  });
});

describe('what reaches the board', () => {
  const fightWith = (...worn: string[]) => {
    const g = geared(...worn);
    g.overworld.equippedRelics = [...worn];
    return createCombat(NOVICE_DUELIST, 7, undefined, undefined, carryFor(g.overworld)).state;
  };

  it('opens the contract wearing the coat', () => {
    expect(fightWith('relic_coat').players.player.armor).toBe(3);
    expect(fightWith().players.player.armor, 'baseline').toBe(0);
  });

  it('raises the Pip ceiling with the battery', () => {
    expect(fightWith('relic_battery').players.player.pipCap).toBe(9);
    expect(fightWith().players.player.pipCap).toBe(PIP_CAP);
  });

  it('never lowers the ceiling, whatever the data says', () => {
    // Gear bends a rule in the player's favour or not at all, so a malformed carry cannot
    // hand them a worse fight than the rules give them.
    const { state } = createCombat(NOVICE_DUELIST, 7, undefined, undefined, {
      boons: { maxPips: 2 },
    });
    expect(state.players.player.pipCap).toBe(PIP_CAP);
  });

  it('gives the enemy nothing', () => {
    const geared = fightWith('relic_coat', 'relic_battery');
    expect(geared.players.enemy.armor).toBe(0);
    expect(geared.players.enemy.pipCap).toBe(PIP_CAP);
  });

  it('hands the engine numbers, never a relic id', () => {
    // The same boundary the brews and Companion levels keep: `createCombat` is handed
    // "3 Armor" and has never heard of a Heavy Trenchcoat.
    const g = geared('relic_coat', 'relic_battery');
    g.overworld.equippedRelics = ['relic_coat', 'relic_battery'];

    const carry = carryFor(g.overworld);
    expect(carry.boons?.armor).toBe(3);
    expect(carry.boons?.maxPips).toBe(9);
    expect(JSON.stringify(carry)).not.toContain('relic_');
  });

  it('stacks with a brew rather than replacing it', () => {
    const g = geared('relic_coat');
    g.overworld.equippedRelics = ['relic_coat'];
    g.overworld.activeBuff = 'ironbrew';

    expect(carryFor(g.overworld).boons?.armor, '5 from the brew, 3 from the coat').toBe(8);
  });
});

describe('spoils that include cores', () => {
  it('credits reagents into the bag alongside the coin', () => {
    const g = geared();
    g.combat = {};
    g.overworld.activeEncounter = {
      bountyId: 'x',
      spoils: { ducats: 90, marrowShards: 1, reagents: { core_frost: 2 } },
    };

    resolveCombat(g, { pactHp: 20 }, 'victory');

    expect(g.overworld.economy.ducats).toBe(90);
    expect(g.overworld.economy.reagents.core_frost).toBe(2);
  });

  it('adds to cores already held rather than replacing them', () => {
    const g = geared();
    g.overworld.economy.reagents = { core_frost: 2 };
    g.combat = {};
    g.overworld.activeEncounter = {
      bountyId: 'x',
      spoils: { reagents: { core_frost: 1, core_surge: 3 } },
    };

    resolveCombat(g, { pactHp: 20 }, 'victory');

    expect(g.overworld.economy.reagents).toEqual({ core_frost: 3, core_surge: 3 });
  });

  it('pays no cores for a loss', () => {
    const g = geared();
    g.combat = {};
    g.overworld.activeEncounter = {
      bountyId: 'x',
      spoils: { reagents: { core_frost: 2 } },
    };

    resolveCombat(g, { pactHp: 0 }, 'defeat');
    expect(g.overworld.economy.reagents).toEqual({});
  });
});
