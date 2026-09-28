/**
 * Side contracts for the contract hybrids: the King's work, posted after each tier's arc, each ending in
 * a hybrid bound.
 *
 * Appended to `STORY_CONTRACTS` rather than threaded into the campaign, so no player
 * mid-arc finds the story's order changed under them: each appears on its tier's poster once
 * that tier's own contracts are walked. Each fight is sealed at a quarter health and awards
 * its beast, as every story hybrid is, and teaches the beast's signature.
 */

import type { EncounterDef } from './registry.js';
import { registerEncounter, registerEncounterScript } from './registry.js';
import { SEAL_ONLY_SCRIPT } from './seal.js';

export const THE_SNUFFED_LAMPS: EncounterDef = registerEncounter({
  id: 'the_snuffed_lamps',
  name: 'The Snuffed Lamps',
  blurb:
    'The last lit street in the ward, and the lamps along it guttering one by one toward you.',
  width: 7,
  height: 7,
  // The guards plus the free Footman setup places in the middle of row 1.
  rosterBudget: 10,
  playerHp: 400,
  enemyHp: 380,
  playerName: 'Hero',
  companionName: 'Companion',
  companionSchool: 'pyre',
  enemyName: 'The Wick Wraith',
  enemySchool: 'dusk',
  enemyDeck: [
    'kindling',
    'flame_surge',
    'pall',
    'wither',
    'gloom_bolt',
    'shield_bash',
    'aegis_ward',
    // The Wick Wraith's own, taught where it is bound.
    'wick_drain',
  ],
  enemyOpeningBoard: [
    ['wailing_geist', 3, 0],
    ['restless_geist', 1, 1],
    ['restless_geist', 5, 1],
  ],
  enemyCompanion: { unitCardId: 'wraith_bound' },
  weather: { kind: 'fog' },
  terrain: [
    { at: { x: 1, y: 3 }, kind: 'cover' },
    { at: { x: 5, y: 3 }, kind: 'cover' },
    { at: { x: 3, y: 4 }, kind: 'wall' },
  ],
  subjugationPrize: 'wraith',
  script: SEAL_ONLY_SCRIPT,
});
registerEncounterScript('the_snuffed_lamps', SEAL_ONLY_SCRIPT);

export const THE_BURNT_ORCHARD: EncounterDef = registerEncounter({
  id: 'the_burnt_orchard',
  name: 'The Burnt Orchard',
  blurb:
    'Charred trunks with green vines through them, and one of the vines is watching you.',
  width: 8,
  height: 7,
  // The guards plus the free Footman setup places in the middle of row 1.
  rosterBudget: 12,
  playerHp: 400,
  enemyHp: 430,
  playerName: 'Hero',
  companionName: 'Companion',
  companionSchool: 'pyre',
  enemyName: 'The Ashvine Chameleon',
  enemySchool: 'pyre',
  enemyDeck: [
    'flame_surge',
    'kindling',
    'fire_breath',
    'thorn_volley',
    'nettle',
    'shield_bash',
    'aegis_ward',
    // The Ashvine Chameleon's own, taught where it is bound.
    'vine_flare',
  ],
  enemyOpeningBoard: [
    ['kiln_guard', 2, 1],
    ['thorn_sprout', 5, 1],
    ['spore_archer', 3, 0],
    ['flame_archer', 6, 0],
  ],
  enemyCompanion: { unitCardId: 'chameleon_bound' },
  terrain: [
    { at: { x: 2, y: 3 }, kind: 'cover' },
    { at: { x: 5, y: 3 }, kind: 'cover' },
    { at: { x: 3, y: 4 }, kind: 'cover' },
  ],
  subjugationPrize: 'chameleon',
  script: SEAL_ONLY_SCRIPT,
});
registerEncounterScript('the_burnt_orchard', SEAL_ONLY_SCRIPT);

