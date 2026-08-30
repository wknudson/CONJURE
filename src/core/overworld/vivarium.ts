/**
 * The Vivarium: what a Companion is worth, and what it costs to make it worth more.
 *
 * A Companion is the one piece of progression that is neither a card nor money — it is
 * the body that fights beside you, and levelling it raises the Pact itself. That makes it
 * the sink with the longest reach: cards change what you can do in a turn, a Companion
 * changes how many turns you survive.
 *
 * Same shape as the Artificer's till, for the same reason: a `*Refusal` that names why in
 * the player's words, and a doer that asks it rather than trusting the button that called
 * it. Nothing is charged for a refusal.
 *
 * Pure, DOM-free, and it never imports the engine — the translation from a Companion's
 * levelled stats into what a fight understands happens in `run.ts`, with everything else
 * that knows both halves.
 */

import type { GlobalGameState, OverworldState } from './state.js';
import type { RngState } from '../util/rng.js';
import { nextInt } from '../util/rng.js';
import { traitsFor } from '../data/companionTraits.js';
import { companionById, GRIMOIRE_SIZE } from '../data/companions.js';
import { AFFINITY_CEILING } from '../data/mastery.js';
import { draftGrimoire } from '../data/grimoire.js';
import type { CardModifier } from '../types/cards.js';

/**
 * What levelling has bought a Companion so far.
 *
 * The bonuses are stored rather than derived from `level`, so a future level that grants
 * armour instead of health is a change to `levelCompanion` and not to a formula that
 * every reader would have to learn.
 */
export interface CompanionProgress {
  level: number;
  /** Added to the Pact's ceiling while this Companion is the active one. */
  bonusMaxHp: number;
  /** Armor on the Commander at the opening bell. Nothing grants this yet. */
  startingArmor: number;
  /** Added to the starting Bone bank. Nothing grants this yet. */
  bonusBones: number;
}

/**
 * One tamed beast, not one species.
 *
 * The roster is a list of these rather than a map keyed by species, because two Ignis are
 * two different animals: same bloodline, different constitution, different knack. That is
 * the whole point of a taming roll — a roster keyed by `baseId` could only ever hold one
 * of each, and there would be nothing to roll *for*.
 *
 * `baseHpRoll` is the Pact ceiling this one supports, before anything levelling adds. It
 * is stored rather than re-rolled because a beast's constitution is a fact about the
 * beast: rolling it again on load would make every reload a re-roll.
 */
export interface CompanionInstance extends CompanionProgress {
  instanceId: string;
  baseId: string;
  baseHpRoll: number;
  traitId: string;
  /**
   * The eight spells this particular beast turned out to know.
   *
   * Drafted from its bloodline's pool when it was caught, and then **stored**. Storing it
   * rather than re-drawing from the seed is the same discipline `baseHpRoll` keeps: what a
   * beast knows is a fact about the beast, and a list re-rolled on load would hand the
   * player a different Companion every time they opened the game.
   */
  grimoire: string[];
  /**
   * Spells the player has socketed over the drafted ones, by slot index.
   *
   * The one part of a Companion that is *edited* rather than rolled, and the reason it
   * exists is a gap the Forge left: a spliced Hybrid is an elemental card, and the Hero
   * Deck takes neutral and arcane only. A player could press a Vaporize Blast at the bench
   * and then had nowhere on earth to put it.
   *
   * Keyed by **slot**, not by def id, and that is the whole difference from
   * `spellModifiers` above. A roll belongs to a spell — both copies of a cheap Glacial
   * Spike are cheap. A socket belongs to a *position*: replacing one of three Cataclysms
   * has to leave the other two alone, and a map keyed by card could not say which.
   *
   * Sparse. An absent index means the beast's own drafted card, which is the state every
   * beast starts in and can always be returned to.
   */
  overrides: Record<number, string>;
  /**
   * What this beast's eight Grimoire spells rolled, keyed by card def id.
   *
   * The reason two Boreas are worth comparing. Keyed by def rather than by slot because a
   * Grimoire may hold the same spell twice and a roll belongs to the *spell*, not to the
   * position — a Boreas whose Glacial Spike came out cheap has both copies cheap, which is
   * the version a player can actually reason about.
   *
   * Sparse: most spells roll nothing at all, and an absent key means an ordinary card.
   */
  spellModifiers: Record<string, CardModifier>;
  /**
   * Lustrous. One beast in a hundred comes up wrong-coloured, and that is the whole of it.
   *
   * **Cosmetic, deliberately and permanently.** A shiny grants nothing: not health, not a
   * better knack, not a wider draft. The moment it did, every one of the rolls above would
   * become a thing a player farms *through* rather than a thing they read, and the ten-minute
   * hunt clock would be a slot machine with a jackpot instead of a reason to go back to a
   * place. What makes a beast worth keeping is its eight cards; this is worth keeping because
   * it is rare, which is a different pleasure and does not need help from the balance sheet.
   *
   * A flag rather than a tier or a hue index, on the `Bounty.audit` precedent: there is one
   * of these and it is either true or absent. A number would imply a scale nobody has
   * designed.
   */
  shiny?: true;
}

