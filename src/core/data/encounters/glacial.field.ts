/**
 * The Open Glacial Field — 8x8, and almost nothing on it.
 *
 * The opposite problem to the Ruin. There is room here for everything to work, and the
 * fog takes it away: on the widest board in the game nobody can see past three tiles, so
 * reach counts for nothing and the fight is fought at arm's length whether either side
 * wanted that or not.
 *
 * A ring of pillars gives the field its only structure, and breaking one trades a wall
 * for ground that costs double to cross. The wildlife arrives partway through and does
 * not care which army it is standing between.
 */

import type { EncounterDef } from './registry.js';
import { registerEncounter } from './registry.js';

export const GLACIAL_FIELD: EncounterDef = registerEncounter({
  id: 'glacial_field',
  name: 'Open Glacial Field',
  blurb:
    'Open ice under thick fog. Nothing sees far, something is already living here, and the pillars are the only cover for a long way.',
  width: 8,
  height: 8,
  playerHp: 400,
  enemyHp: 400,
  playerName: 'Hero',
  companionName: 'Boreas',
  companionId: 'boreas',
  companionSchool: 'frost',
  enemyName: 'Glacier Duelist',
  enemySchool: 'frost',
  /**
   * Two bodies in twelve cards, and it was four.
   *
   * Retuned when attacking started costing a Bone. A third of this deck was minions —
   * `rimeguard` twice, a Grave Sentinel and a Scout Imp — and the deck reshuffles with no
   * fatigue, so it printed a body every third draw forever. Under free attacks the player
   * cleared them as fast as they arrived. Under a per-swing cost they cannot: measured over
   * eight seeds the enemy reached **twelve to fifteen bodies against the player's one**, and
   * two of those eight could not finish inside the sixty-turn guard.
   *
   * Halving the body count is the retune that fits what this fight is *about*. The header
   * above calls it a field of fog and pillars, where "reach counts for nothing and the fight
   * is fought at arm's length" — that is an argument about sight and distance, not an
   * attrition race, and the swarm was drowning the thing the encounter was built to say.
   */
  enemyDeck: [
    'glacial_spike',
    'glacial_spike',
    'flash_freeze',
    'flash_freeze',
    'brittle_touch',
    'brittle_touch',
    'frost_nova',
    'rimeguard',
    'ice_barricade',
    'grave_sentinel',
    'shield_bash',
    'aegis_ward',
  ],
  enemyOpeningBoard: [
    ['scout_imp', 2, 1],
    ['rimeguard', 5, 1],
    // The arena pass: an 8x8 seats sixteen points, and the mirror stops being a mirror if
    // only one side fields what the field allows.
    ['glacier_warden', 6, 1],
    ['rimeguard', 1, 1],
    ['glacial_stalker', 0, 0],
    ['hoarhound', 7, 0],
  ],
  // A mirror, and a frost one: their spells are thrown from a body that has to walk into
  // the fog to reach anything, exactly as yours does.
  enemyCompanion: { unitCardId: 'boreas_bound' },
  // The whole point of the field. Snipers are blind, mortars cannot range, and the
  // Companion has to be walked forward to cast at all.
  weather: { kind: 'fog' },
  // A broken ring: cover where there would otherwise be none, and rubble once it goes.
  terrain: [
    { at: { x: 2, y: 3 }, kind: 'wall' },
    { at: { x: 5, y: 3 }, kind: 'wall' },
    { at: { x: 2, y: 4 }, kind: 'wall' },
    { at: { x: 5, y: 4 }, kind: 'wall' },
    { at: { x: 3, y: 2 }, kind: 'cover' },
    { at: { x: 4, y: 5 }, kind: 'cover' },
  ],
  props: [
    { at: { x: 3, y: 3 }, defId: 'cryo_crystal' },
    { at: { x: 4, y: 4 }, defId: 'cryo_crystal' },
  ],
  marrowGeodes: { min: 2, max: 3 },
  scavenger: true,
  turfwar: { count: 2, unitCardId: 'ridge_wolf' },
});
