import { describe, expect, it } from 'vitest';
import { AUDIT_BOUNTY_ID, AUDIT_SPOILS, rollBounties } from '../core/data/bounties.js';
import { resolveCombat } from '../core/overworld/run.js';
import { newRun } from '../core/overworld/state.js';
import type { GlobalGameState } from '../core/overworld/state.js';
import { encounterById } from '../core/data/encounters/index.js';
import { schematicCatalogue, schematicsFor } from '../core/data/artificer.js';
import { isObtainable } from '../core/data/collection.js';
import { CARDS } from '../core/data/cards/index.js';
import { GEAR_STOCK } from '../core/data/outfitter.js';
import { ASCENSION_COST_SHARDS } from '../core/overworld/forge.js';

/**
 * The Magistrate's Audit, and the shelf it exists to stock.
 *
 * A development affordance shipped on purpose. These tests are less about the numbers
 * than about the two things that would make it useless: paying through a different seam
 * than a real contract, or quietly displacing the Master poster.
 */

function accepted(seed: number, index: number): GlobalGameState {
  const overworld = newRun(seed);
  const bounty = rollBounties(seed)[index]!;
  overworld.activeEncounter = { bountyId: bounty.id, spoils: bounty.spoils };
  return { overworld, combat: null };
}

describe('the audit poster', () => {
  const audit = () => rollBounties(4242)[2]!;

  it('is the third poster, sealed and named', () => {
    expect(audit().audit).toBe(true);
    expect(audit().id).toBe(AUDIT_BOUNTY_ID);
    expect(audit().title).toContain('Audit');
  });

  it('sends you to a real fight, and the fastest one', () => {
    // A contract that paid on being clicked would test the shop and nothing about the run
    // resolving around it. It is also the easiest opposition on the board on purpose: a
    // test loop that takes ten minutes to close is not a test loop.
    const enc = encounterById(audit().enemySeed);
    expect(enc, 'the audit points at no encounter').toBeDefined();
    expect(audit().difficulty).toBe('novice');
  });

  it('is the same contract whatever the board does', () => {
    // Fixed rather than seeded, so it survives a reroll and can be recognised in a save.
    for (const seed of [1, 77, 9001]) {
      const a = rollBounties(seed)[2]!;
      expect(a.id).toBe(AUDIT_BOUNTY_ID);
      expect(a.spoils.ducats).toBe(AUDIT_SPOILS.ducats);
    }
  });

  it('does not take the Apex Subjugation off the board', () => {
    // The whole reason it is spliced in rather than written over slot three: the Master
    // contract is the only route to `beginSubjugation`, and therefore to a bound Companion.
    const board = rollBounties(4242);
    expect(board.some((b) => b.difficulty === 'master')).toBe(true);
    expect(board.some((b) => b.enemySeed === 'ignis_trial')).toBe(true);
  });
});

describe('the vault pays through the ordinary seam', () => {
  it('banks the whole payload on a win', () => {
    const g = accepted(4242, 2);
    const before = { ...g.overworld.economy };

    resolveCombat(g, { pactHp: 20 }, 'victory');

    expect(g.overworld.economy.ducats).toBe(before.ducats + AUDIT_SPOILS.ducats);
    expect(g.overworld.economy.marrowShards).toBe(
      before.marrowShards + AUDIT_SPOILS.marrowShards,
    );
    for (const [core, n] of Object.entries(AUDIT_SPOILS.reagents)) {
      expect(g.overworld.economy.reagents[core], core).toBe(n);
    }
  });

  it('pays nothing for a loss, like any other contract', () => {
    const g = accepted(4242, 2);
    const before = g.overworld.economy.ducats;
    resolveCombat(g, { pactHp: 0 }, 'defeat');
    expect(g.overworld.economy.ducats).toBe(before);
  });

  it('closes the contract, so it cannot be collected twice', () => {
    const g = accepted(4242, 2);
    resolveCombat(g, { pactHp: 20 }, 'victory');
    expect(g.overworld.activeEncounter).toBeNull();
  });
});

describe('one audit actually funds the benches it exists to test', () => {
  it('buys the most expensive thing on the gear counter several times over', () => {
    const dearest = Math.max(...GEAR_STOCK.map((g) => g.price));
    expect(AUDIT_SPOILS.ducats).toBeGreaterThan(dearest * 5);
  });

  it('outfits a commander completely and leaves change', () => {
    const whole = GEAR_STOCK.reduce((sum, g) => sum + g.price, 0);
    expect(AUDIT_SPOILS.ducats, 'cannot buy the whole shelf').toBeGreaterThan(whole);
  });

  it('funds a run of Ascensions rather than one', () => {
    expect(AUDIT_SPOILS.marrowShards).toBeGreaterThan(ASCENSION_COST_SHARDS * 5);
  });

  it('carries every core the bench presses with', () => {
    // A vault that paid one school's core would test a third of the splicing recipes.
    for (const core of ['core_pyre', 'core_surge', 'core_frost']) {
      expect(
        AUDIT_SPOILS.reagents[core as keyof typeof AUDIT_SPOILS.reagents],
        core,
      ).toBeGreaterThan(0);
    }
  });
});

describe('the blueprint shelf', () => {
  it('lists everything obtainable, held or not', () => {
    // The grid sorts by unlock status, which means nothing on a list that has already
    // removed everything unlocked.
    const shelf = schematicCatalogue().map((d) => d.id);
    const obtainable = Object.values(CARDS).filter(isObtainable).map((d) => d.id);
    expect(shelf.sort()).toEqual(obtainable.sort());
  });

  it('still keeps engine furniture and Rank 2 printings off it', () => {
    for (const def of schematicCatalogue()) {
      expect(def.setupOnly, def.id).not.toBe(true);
      expect(def.spliceOnly, def.id).not.toBe(true);
    }
  });

  it('is a superset of what the player could buy right now', () => {
    // `schematicsFor` still answers "what could I cut"; the catalogue answers "what is
    // there". The Safehouse door counts the first and the shelf shows the second.
    const owned = { unlocked: ['shield_bash'] };
    const buyable = schematicsFor(owned).map((d) => d.id);
    const shelf = new Set(schematicCatalogue().map((d) => d.id));
    for (const id of buyable) expect(shelf.has(id), id).toBe(true);
    expect(buyable).not.toContain('shield_bash');
    expect(shelf.has('shield_bash'), 'the shelf still shows what you hold').toBe(true);
  });
});
