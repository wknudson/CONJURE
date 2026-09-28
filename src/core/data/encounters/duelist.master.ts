/**
 * The Master Duelist: the Master poster's honest duel, and the last of the three.
 *
 * Novice teaches the Hero's first shelf, Journeyman the colourless half of the kit; this one
 * teaches the arcane half — the bolts, the cleanse, the Stasis Glyph and the Warding Obelisk
 * — and the Timber Palisade, which is the one neutral card heavy enough to belong at the top
 * tier. It is the duel a player walks into once they think they know what a Hero Deck is.
 *
 * Posted on the Master rolled pool (`bounties.ts`) and wagered like every duel. It awards no
 * beast.
 */

import type { EncounterDef } from './registry.js';
import { registerEncounter } from './registry.js';

export const MASTER_DUELIST: EncounterDef = registerEncounter({
  id: 'master_duelist',
  name: 'The Master Duelist',
  blurb:
    'She has not lost a duel in the wards in eleven years and does not intend to start with ' +
    'you. Glyphs, palisades and patience: bring more than your beast.',
  // Eight wide and nine deep, the largest of the three: room for a Palisade to close a lane
  // and an Obelisk to hold another, and a long walk for anyone who wants to break either.
  width: 8,
  height: 9,
  playerHp: 400,
  enemyHp: 480,
  playerName: 'Hero',
  companionName: 'Ignis',
  companionSchool: 'pyre',
  enemyName: 'Master Duelist',
  enemySchool: 'frost',
  /**
   * The arcane half of the kit, plus the Palisade and a few staples to round out a real deck.
   *
   * Hero-legal throughout. Two Mana Bolts because a master's first answer is the simple one;
   * one Stasis Glyph, because one is all a Tier 2 card is allowed to be most places and a
   * master does not need two.
   */
  enemyDeck: [
    'mana_bolt',
    'mana_bolt',
    'aether_lance',
    'siphon_bolt',
    'stasis_glyph',
    'cleansing_rune',
    'warding_obelisk',
    'timber_palisade',
    'aegis_ward',
    'aegis_ward',
    'shield_bash',
    'cull_the_weak',
    'rime_mark',
    'cinder_mark',
  ],
  /**
   * A Frost warband worth the arena: fifteen points authored plus the free Footman at (4,1),
   * which is left clear. The Glacier Warden anchors the middle; the archer stands behind it.
   */
  enemyOpeningBoard: [
    ['glacier_warden', 3, 1],
    ['rimeguard', 2, 1],
    ['rimeguard', 5, 1],
    ['hoarhound', 0, 1],
    ['rime_fox', 7, 1],
    ['rime_archer', 4, 0],
  ],
  // The Frost Bear, standing back and throwing: a master's beast is the patient kind.
  enemyCompanion: { unitCardId: 'boreas_bound' },
  marrowGeodes: { min: 1, max: 3 },
  weather: { kind: 'fog' },
  terrain: [
    { at: { x: 2, y: 4 }, kind: 'wall' },
    { at: { x: 5, y: 4 }, kind: 'wall' },
    { at: { x: 3, y: 3 }, kind: 'cover' },
    { at: { x: 4, y: 5 }, kind: 'cover' },
  ],
});
