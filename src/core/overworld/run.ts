/**
 * Where the overworld and a fight meet.
 *
 * This is the only module that knows about both. `state.ts` never imports the engine and
 * the engine never imports it; everything that has to understand the two together — what
 * a run hands a fight, and what a fight hands back — is here, so the seam is one file
 * rather than a habit.
 */

import type { CombatResult } from '../../contract/events.js';
import type { CombatBoons, CombatCarry } from '../engine/setup.js';
import type { Bestiary, BuffId, GlobalGameState, OverworldState } from './state.js';
import { INVENTORY_LIMIT } from './state.js';
import { nextBountySeed } from '../data/bounties.js';
import type { CompanionInstance, CompanionProgress } from './vivarium.js';
import { boonsOfRelics } from '../data/relics.js';
import { traitById } from '../data/companionTraits.js';
import { tameCompanion } from './vivarium.js';
import { makeRng } from '../util/rng.js';

/**
 * What each brew does to a fight.
 *
 * The translation table, and the reason this module exists. `state.ts` owns which brews
 * a run may carry; saying what one *does* needs the engine's vocabulary, so it is said
 * here — the one file allowed to hold both. Adding a fourth brew is adding a row.
 */
export const BUFF_EFFECTS: Record<BuffId, CombatBoons> = {
  /** Armour to soak the first exchange. */
  ironbrew: { armor: 5 },
  /** Opens on a bigger bank, so a turn-one Power Tier play is briefly possible. */
  kinetic_capacitor: { pips: 2 },
  /** A wider opening hand: more options rather than more power. */
  quicksilver: { extraOpeningCards: 2 },
};

/**
 * What the character hands the next fight.
 *
 * Two sources of advantage meet here and nowhere else: the brew in hand, and the
 * Companion standing beside you. Both are translated into the engine's own words —
 * armour, pips, cards, a ceiling — so `createCombat` is handed numbers and never learns
 * that either a brew or a Companion level exists.
 *
 * The two add rather than override. A levelled Companion and an Ironbrew are separate
 * purchases, and a player who made both should get both.
 */
export function carryFor(
  overworld: OverworldState,
  companion?: CompanionInstance | CompanionProgress,
): CombatCarry {
  const brew = overworld.activeBuff ? BUFF_EFFECTS[overworld.activeBuff] : undefined;
  // Relics are translated here, not passed on as ids. `createCombat` is handed "3 Armor"
  // and "the ceiling is 9"; it has never heard of a Heavy Trenchcoat, exactly as it has
  // never heard of an Ironbrew. Adding a fourth relic is a row in a data table.
  const gear = boonsOfRelics(overworld.equippedRelics);
  // The tamed beast's knack, translated like everything else. `createCombat` learns that
  // this side is immune to Burn; it never learns there is such a thing as an Ash-Walker.
  const knack =
    companion && 'traitId' in companion ? (traitById(companion.traitId)?.boons ?? {}) : {};

  const armor =
    (brew?.armor ?? 0) + (companion?.startingArmor ?? 0) + (gear.armor ?? 0) + (knack.armor ?? 0);
  const pips =
    (brew?.pips ?? 0) + (companion?.bonusPips ?? 0) + (gear.pips ?? 0) + (knack.pips ?? 0);
  const extraOpeningCards =
    (brew?.extraOpeningCards ?? 0) + (gear.extraOpeningCards ?? 0) + (knack.extraOpeningCards ?? 0);
  const maxPips = Math.max(gear.maxPips ?? 0, knack.maxPips ?? 0);
  const obstacleHp = (gear.bonusObstacleHp ?? 0) + (knack.bonusObstacleHp ?? 0);
  const sacrificeMarrow = (gear.bonusSacrificeMarrow ?? 0) + (knack.bonusSacrificeMarrow ?? 0);
  const sacrificeHeal = (gear.healOnSacrifice ?? 0) + (knack.healOnSacrifice ?? 0);
  const toxinStacks = (gear.bonusToxinStacks ?? 0) + (knack.bonusToxinStacks ?? 0);
  const handLimit = (gear.bonusHandLimit ?? 0) + (knack.bonusHandLimit ?? 0);

  const boons: CombatBoons = {
    ...(armor ? { armor } : {}),
    ...(pips ? { pips } : {}),
    ...(extraOpeningCards ? { extraOpeningCards } : {}),
    ...(maxPips ? { maxPips } : {}),
    ...(gear.ignoreFog || knack.ignoreFog ? { ignoreFog: true } : {}),
    ...(gear.immuneToBurn || knack.immuneToBurn ? { immuneToBurn: true } : {}),
    ...(gear.immuneToToxin || knack.immuneToToxin ? { immuneToToxin: true } : {}),
    ...(gear.ignoreIceSlip || knack.ignoreIceSlip ? { ignoreIceSlip: true } : {}),
    ...(gear.revealIntents || knack.revealIntents ? { revealIntents: true } : {}),
    ...(obstacleHp ? { bonusObstacleHp: obstacleHp } : {}),
    ...(sacrificeMarrow ? { bonusSacrificeMarrow: sacrificeMarrow } : {}),
    ...(sacrificeHeal ? { healOnSacrifice: sacrificeHeal } : {}),
    ...(toxinStacks ? { bonusToxinStacks: toxinStacks } : {}),
    ...(gear.boundFormIgnoresHazards || knack.boundFormIgnoresHazards
      ? { boundFormIgnoresHazards: true }
      : {}),
    ...(gear.boundFormGrounded || knack.boundFormGrounded ? { boundFormGrounded: true } : {}),
    ...(gear.doubleResonance || knack.doubleResonance ? { doubleResonance: true } : {}),
    ...(gear.discountHybrids || knack.discountHybrids ? { discountHybrids: true } : {}),
    ...(handLimit ? { bonusHandLimit: handLimit } : {}),
  };

  return {
    startingHp: overworld.pact.currentHp,
    // The character's gauge, not the encounter's. `syncPactCeiling` has already folded
    // the active Companion's bonus into it, so this is one number rather than a sum done
    // differently at each end.
    maxHp: overworld.pact.maxHp,
    ...(Object.keys(boons).length > 0 ? { boons } : {}),
  };
}