export const THE_SCRAP_FIELD: EncounterDef = registerEncounter({
  id: 'the_scrap_field',
  name: 'The Scrap Field',
  blurb:
    'A field of scrap iron, and all of it leaning the same way.',
  width: 8,
  height: 7,
  // The guards plus the free Footman setup places in the middle of row 1.
  rosterBudget: 11,
  playerHp: 400,
  enemyHp: 430,
  playerName: 'Hero',
  companionName: 'Companion',
  companionSchool: 'pyre',
  enemyName: 'The Lodestone Scarab',
  enemySchool: 'surge',
  enemyDeck: [
    'static_arc',
    'chain_bolt',
    'spark',
    'counterweight',
    'fault_line',
    'shield_bash',
    'aegis_ward',
    // The Lodestone Scarab's own, taught where it is bound.
    'lodestone_pull',
  ],
  enemyOpeningBoard: [
    ['galvanic_brute', 3, 1],
    ['coil_lancer', 1, 0],
    ['spark_imp', 6, 1],
  ],
  enemyCompanion: { unitCardId: 'scarab_bound' },
  weather: { kind: 'gale', wind: { x: 1, y: 0 } },
  terrain: [
    { at: { x: 2, y: 3 }, kind: 'wall' },
    { at: { x: 5, y: 4 }, kind: 'wall' },
  ],
  marrowGeodes: { min: 2, max: 3 },
  subjugationPrize: 'scarab',
  script: SEAL_ONLY_SCRIPT,
});
registerEncounterScript('the_scrap_field', SEAL_ONLY_SCRIPT);

export const THE_FROZEN_TOLL: EncounterDef = registerEncounter({
  id: 'the_frozen_toll',
  name: 'The Frozen Toll',
  blurb:
    'The toll-house road, iced shut, and something the size of the toll-house standing in the middle of it.',
  width: 8,
  height: 8,
  // The guards plus the free Footman setup places in the middle of row 1.
  rosterBudget: 13,
  playerHp: 400,
  enemyHp: 480,
  playerName: 'Hero',
  companionName: 'Companion',
  companionSchool: 'pyre',
  enemyName: 'The Rimestone Yak',
  enemySchool: 'frost',
  enemyDeck: [
    'glacial_spike',
    'frost_nova',
    'ice_barricade',
    'counterweight',
    'crag_slam',
    'shield_bash',
    'aegis_ward',
    // The Rimestone Yak's own, taught where it is bound.
    'avalanche_haul',
  ],
  enemyOpeningBoard: [
    ['permafrost_troll', 3, 1],
    ['rampart_mason', 1, 1],
    ['frost_ballista', 5, 0],
    ['ramming_goat', 6, 1],
  ],
  enemyCompanion: { unitCardId: 'yak_bound' },
  weather: { kind: 'fog' },
  terrain: [
    { at: { x: 2, y: 4 }, kind: 'wall' },
    { at: { x: 5, y: 4 }, kind: 'wall' },
    { at: { x: 3, y: 3 }, kind: 'cover' },
  ],
  subjugationPrize: 'yak',
  script: SEAL_ONLY_SCRIPT,
});
registerEncounterScript('the_frozen_toll', SEAL_ONLY_SCRIPT);

export const THE_HEDGE_FORT: EncounterDef = registerEncounter({
  id: 'the_hedge_fort',
  name: 'The Hedge Fort',
  blurb:
    'A dry-stone wall with thorns growing out of every gap, and the wall breathing.',
  width: 7,
  height: 7,
  // The guards plus the free Footman setup places in the middle of row 1.
  rosterBudget: 10,
  playerHp: 400,
  enemyHp: 380,
  playerName: 'Hero',
  companionName: 'Companion',
  companionSchool: 'pyre',
  enemyName: 'The Thornstone Hedgehog',
  enemySchool: 'bloom',
  enemyDeck: [
    'thornlash',
    'root_snare',
    'nettle',
    'counterweight',
    'rubble_wall',
    'shield_bash',
    'aegis_ward',
    // The Thornstone Hedgehog's own, taught where it is bound.
    'spine_volley',
  ],
  enemyOpeningBoard: [
    ['oakheart_guardian', 3, 0],
    ['thorn_sprout', 1, 1],
    ['rampart_mason', 5, 1],
  ],
  enemyCompanion: { unitCardId: 'hedgehog_bound' },
  terrain: [
    { at: { x: 1, y: 3 }, kind: 'wall' },
    { at: { x: 5, y: 3 }, kind: 'wall' },
    { at: { x: 3, y: 4 }, kind: 'cover' },
  ],
  subjugationPrize: 'hedgehog',
  script: SEAL_ONLY_SCRIPT,
});
registerEncounterScript('the_hedge_fort', SEAL_ONLY_SCRIPT);
