/**
 * The Wild Hunts: the registry, the cooldown arithmetic, and the promise the whole feature
 * rests on — that going back is worth it.
 *
 * The last of those is the one worth testing hardest. A hunt is repeatable because what it
 * pays out is rolled, so a hunt that handed back the same animal every time would be a
 * ten-minute timer guarding a duplicate. That is not a thing a type can catch.
 */

import { describe, expect, it } from 'vitest';
import {
  HUNTS,
  HUNT_COOLDOWN_MS,
  huntAvailable,
  huntByEncounter,
  huntCooldownLabel,
  huntCooldownRemaining,
  isHunt,
} from '../core/data/hunts.js';
import { encounterById } from '../core/data/encounters/index.js';
import { getEncounterScript } from '../core/data/encounters/registry.js';
import { companionById, COMPANIONS } from '../core/data/companions.js';
import { traitsFor } from '../core/data/companionTraits.js';
import { huntBoard, tierOfEncounter } from '../core/data/bounties.js';
import { tameCompanion } from '../core/overworld/vivarium.js';
import { makeRng } from '../core/util/rng.js';

describe('the hunt registry', () => {
  it('names a real encounter, a real species, and a beast the encounter actually awards', () => {
    for (const hunt of HUNTS) {
      const encounter = encounterById(hunt.encounterId);
      expect(encounter, hunt.encounterId).toBeDefined();
      expect(companionById(hunt.species), hunt.species).toBeDefined();
      // The registry and the encounter must agree about the prize. Two places holding the
      // same fact is how a panel comes to advertise a beast the fight does not hand over.
      expect(encounter!.subjugationPrize, `${hunt.encounterId} prize`).toBe(hunt.species);
    }
  });

  it('can actually offer the beast it advertises', () => {
    // `subjugationPrize` names a prize; it does not deal the Rite. A hunt whose script
    // never calls `beginSubjugation` is a fight that can only be won by killing the animal
    // the hunt exists to catch — which would look exactly like a working feature until
    // somebody tried to bind one.
    for (const hunt of HUNTS) {
      const script = getEncounterScript(hunt.encounterId);
      expect(script, `${hunt.encounterId} has no script`).toBeDefined();
      const hooks = Object.keys(script!);
      expect(
        hooks.includes('onTurnStart') || hooks.includes('onCommanderHpChanged'),
        `${hunt.encounterId} has no hook that could seal`,
      ).toBe(true);
    }
  });

  it('fields real soldiers, never an army of nothing but wildlife', () => {
    // An all-Feral enemy belongs to nobody, so neither side can lose and every playout runs
    // to the turn cap. `campaign.adept.ts` records the same lesson from the Hollow Census.
    for (const hunt of HUNTS) {
      const encounter = encounterById(hunt.encounterId)!;
      expect(encounter.enemyOpeningBoard.length, `${hunt.encounterId} opening`).toBeGreaterThan(0);
      expect(encounter.enemyDeck.length, `${hunt.encounterId} deck`).toBeGreaterThan(0);
    }
  });

  it('pays at its own tier rather than defaulting to novice', () => {
    // `tierOfEncounter` falls back to novice for anything it does not recognise, which for a
    // Master hunt would quietly halve the Schematic offer.
    for (const hunt of HUNTS) {
      expect(tierOfEncounter(hunt.encounterId), hunt.encounterId).toBe(hunt.tier);
    }
  });

  it('covers every founding bloodline, so no starter is unreachable', () => {
    // A character enrols with one of six and could never obtain the other five. All six are
    // huntable now — the player's own included, because a second beast of your own line is a
    // different book rather than a duplicate.
    const founders = ['ignis', 'boreas', 'voltara', 'mortis', 'sylva', 'ferrum'];
    const hunted = new Set(HUNTS.map((h) => h.species));
    for (const id of founders) expect(hunted.has(id), `${id} is not huntable`).toBe(true);
  });

  it('awards only species that have a knack to roll', () => {
    for (const hunt of HUNTS) {
      expect(traitsFor(hunt.species).length, `${hunt.species} knacks`).toBeGreaterThan(0);
    }
  });

  it('is looked up by encounter id, and says no to anything else', () => {
    expect(isHunt(HUNTS[0]!.encounterId)).toBe(true);
    expect(isHunt('ignis_trial')).toBe(false);
    expect(isHunt('')).toBe(false);
    expect(huntByEncounter('not_a_hunt')).toBeUndefined();
  });
});

