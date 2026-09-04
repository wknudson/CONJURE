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
 * words, never as an id the reducer has to recognise. `createCombat` receives "the bone
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
   * Additive fields stack across equipped relics; `maxBones` takes the highest rather than
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
   * The reward for having used the bench.
   *
   * Only touches Bones. A hybrid's Marrow half is a strict requirement rather than a price
   * — it asks you to have opened something up this turn, and gear does not do that for
   * you. Floored at one Bone, because a free card is a loop rather than a discount.
   */
  relic_splicer_goggles: {
    id: 'relic_splicer_goggles',
    name: "Splicer's Goggles",
    text: 'Ground to read a seam. Every spliced card costs 1 Bone less, never less than 1.',
    slot: 'optics',
    boons: { discountHybrids: true },
  },

  /**
   * A Guardian is a rule, and this is a lens for reading past one.
   *
   * Guardian says a body must be dealt with before what stands behind it. The Warrant-Glass
   * says the *keyword* no longer stops a shot — deliberately the keyword and not the
   * geometry, so a Guardian still blocks a wall's worth of line of sight and still occupies
   * the tile it is standing on. What you buy is permission, not a clear shot.
   */
  relic_warrant_glass: {
    id: 'relic_warrant_glass',
    name: "Bailiff's Warrant-Glass",
    text: 'Ground for serving papers past a bodyguard. Your ranged attacks and spells see straight through a Guardian.',
    slot: 'optics',
    boons: { ignoreGuardians: true },
  },

  /**
   * The other half of the fog rule, and the reason it is filed under optics.
   *
   * Not "a lens that hides you" — that flavour does not survive being looked at. It is here
   * because line of sight is one rule with two answers: the Goggles let you see *through*
   * the cloud, and the Periscope stops them picking your bodies *out* of it. The engine
   * reads both in the same function, and the slot that owns sight should own both.
   *
   * It rewards a deck that makes its own weather. Steam is Pyre-into-Frost, so this is a
   * Chimera's relic, or anyone who brought a Coolant Pillar to a fire.
   */
  relic_periscope: {
    id: 'relic_periscope',
    name: 'Ashfall Periscope',
    text: 'A mirror-box for fighting from inside the cloud. Your units standing in steam cannot be picked out by ranged attacks.',
    slot: 'optics',
    boons: { fogConceals: true },
  },

  relic_survey_plate: {
    id: 'relic_survey_plate',
    name: 'Ward Survey Plate',
    text: 'Etched with every alley in the district, and you walked all of them. Open every contract holding 1 more card.',
    slot: 'optics',
    boons: { extraOpeningCards: 1 },
  },

  /**
   * The Plate's whole set, read at once.
   *
   * A magnitude step rather than a new capability, and legitimate for the same reason the
   * Battery is: cards held is a **counted** thing. Nothing hits harder for it — you simply
   * arrive knowing more of your own deck, which is the one axis where a bigger number buys
   * consistency instead of power.
   */
  relic_survey_prism: {
    id: 'relic_survey_prism',
    name: 'Magistracy Survey Prism',
    text: 'The full set of plates, stacked and read at once. Open every contract holding 2 more cards.',
    slot: 'optics',
    boons: { extraOpeningCards: 2 },
  },

  /**
   * Both sight rules at once, for the price of the slot.
   *
   * The argument for a combination relic in a five-slot loadout: what it really sells is
   * that **one opening does two jobs**, and openings are the scarce resource. Priced under
   * the sum of its parts (420 against 540) because the parts are two things you could never
   * have worn together anyway.
   */
  relic_sighting_rig: {
    id: 'relic_sighting_rig',
    name: "Assessor's Sighting Rig",
    text: 'Issued to the ones who count bodies for the ledger. You see past their screen, and the smoke does not give up yours.',
    slot: 'optics',
    boons: { ignoreGuardians: true, fogConceals: true },
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

  relic_splinter_mantle: {
    id: 'relic_splinter_mantle',
    name: "Splinter-Warden's Mantle",
    text: 'Quilted against flying ice. Shatter shrapnel does not touch your side.',
    slot: 'vestment',
    boons: { immuneToShatterSplash: true },
  },

  /**
   * The Surge mirror, worn.
   *
   * Arc collateral is the splash a shock hit earths into everything nearby, and against
   * another Surge deck it is most of what kills you. This turns each of those into plate:
   * the more they earth into your line, the more your line is wearing. It does nothing at
   * all against an opponent who brought no lightning, which is the honest price of an
   * answer this specific.
   */
  relic_earthed_mail: {
    id: 'relic_earthed_mail',
    name: 'Earthed Mail',
    text: 'Braided copper through every ring. Your units gain 10 Armor whenever Arc collateral strikes them.',
    slot: 'vestment',
    boons: { armorOnArcCollateral: 10 },
  },

  relic_cinder_cloth: {
    id: 'relic_cinder_cloth',
    name: 'Cinder-Cloth Greatcoat',
    text: 'Woven out of flue-lining, and it has already been on fire. Burn no longer touches your side.',
    slot: 'vestment',
    boons: { immuneToBurn: true },
  },

  relic_foundry_plate: {
    id: 'relic_foundry_plate',
    name: 'Foundry Plate',
    text: 'Cast for men who work beside the drop-hammer. Your units take 20 less from every collision.',
    slot: 'vestment',
    boons: { collisionResist: 20 },
  },

  /**
   * The coat for not knowing the matchup.
   *
   * Deliberately carries **less of both** than the pieces it borrows from — 20 Armor against
   * the Trenchcoat's 30, and 10 collision against the Foundry Plate's 20. That is what keeps
   * a combination relic a sidegrade rather than a tier: it is never the right answer to a
   * question you already know, and it is often the right answer to a question you do not.
   */
  relic_brigandine: {
    id: 'relic_brigandine',
    name: "Constable's Brigandine",
    text: 'Plate under canvas, cut for a long shift. Start wearing 20 Armor, and take 10 less from every collision.',
    slot: 'vestment',
    boons: { armor: 20, collisionResist: 10 },
  },

  // ---------------------------------------------------------------- trinket

  relic_battery: {
    id: 'relic_battery',
    name: 'Galvanic Battery',
    text: 'Banks one more than the body should hold. Bone ceiling raised to 9.',
    slot: 'trinket',
    // Stated as the ceiling it produces rather than as "+1", so two batteries are one
    // battery and the number in the data is the number the engine uses.
    boons: { maxBones: 9 },
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

  relic_wound_cell: {
    id: 'relic_wound_cell',
    name: 'Wound Cell',
    text: 'Wound tight the night before and left on the bench. Start every contract with 2 extra Bones.',
    slot: 'trinket',
    boons: { bones: 2 },
  },

  relic_scald_flask: {
    id: 'relic_scald_flask',
    name: 'Scald-Flask',
    text: 'Superheated, and badly sealed on purpose. Enemies beginning a turn in your steam take 10 damage through armor.',
    slot: 'trinket',
    boons: { steamBurns: 10 },
  },

  /**
   * The strongest thing in the catalogue conceptually, at a middling price.
   *
   * Every other relic changes what happens to you or what you can see. This one changes
   * what a **cost may legally be paid with**: a reaction that demands a Charged body will
   * accept a Chilled one and spend the Chill in its place. A Frost deck gets the whole
   * Surge half of the reaction table without ever casting a shock card.
   *
   * Priced at 280 rather than 400 because it is worth nothing at all to the four schools
   * that do not chill. Breadth of effect and breadth of *applicability* are different
   * things, and only the second one should move a price.
   */
  relic_leyline_tap: {
    id: 'relic_leyline_tap',
    name: 'Leyline Tap',
    text: 'Bled off the conduit under the Ward. Chill satisfies any reaction that asks for Charged, and is spent in its place.',
    slot: 'trinket',
    boons: { chillConducts: true },
  },

  relic_rime_ampoule: {
    id: 'relic_rime_ampoule',
    name: 'Rime Ampoule',
    text: 'Cold that does not let go of what it took. Every Freeze you cause lasts one turn longer.',
    slot: 'trinket',
    boons: { bonusFreezeStacks: 1 },
  },

  /**
   * A second cell on the same spindle.
   *
   * `maxBones` is the one boon the schema asks you to state as an **absolute ceiling** rather
   * than as a delta — two batteries are one battery, and the number in the data is the
   * number the engine uses. So a second value on that axis is the field working exactly as
   * designed rather than an inflated one. It supersedes the Galvanic Battery outright, at
   * a third again the price; the Battery stays as the purchase you can afford first.
   */
  relic_twin_cell: {
    id: 'relic_twin_cell',
    name: 'Twin-Wound Battery',
    text: 'Two cells on one spindle, and the spindle complains. Bone ceiling raised to 10, and you open with 1 extra.',
    slot: 'trinket',
    boons: { maxBones: 10, bones: 1 },
  },

  // ----------------------------------------------------------------- treads

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
   * Was `ignoreIceSlip`, a boon for a mechanic the game never had — no ice hazard exists and
   * nothing ever read the flag, so these could be bought and worn for nothing. The id is kept
   * so a pair already in somebody's bag starts working; the rule is the one the sole was
   * always describing: whatever throws you, you land on your feet.
   */
  relic_crampons: {
    id: 'relic_crampons',
    name: 'Rimewalker Crampons',
    text: 'Spiked straight through the sole. Your units take 20 less from every collision.',
    slot: 'treads',
    boons: { collisionResist: 20 },
  },

  relic_sabatons: {
    id: 'relic_sabatons',
    name: 'Ghost-Iron Sabatons',
    text: 'They never quite finish touching the ground. Your Bound Form crosses rubble, and no current can carry it.',
    slot: 'treads',
    boons: { boundFormIgnoresHazards: true },
  },

  /**
   * Give it and take it back.
   *
   * The other sidegrade combination, and the same discipline as the Brigandine: one tile
   * less shove than the Stompers and half the Foundry Plate's bracing, in a slot that
   * competes with neither. A shove deck that expects to be shoved back wants this; a shove
   * deck that expects to win the exchange wants the Stompers.
   */
  relic_kickplates: {
    id: 'relic_kickplates',
    name: 'Recoil Kickplates',
    text: 'Braced to give it and to take it back. Your shoves travel 1 tile further, and your units take 10 less from every collision.',
    slot: 'treads',
    boons: { bonusShoveDistance: 1, collisionResist: 10 },
  },

  /**
   * The whole line, poured in place — **yours included.**
   *
   * The one relic in the catalogue that is a genuine liability in the wrong fight. Nothing
   * can displace your units, which also means none of your own cards can reposition them:
   * no Phalanx Step, no Arcing Step, no shove of your own to set up a collision. Against an
   * opponent whose entire plan is displacement it wins the fight outright, and against
   * anyone else it is a pair of boots that says no to you.
   */
  relic_ferrocrete: {
    id: 'relic_ferrocrete',
    name: 'Ferrocrete Treads',
    text: 'Poured around the feet of the whole line, yours included. Nothing shoves, drags, or carries any unit of yours anywhere.',
    slot: 'treads',
    boons: { alliesGrounded: true },
  },

  relic_piston_heels: {
    id: 'relic_piston_heels',
    name: 'Piston-Heel Stompers',
    text: "Sprung steel in the heel, and a foundry's opinion of subtlety. Every shove your cards deal travels 2 tiles further.",
    slot: 'treads',
    boons: { bonusShoveDistance: 2 },
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

  relic_covenant: {
    id: 'relic_covenant',
    name: 'Cinder-Spore Covenant',
    text: 'What the fire leaves, the spores take. Enemies surviving a Wildfire are left poisoned (Toxin 1).',
    slot: 'will',
    boons: { wildfireSeedsToxin: 1 },
  },

  /**
   * Sustain for the school that has never had any.
   *
   * Dusk pays for everything in its own blood and had no way to get a point of it back —
   * the Ledger takes *more* out of each offering, and this is the other direction. A deck
   * built on tithes stops trading its Pact away one body at a time.
   */
  relic_rosary: {
    id: 'relic_rosary',
    name: 'Marrow-Debt Rosary',
    text: 'One bead for every body, and you have never lost count. Each tithe returns 20 health to your Pact.',
    slot: 'will',
    boons: { healOnTithe: 20 },
  },

  relic_earthing_creed: {
    id: 'relic_earthing_creed',
    name: 'The Earthing Creed',
    text: 'Ground it through them rather than around them. Arc collateral ignores Armor entirely.',
    slot: 'will',
    boons: { arcPierces: true },
  },

  /**
   * The one piece of gear that argues with the house rule, stated plainly.
   *
   * Every other relic bends a rule; this one **scales a number a card already prints** —
   * a Spore Cloud printing Toxin 2 lands as 3. `companionTraits.ts` says in as many words
   * that its knacks may not do that, and the catalogue does it anyway in `toxic_bloom`, so
   * this is widening an existing inconsistency rather than inventing one.
   *
   * Kept because Bloom's whole clock is stack count and there is no way to reward a poison
   * deck through any other boon in the vocabulary. If the Director rules the other way,
   * this is the relic to cut, and Blight Communion below takes `wildfireSeedsToxin`
   * in its place.
   */
  relic_ashfall_oath: {
    id: 'relic_ashfall_oath',
    name: 'The Ashfall Oath',
    text: 'Sworn downwind of the stacks, where it means something. Everything you poison takes one stack more than it should.',
    slot: 'will',
    boons: { bonusToxinStacks: 1 },
  },

  /**
   * Rot taken in and handed back.
   *
   * Half the Rosary's healing, so it does not supersede it — but it does supersede the
   * Ashfall Oath outright, at a third again the price. That is the same early-purchase
   * ladder the Battery and the Twin-Wound Cell sit on, and it is deliberate: the cheap
   * piece is what a Whisperer can afford in their first season.
   */
  relic_communion: {
    id: 'relic_communion',
    name: 'Blight Communion',
    text: 'You take the rot in and hand it back with interest. Each tithe returns 10 health, and everything you poison bites one stack deeper.',
    slot: 'will',
    boons: { healOnTithe: 10, bonusToxinStacks: 1 },
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
    if (b.bones) out.bones = (out.bones ?? 0) + b.bones;
    if (b.extraOpeningCards) {
      out.extraOpeningCards = (out.extraOpeningCards ?? 0) + b.extraOpeningCards;
    }
    if (b.bonusObstacleHp) out.bonusObstacleHp = (out.bonusObstacleHp ?? 0) + b.bonusObstacleHp;
    if (b.bonusTitheMarrow) {
      out.bonusTitheMarrow = (out.bonusTitheMarrow ?? 0) + b.bonusTitheMarrow;
    }
    if (b.healOnTithe) out.healOnTithe = (out.healOnTithe ?? 0) + b.healOnTithe;
    if (b.bonusToxinStacks) out.bonusToxinStacks = (out.bonusToxinStacks ?? 0) + b.bonusToxinStacks;
    if (b.maxBones) out.maxBones = Math.max(out.maxBones ?? 0, b.maxBones);
    if (b.ignoreFog) out.ignoreFog = true;
    if (b.immuneToBurn) out.immuneToBurn = true;
    if (b.immuneToToxin) out.immuneToToxin = true;
    if (b.revealIntents) out.revealIntents = true;
    if (b.boundFormIgnoresHazards) out.boundFormIgnoresHazards = true;
    if (b.boundFormGrounded) out.boundFormGrounded = true;
    if (b.doubleResonance) out.doubleResonance = true;
    if (b.discountHybrids) out.discountHybrids = true;
    if (b.ignoreGuardians) out.ignoreGuardians = true;
    if (b.collisionResist) out.collisionResist = (out.collisionResist ?? 0) + b.collisionResist;
    if (b.bonusHandLimit) out.bonusHandLimit = (out.bonusHandLimit ?? 0) + b.bonusHandLimit;
    if (b.fogConceals) out.fogConceals = true;
    if (b.arcPierces) out.arcPierces = true;
    if (b.alliesGrounded) out.alliesGrounded = true;
    if (b.chillConducts) out.chillConducts = true;
    if (b.immuneToShatterSplash) out.immuneToShatterSplash = true;
    if (b.steamBurns) out.steamBurns = (out.steamBurns ?? 0) + b.steamBurns;
    if (b.armorOnArcCollateral) {
      out.armorOnArcCollateral = (out.armorOnArcCollateral ?? 0) + b.armorOnArcCollateral;
    }
    if (b.wildfireSeedsToxin) {
      out.wildfireSeedsToxin = (out.wildfireSeedsToxin ?? 0) + b.wildfireSeedsToxin;
    }
    if (b.bonusFreezeStacks) {
      out.bonusFreezeStacks = (out.bonusFreezeStacks ?? 0) + b.bonusFreezeStacks;
    }
    if (b.bonusShoveDistance) {
      out.bonusShoveDistance = (out.bonusShoveDistance ?? 0) + b.bonusShoveDistance;
    }
    // The nine knacks built on 2026-09-03. No relic grants one yet; the seam carries them
    // so the day one does, it works — this is exactly the seam the test exists to hold.
    if (b.guardiansCharge) out.guardiansCharge = true;
    if (b.duskBrittlesChilled) out.duskBrittlesChilled = true;
    if (b.hollowLeavesIce) out.hollowLeavesIce = true;
    if (b.deathRattle) out.deathRattle = true;
    if (b.armorUnstrippable) out.armorUnstrippable = true;
    if (b.burnSlows) out.burnSlows = (out.burnSlows ?? 0) + b.burnSlows;
    if (b.toxinKindles) out.toxinKindles = (out.toxinKindles ?? 0) + b.toxinKindles;
    if (b.deathburstReach) out.deathburstReach = (out.deathburstReach ?? 0) + b.deathburstReach;
    if (b.bonesOnDeath) out.bonesOnDeath = (out.bonesOnDeath ?? 0) + b.bonesOnDeath;
  }

  return out;
}
