import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  grantCard,
  isUnlocked,
  reconcileCollection,
  startingCollection,
} from '../core/data/collection.js';
import {
  TIER_COPY_LIMIT,
  remainingCopies,
  tierOf,
  validateDeck,
} from '../core/data/deckRules.js';
import { CARDS } from '../core/data/cards/index.js';
import { forgeSchematic, schematicRefusal, SCHEMATIC_COST_DUCATS } from '../core/overworld/forge.js';
import { spliceCard } from '../core/overworld/splice.js';
import { SPLICE_RECIPES } from '../core/data/splicing.js';
import { newRun, type GlobalGameState } from '../core/overworld/state.js';
import type { Collection } from '../core/data/deckRules.js';
import { DUEL_ENCOUNTERS, WAGER_MULTIPLIER, rollBounties, type Bounty } from '../core/data/bounties.js';
import { contractRefusal, openContract, resolveCombat } from '../core/overworld/run.js';
import { emptySave, loadSave, newProfile, writeSave, type SaveFile } from '../app/save.js';

/**
 * Unlock-once.
 *
 * A card used to be a physical copy you could run out of, which meant two systems capped
 * the same thing: a Tier limit *and* an inventory count. Forging now unlocks a card
 * permanently, the Tier limit is the only bottleneck left, and nothing in the game can
 * take an unlock away.
 */

/** A minimal in-memory localStorage, so the save checks run without a DOM. */
function installStorage(): void {
  const store = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
  });
}

/** A save file on disk with one profile in it, for the migration checks. */
function fileWith(slot: string): SaveFile {
  const file = emptySave();
  file.profiles[slot as keyof SaveFile['profiles']] = newProfile(slot);
  return file;
}

function rich(ducats = 5_000): GlobalGameState {
  const overworld = newRun(1);
  overworld.economy.ducats = ducats;
  return { overworld, combat: null };
}

describe('one unlock is unlimited access', () => {
  it('lets a deck run the full Tier allowance from a single unlock', () => {
    const collection: Collection = { unlocked: ['grapple_line', 'shield_bash'] };
    const limit = TIER_COPY_LIMIT[tierOf(CARDS.grapple_line!)];
    const deck = [...Array.from({ length: limit }, () => 'grapple_line'), 'shield_bash', 'aegis_ward'];

    expect(limit).toBe(3);
    expect(validateDeck(deck.slice(0, limit + 1), collection)
      .some((p) => p.code === 'not_unlocked')).toBe(false);
  });

  it('still stops at the Tier limit, which is now the only cap', () => {
    const collection: Collection = { unlocked: ['grapple_line', 'shield_bash', 'aegis_ward'] };
    const four = ['grapple_line', 'grapple_line', 'grapple_line', 'grapple_line', 'shield_bash'];
    expect(validateDeck(four, collection).map((p) => p.code)).toContain('over_copy_limit');
  });

  it('reports the Tier allowance as what remains, never a copy count', () => {
    const collection: Collection = { unlocked: ['grapple_line'] };
    expect(remainingCopies([], 'grapple_line', collection)).toBe(3);
    expect(remainingCopies(['grapple_line'], 'grapple_line', collection)).toBe(2);
  });

  it('offers nothing at all for a card that is not unlocked', () => {
    const collection: Collection = { unlocked: [] };
    expect(remainingCopies([], 'grapple_line', collection)).toBe(0);
    expect(validateDeck(['grapple_line'], collection).map((p) => p.code)).toContain('not_unlocked');
  });

  it('is a set, so granting twice is granting once', () => {
    const once = grantCard(startingCollection(), 'flame_surge');
    const twice = grantCard(once, 'flame_surge');
    expect(twice.unlocked.filter((id) => id === 'flame_surge')).toHaveLength(1);
    expect(twice, 'and the identical collection comes back').toBe(once);
  });
});

