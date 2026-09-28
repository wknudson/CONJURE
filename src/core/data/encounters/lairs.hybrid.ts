/**
 * Lairs for the newer hybrids: walk-to fights, one beast each, guarded by its den.
 *
 * The same shape as the apex lairs (`apex.lairs.ts`): no poster, a site in the world that
 * opens once the story fight that named the region is walked, the Seal at a quarter health,
 * and the hunt clock for a rematch. Each den is the Wave 14 worldbuild wish list made real —
 * a drake's brood, a bear, wights — and each teaches the hybrid's signature.
 */

import type { EncounterDef } from './registry.js';
import { registerEncounter, registerEncounterScript } from './registry.js';
import { SEAL_ONLY_SCRIPT } from './seal.js';

export const CALDERA_OTTER: EncounterDef = registerEncounter({
  id: 'caldera_otter',
  name: 'The Scalding Pools',
  blurb:
    'Where the meltwater runs into the vents the pools steam all year, and the tap crews have stopped filling their kettles there. Something swims in them that likes it hot and cold at once.',
  width: 8,
  height: 8,
  // The den's guards plus the free Footman setup places at (4,1).
  rosterBudget: 10,
  playerHp: 400,
  enemyHp: 430,
  playerName: 'Hero',
  companionName: 'Companion',
  companionSchool: 'pyre',
  enemyName: 'Steamvent Otter',
  enemySchool: 'frost',
  enemyDeck: [
    'glacial_spike',
    'frost_nova',
    'flame_surge',
    'kindling',
    'wildfire',
    'shield_bash',
    'aegis_ward',
    // The Steamvent Otter's own, taught where it is bound.
    'scalding_splash',
  ],
  enemyOpeningBoard: [
    ['brood_drake', 3, 1],
    ['drake_hatchling', 1, 1],
    ['drake_hatchling', 6, 1],
  ],
  enemyCompanion: { unitCardId: 'otter_bound' },
  weather: { kind: 'fog' },
  terrain: [
    { at: { x: 2, y: 4 }, kind: 'wall' },
    { at: { x: 5, y: 3 }, kind: 'wall' },
    { at: { x: 3, y: 5 }, kind: 'cover' },
  ],
  marrowGeodes: { min: 2, max: 3 },
  subjugationPrize: 'otter',
  script: SEAL_ONLY_SCRIPT,
});
registerEncounterScript('caldera_otter', SEAL_ONLY_SCRIPT);

export const SHELF_EYRIE: EncounterDef = registerEncounter({
  id: 'shelf_eyrie',
  name: 'The Storm Eyrie',
  blurb:
    'The conduit masts at the Shelf’s edge have a nest on every one, and the nests are struck every storm and are always still there in the morning.',
  width: 8,
  height: 8,
  // The den's guards plus the free Footman setup places at (4,1).
  rosterBudget: 10,
  playerHp: 400,
  enemyHp: 480,
  playerName: 'Hero',
  companionName: 'Companion',
  companionSchool: 'pyre',
  enemyName: 'Thunderhawk',
  enemySchool: 'surge',
  enemyDeck: [
    'static_arc',
    'chain_bolt',
    'discharge',
    'flame_surge',
    'immolate',
    'shield_bash',
    'aegis_ward',
    // The Thunderhawk's own, taught where it is bound.
    'lightning_dive',
  ],
  enemyOpeningBoard: [
    ['storm_roc', 3, 1],
    ['hawk_fledgling', 1, 1],
    ['hawk_fledgling', 6, 1],
  ],
  enemyCompanion: { unitCardId: 'thunderhawk_bound' },
  weather: { kind: 'gale', wind: { x: 1, y: 0 } },
  terrain: [
    { at: { x: 2, y: 3 }, kind: 'wall' },
    { at: { x: 5, y: 4 }, kind: 'wall' },
    { at: { x: 4, y: 2 }, kind: 'cover' },
  ],
  marrowGeodes: { min: 2, max: 3 },
  subjugationPrize: 'thunderhawk',
  script: SEAL_ONLY_SCRIPT,
});
registerEncounterScript('shelf_eyrie', SEAL_ONLY_SCRIPT);

