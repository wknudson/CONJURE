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
import { MONO_HYBRID_CHANCE } from './grimoire.js';

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
   * Ignis are now two different books drawn from the same shelf: one heavy on runes, one
   * that rolled a Cataclysm it has no business knowing.
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
      'Runes and cascades. Brand your enemies, then set the whole board off at once. Ember Watch ignites anything standing in its lane.',
    // The Draft 7 deck exactly as specced.
    deck: [...STARTER_DECK],
    grimoire: { schools: ['pyre'], hybridChance: MONO_HYBRID_CHANCE },
    legacyGrimoire: [
      'flame_surge',
      'flame_surge',
      'cinder_rune',
      'cinder_rune',
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
      'soul_splinter_rune',
      'soul_splinter_rune',
      'soul_splinter_rune',
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
      'rot_root_snare',
      'rot_root_snare',
      'rot_root_snare',
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
  {
    id: 'lexis',
    name: 'Lexis',
    title: 'Ink Owl',
    school: 'arcane',
    blurb:
      'Cards. Beams, hooks, and a hand that keeps refilling. Marginalia draws you one more every turn you cast.',
    deck: [...STARTER_DECK],
    grimoire: { schools: ['arcane'], hybridChance: MONO_HYBRID_CHANCE },
    legacyGrimoire: [
      'aether_beam',
      'aether_beam',
      'volatile_cask',
      'alchemists_barricade',
      'aetheric_resurgence',
      'anchor_rally',
      'grapple_line',
      'cull_the_weak',
    ],
    unitCardId: 'lexis_bound',
  },
];

export function companionById(id: string): CompanionDef | undefined {
  return COMPANIONS.find((c) => c.id === id);
}

export const DEFAULT_COMPANION = COMPANIONS[0]!;
