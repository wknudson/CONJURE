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
  playerHp: 40,
  enemyHp: 40,
  playerName: 'Hero',
  companionName: 'Boreas',
  companionId: 'boreas',
  companionSchool: 'frost',
  enemyName: 'Glacier Duelist',
  enemySchool: 'frost',
  enemyDeck: [
    'glacial_spike',
    'glacial_spike',
    'flash_freeze',
    'brittle_touch',
    'frost_nova',
    'rimeguard',
    'rimeguard',
    'ice_barricade',
    'grave_sentinel',
    'scout_imp',
    'shield_bash',
    'aegis_ward',
  ],
  enemyOpeningBoard: [
    ['scout_imp', 2, 1],
    ['rimeguard', 5, 1],
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
  sparkGeodes: { min: 2, max: 3 },
  scavenger: true,
  turfwar: { count: 2, unitCardId: 'ridge_wolf' },
});