describe('the Scribing Forge', () => {
  it('unlocks the card and charges once', () => {
    const g = rich();
    const before = g.overworld.economy.ducats;
    const after = forgeSchematic(g, { unlocked: [] }, 'scout_imp')!;

    expect(isUnlocked(after, 'scout_imp')).toBe(true);
    expect(g.overworld.economy.ducats).toBe(before - SCHEMATIC_COST_DUCATS);
  });

  it('refuses a card already forged, and charges nothing for saying so', () => {
    const g = rich();
    const owned = forgeSchematic(g, { unlocked: [] }, 'scout_imp')!;
    const ducats = g.overworld.economy.ducats;

    expect(schematicRefusal(g, owned, 'scout_imp')).toBe('already-forged');
    expect(forgeSchematic(g, owned, 'scout_imp')).toBeNull();
    expect(g.overworld.economy.ducats).toBe(ducats);
  });

  it('leaves an earlier Ascension untouched', () => {
    const g = rich();
    const before: Collection = { unlocked: ['scout_imp'], ascended: ['scout_imp'] };
    const after = forgeSchematic(g, before, 'grapple_line')!;
    expect(after.ascended).toEqual(['scout_imp']);
  });
});

describe('the splicing bench spends a Core, not a card', () => {
  const BASE = SPLICE_RECIPES[0]!.baseCardId;
  const CORE = SPLICE_RECIPES[0]!.catalystId;
  const RESULT = SPLICE_RECIPES[0]!.resultId;
  /** The other half of the fusion, which the bench now insists the player has learned. */
  const PREREQS = SPLICE_RECIPES[0]!.requiredUnlockedCards ?? [];

  it('keeps the base unlocked and adds the hybrid', () => {
    const g = rich();
    g.overworld.economy.reagents = { [CORE]: 1 };
    const done = spliceCard(g, { unlocked: [BASE, ...PREREQS] }, BASE, CORE)!;

    expect(isUnlocked(done.collection, BASE), 'knowing a spell cannot be taken away').toBe(true);
    expect(isUnlocked(done.collection, RESULT)).toBe(true);
    expect(g.overworld.economy.reagents[CORE], 'the Core is the whole price').toBeUndefined();
  });

  it('never needs to trim a deck, because nothing was lost', () => {
    const g = rich();
    g.overworld.economy.reagents = { [CORE]: 1 };
    const done = spliceCard(g, { unlocked: [BASE, ...PREREQS] }, BASE, CORE)!;
    expect(done.trimmed).toBe(0);
  });
});

describe('the collection survives a reconcile', () => {
  it('drops ids the registry no longer has, and keeps the rest', () => {
    const { collection, dropped } = reconcileCollection({
      unlocked: ['shield_bash', 'a_card_from_a_past_patch'],
    });
    expect(dropped).toContain('a_card_from_a_past_patch');
    expect(collection.unlocked).toContain('shield_bash');
  });

  it('never lists the same card twice', () => {
    const { collection } = reconcileCollection({ unlocked: ['shield_bash', 'shield_bash'] });
    expect(collection.unlocked.filter((id) => id === 'shield_bash')).toHaveLength(1);
  });
});

describe('the legacy save migration', () => {
  beforeEach(() => installStorage());
  it('turns a tally of copies into a set of unlocks', () => {
    const file = fileWith('slot-1');
    writeSave(file);
    const raw = JSON.parse(localStorage.getItem('conjure.save')!);
    // The pre-v13 shape: counts, including one the player held three of.
    raw.profiles['slot-1'].collection = {
      owned: { shield_bash: 3, aegis_ward: 1, grapple_line: 2 },
      ascended: ['shield_bash'],
    };
    localStorage.setItem('conjure.save', JSON.stringify(raw));

    const p = loadSave().save.profiles['slot-1']!;

    for (const id of ['shield_bash', 'aegis_ward', 'grapple_line']) {
      expect(p.collection.unlocked, id).toContain(id);
    }
    expect(p.collection.ascended, 'and the Ascension came through').toContain('shield_bash');
  });

  it('gives the one-copy card the same access as the three-copy one', () => {
    // The counts are dropped, and that is strictly generous: a player who held one of a
    // finisher can now run whatever its Tier allows.
    const file = fileWith('slot-1');
    writeSave(file);
    const raw = JSON.parse(localStorage.getItem('conjure.save')!);
    raw.profiles['slot-1'].collection = { owned: { aegis_ward: 1 } };
    localStorage.setItem('conjure.save', JSON.stringify(raw));

    const p = loadSave().save.profiles['slot-1']!;
    expect(remainingCopies([], 'aegis_ward', p.collection)).toBe(
      TIER_COPY_LIMIT[tierOf(CARDS.aegis_ward!)],
    );
  });

  it('drops a card the player held zero of', () => {
    const file = fileWith('slot-1');
    writeSave(file);
    const raw = JSON.parse(localStorage.getItem('conjure.save')!);
    raw.profiles['slot-1'].collection = { owned: { volatile_cask: 0, aether_beam: 2 } };
    localStorage.setItem('conjure.save', JSON.stringify(raw));

    const p = loadSave().save.profiles['slot-1']!;
    expect(p.collection.unlocked).not.toContain('volatile_cask');
    expect(p.collection.unlocked).toContain('aether_beam');
  });

  it('reads a v13 save back unchanged', () => {
    const file = fileWith('slot-1');
    writeSave(file);
    const raw = JSON.parse(localStorage.getItem('conjure.save')!);
    raw.profiles['slot-1'].collection = { unlocked: ['shield_bash', 'aether_beam'] };
    localStorage.setItem('conjure.save', JSON.stringify(raw));

    const p = loadSave().save.profiles['slot-1']!;
    expect(p.collection.unlocked).toContain('shield_bash');
    expect(p.collection.unlocked).toContain('aether_beam');
  });
});

