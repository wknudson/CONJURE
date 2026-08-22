import { describe, expect, it } from 'vitest';
import { CARDS } from '../core/data/cards/index.js';
import { ENCOUNTERS, encounterById } from '../core/data/encounters/index.js';
import { isObtainable, startingCollection } from '../core/data/collection.js';
import { schematicsFor } from '../core/data/artificer.js';
import {
  SCHEMATIC_PICKS,
  grantSchematic,
  rollSchematicOffer,
  schematicPool,
} from '../core/data/schematics.js';
import { SCHEMATIC_COST_DUCATS, forgeSchematic, schematicRefusal } from '../core/overworld/forge.js';
import { newRun } from '../core/overworld/state.js';
import { makeRng } from '../core/util/rng.js';
import type { GlobalGameState } from '../core/overworld/state.js';

/**
 * The one door into a collection.
 *
 * A win used to hand over the card. Now it hands over a *plan*, and the card still costs
 * Ducats at the bench — so a card is two things the player went and got, not one thing the
 * dice gave them.
 */

function bench(ducats: number): GlobalGameState {
  const overworld = newRun(5);
  overworld.economy.ducats = ducats;
  return { overworld, combat: null } as GlobalGameState;
}

describe('a fight teaches what it fought you with', () => {
  it('draws its pool out of the enemy deck rather than a second list', () => {
    for (const encounter of ENCOUNTERS) {
      const pool = schematicPool(encounter).map((d) => d.id);
      const played = new Set(encounter.enemyDeck);
      for (const id of pool) {
        expect(played.has(id), `${encounter.id} pools ${id}, which it never plays`).toBe(true);
      }
      // Deduped: an enemy deck holding three Flame Surges is one thing to learn.
      expect(new Set(pool).size).toBe(pool.length);
    }
  });

  it('offers nothing a fight could not legitimately hand over', () => {
    // The gate is `isObtainable`, the same predicate the bench's shelf asks — so the Rite,
    // Rank 2 printings, spliced Hybrids and bodies stay out of both.
    for (const encounter of ENCOUNTERS) {
      for (const def of schematicPool(encounter)) {
        expect(isObtainable(def), `${encounter.id} pools ${def.id}`).toBe(true);
      }
    }
  });

  it('gives every shipped fight something to teach', () => {
    // A contract that can never pay a plan is a contract that only pays money, and after
    // this change that is most of the progression gone. If a new encounter trips this, its
    // enemy deck is entirely un-obtainable and that is worth knowing at build time.
    for (const encounter of ENCOUNTERS) {
      expect(schematicPool(encounter).length, `${encounter.id} teaches nothing`).toBeGreaterThan(0);
    }
  });

  it('widens the choice with the tier and still hands over exactly one', () => {
    expect(SCHEMATIC_PICKS.novice).toBe(2);
    expect(SCHEMATIC_PICKS.adept).toBe(3);
    expect(SCHEMATIC_PICKS.master).toBe(4);
  });
});

describe('the plan and the price are two different gates', () => {
  const trial = encounterById('ignis_trial')!;

  it('refuses a card the character holds no plan for, however rich they are', () => {
    const pool = schematicPool(trial).map((d) => d.id);
    const target = pool[0]!;
    const g = bench(10_000);

    expect(schematicRefusal(g, { unlocked: [] }, target, [])).toBe('no-schematic');
    expect(forgeSchematic(g, { unlocked: [] }, target, [])).toBeNull();
    expect(g.overworld.economy.ducats, 'and nothing was charged for the refusal').toBe(10_000);
  });

  it('refuses a card the character cannot pay for, however well prepared', () => {
    const target = schematicPool(trial)[0]!.id;
    const g = bench(SCHEMATIC_COST_DUCATS - 1);
    expect(schematicRefusal(g, { unlocked: [] }, target, [target])).toBe('too-poor');
  });

  it('names the missing plan before the missing money', () => {
    // Order is the message. Telling a broke player to go and earn Ducats for a card they
    // could not cut at any price sends them to do the wrong thing.
    const target = schematicPool(trial)[0]!.id;
    const broke = bench(0);
    expect(schematicRefusal(broke, { unlocked: [] }, target, [])).toBe('no-schematic');
  });

  it('cuts the card when both are in hand, and charges once', () => {
    const target = schematicPool(trial)[0]!.id;
    const g = bench(SCHEMATIC_COST_DUCATS);
    const after = forgeSchematic(g, { unlocked: [] }, target, [target]);

    expect(after?.unlocked).toContain(target);
    expect(g.overworld.economy.ducats).toBe(0);
    // Forged once and that is the whole of it -- there is no second copy to buy.
    expect(schematicRefusal(g, after!, target, [target])).toBe('already-forged');
  });

  it('leaves the plan in hand after it is spent', () => {
    // A Schematic is a record of a thing that happened, like `rosterUnlocks`. Keeping it is
    // what lets a later offer tell "you never had this" apart from "you already used it".
    const target = schematicPool(trial)[0]!.id;
    const held = grantSchematic([], target);
    const g = bench(SCHEMATIC_COST_DUCATS);
    const after = forgeSchematic(g, { unlocked: [] }, target, held)!;

    expect(held).toContain(target);
    expect(rollSchematicOffer(makeRng(4), trial, after, held)).not.toContain(target);
  });
});