/**
 * What a finished fight tells the run.
 *
 * A named payload rather than the whole `GameState`: the run needs exactly one number
 * out of a fight, and handing it the entire board would invite the overworld to start
 * reading combat internals it has no business knowing about.
 */
/**
 * The roster a subjugation would be added to, and what it would add.
 *
 * Passed in rather than reached for, because the roster lives on the Profile and this
 * module only knows about the run. It is the same shape the Ledger uses: hand the thing
 * in, let the resolver fold one fight into it.
 */
export interface SubjugationClaim {
  /** The species the encounter offers, from `EncounterDef.subjugationPrize`. */
  prize?: string;
  /** The player's beasts. The new one is pushed here. */
  roster: CompanionInstance[];
}

export interface CombatOutcome {
  /** The Pact as it stood when the bell rang. */
  pactHp: number;
  /**
   * Enemy stat blocks met and killed during the fight, by **definition** id.
   *
   * Definition ids rather than instance ids, despite the name: the Ledger is about kinds
   * of thing, and a list of `u7` would grow without bound and identify nothing. Both are
   * optional so a fight resolved without them — a test, a standalone bout — still closes.
   */
  encounteredUnitIds?: string[];
  defeatedUnitIds?: string[];
}

/**
 * Closes a fight and folds it back into the run.
 *
 * Three things happen in a fixed order, and the order matters:
 *
 *  1. The surviving Pact is written back, whatever it is. A defeat writes zero rather
 *     than being suppressed — a player who is down should read as down, and `isDown`
 *     should not need a second flag to agree with the number beside it.
 *  2. The buff clears regardless of outcome, and so does the contract. The brew was
 *     drunk on the way in; losing does not give it back, and a brew that survived a
 *     defeat would make retrying strictly better than winning.
 *  3. Spoils are granted only on a win, and only after the Pact is settled, so a victory
 *     at one health still pays. They are read from the contract the player accepted, not
 *     passed in — the board rerolls after every fight, and paying from the new board
 *     would settle a win against an offer nobody agreed to.
 *  4. The board moves on, win or lose. Declining everything keeps your board; finishing
 *     something changes it.
 *
 * The combat handle is nulled last: `combat === null` is what "we are in the overworld"
 * means, so it flips once everything it was holding has been read out of it.
 */
export function resolveCombat(
  global: GlobalGameState,
  outcome: CombatOutcome,
  result: CombatResult,
  bestiary?: Bestiary,
  claim?: SubjugationClaim,
): CompanionInstance | null {
  const { overworld } = global;

  // The Ledger is written win or lose. Killing a thing teaches you what it was, and
  // losing the fight afterwards does not un-teach it.
  if (bestiary) recordSightings(bestiary, outcome);

  // Read the contract before closing it: the payout was fixed when the bounty was
  // accepted, and clearing first would settle every win at nothing.
  const spoils = overworld.activeEncounter?.spoils ?? {};

  overworld.pact.currentHp = Math.max(0, Math.min(overworld.pact.maxHp, outcome.pactHp));

  overworld.activeBuff = null;
  // The fight is answered for, so the contract closes. Whoever calls this owns writing it
  // to disk — a cleared contract that never reaches storage would forfeit a fight the
  // player actually finished.
  overworld.activeEncounter = null;

  // 'bound' is a win: the companion was subjugated rather than the enemy killed.
  if (result === 'victory' || result === 'bound') {
    overworld.economy.ducats += spoils.ducats ?? 0;
    overworld.economy.marrowShards += spoils.marrowShards ?? 0;
    for (const [id, count] of Object.entries(spoils.reagents ?? {})) {
      if (count > 0) overworld.economy.reagents[id] = (overworld.economy.reagents[id] ?? 0) + count;
    }
  }

  // The beast itself, if one was bound and the encounter named a species for it.
  //
  // Rolled *before* the bounty seed moves on, so the animal a given fight yields is fixed
  // by the board that offered the fight rather than by the one that replaces it -- a
  // subjugation replays to the same creature.
  const tamed = claimSubjugation(overworld.bountySeed, result, claim);

  overworld.bountySeed = nextBountySeed(overworld.bountySeed);
  global.combat = null;

  return tamed;
}

