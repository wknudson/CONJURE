/**
 * Relics: gear that bends a rule rather than raising a number.
 *
 * The house style, stated as a constraint the data enforces. A relic may change what is
 * *possible* — how much energy banks, what the fog hides, what you are wearing when the
 * bell rings — and may not change what anything hits for. Damage is the one axis where a
 * number going up is indistinguishable from the game getting easier, and a relic that
 * added two damage would be worth exactly as much as a card that did, which is how a gear
 * system eats a card game.
 *
 * Each relic is therefore authored as a set of **capabilities**, in the engine's own
 * words, never as an id the reducer has to recognise. `createCombat` receives "the pip
 * ceiling is 9" and has never heard of a Galvanic Battery — the same rule that keeps
 * brews and Companion levels out of the engine.
 *
 * Every relic also names the **slot** it is worn in. That is what stops the loadout being
 * arithmetic: a flat list of four openings made every relic compete with every other, so
 * the answer was always "the four strongest". Anatomy means goggles compete with goggles,
 * and the Will slot cannot be filled with more armour.
 */

import type { CombatBoons } from '../engine/setup.js';
import type { RelicLoadout, RelicSlot } from '../overworld/state.js';
import { RELIC_SLOT_ORDER, wornRelics } from '../overworld/state.js';

export interface RelicDef {
  id: string;
  name: string;
  /** One line, as it reads on the slot. */
  text: string;
  /**
   * Where it is worn.
   *
   * Replaces the old free-floating `domain`, which described roughly the same thing and
   * bound nothing. A slot groups the gear *and* decides what it competes with, so one
   * field does the work the two would have shared — and the loadout can enforce it.
   */
  slot: RelicSlot;
  /**
   * What it does, in the engine's vocabulary.
   *
   * Additive fields stack across equipped relics; `maxPips` takes the highest rather than
   * summing, because two batteries should not be twice a battery.
   */
  boons: CombatBoons;
}

/** Slots on the coat, head to boot and then the one that is not a place at all. */
export const RELIC_SLOTS = RELIC_SLOT_ORDER.length;

/** What each slot is called on the loadout screen. */
export const RELIC_SLOT_LABELS: Record<RelicSlot, string> = {
  optics: 'Optics',
  vestment: 'Vestment',
  trinket: 'Trinket',
  treads: 'Treads',
  will: 'Will',
};

/** One line on what belongs there, shown while the slot is bare. */
export const RELIC_SLOT_BLURBS: Record<RelicSlot, string> = {
  optics: 'What you see through.',
  vestment: 'What you wear against the world.',
  trinket: 'What you carry in a pocket.',
  treads: 'What you stand in.',
  will: 'What you are prepared to do.',
};

