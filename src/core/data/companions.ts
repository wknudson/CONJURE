/**
 * Companions.
 *
 * A Companion is chosen before a run and decides three things: which school its
 * Resonance belongs to, which lane on the board that Resonance watches, and which cards
 * fill the Companion slots of the deck. The Hero half of the deck never changes, so the
 * two play the same physical game and differ in what their caster brings to it.
 */

import type { School } from '../../contract/ids.js';
import { STARTER_DECK } from './cards/index.js';
import type { GrimoireSource } from './grimoire.js';
import { HYBRID_HYBRID_CHANCE, MONO_HYBRID_CHANCE } from './grimoire.js';

/**
 * Cards a Companion fuses into the deck at the opening bell. Exactly eight, always.
 *
 * A constant rather than "whatever the species happens to carry", because the Hero Deck's
 * bounds are written *against* it: a 12-card Hero half is a 20-card deck once the beast
 * has shuffled its own in, and a species that quietly brought seven would make every deck
 * size in the game one short without anything saying so.
 */
export const GRIMOIRE_SIZE = 8;

export interface CompanionDef {
  id: string;
  name: string;
  title: string;
  school: School;
  /**
   * What this species' art is filed under, when that is not its id.
   *
   * The founders' files are named for their ids (`ignis-front.png`); the wild bloodlines'
   * are named for their titles (`chimera_of_the_caldera-front.png` for `chimera`). Rather
   * than rename painted art or make the loader guess, the species states where its own
   * pictures are — the one place that already knows everything else about it.
   *
   * This existed as an unwritten assumption that ids and filenames matched, and every
   * wild species broke it: a bound Chimera fetched `chimera-front.png`, 404ed, and took
   * the whole district's actor batch down with it. `spriteAssets.test.ts` now walks every
   * species against the folder so the next mismatch is a red test, not a dead street.
   */
  artId?: string;
  /** One line, shown on the selection screen. */
  blurb: string;
  /**
   * The Hero Deck a new character is handed alongside this Companion.
   *
   * Identical across every species now, and deliberately so: the Hero half is utility, and
   * utility has no colour. What makes a Boreas fight differently from an Ignis is the
   * Grimoire below, not this.
   */
  deck: string[];
  /**
   * The pool this bloodline drafts its eight from, and how it is weighted.
   *
   * A *pool*, not a list, and that is the change. Every Ignis used to carry the same eight
   * cards, so the second one you caught was worth nothing — the beast was a checkbox. Two
   * Ignis are now two different books drawn from the same shelf: one heavy on Ashen Wakes,
   * one that rolled a Cataclysm it has no business knowing.
   *
   * `schools` is a list because a hybrid bloodline draws from two at once. Every species
   * shipped so far is mono-element, so every entry holds one — the second slot is what a
   * Chimera would use, and the draft has no separate case for it.
   *
   * What each of the eight *rolled* is a second, independent question
   * (`CompanionInstance.spellModifiers`). Which cards, and what those cards came out at.
   */
  grimoire: GrimoireSource;

  /**
   * The eight this species used to always bring.
   *
   * Kept as the **fallback** for a beast tamed before the draft existed, and for nothing
   * else. A save from before this change holds no drafted list, and re-rolling one on load
   * would hand every player a different Companion than the one they went and caught.
   */
  legacyGrimoire: string[];
  /** The setup-only stat block placed on the board as its Bound Form. */
  unitCardId: string;
}