/**
 * Turns a `bound` result into an animal.
 *
 * The payoff the Harpoon Protocol was built for and went without: `bound` was recognised
 * as a win and paid like one, so the only difference between killing a boss and binding
 * it was a line in the record. Three rounds of holding a tether now produce the thing the
 * fiction always said they produced.
 *
 * Every other result returns null, including a `bound` from an encounter that names no
 * prize -- binding something the catalogue has no species for should pay like a victory
 * rather than crash or invent one.
 */
function claimSubjugation(
  seed: number,
  result: CombatResult,
  claim?: SubjugationClaim,
): CompanionInstance | null {
  if (result !== 'bound' || !claim?.prize) return null;

  // The same stream `tameWild` uses, so a bound beast and a wild one are rolled by one
  // rule. The sequence both numbers the instance id and moves the seed on, so two
  // tamings in a run cannot land on the same constitution.
  const sequence = claim.roster.length + 1;
  const beast = tameCompanion(
    makeRng((seed + sequence * 7919) >>> 0),
    claim.prize,
    sequence,
  );

  claim.roster.push(beast);
  return beast;
}

/**
 * Folds one fight's sightings into the running Ledger.
 *
 * Both tallies are cumulative counts rather than flags, so "met eleven, killed two" is a
 * sentence the Ledger can say. A kind is only ever created here — an entry that exists
 * means the player has laid eyes on it.
 */
function recordSightings(bestiary: Bestiary, outcome: CombatOutcome): void {
  const bump = (defId: string, field: 'encountered' | 'defeated'): void => {
    const entry = (bestiary[defId] ??= { encountered: 0, defeated: 0 });
    entry[field] += 1;
  };

  for (const defId of outcome.encounteredUnitIds ?? []) bump(defId, 'encountered');
  // A kill implies a meeting, but the two lists come from the same fight and the meeting
  // was already counted when the thing walked on. Counting it twice here would make
  // `defeated` exceed `encountered`, which reads as a bug in the Ledger.
  for (const defId of outcome.defeatedUnitIds ?? []) bump(defId, 'defeated');
}

/** Why a consumable could not be used, or null if it can. */
export type ConsumableRefusal =
  | 'in-combat'
  | 'no-such-item'
  | null;

export function consumableRefusal(
  global: GlobalGameState,
  inventoryIndex: number,
): ConsumableRefusal {
  // Items are an overworld affordance. Allowing one mid-fight would let a player heal
  // out of a lethal turn the engine had already committed to, and would put a source of
  // healing outside the deterministic reducer entirely.
  //
  // Two flags are consulted, and either one is enough. `combat` is the live handle and
  // `activeEncounter` is its persisted mirror; asking for both to agree would mean a
  // desync unlocks the satchel, where asking for either means a desync merely locks it.
  // Failing shut is the right way round for a rule that exists to stop an exploit.
  if (global.combat !== null || global.overworld.activeEncounter !== null) return 'in-combat';
  const item = global.overworld.inventory[inventoryIndex];
  if (!item) return 'no-such-item';
  return null;
}

/**
 * Uses an item, returning whether it was used.
 *
 * A boolean rather than a throw: a click on a greyed-out satchel during a fight is a
 * thing players do, not a programming error. `consumableRefusal` gives the UI the reason
 * when it wants to say one.
 */
export function useConsumable(global: GlobalGameState, inventoryIndex: number): boolean {
  if (consumableRefusal(global, inventoryIndex) !== null) return false;

  const { overworld } = global;
  const item = overworld.inventory[inventoryIndex]!;

  if (item.type === 'healing') {
    overworld.pact.currentHp = Math.min(
      overworld.pact.maxHp,
      overworld.pact.currentHp + item.value,
    );
  } else {
    // Overwrites rather than stacks, so the question is always which brew and never how
    // many. A second one drunk before a fight simply replaces the first.
    overworld.activeBuff = item.id as typeof overworld.activeBuff;
  }

  overworld.inventory.splice(inventoryIndex, 1);
  return true;
}

/** Guard for anything building an inventory, so the cap cannot be exceeded by assembly. */
export function inventoryHasRoom(overworld: OverworldState): boolean {
  return overworld.inventory.length < INVENTORY_LIMIT;
}