export function newCompanion(): CompanionProgress {
  return { level: 1, bonusMaxHp: 0, startingArmor: 0, bonusBones: 0 };
}

// ---------------------------------------------------------------- the variance engine

/**
 * The most a subjugation can be mastered by.
 *
 * Mastery Objectives are counted, not weighted, so this is simply how many there are — see
 * `data/mastery.ts`. Named here because every roll below scales against it, and a table
 * tuned to a maximum of three that quietly became four would drift without anything saying
 * so.
 */
export const AFFINITY_MAX = AFFINITY_CEILING;

/**
 * Health the constitution's *floor* rises by, per point of affinity.
 *
 * The floor, never the ceiling. A clean capture cannot roll you a better beast than a
 * lucky messy one — it narrows the range of beast you might get, which is a real reward
 * for playing well and still leaves something to find out.
 */
export const AFFINITY_HP_FLOOR_STEP = 10;

/**
 * A wild beast's second gift, beyond its constitution.
 *
 * Deliberately not a third stat roll bolted onto the first two. A beast rolls **one** of
 * these or none at all, so the answer to "what did it come out with" is a sentence rather
 * than a spreadsheet — and so the good rolls stay legible: an Ignis that opens every fight
 * with plate is a thing a player can want, where "+7 HP, +1 armour, +0 Bones" is noise.
 *
 * Armour and Bones only. Max HP is already the constitution roll, and a second source
 * moving the same number would make two rolls fight over one gauge.
 */
export interface WildModifier {
  startingArmor: number;
  bonusBones: number;
}

/** What each wild roll is worth, and how often it comes up. Weighted, not uniform. */
const WILD_TABLE: { weight: number; mod: WildModifier }[] = [
  // Plate. The common one, and the one that reads immediately at the opening bell.
  { weight: 5, mod: { startingArmor: 20, bonusBones: 0 } },
  { weight: 3, mod: { startingArmor: 40, bonusBones: 0 } },
  // A Bone is worth far more than twenty armour and is priced accordingly: turn one with
  // an extra Bone is a turn that can open on a card nobody expects that early.
  { weight: 2, mod: { startingArmor: 0, bonusBones: 1 } },
];

const WILD_WEIGHT = WILD_TABLE.reduce((n, e) => n + e.weight, 0);

/** Chance in a hundred of rolling anything at all, before affinity is counted. */
export const WILD_MODIFIER_CHANCE = 30;

/** How much cleaner the capture makes that chance, per point of affinity. */
export const AFFINITY_WILD_STEP = 15;

/**
 * Rolls the beast's one wild modifier, or nothing.
 *
 * Always consumes exactly two integers from the stream whatever it decides, so that a
 * beast which rolled nothing and a beast which rolled plate leave the Grimoire draft after
 * them looking at the same position. A roll that spent a variable number of draws would
 * make every downstream result depend on an upstream coin flip, which is how a seeded
 * system stops being reproducible in any useful way.
 */
export function rollWildModifier(rng: RngState, affinity = 0): WildModifier {
  const chance = WILD_MODIFIER_CHANCE + affinity * AFFINITY_WILD_STEP;
  const got = nextInt(rng, 100) < chance;

  let pick = nextInt(rng, WILD_WEIGHT);
  for (const entry of WILD_TABLE) {
    pick -= entry.weight;
    if (pick < 0) return got ? { ...entry.mod } : { startingArmor: 0, bonusBones: 0 };
  }
  return { startingArmor: 0, bonusBones: 0 };
}

/** The band a wild Companion's constitution falls in. Tight on purpose. */
/**
 * One in this many caught beasts is lustrous.
 *
 * A hundred is chosen against the ten-minute hunt clock rather than in the abstract: a
 * player working the hunts steadily meets one across a long session or two, which is rare
 * enough to be worth saying out loud and common enough that shinies are a thing that exists
 * rather than a rumour. Since the effect is purely cosmetic, the number costs nothing to
 * move later — no balance table reads it.
 */
export const SHINY_ODDS = 100;