export const COMPANIONS: CompanionDef[] = [
  {
    id: 'ignis',
    name: 'Ignis',
    title: 'Ember Drake',
    school: 'pyre',
    blurb:
      'Marks and cascades. Brand your enemies, then set the whole board off at once. Ember Watch ignites anything standing in its lane.',
    // The founding deck, exactly as specced.
    deck: [...STARTER_DECK],
    grimoire: { schools: ['pyre'], hybridChance: MONO_HYBRID_CHANCE },
    legacyGrimoire: [
      'flame_surge',
      'flame_surge',
      'ashen_wake',
      'ashen_wake',
      'ember_coat',
      'ember_coat',
      'cataclysm',
      'cataclysmic_core',
    ],
    unitCardId: 'ignis_bound',
  },
  {
    id: 'boreas',
    name: 'Boreas',
    title: 'Frost Bear',
    school: 'frost',
    blurb:
      'Control. Chill an enemy three times and it freezes solid — then break it. Rime Guard armours your Hero each turn.',
    deck: [...STARTER_DECK],
    grimoire: { schools: ['frost'], hybridChance: MONO_HYBRID_CHANCE },
    legacyGrimoire: [
      'glacial_spike',
      'glacial_spike',
      'frost_nova',
      'frost_nova',
      'brittle_touch',
      'brittle_touch',
      'flash_freeze',
      'ice_barricade',
    ],
    unitCardId: 'boreas_bound',
  },
  {
    id: 'voltara',
    name: 'Voltara',
    title: 'Storm Lynx',
    school: 'surge',
    blurb:
      'Setup. Charge a cluster and let somebody else light it — fire Overloads, frost Superconducts. Storm Tithe pays a Pip back for the first card each turn.',
    // Three Static Arcs, because charging is the whole plan and one copy would make the
    // plan a coincidence. Arc Lash and the Hound are Hero cards and would be legal in any
    // deck; they are here because this is the deck that wants them.
    deck: [...STARTER_DECK],
    grimoire: { schools: ['surge'], hybridChance: MONO_HYBRID_CHANCE },
    legacyGrimoire: [
      'static_arc',
      'static_arc',
      'static_arc',
      'arc_lash',
      'arc_lash',
      'static_charge',
      'static_charge',
      'marrow_burst',
    ],
    unitCardId: 'voltara_bound',
  },
  {
    id: 'mortis',
    name: 'Mortis',
    title: 'Carrion Stag',
    school: 'dusk',
    blurb:
      'Attrition. Feed it your own bodies and take the difference — Grave Tithe drains the weakest thing standing every turn you cast.',
    // Its own school has exactly two cards a deck can hold three of, so the six are those
    // at their caps. A Dusk deck is short on options by design: it spends what it has.
    deck: [...STARTER_DECK],
    grimoire: { schools: ['dusk'], hybridChance: MONO_HYBRID_CHANCE },
    legacyGrimoire: [
      'shadow_siphon',
      'shadow_siphon',
      'shadow_siphon',
      'marrow_siphon',
      'marrow_siphon',
      'marrow_siphon',
      'harvest_the_weak',
      'marrow_burst',
    ],
    unitCardId: 'mortis_bound',
  },
  {
    id: 'sylva',
    name: 'Sylva',
    title: 'Thorn Warden',
    school: 'bloom',
    blurb:
      'Patience. Poison, roots, and a body that grows where you plant it. Verdant Growth gives 2 HP back for the first card each turn.',
    deck: [...STARTER_DECK],
    grimoire: { schools: ['bloom'], hybridChance: MONO_HYBRID_CHANCE },
    legacyGrimoire: [
      'spore_cloud',
      'spore_cloud',
      'root_snare',
      'root_snare',
      'root_snare',
      'verdant_swell',
      'verdant_swell',
      'verdant_collapse',
    ],
    unitCardId: 'sylva_bound',
  },
  {
    id: 'ferrum',
    name: 'Ferrum',
    title: 'Vault Boar',
    school: 'bulwark',
    blurb:
      'Ground. Walls, shoves, and a body that will not be moved. Shield Oath armours everything standing in its lane.',
    deck: [...STARTER_DECK],
    grimoire: { schools: ['bulwark'], hybridChance: MONO_HYBRID_CHANCE },
    legacyGrimoire: [
      'seismic_slam',
      'seismic_slam',
      'petrifying_mantle',
      'petrifying_mantle',
      'smoke_bomb',
      'smoke_bomb',
      'pressure_valve_release',
      'cataclysm',
    ],
    unitCardId: 'ferrum_bound',
  },
  // ---------------------------------------------------------------- hybrids
  //
  // Ten bloodlines that draw on two schools at once. The draft has supported a two-school
  // pool since it was written and had no content for it: every species shipped so far is
  // mono-element, so the hybrid branch was a mechanism nobody could reach.
  //
  // These are what it was for. A Chimera draws its pure spells from Pyre *and* Frost, and
  // rolls a fusion into any given slot at `HYBRID_HYBRID_CHANCE` -- roughly a third of its
  // book -- where a mono-element beast rolls one at a twentieth. Two Chimeras are two very
  // different decks, and neither is a deck a mono bloodline would realistically deal.
  //
  // One thing these do *not* change, and it is worth knowing before reading a caught
  // beast's book: `hybridPool` reaches a fusion when the bloodline supplies **at least
  // one** of the two schools that press it. That rule was written for mono-element beasts,
  // where it is the only reading that works, and it is unchanged here -- so a Frost/Dusk
  // Grave-Gargoyle can legitimately deal itself a Pyre/Frost Vaporize Blast. A hybrid's
  // identity is currently expressed by *how often* it draws fusions, not by *which*.
  // Tightening that to the beast's own pair is a live design question, not an oversight.
  //
  // **`school` is the Resonance, and a hybrid has to pick one.** Resonance is keyed by
  // school and a Companion carries a single one, so each of these names the parent whose
  // passive it inherits -- the Chimera burns like an Ignis, the Mantis rimes like a
  // Boreas. Their own bespoke Resonances are designed and *not* built; see the note above
  // `RESONANCE` in `data/resonance.ts` for what each would need.

  {
    id: 'chimera',
    artId: 'chimera_of_the_caldera',
    name: 'Chimera of the Caldera',
    title: 'Caldera Chimera',
    school: 'pyre',
    blurb:
      'Boil them. Fire into a Chilled body flash-boils it, and the steam it leaves blinds whatever is left standing behind.',
    deck: [...STARTER_DECK],
    grimoire: { schools: ['pyre', 'frost'], hybridChance: HYBRID_HYBRID_CHANCE },
    legacyGrimoire: [
      'flame_surge',
      'flame_surge',
      'glacial_spike',
      'glacial_spike',
      'brittle_touch',
      'frost_nova',
      'ember_coat',
      'cataclysm',
    ],
    unitCardId: 'chimera_bound',
  },
  {
    id: 'wasp',
    artId: 'cinder_wasp',
    name: 'Cinder-Wasp Swarm',
    title: 'Ember Swarm',
    school: 'surge',
    blurb:
      'Charge, then light it. A Charged body takes fire badly, and the arc goes looking for the next one.',
    deck: [...STARTER_DECK],
    grimoire: { schools: ['pyre', 'surge'], hybridChance: HYBRID_HYBRID_CHANCE },
    legacyGrimoire: [
      'static_arc',
      'static_arc',
      'arc_lash',
      'flame_surge',
      'flame_surge',
      'ashen_wake',
      'ember_coat',
      'static_charge',
    ],
    unitCardId: 'wasp_bound',
  },
  {
    id: 'tortoise',
    artId: 'obsidian_tortoise',
    name: 'Obsidian Tortoise',
    title: 'Caldera Bulwark',
    school: 'bulwark',
    blurb:
      'Ground held and ground denied. Shove them off the tile they wanted and leave something burning on it.',
    deck: [...STARTER_DECK],
    grimoire: { schools: ['pyre', 'bulwark'], hybridChance: HYBRID_HYBRID_CHANCE },
    legacyGrimoire: [
      'seismic_slam',
      'seismic_slam',
      'petrifying_mantle',
      'petrifying_mantle',
      'flame_surge',
      'ashen_wake',
      'ember_coat',
      'smoke_bomb',
    ],
    unitCardId: 'tortoise_bound',
  },
  {
    id: 'treant',
    artId: 'crimson_treant',
    name: 'Crimson Treant',
    title: 'Ashwood Warden',
    school: 'bloom',
    blurb:
      'Poison first, fire second. Wildfire burns off every stack at once and everything nearby is standing in it.',
    deck: [...STARTER_DECK],
    grimoire: { schools: ['pyre', 'bloom'], hybridChance: HYBRID_HYBRID_CHANCE },
    legacyGrimoire: [
      'spore_cloud',
      'spore_cloud',
      'root_snare',
      'root_snare',
      'flame_surge',
      'ashen_wake',
      'verdant_swell',
      'ember_coat',
    ],
    unitCardId: 'treant_bound',
  },
  {
    id: 'mantis',
    artId: 'storm_mantis',
    name: 'Storm-Mantis',
    title: 'Rime Conductor',
    school: 'frost',
    blurb:
      'Cold conducts. Shock through a Chilled body Superconducts, and what it earths into comes out Brittle.',
    deck: [...STARTER_DECK],
    grimoire: { schools: ['frost', 'surge'], hybridChance: HYBRID_HYBRID_CHANCE },
    legacyGrimoire: [
      'glacial_spike',
      'glacial_spike',
      'static_arc',
      'static_arc',
      'arc_lash',
      'frost_nova',
      'brittle_touch',
      'static_charge',
    ],
    unitCardId: 'mantis_bound',
  },
  {
    id: 'juggernaut',
    artId: 'glacial_juggernaut',
    name: 'Glacial Juggernaut',
    title: 'Icebreaker',
    school: 'bulwark',
    blurb:
      'Freeze it, then break it. A physical blow on frozen flesh Shatters, and the shrapnel does not care who is nearby.',
    deck: [...STARTER_DECK],
    grimoire: { schools: ['frost', 'bulwark'], hybridChance: HYBRID_HYBRID_CHANCE },
    legacyGrimoire: [
      'glacial_spike',
      'flash_freeze',
      'frost_nova',
      'seismic_slam',
      'seismic_slam',
      'petrifying_mantle',
      'ice_barricade',
      'brittle_touch',
    ],
    unitCardId: 'juggernaut_bound',
  },
  {
    id: 'gargoyle',
    artId: 'grave_gargoyle',
    name: 'Grave-Gargoyle',
    title: 'Black Ice',
    school: 'dusk',
    blurb:
      'Cold is patient and so is the debt. Chill them still, then take what is left in Marrow.',
    deck: [...STARTER_DECK],
    grimoire: { schools: ['frost', 'dusk'], hybridChance: HYBRID_HYBRID_CHANCE },
    legacyGrimoire: [
      'glacial_spike',
      'frost_nova',
      'brittle_touch',
      'shadow_siphon',
      'shadow_siphon',
      'marrow_siphon',
      'marrow_burst',
      'flash_freeze',
    ],
    unitCardId: 'gargoyle_bound',
  },
  {
    id: 'dynamo',
    artId: 'kinetic_dynamo',
    name: 'Kinetic Dynamo',
    title: 'Momentum Engine',
    school: 'surge',
    blurb:
      'Charge is only useful if something moves. Shock them, shove them, and let the wall finish it.',
    deck: [...STARTER_DECK],
    grimoire: { schools: ['surge', 'bulwark'], hybridChance: HYBRID_HYBRID_CHANCE },
    legacyGrimoire: [
      'static_arc',
      'arc_lash',
      'seismic_slam',
      'seismic_slam',
      'petrifying_mantle',
      'static_charge',
      'smoke_bomb',
      'arc_lash',
    ],
    unitCardId: 'dynamo_bound',
  },
  {
    id: 'geist',
    artId: 'volatile_geist',
    name: 'Volatile Geist',
    title: 'Aether Siphon',
    school: 'dusk',
    blurb:
      'Everything is a battery, including your own line. Charge a body, spend it, and take the difference.',
    deck: [...STARTER_DECK],
    grimoire: { schools: ['surge', 'dusk'], hybridChance: HYBRID_HYBRID_CHANCE },
    legacyGrimoire: [
      'static_arc',
      'arc_lash',
      'marrow_siphon',
      'marrow_siphon',
      'shadow_siphon',
      'harvest_the_weak',
      'marrow_burst',
      'static_charge',
    ],
    unitCardId: 'geist_bound',
  },
  {
    id: 'sovereign',
    artId: 'bone_bastion_sovereign',
    name: 'Bone Bastion Sovereign',
    title: 'Marrow Bastion',
    school: 'bulwark',
    blurb:
      'The line holds because of what is buried under it. Feed it your own and it stands taller.',
    deck: [...STARTER_DECK],
    grimoire: { schools: ['bulwark', 'dusk'], hybridChance: HYBRID_HYBRID_CHANCE },
    legacyGrimoire: [
      'petrifying_mantle',
      'petrifying_mantle',
      'seismic_slam',
      'marrow_siphon',
      'shadow_siphon',
      'harvest_the_weak',
      'smoke_bomb',
      'marrow_burst',
    ],
    unitCardId: 'sovereign_bound',
  },
];

export function companionById(id: string): CompanionDef | undefined {
  return COMPANIONS.find((c) => c.id === id);
}

export const DEFAULT_COMPANION = COMPANIONS[0]!;

/**
 * The discipline a character enrols in when nobody asked.
 *
 * Read off `DEFAULT_COMPANION` rather than written down, so the fallback school and the
 * fallback bloodline cannot name different things. It is what a legacy save, a test, and
 * any caller that has not been through the selection screen all get -- the school the game
 * started with, before there was a choice to make.
 */
export const DEFAULT_SCHOOL: School = DEFAULT_COMPANION.grimoire.schools[0]!;
