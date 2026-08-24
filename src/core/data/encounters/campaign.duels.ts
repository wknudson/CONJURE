/**
 * The King's Contracts — the wager duels (campaign, Wave 2).
 *
 * Three duelists on the ladder the design doc runs under the whole arc: a broken veteran
 * in Highcourt, a discharged King's Duelist poaching the Ashwood fringe, and the man
 * Millharrow feeds on the Waystone bridge. Every one is a person across a board, so every
 * one is a bet — the campaign marks them `wager: true` and the board stakes the tier.
 *
 * Like the Novice Duelist, their decks are Hero-legal kit (abilities, marks, constructs),
 * because that is what a duelist has.
 */

import type { EncounterDef } from './registry.js';
import { registerEncounter } from './registry.js';

/** Novice #6 — the veteran who heard the floor eating. */
export const SMOKE_EATERS_REST: EncounterDef = registerEncounter({
  id: 'smoke_eaters_rest',
  name: 'Smoke-Eater’s Rest',
  blurb:
    'A cracked veteran has claimed a bench on Highcourt plaza and duels anyone the ' +
    'Wardens send to move him. Be politer than the last three.',
  width: 7,
  height: 7,
  playerHp: 400,
  enemyHp: 380,
  playerName: 'Hero',
  companionName: 'Ignis',
  companionSchool: 'pyre',
  enemyName: 'The Smoke-Eater',
  enemySchool: 'bulwark',
  // An old soldier's kit: shields, grapples, and the discipline of a man who stood post.
  enemyDeck: [
    'shield_bash',
    'shield_bash',
    'aegis_ward',
    'aegis_ward',
    'grapple_line',
    'concussive_blow',
    'stone_barricade',
    'tremor_mark',
    'cinder_mark',
  ],
  // What is left of his old squad, drilled and square.
  enemyOpeningBoard: [
    ['shieldbearer', 2, 1],
    ['shieldbearer', 4, 1],
    ['grave_sentinel', 2, 0],
  ],
  // TODO(worldbuild): his companion is the stock duelist umbra until he has his own.
  enemyCompanion: { unitCardId: 'umbra_bound' },
  // A plaza: clean ground, two benches, one fountain. A duel, not an ambush.
  terrain: [
    { at: { x: 3, y: 3 }, kind: 'wall' },
    { at: { x: 1, y: 3 }, kind: 'cover' },
    { at: { x: 5, y: 3 }, kind: 'cover' },
  ],
});

/** Adept #6 — the discharged King's Duelist, poaching the forest he refused to burn. */
export const ASHWOOD_POACHER: EncounterDef = registerEncounter({
  id: 'ashwood_poacher',
  name: 'The Poacher of the Ashwood Fringe',
  blurb:
    'A poacher-duelist is bleeding the King’s forest and mocking the wardens sent after ' +
    'him. Bring back his medallion, whole or otherwise.',
  width: 7,
  height: 8,
  playerHp: 400,
  enemyHp: 400,
  playerName: 'Hero',
  companionName: 'Ignis',
  companionSchool: 'pyre',
  enemyName: 'The Poacher',
  enemySchool: 'bloom',
  // A woodsman's duel: snares, sightlines, and patience.
  enemyDeck: [
    'grapple_line',
    'aether_beam',
    'shield_bash',
    'aegis_ward',
    'stone_barricade',
    'rot_root_snare',
    'rime_mark',
    'soul_splinter_mark',
  ],
  enemyOpeningBoard: [
    ['longshot_stalker', 1, 1],
    ['briar_wolf', 5, 1],
    ['briar_wolf', 2, 0],
  ],
  // TODO(worldbuild): stock duelist companion; his should be something taken from the wood.
  enemyCompanion: { unitCardId: 'umbra_bound' },
  // The fringe under fog: trunks and thickets, sight bought a tile at a time.
  weather: { kind: 'fog' },
  terrain: [
    { at: { x: 1, y: 3 }, kind: 'wall' },
    { at: { x: 5, y: 4 }, kind: 'wall' },
    { at: { x: 3, y: 3 }, kind: 'cover' },
    { at: { x: 2, y: 5 }, kind: 'cover' },
    { at: { x: 4, y: 5 }, kind: 'cover' },
    { at: { x: 6, y: 2 }, kind: 'cover' },
  ],
});

/** Adept #10 — the man Millharrow feeds, holding the bridge against the toll. */
export const WAYSTONE_DUEL: EncounterDef = registerEncounter({
  id: 'waystone_duel',
  name: 'Duel at the Waystone',
  blurb:
    'A duelist holds the Waystone bridge and turns the toll-men back at the parapet. The ' +
    'crown wants its road, and is paying you to want it too.',
  width: 6,
  height: 9,
  playerHp: 400,
  enemyHp: 420,
  playerName: 'Hero',
  companionName: 'Ignis',
  companionSchool: 'pyre',
  enemyName: 'The Waystone Duelist',
  enemySchool: 'bulwark',
  enemyDeck: [
    'shield_bash',
    'shield_bash',
    'concussive_blow',
    'aegis_ward',
    'aegis_ward',
    'bastion_stance',
    'stone_barricade',
    'tremor_mark',
    'arc_mark',
  ],
  enemyOpeningBoard: [
    ['shieldbearer', 2, 1],
    ['anvil_lord', 4, 1],
  ],
  // TODO(worldbuild): stock duelist companion for now.
  enemyCompanion: { unitCardId: 'umbra_bound' },
  // The gale funnels down the river as it always does at the Waystone.
  weather: { kind: 'gale', wind: { x: 0, y: 1 } },
  // The bridge: parapets wall both edges through the middle rows, leaving a two-tile
  // lane. A one-lane fight, exactly as the doc bills it.
  terrain: [
    { at: { x: 0, y: 2 }, kind: 'wall' },
    { at: { x: 1, y: 2 }, kind: 'wall' },
    { at: { x: 4, y: 2 }, kind: 'wall' },
    { at: { x: 5, y: 2 }, kind: 'wall' },
    { at: { x: 0, y: 4 }, kind: 'wall' },
    { at: { x: 1, y: 4 }, kind: 'wall' },
    { at: { x: 4, y: 4 }, kind: 'wall' },
    { at: { x: 5, y: 4 }, kind: 'wall' },
    { at: { x: 0, y: 6 }, kind: 'wall' },
    { at: { x: 1, y: 6 }, kind: 'wall' },
    { at: { x: 4, y: 6 }, kind: 'wall' },
    { at: { x: 5, y: 6 }, kind: 'wall' },
  ],
});
