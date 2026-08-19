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

/** Hero cards from the Draft 7 starter deck — the shared spine of every companion deck. */
const HERO_SPINE = STARTER_DECK.filter(
  (id) =>
    ![
      'cinder_rune',
      'soul_splinter_rune',
      'flame_surge',
      'cataclysmic_core',
    ].includes(id),
);

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
      'voltaic_hound',
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
      'ash_ghoul',
      'ash_ghoul',
      'ash_ghoul',
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
      'creeping_briar',
      'creeping_briar',
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
      'concussive_blow',
      'concussive_blow',
      'seismic_slam',
      'seismic_slam',
      'slag_iron_golem',
      // A second wall. Bulwark is the only school whose Companion cards are mostly other
      // people's problems, so its own deck wants one more thing to hide behind.
      'stone_barricade',
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
      'scrap_phalanx',
      'cull_the_weak',
    ],
    unitCardId: 'lexis_bound',
  },
];

export function companionById(id: string): CompanionDef | undefined {
  return COMPANIONS.find((c) => c.id === id);
}

export const DEFAULT_COMPANION = COMPANIONS[0]!;
