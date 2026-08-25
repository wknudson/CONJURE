import { describe, expect, it } from 'vitest';
import {
  RELICS,
  RELIC_SLOTS,
  allRelics,
  boonsOfRelics,
  relicsForSlot,
  slotOf,
} from '../core/data/relics.js';
import { BOON_KEYS } from './boons.js';
import { BOON_LABELS } from '../app/DeckBuilderScreen.js';
import type { CombatBoons } from '../core/engine/setup.js';
import {
  RELIC_SLOT_ORDER,
  emptyLoadout,
  equipRefusal,
  equipRelic,
  newRun,
  unequipRelic,
  wornRelics,
  type GlobalGameState,
  type RelicLoadout,
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

/** Dresses a loadout from a list of ids, each into the slot it belongs in. */
const worn = (...ids: string[]): RelicLoadout => {
  const loadout = emptyLoadout();
  for (const id of ids) {
    const slot = slotOf(id);
    if (slot) loadout[slot] = id;
  }
  return loadout;
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
    // Reads the one shared list rather than keeping a second copy. It kept a copy once,
    // and the copy drifted the first time the vocabulary grew — this test started
    // rejecting a relic for naming a capability that had been legal for a sprint.
    for (const relic of allRelics()) {
      for (const key of Object.keys(relic.boons)) {
        expect(BOON_KEYS as string[], `${relic.name} names ${key}`).toContain(key);
      }
    }
  });
});

describe('folding gear into capabilities', () => {
  it('adds armour across pieces', () => {
    // One coat per loadout now — the slot is what stops two — so this reads the fold
    // directly rather than through a loadout that could not legally exist.
    expect(boonsOfRelics(worn('relic_coat')).armor).toBe(30);
  });

  it('takes the highest ceiling rather than summing it', () => {
    // Two batteries are one battery. Summing would make the ceiling a stacking stat,
    // which is the bloat the whole philosophy is against.
    expect(boonsOfRelics(worn('relic_battery')).maxPips).toBe(
      RELICS.relic_battery!.boons.maxPips,
    );
  });

  it('skips a relic that no longer exists rather than throwing', () => {
    // A save naming a cut relic should lose the relic, not the fight.
    expect(boonsOfRelics({ ...worn('relic_coat'), optics: 'relic_that_was_cut' }).armor).toBe(30);
  });

  it('is empty for bare slots', () => {
    expect(boonsOfRelics(emptyLoadout())).toEqual({});
  });
});

describe('reading them', () => {
  it('has a label for every capability a relic can grant', () => {
    // The Field Journal's Hero tab filters its totals panel by `BOON_LABELS`, so a boon with
    // no label is a worn relic the game refuses to admit is doing anything — it renders
    // "Nothing worn. The rules apply as written." while the fight plainly disagrees.
    //
    // That was live for ten boons: the table was an array typed `{ key: keyof CombatBoons }[]`,
    // which asserts every key is a boon and never that every boon has a key, under a
    // docblock claiming the opposite. It is a total `Record` now, so the compiler catches a
    // missing entry — and this catches the thing the compiler cannot, which is an entry that
    // is present and says nothing.
    for (const key of BOON_KEYS) {
      const label = BOON_LABELS[key as keyof CombatBoons];
      expect(label, `${key} has no label on the Hero sheet`).toBeTruthy();
      expect(label.trim().length, `${key}'s label is blank`).toBeGreaterThan(0);
      expect(label, `${key}'s label is the field name`).not.toBe(key);
    }
  });
});