export const HP_ROLL_MIN = 360;
export const HP_ROLL_MAX = 440;

/**
 * Rolls a wild beast.
 *
 * Seeded, like everything else in this project that has a die in it — the caller owns the
 * stream, so a taming can be replayed and a test can pin one. The instance id carries the
 * species and a counter rather than a random string, so a save is readable by a human and
 * two rolls in the same millisecond cannot collide.
 */
/** Chance any one Grimoire spell rolls anything at all. */
export const MODIFIER_CHANCE = 0.25;

/**
 * The table a Grimoire spell rolls on.
 *
 * Weighted by how much each is worth rather than uniformly: a Bone off is the roll players
 * will chase, so it is the rarest, and Retain is the quiet one that makes a situational
 * card worth drafting. Every entry is a *delta*, so the table needs to know nothing about
 * the cards it is rolled against.
 */
const MODIFIER_TABLE: { weight: number; mod: CardModifier }[] = [
  { weight: 2, mod: { boneCostDelta: -1 } },
  { weight: 4, mod: { bonusDamage: 10 } },
  { weight: 3, mod: { grantRetain: true } },
];

const MODIFIER_WEIGHT = MODIFIER_TABLE.reduce((n, e) => n + e.weight, 0);

/**
 * Rolls one beast's Grimoire.
 *
 * Walks the eight in a fixed order and gives each a chance to roll, so the same seed
 * always produces the same beast — the same discipline the constitution and knack rolls
 * already keep. A spell that appears twice is rolled once and shares the result, because
 * the key is the spell.
 */
export function rollSpellModifiers(rng: RngState, grimoire: string[]): Record<string, CardModifier> {
  const out: Record<string, CardModifier> = {};

  for (const defId of grimoire) {
    // Already rolled — a duplicate copy shares whatever the first one got.
    if (out[defId]) continue;
    // `nextInt` over a hundred rather than a float, so the stream stays integer-only and
    // a replay cannot drift on floating-point rounding.
    if (nextInt(rng, 100) >= MODIFIER_CHANCE * 100) continue;

    let pick = nextInt(rng, MODIFIER_WEIGHT);
    for (const entry of MODIFIER_TABLE) {
      pick -= entry.weight;
      if (pick < 0) {
        out[defId] = { ...entry.mod };
        break;
      }
    }
  }

  return out;
}

export function tameCompanion(
  rng: RngState,
  baseId: string,
  sequence: number,
  /**
   * How well the subjugation went, 0 upward. See `AFFINITY_MAX`.
   *
   * Every roll below reads it, and none of them is *decided* by it: affinity moves floors
   * and odds, never outcomes. A flawless capture that rolled a poor constitution is still
   * a poor constitution — a mastery system that guaranteed the good beast would turn the
   * Variance Engine into a checklist, which is exactly what it replaced.
   */
  affinity = 0,
): CompanionInstance {
  const def = companionById(baseId);
  const pool = traitsFor(baseId);
  const traitId = pool.length > 0 ? pool[nextInt(rng, pool.length)]!.id : '';

  // The constitution, with its floor raised by how cleanly the beast was taken. The
  // ceiling does not move: a perfect capture improves the worst case it can hand you,
  // never the best.
  const floor = Math.min(HP_ROLL_MIN + affinity * AFFINITY_HP_FLOOR_STEP, HP_ROLL_MAX);
  const baseHpRoll = floor + nextInt(rng, HP_ROLL_MAX - floor + 1);

  // Which eight, then what each of them rolled — two independent questions, drawn in that
  // order because the second one needs the answer to the first.
  const grimoire = def ? draftGrimoire(rng, def.grimoire, GRIMOIRE_SIZE) : [];
  const spellModifiers = rollSpellModifiers(rng, grimoire);

  // **Drawn last, and it has to stay last.** Every roll above consumes a fixed number of
  // ints off one stream, which is what lets a subjugation replay to the same animal — the
  // seed is derived from the board that offered the fight. Inserting a draw anywhere but the
  // end shifts every subsequent roll, so an existing save's Chimera would come back from a
  // reload with a different constitution and a different book. Appending shifts nothing.
  //
  // Affinity deliberately does not touch it. Everything else here rewards a clean capture;
  // being lustrous is luck, and a shiny you could improve your odds at would quietly become
  // the reason to grind mastery rather than a thing that happens to you.
  const shiny = nextInt(rng, SHINY_ODDS) === 0;

  return {
    ...newCompanion(),
    instanceId: `${baseId}-${sequence}`,
    baseId,
    baseHpRoll,
    traitId,
    ...rollWildModifier(rng, affinity),
    // Which eight, then what each of them rolled — two independent questions, drawn in
    // that order because the second one needs the answer to the first.
    grimoire,
    // Nothing socketed. A caught beast knows what it knows; the sockets are what the
    // player does about it afterwards.
    overrides: {},
    spellModifiers,
    // Absent rather than `false` on an ordinary beast, so the flag reads the same way in a
    // save as it does in memory and no migration has to invent a value for the ninety-nine.
    ...(shiny ? { shiny: true as const } : {}),
  };
}

