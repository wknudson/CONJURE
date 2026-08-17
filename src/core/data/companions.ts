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
];

export function companionById(id: string): CompanionDef | undefined {
  return COMPANIONS.find((c) => c.id === id);
}

export const DEFAULT_COMPANION = COMPANIONS[0]!;
