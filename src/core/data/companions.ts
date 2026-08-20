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

export interface CompanionDef {
  id: string;
  name: string;
  title: string;
  school: School;
  /** One line, shown on the selection screen. */
  blurb: string;
  /** The 15-card deck this companion brings. */
  deck: string[];
  /** The setup-only stat block placed on the board as its Bound Form. */
  unitCardId: string;
}

/**
 * The shared spine of every companion deck: the cards that belong to no school.
 *
 * Narrower than it was. It used to be the starter deck minus its Pyre half, which meant it
 * also carried the starter's five minions — and those are a Vanguard Roster now. What is
 * left is genuinely universal: a bleed, a shove, a wall and a ward, four cards any school
 * is glad of. Everything with a colour is dealt below, per Companion.
 */
const HERO_SPINE: string[] = ['dark_tithe', 'shield_bash', 'stone_barricade', 'aegis_ward'];

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
    unitCardId: 'ignis_bound',
  },
  {
    id: 'boreas',
    name: 'Boreas',
    title: 'Frost Bear',
    school: 'frost',
    blurb:
      'Control. Chill an enemy three times and it freezes solid — then break it. Rime Guard armours your Hero each turn.',
    deck: [
      ...HERO_SPINE,
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
    deck: [
      ...HERO_SPINE,
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
    deck: [
      ...HERO_SPINE,
      'soul_splinter_rune',
      'soul_splinter_rune',
      'soul_splinter_rune',
      'marrow_siphon',
      'marrow_siphon',
      'marrow_siphon',
      'marrow_burst',
      'harvest_the_weak',
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
    deck: [
      ...HERO_SPINE,
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
    deck: [
      ...HERO_SPINE,
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
    deck: [
      ...HERO_SPINE,
      'aether_beam',
      'aether_beam',
      'grapple_line',
      'grapple_line',
      'grapple_line',
      'cull_the_weak',
      'volatile_cask',
      'alchemists_barricade',
    ],
    unitCardId: 'lexis_bound',
  },
];

export function companionById(id: string): CompanionDef | undefined {
  return COMPANIONS.find((c) => c.id === id);
}

export const DEFAULT_COMPANION = COMPANIONS[0]!;