/** The Pact's ceiling with nobody standing beside it — and the roll's own midpoint. */
export const BASE_PACT_HP = 400;

/** Health a level buys. The whole benefit, for now. */
export const HP_PER_LEVEL = 20;

/**
 * What the next level costs.
 *
 * Scales with the level being left behind, so the first is affordable off a couple of
 * contracts and the fifth is a campaign. Both currencies, deliberately: this is the one
 * sink that competes with *both* halves of the Artificer, which is what stops a player
 * pouring everything into cards and arriving at a Master bounty with a level 1 body.
 */
export function levelCost(progress: CompanionProgress): {
  ducats: number;
  marrowShards: number;
} {
  return { ducats: 150 * progress.level, marrowShards: 2 * progress.level };
}

export type LevelRefusal = 'in-combat' | 'unknown-companion' | 'too-poor' | null;

export function levelRefusal(
  state: GlobalGameState,
  progress: CompanionProgress | undefined,
  ): LevelRefusal {
  // Raising the body a fight is already committed to would change a Pact ceiling the
  // board was built against.
  if (state.combat !== null || state.overworld.activeEncounter !== null) return 'in-combat';
  if (!progress) return 'unknown-companion';

  const cost = levelCost(progress);
  const { economy } = state.overworld;
  if (economy.ducats < cost.ducats || economy.marrowShards < cost.marrowShards) return 'too-poor';
  return null;
}

/**
 * Raises a Companion a level, and reports whether it happened.
 *
 * Mutates the progress in place — it belongs to the save, which holds it by reference —
 * and returns a boolean rather than throwing, for the same reason every other till here
 * does: a click on a stale button is a thing players do.
 *
 * The Pact's ceiling is resynced as part of the same call rather than left to the caller.
 * A level that raised `bonusMaxHp` without raising the gauge beside it would be a purchase
 * with no visible effect until the next fight, which is how a bug hides.
 */
export function levelCompanion(
  state: GlobalGameState,
  progress: CompanionProgress | undefined,
  isActive: boolean,
): boolean {
  if (levelRefusal(state, progress) !== null || !progress) return false;

  const cost = levelCost(progress);
  state.overworld.economy.ducats -= cost.ducats;
  state.overworld.economy.marrowShards -= cost.marrowShards;

  progress.level += 1;
  progress.bonusMaxHp += HP_PER_LEVEL;

  if (isActive) {
    // The level hands over the health it added, rather than only the room to hold it.
    // Buying a bigger gauge and then owing the Clinic six Ducats to fill the new part of
    // it would read as a purchase that did nothing. This is not an exploitable heal: a
    // level costs orders of magnitude more than the points it grants are worth at the
    // Clinic, and it can only ever be bought once per level.
    state.overworld.pact.currentHp += HP_PER_LEVEL;
    syncPactCeiling(state.overworld, progress);
  }
  return true;
}

/**
 * Sets the Pact's ceiling from whoever is standing beside it.
 *
 * `pact.maxHp` stays the single number every clamp in the game already reads — the
 * Clinic's bill, the tonic's cap, the write-back after a fight — so the alternative was
 * threading a Companion through all of them and getting one wrong in silence. Instead the
 * ceiling is recomputed at the only two moments it can change: picking a Companion, and
 * levelling one.
 *
 * Current health is clamped down but never up. Swapping to a lesser Companion costs you
 * the overflow; swapping back does not hand it over as free healing. Growth of your own
 * is the exception, and `levelCompanion` grants that before it calls this.
 */
export function syncPactCeiling(
  overworld: OverworldState,
  companion: CompanionInstance | CompanionProgress | undefined,
): void {
  // A tamed instance carries its own constitution; a bare progress object — a test, or a
  // save from before the roster existed — falls back to the standard body.
  const base =
    companion && 'baseHpRoll' in companion ? companion.baseHpRoll : BASE_PACT_HP;

  overworld.pact.maxHp = base + (companion?.bonusMaxHp ?? 0);
  overworld.pact.currentHp = Math.min(overworld.pact.currentHp, overworld.pact.maxHp);
}