describe('the cooldown', () => {
  const NOW = 1_700_000_000_000;

  it('is open when it has never been walked', () => {
    expect(huntCooldownRemaining(undefined, NOW)).toBe(0);
    expect(huntAvailable(undefined, NOW)).toBe(true);
  });

  it('runs the full duration from the moment it paid out', () => {
    expect(huntCooldownRemaining(NOW, NOW)).toBe(HUNT_COOLDOWN_MS);
    expect(huntAvailable(NOW, NOW)).toBe(false);
  });

  it('counts down, and opens exactly on the boundary', () => {
    expect(huntCooldownRemaining(NOW, NOW + 60_000)).toBe(HUNT_COOLDOWN_MS - 60_000);
    expect(huntCooldownRemaining(NOW, NOW + HUNT_COOLDOWN_MS - 1)).toBe(1);
    expect(huntCooldownRemaining(NOW, NOW + HUNT_COOLDOWN_MS)).toBe(0);
    expect(huntAvailable(NOW, NOW + HUNT_COOLDOWN_MS)).toBe(true);
  });

  it('treats a stamp from the future as expired rather than as a very long wait', () => {
    // A clock rolled back, a save carried between machines, a hand-edited profile. Clamping
    // the other way would lock the gate for as long as the discrepancy lasts, and there is
    // no reading of the player's intent under which that is right.
    expect(huntCooldownRemaining(NOW + 86_400_000, NOW)).toBe(0);
    expect(huntAvailable(NOW + 86_400_000, NOW)).toBe(true);
  });

  it('survives a junk stamp without producing NaN', () => {
    // `NaN` would make every comparison false and read as neither locked nor open.
    expect(huntCooldownRemaining(Number.NaN, NOW)).toBe(0);
    expect(huntCooldownRemaining(Number.POSITIVE_INFINITY, NOW)).toBe(0);
  });

  it('never says "returns in 0m" while it is still shut', () => {
    // Rounds up: a countdown that reads zero and then refuses the click is worse than one
    // that overstates by fifty seconds.
    expect(huntCooldownLabel(0)).toBe('');
    expect(huntCooldownLabel(1)).toBe('returns in a minute');
    expect(huntCooldownLabel(60_000)).toBe('returns in a minute');
    expect(huntCooldownLabel(60_001)).toBe('returns in 2m');
    expect(huntCooldownLabel(HUNT_COOLDOWN_MS)).toBe('returns in 10m');
  });
});

describe('the board past the gate', () => {
  it('offers every hunt, priced at its tier', () => {
    const board = huntBoard(12345);
    expect(board).toHaveLength(HUNTS.length);
    for (const bounty of board) {
      const hunt = huntByEncounter(bounty.enemySeed)!;
      expect(hunt, bounty.id).toBeDefined();
      expect(bounty.difficulty).toBe(hunt.tier);
      expect(bounty.spoils.ducats ?? 0).toBeGreaterThan(0);
      // An animal has not agreed to a bet.
      expect(bounty.wager, `${bounty.id} should not be wagered`).toBeUndefined();
    }
  });

  it('prices a hunt the same way twice for one seed, and differently across seeds', () => {
    expect(huntBoard(99)[0]!.spoils.ducats).toBe(huntBoard(99)[0]!.spoils.ducats);
    const spread = new Set([1, 2, 3, 4, 5, 6].map((s) => huntBoard(s)[0]!.spoils.ducats));
    expect(spread.size, 'the fee should move with the board').toBeGreaterThan(1);
  });
});

describe('why going back is worth it', () => {
  it('rolls a different beast the second time, off the seed the fight advances', () => {
    // The repeatability claim, tested end to end at the level that matters: same species,
    // two catches, two animals. `resolveCombat` advances `bountySeed` after every fight and
    // salts by roster length, which is what these two seeds stand in for.
    const first = tameCompanion(makeRng((1000 + 1 * 7919) >>> 0), 'seal', 1);
    const second = tameCompanion(makeRng((2000 + 2 * 7919) >>> 0), 'seal', 2);

    const differs =
      first.grimoire.join('|') !== second.grimoire.join('|') ||
      first.traitId !== second.traitId ||
      first.baseHpRoll !== second.baseHpRoll;
    expect(differs, 'two catches of one species should not be the same animal').toBe(true);
  });

  it('rolls the same beast from the same seed, so a subjugation replays', () => {
    const a = tameCompanion(makeRng(4242), 'jackal', 1);
    const b = tameCompanion(makeRng(4242), 'jackal', 1);
    expect(a).toEqual(b);
  });

  it('only ever deals a beast cards its own bloodline knows', () => {
    // The `omit` lists are what make two species of one school two shelves. A draft that
    // ignored them would hand a Saltglass Seal the Frost Bear's book.
    for (const species of COMPANIONS) {
      const beast = tameCompanion(makeRng(777), species.id, 1);
      for (const cardId of beast.grimoire) {
        expect(
          species.grimoire.omit?.includes(cardId) ?? false,
          `${species.id} drafted ${cardId}, which it never learns`,
        ).toBe(false);
      }
    }
  });
});