describe('wearing them', () => {
  it('holds one of each slot and no more', () => {
    // One per slot, whatever the slots currently are — naming four here is how this test
    // broke when a fifth was added.
    const oneEach = RELIC_SLOT_ORDER.map((slot) => relicsForSlot(slot)[0]!.id);
    const g = geared(...oneEach);
    for (const id of g.overworld.relics) equipRelic(g, id, slotOf(id));

    expect(wornRelics(g.overworld.equippedRelics)).toHaveLength(RELIC_SLOTS);
    expect(RELIC_SLOT_ORDER.every((s) => g.overworld.equippedRelics[s] !== null)).toBe(true);
  });

  it('swaps rather than refusing when the slot is taken', () => {
    // The flat list had to say no, because it could not know which of four to drop. A
    // slot answers that by construction: there is one thing in the way and it is the
    // thing being replaced.
    const g = geared('relic_goggles', 'relic_monocle');
    equipRelic(g, 'relic_goggles', slotOf('relic_goggles'));

    expect(equipRelic(g, 'relic_monocle', slotOf('relic_monocle'))).toBe(true);
    expect(g.overworld.equippedRelics.optics).toBe('relic_monocle');
    expect(g.overworld.relics, 'the displaced pair is not lost').toContain('relic_goggles');
  });

  it('refuses gear the catalogue cannot place', () => {
    const g = geared('relic_coat');
    g.overworld.relics.push('relic_that_was_cut');
    expect(equipRefusal(g, 'relic_that_was_cut', slotOf('relic_that_was_cut'))).toBe('unknown-slot');
    expect(equipRelic(g, 'relic_that_was_cut', undefined)).toBe(false);
  });

  it('refuses what is not owned, and what is already on', () => {
    const g = geared('relic_coat');
    expect(equipRefusal(g, 'relic_battery', slotOf('relic_battery'))).toBe('not-owned');

    equipRelic(g, 'relic_coat', slotOf('relic_coat'));
    expect(equipRefusal(g, 'relic_coat', slotOf('relic_coat'))).toBe('already-worn');
    expect(wornRelics(g.overworld.equippedRelics)).toEqual(['relic_coat']);
  });

  it('is barred once a contract is open', () => {
    // Changing what you are wearing after a bounty is accepted would change a fight the
    // board was already built against.
    const g = geared('relic_coat');
    g.overworld.activeEncounter = { bountyId: 'x', spoils: { ducats: 5 } };

    expect(equipRefusal(g, 'relic_coat', slotOf('relic_coat'))).toBe('in-combat');
    expect(equipRelic(g, 'relic_coat', slotOf('relic_coat'))).toBe(false);
    expect(unequipRelic(g, 'relic_coat'), 'and it cannot come off either').toBe(false);
  });

  it('comes off freely out of combat', () => {
    const g = geared('relic_coat');
    equipRelic(g, 'relic_coat', slotOf('relic_coat'));

    expect(unequipRelic(g, 'relic_coat')).toBe(true);
    expect(g.overworld.equippedRelics).toEqual(emptyLoadout());
    expect(g.overworld.relics, 'taken off, not thrown away').toContain('relic_coat');
  });
});

describe('what reaches the board', () => {
  const fightWith = (...ids: string[]) => {
    const g = geared(...ids);
    g.overworld.equippedRelics = worn(...ids);
    return createCombat(NOVICE_DUELIST, 7, undefined, undefined, carryFor(g.overworld)).state;
  };

  it('opens the contract wearing the coat', () => {
    expect(fightWith('relic_coat').players.player.armor).toBe(30);
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
    g.overworld.equippedRelics = worn('relic_coat', 'relic_battery');

    const carry = carryFor(g.overworld);
    expect(carry.boons?.armor).toBe(30);
    expect(carry.boons?.maxPips).toBe(9);
    expect(JSON.stringify(carry)).not.toContain('relic_');
  });

  it('stacks with a brew rather than replacing it', () => {
    const g = geared('relic_coat');
    g.overworld.equippedRelics = worn('relic_coat');
    g.overworld.activeBuff = 'ironbrew';

    expect(carryFor(g.overworld).boons?.armor, '5 from the brew, 3 from the coat').toBe(80);
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

describe('the slots themselves', () => {
  it('places every relic somewhere the loadout can hold it', () => {
    for (const relic of allRelics()) {
      expect(RELIC_SLOT_ORDER, relic.name).toContain(relic.slot);
    }
  });

  it('gives every slot something to put in it', () => {
    // A slot with no gear is a hole in the screen the player can never fill, which reads
    // as a bug rather than as content still to come.
    for (const slot of RELIC_SLOT_ORDER) {
      expect(relicsForSlot(slot).length, slot).toBeGreaterThan(0);
    }
  });

  it('makes the loadout a choice, not a checklist', () => {
    // At least one slot has to hold a real decision, or wearing everything you own is
    // always right and the slots are just four labels.
    const contested = RELIC_SLOT_ORDER.filter((s) => relicsForSlot(s).length > 1);
    expect(contested.length, 'some slot has rivals in it').toBeGreaterThan(0);
  });
});