describe('the bench shelf', () => {
  it('carries only what the character holds a plan for', () => {
    const collection = startingCollection();
    expect(schematicsFor(collection, []), 'nothing found, nothing to cut').toEqual([]);

    // Deliberately a card the starting collection does *not* already hold: the shelf drops
    // what is forged as well as what is unplanned, and a fixture that happened to pick an
    // owned card would pass this test by proving the wrong rule.
    const target = schematicPool(encounterById('ignis_trial')!)
      .map((d) => d.id)
      .find((id) => !collection.unlocked.includes(id))!;
    expect(target, 'the Trial teaches something new').toBeDefined();

    const shelf = schematicsFor(collection, [target]).map((d) => d.id);
    expect(shelf).toEqual([target]);

    // And a plan for a card already forged buys nothing.
    const forged = collection.unlocked[0]!;
    expect(schematicsFor(collection, [forged])).toEqual([]);
  });

  it('still answers what it could cut in principle when nobody asks about a ledger', () => {
    // The catalogue view and the tooltips want the whole shelf. Omitting `held` is the old
    // behaviour on purpose, so a caller that is not gating a purchase need not invent one.
    expect(schematicsFor(startingCollection()).length).toBeGreaterThan(0);
  });
});

describe('grantSchematic', () => {
  it('is idempotent, sorted, and ignores a card that does not exist', () => {
    const once = grantSchematic([], 'shield_bash');
    expect(grantSchematic(once, 'shield_bash')).toEqual(once);
    expect(grantSchematic(['shield_bash'], 'aegis_ward')).toEqual(['aegis_ward', 'shield_bash']);
    expect(grantSchematic([], 'not_a_card')).toEqual([]);
  });

  it('never mutates what it was handed', () => {
    const before: string[] = [];
    grantSchematic(before, 'shield_bash');
    expect(before).toEqual([]);
  });
});

/**
 * What the loop can actually reach — and, honestly, what it cannot.
 *
 * This is the cost of the change, and it is not small. Making the plan the only door means
 * a card is reachable exactly when some encounter's deck carries it. Four encounters ship,
 * between them they play five schools' worth of cards, and **29 of the 50 obtainable cards
 * are currently behind no door at all**.
 *
 * That is a content gap, not a bug: it closes as encounters are added, and every card on
 * the list below becomes reachable the day a fight plays it. But a gap nobody can see is a
 * gap nobody schedules, so it is written down here in the shape this codebase already uses
 * for exactly this — the `KNOWN_UNREACHABLE` ledger in `elements.test.ts`.
 *
 * The assertion runs in **both directions**. A card joining this list fails the build, and
 * so does a card leaving it. The gap cannot be forgotten and closing it cannot go
 * unrecorded.
 */
describe('what the loop can actually reach', () => {
  const UNREACHABLE = new Set([
    // Arcane and Pyre furniture no shipped fight plays.
    'volatile_cask',
    'pyre_pillar',
    'ashen_wake',
    'pressure_valve_release',
    // The Hero's own arcane tools, which no enemy has ever cast at anybody.
    'aetheric_tether',
    'aetheric_resurgence',
    'anchor_rally',
    // The Bloom trap, and Bloom generally: no encounter is fought against it.
    'rot_root_snare',
    'spore_cloud',
    'noxious_cloud',
    'root_snare',
    'verdant_swell',
    'verdant_collapse',
    // Surge: same story.
    'static_arc',
    'arc_lash',
    'arcing_step',
    'thunderhead',
    'static_charge',
    // Bulwark: same story.
    'seismic_slam',
    'tectonic_plate',
    'avalanche_slam',
    'petrifying_mantle',
    // Dusk: the Trial is Pyre and the Duelist plays neutral, so none of this is on offer.
    'smoke_bomb',
    'shadow_siphon',
    'grave_call',
    'harvest_the_weak',
    'blood_and_bone_rally',
    // Frost spells the Glacial Field happens not to run.
    'creeping_rime',
    'rime_lock',
  ]);

  const reachable = (): Set<string> => {
    const taught = new Set(ENCOUNTERS.flatMap((e) => schematicPool(e).map((d) => d.id)));
    for (const id of startingCollection().unlocked) taught.add(id);
    return taught;
  };

  it('knows exactly which cards no fight carries the plan for', () => {
    const canReach = reachable();

    for (const def of Object.values(CARDS)) {
      if (!isObtainable(def)) continue;

      if (UNREACHABLE.has(def.id)) {
        expect(
          canReach.has(def.id),
          `${def.id} is reachable now — take it out of UNREACHABLE`,
        ).toBe(false);
      } else {
        expect(
          canReach.has(def.id),
          `${def.id}: no fight plays it and nobody starts with it — add an encounter that does, or add it to UNREACHABLE`,
        ).toBe(true);
      }
    }
  });

  it('still leaves a new character a way to grow', () => {
    // The floor under the gap above. Whatever is unreachable, the first fight a player can
    // take must be able to teach them *something* they do not already have — otherwise the
    // opening hour is money with nothing to spend it on.
    const start = startingCollection();
    const opener = encounterById('novice_duelist')!;
    const fresh = schematicPool(opener)
      .map((d) => d.id)
      .filter((id) => !start.unlocked.includes(id));

    expect(fresh.length, 'the first contract teaches nothing new').toBeGreaterThan(0);
  });
});