export const RELICS: Record<string, RelicDef> = {
  // ----------------------------------------------------------------- optics

  relic_goggles: {
    id: 'relic_goggles',
    name: 'Soot-Stained Goggles',
    text: 'Smoked glass and a tight seal. Fog and steam no longer blind you.',
    slot: 'optics',
    boons: { ignoreFog: true },
  },

  /**
   * The counter to the Adept's one real advantage.
   *
   * A Novice telegraphs everything; an Adept keeps its hand to itself and shows only its
   * blows. The Monocle buys that back — a *rule* bent rather than a number moved, which
   * is exactly what this system is for. It cannot make the enemy weaker; it can only stop
   * them being unreadable.
   */
  relic_monocle: {
    id: 'relic_monocle',
    name: "Magistrate's Monocle",
    text: 'Ground for reading warrants, not faces. The enemy declares every card it means to play, however good it is at hiding.',
    slot: 'optics',
    boons: { revealIntents: true },
  },

  /**
   * The counter to a hand that is always one card too full.
   *
   * Seven is the limit that makes overdrawing a real cost — the eighth card burns and
   * pays a Marrow. Nine turns a Retain-heavy deck from something that discards its plan
   * into something that keeps it, which is a rule bent rather than a number raised.
   */
  relic_coin: {
    id: 'relic_coin',
    name: "The Gambler's Coin",
    text: 'Worn smooth on one side. Hold 9 cards through end of turn instead of 7.',
    slot: 'trinket',
    boons: { bonusHandLimit: 2 },
  },

  /**
   * Sylva's Deep Roots, for anyone.
   *
   * The same capability reached from the other direction — a relic and a trait asking for
   * one rule is the system working rather than a duplication. A Sylva wearing these is not
   * twice as rooted; the flag is a flag.
   */
  relic_boots: {
    id: 'relic_boots',
    name: 'Ironclad Boots',
    text: 'Bolted through at the ankle. Nothing shoves, drags, or carries your Companion anywhere.',
    slot: 'treads',
    boons: { boundFormGrounded: true },
  },

  /**
   * The passive, twice.
   *
   * Easily the largest thing in the loadout, and priced as such by taking the Will slot
   * the Blood-Ink Ledger wants. Note what it does *not* change: Resonance still fires on
   * a **Companion-source** card rather than a school-matched one, so this doubles whatever
   * your Companion already does and does not widen what counts.
   */
  relic_gloves: {
    id: 'relic_gloves',
    name: 'Aether-Weave Gloves',
    text: 'Stitched with something that remembers. Your Resonance fires on the first two Companion cards each turn.',
    slot: 'will',
    boons: { doubleResonance: true },
  },

  /**
   * The reward for having used the bench.
   *
   * Only touches Pips. A hybrid's Marrow half is a strict requirement rather than a price
   * — it asks you to have opened something up this turn, and gear does not do that for
   * you. Floored at one Pip, because a free card is a loop rather than a discount.
   */
  relic_splicer_goggles: {
    id: 'relic_splicer_goggles',
    name: "Splicer's Goggles",
    text: 'Ground to read a seam. Every spliced card costs 1 Pip less, never less than 1.',
    slot: 'optics',
    boons: { discountHybrids: true },
  },

  // --------------------------------------------------------------- vestment

  relic_coat: {
    id: 'relic_coat',
    name: 'Heavy Trenchcoat',
    text: 'Oilcloth over plate. Start every contract wearing 30 Armor.',
    slot: 'vestment',
    boons: { armor: 30 },
  },

  /**
   * Bloom's answer, worn rather than played.
   *
   * Toxin is the one status armour cannot help with — it ticks as `true` damage precisely
   * so plate is not the answer to it. This is the answer to it, and it costs the slot the
   * Heavy Trenchcoat wants, so soaking blows and shrugging off poison are two different
   * coats and you may only wear one.
   */
  relic_lead_coat: {
    id: 'relic_lead_coat',
    name: 'Lead-Lined Trenchcoat',
    text: 'Heavier than it looks, and it does not breathe. Toxin no longer touches your side.',
    slot: 'vestment',
    boons: { immuneToToxin: true },
  },

  // ---------------------------------------------------------------- trinket

  relic_battery: {
    id: 'relic_battery',
    name: 'Galvanic Battery',
    text: 'Banks one more than the body should hold. Pip ceiling raised to 9.',
    slot: 'trinket',
    // Stated as the ceiling it produces rather than as "+1", so two batteries are one
    // battery and the number in the data is the number the engine uses.
    boons: { maxPips: 9 },
  },

  /**
   * Two health on everything you raise.
   *
   * Deliberately small. An obstacle's job is to survive one more swing than the attacker
   * expected, and two is that swing on most of them — a Stone Barricade goes 6 to 8,
   * which is one extra hit from almost anything on the board.
   *
   * It only ever touches walls the player *conjures*. The map's own crystals and geodes
   * are spawned through the same function during setup, and thickening those would be the
   * Mortar quietly rewriting the arena — so the bonus is applied at the effect ops, which
   * only a played card reaches.
   */
  relic_mortar: {
    id: 'relic_mortar',
    name: "Alchemist's Mortar",
    text: 'Ground glass and quicklime, worked into the mix. Every wall you raise stands 20 HP sturdier.',
    slot: 'trinket',
    boons: { bonusObstacleHp: 20 },
  },

  // ------------------------------------------------------------------- will

  /**
   * What you are prepared to do, priced.
   *
   * The Marrow economy's only permanent multiplier, and the reason the Will slot exists:
   * every other relic changes what happens *to* you, and this one changes what you are
   * willing to spend. A deck built on Marrow Wisps and Dark Tithe gets a whole extra point
   * of fuel per offering.
   */
  relic_ledger: {
    id: 'relic_ledger',
    name: 'Blood-Ink Ledger',
    text: 'Every name in it is one you wrote. Each tithe extracts 1 more Marrow.',
    slot: 'will',
    boons: { bonusTitheMarrow: 1 },
  },
};