describe('duels wager currency, never cards', () => {
  const duel = (wager: number): Bounty => ({
    id: 'd1',
    title: 'A Wandering Duelist',
    difficulty: 'novice',
    enemySeed: 'novice_duelist',
    wager,
    spoils: { ducats: 10 },
    flavour: '',
  });

  it('takes the stake the moment the contract opens', () => {
    const g = rich(500);
    expect(openContract(g, duel(40))).toBe(true);

    expect(g.overworld.economy.ducats, 'paid up front').toBe(460);
    expect(g.overworld.activeEncounter!.wager).toBe(40);
  });

  it('pays the stake back doubled on a win', () => {
    const g = rich(500);
    openContract(g, duel(40));
    resolveCombat(g, { pactHp: 20, encounteredUnitIds: [], defeatedUnitIds: [] }, 'victory');

    // 500 - 40 staked, + 80 won, + 10 spoils.
    expect(g.overworld.economy.ducats).toBe(500 - 40 + 40 * WAGER_MULTIPLIER + 10);
  });

  it('pays nothing on a loss — the buy-in was the cost', () => {
    const g = rich(500);
    openContract(g, duel(40));
    resolveCombat(g, { pactHp: 0, encounteredUnitIds: [], defeatedUnitIds: [] }, 'defeat');

    expect(g.overworld.economy.ducats, 'down exactly the stake').toBe(460);
  });

  it('refuses a stake the purse cannot cover, and takes nothing', () => {
    const g = rich(10);
    expect(contractRefusal(g, duel(40))).toBe('cannot-cover-wager');
    expect(openContract(g, duel(40))).toBe(false);
    expect(g.overworld.economy.ducats).toBe(10);
    expect(g.overworld.activeEncounter).toBeNull();
  });

  it('leaves an ordinary contract entirely alone', () => {
    const g = rich(500);
    const job: Bounty = { ...duel(0), enemySeed: 'narrow_ruin' };
    delete (job as { wager?: number }).wager;

    expect(openContract(g, job)).toBe(true);
    expect(g.overworld.economy.ducats, 'no stake on a job').toBe(500);
    expect(g.overworld.activeEncounter!.wager).toBeUndefined();
  });

  it('never touches the collection or a deck, win or lose', () => {
    // The rule the whole progression model rests on: a loss costs money and time, never
    // possessions. There has never been a card ante and there is not one now.
    const g = rich(500);
    const before = startingCollection();
    openContract(g, duel(40));
    resolveCombat(g, { pactHp: 0, encounteredUnitIds: [], defeatedUnitIds: [] }, 'defeat');

    expect(reconcileCollection(before).collection.unlocked).toEqual(
      reconcileCollection(startingCollection()).collection.unlocked,
    );
  });

  it('stakes only the encounters that are actually duels', () => {
    const rolled = rollBounties(7);
    for (const b of rolled) {
      if (b.audit) {
        // The Magistrate's Audit uses the duelling board but is a debug contract, not a
        // bet. Staking it would charge a developer for their own test loop.
        expect(b.wager, b.title).toBeUndefined();
      } else if (DUEL_ENCOUNTERS.includes(b.enemySeed)) {
        expect(b.wager, b.title).toBeGreaterThan(0);
      } else {
        expect(b.wager, b.title).toBeUndefined();
      }
    }
  });
});