export const RIMEFIELD_BARROW: EncounterDef = registerEncounter({
  id: 'rimefield_barrow',
  name: 'The Frost Barrow',
  blurb:
    'The old barrow on the south slope has frost on the inside of its door. The shepherds say it has always been cold in there; the new thing is that the cold comes out.',
  width: 8,
  height: 8,
  // The den's guards plus the free Footman setup places at (4,1).
  rosterBudget: 10,
  playerHp: 400,
  enemyHp: 480,
  playerName: 'Hero',
  companionName: 'Companion',
  companionSchool: 'pyre',
  enemyName: 'Frostbarrow Wight',
  enemySchool: 'dusk',
  enemyDeck: [
    'wither',
    'pall',
    'creeping_decay',
    'glacial_spike',
    'frostbite',
    'shield_bash',
    'aegis_ward',
    // The Frostbarrow Wight's own, taught where it is bound.
    'barrow_chill',
  ],
  enemyOpeningBoard: [
    ['wight_lord', 3, 1],
    ['barrow_wight', 1, 1],
    ['barrow_wight', 6, 1],
  ],
  enemyCompanion: { unitCardId: 'wight_bound' },
  weather: { kind: 'fog' },
  terrain: [
    { at: { x: 2, y: 2 }, kind: 'wall' },
    { at: { x: 5, y: 5 }, kind: 'wall' },
    { at: { x: 3, y: 4 }, kind: 'cover' },
  ],
  marrowGeodes: { min: 1, max: 3 },
  subjugationPrize: 'wight',
  script: SEAL_ONLY_SCRIPT,
});
registerEncounterScript('rimefield_barrow', SEAL_ONLY_SCRIPT);

export const BASTION_DEN: EncounterDef = registerEncounter({
  id: 'bastion_den',
  name: 'The Ossuary Den',
  blurb:
    'The lowest ossuary on the Bastion has been dug out from inside, and the bones are stacked neatly round the walls like a nest. Something sleeps on them.',
  width: 8,
  height: 8,
  // The den's guards plus the free Footman setup places at (4,1).
  rosterBudget: 10,
  playerHp: 400,
  enemyHp: 430,
  playerName: 'Hero',
  companionName: 'Companion',
  companionSchool: 'pyre',
  enemyName: 'Barrow Bear',
  enemySchool: 'bulwark',
  enemyDeck: [
    'counterweight',
    'crag_slam',
    'bastion_stance',
    'pall',
    'wither',
    'shield_bash',
    'aegis_ward',
    // The Barrow Bear's own, taught where it is bound.
    'ossuary_maul',
  ],
  enemyOpeningBoard: [
    ['den_bear', 3, 1],
    ['bear_cub', 1, 1],
    ['bear_cub', 6, 1],
  ],
  enemyCompanion: { unitCardId: 'bear_bound' },
  terrain: [
    { at: { x: 1, y: 3 }, kind: 'wall' },
    { at: { x: 6, y: 4 }, kind: 'wall' },
    { at: { x: 3, y: 4 }, kind: 'cover' },
  ],
  marrowGeodes: { min: 2, max: 3 },
  subjugationPrize: 'bear',
  script: SEAL_ONLY_SCRIPT,
});
registerEncounterScript('bastion_den', SEAL_ONLY_SCRIPT);

export const ASHWOOD_RING: EncounterDef = registerEncounter({
  id: 'ashwood_ring',
  name: 'The Rotcap Ring',
  blurb:
    'There is a ring of caps in the deep Ashwood that the charcoal burners walk a mile round. Nothing grows inside it but more of it.',
  width: 8,
  height: 8,
  // The den's guards plus the free Footman setup places at (4,1).
  rosterBudget: 10,
  playerHp: 400,
  enemyHp: 430,
  playerName: 'Hero',
  companionName: 'Companion',
  companionSchool: 'pyre',
  enemyName: 'Rotcap Myconid',
  enemySchool: 'bloom',
  enemyDeck: [
    'spore_cloud',
    'pollen_drift',
    'spore_burst',
    'pall',
    'wither',
    'shield_bash',
    'aegis_ward',
    // The Rotcap Myconid's own, taught where it is bound.
    'rotcap_bloom',
  ],
  enemyOpeningBoard: [
    ['ring_elder', 3, 1],
    ['spore_thrall', 1, 1],
    ['spore_thrall', 6, 1],
  ],
  enemyCompanion: { unitCardId: 'myconid_bound' },
  weather: { kind: 'fog' },
  terrain: [
    { at: { x: 2, y: 4 }, kind: 'cover' },
    { at: { x: 5, y: 3 }, kind: 'cover' },
    { at: { x: 3, y: 3 }, kind: 'wall' },
  ],
  subjugationPrize: 'myconid',
  script: SEAL_ONLY_SCRIPT,
});
registerEncounterScript('ashwood_ring', SEAL_ONLY_SCRIPT);