export function relicById(id: string): RelicDef | undefined {
  return RELICS[id];
}

/** Every relic in the game, in a stable order for the loadout screen. */
export function allRelics(): RelicDef[] {
  return Object.values(RELICS).sort((a, b) => a.name.localeCompare(b.name));
}

/** Where a relic belongs, or undefined if the catalogue has forgotten it. */
export function slotOf(relicId: string): RelicSlot | undefined {
  return RELICS[relicId]?.slot;
}

/** Every relic that belongs in a given slot, for the loadout shelf. */
export function relicsForSlot(slot: RelicSlot): RelicDef[] {
  return allRelics().filter((r) => r.slot === slot);
}

/**
 * Folds a worn loadout into one set of capabilities.
 *
 * Additive where adding makes sense and maximal where it does not — a second coat is more
 * armour, a second battery is not a higher ceiling. Unknown ids are skipped rather than
 * throwing: a save naming a relic that has since been cut should lose the relic, not the
 * fight.
 */
export function boonsOfRelics(equipped: RelicLoadout): CombatBoons {
  const out: CombatBoons = {};

  for (const id of wornRelics(equipped)) {
    const relic = RELICS[id];
    if (!relic) continue;
    const b = relic.boons;

    if (b.armor) out.armor = (out.armor ?? 0) + b.armor;
    if (b.pips) out.pips = (out.pips ?? 0) + b.pips;
    if (b.extraOpeningCards) {
      out.extraOpeningCards = (out.extraOpeningCards ?? 0) + b.extraOpeningCards;
    }
    if (b.bonusObstacleHp) out.bonusObstacleHp = (out.bonusObstacleHp ?? 0) + b.bonusObstacleHp;
    if (b.bonusTitheMarrow) {
      out.bonusTitheMarrow = (out.bonusTitheMarrow ?? 0) + b.bonusTitheMarrow;
    }
    if (b.healOnTithe) out.healOnTithe = (out.healOnTithe ?? 0) + b.healOnTithe;
    if (b.bonusToxinStacks) out.bonusToxinStacks = (out.bonusToxinStacks ?? 0) + b.bonusToxinStacks;
    if (b.maxPips) out.maxPips = Math.max(out.maxPips ?? 0, b.maxPips);
    if (b.ignoreFog) out.ignoreFog = true;
    if (b.immuneToBurn) out.immuneToBurn = true;
    if (b.immuneToToxin) out.immuneToToxin = true;
    if (b.ignoreIceSlip) out.ignoreIceSlip = true;
    if (b.revealIntents) out.revealIntents = true;
    if (b.boundFormIgnoresHazards) out.boundFormIgnoresHazards = true;
    if (b.boundFormGrounded) out.boundFormGrounded = true;
    if (b.doubleResonance) out.doubleResonance = true;
    if (b.discountHybrids) out.discountHybrids = true;
    if (b.ignoreGuardians) out.ignoreGuardians = true;
    if (b.collisionResist) out.collisionResist = (out.collisionResist ?? 0) + b.collisionResist;
    if (b.bonusHandLimit) out.bonusHandLimit = (out.bonusHandLimit ?? 0) + b.bonusHandLimit;
  }

  return out;
}
