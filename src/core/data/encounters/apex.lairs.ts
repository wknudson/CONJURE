/**
 * The regional apex lairs — walk-to fights with no poster.
 *
 * The atlas seats three species in ground their story fights never touched: the Obsidian
 * Tortoise under the Caldera's crust (bound in the city's drowned granary), the
 * Cinder-Wasp mother-comb in the crater wall (bound off one burnt Bonemarket awning),
 * and the Grave-Gargoyles' growing-ice south of the Rimefield road (bound in a Ward
 * Seven cistern). These lairs put the fights where the atlas says the animals live —
 * and they are deliberately **second acquisition routes**: a player who killed the story
 * beast can still walk to where its kind grow old and bind one. Re-binding an owned
 * species is allowed and pays, exactly as hunts allow it — a taming is a roll, so a
 * second animal is a different animal.
 *
 * No poster, no signpost: these are found by walking, gated on the story contract that
 * names the species (`district/sites.ts` holds the ground and the gate), and rematch on
 * the hunt cooldown.
 */

import type { EncounterDef, EncounterScript } from './registry.js';
import { registerEncounter, registerEncounterScript } from './registry.js';
import { newCause } from '../../engine/context.js';
import { summonUnit } from '../../engine/spawn.js';
import { canPlace } from '../../engine/board.js';
import { SEAL_ONLY_SCRIPT, sealAt25 } from './seal.js';

/* ================================================================================== *
 * The Obsidian Shelf — the Caldera's tortoise, on the seam it is keeping
 * ================================================================================== */

export const CALDERA_TORTOISE: EncounterDef = registerEncounter({
  id: 'caldera_tortoise',
  name: 'The Obsidian Shelf',
  blurb:
    'South of the vents the crust rings hollow, and the tap-field augers come back ' +
    'blunted. The seam the Works wanted is under something that wants it more.',
  width: 8,
  height: 8,
  playerHp: 400,
  enemyHp: 430,
  playerName: 'Hero',
  companionName: 'Companion',
  companionSchool: 'pyre',
  enemyName: 'The Caldera Bulwark',
  enemySchool: 'bulwark',
  // The pyre+bulwark hybrid speaking both halves; magma_shove is the species blurb made
  // a card — shove them off the tile and leave it burning.
  enemyDeck: [
    'magma_shove',
    'seismic_slam',
    'crag_slam',
    'bastion_stance',
    'stoke',
    'ashen_wake',
    'tremor_mark',
    'cinder_mark',
    'stone_barricade',
    'aegis_ward',
  ],
  // Vent-things, all enemy-owned: no all-Feral stall.
  enemyOpeningBoard: [
    ['magma_brute', 1, 1],
    ['ember_hound', 6, 1],
    ['ember_moth', 3, 0],
  ],
  enemyCompanion: { unitCardId: 'tortoise_bound' },
  // Vents, and shatterable crust plates the fight is had across.
  terrain: [
    { at: { x: 2, y: 2 }, kind: 'wall' },
    { at: { x: 5, y: 5 }, kind: 'wall' },
    { at: { x: 3, y: 3 }, kind: 'cover', hp: 50 },
    { at: { x: 4, y: 4 }, kind: 'cover', hp: 50 },
    { at: { x: 2, y: 5 }, kind: 'cover', hp: 50 },
    { at: { x: 5, y: 2 }, kind: 'cover', hp: 50 },
  ],
  // The shelf IS a geode seam. The arena is the motive — the chimera's argument restated.
  marrowGeodes: { min: 4, max: 6 },
  subjugationPrize: 'tortoise',
  script: SEAL_ONLY_SCRIPT,
});
registerEncounterScript('caldera_tortoise', SEAL_ONLY_SCRIPT);

/* ================================================================================== *
 * The Vent Nest — the mother-comb the Bonemarket nest was a satellite of
 * ================================================================================== */

/** Where a fresh drone crawls out of the comb. */
const NEST_HATCHES: [number, number][] = [
  [1, 1],
  [6, 1],
  [3, 0],
];

// Seal at 25%, and the comb keeps hatching: every second enemy turn one drone arrives
// at the first anchor with room. The Ember Moth stands in for a drone, as it did at the
// Bonemarket — the worldbuild ledger's standing note gains a second consumer.
const nestScript: EncounterScript = {
  onTurnStart(ctx, side) {
    if (side !== 'enemy') return;
    if (ctx.state.turn % 2 === 0) {
      newCause(ctx);
      for (const [x, y] of NEST_HATCHES) {
        if (canPlace(ctx.state, { x, y }, 1)) {
          summonUnit(ctx, 'ember_moth', 'enemy', { x, y });
          break;
        }
      }
    }
    sealAt25(ctx);
  },
  onCommanderHpChanged(ctx, side) {
    if (side === 'enemy') sealAt25(ctx);
  },
};
registerEncounterScript('caldera_wasps', nestScript);

export const CALDERA_WASPS: EncounterDef = registerEncounter({
  id: 'caldera_wasps',
  name: 'The Vent Nest',
  blurb:
    'The Bonemarket nest was a satellite. The mother-comb is in the crater wall, in a ' +
    'seam the vents keep warm, and it was growing all the years the market thought one ' +
    'burnt awning was the end of it.',
  width: 8,
  height: 8,
  playerHp: 400,
  enemyHp: 430,
  playerName: 'Hero',
  companionName: 'Companion',
  companionSchool: 'pyre',
  // At home the Ember Swarm shows its arc half: the species' own school, where the
  // Bonemarket fight deliberately wore pyre — a nest burning.
  enemyName: 'The Mother-Comb',
  enemySchool: 'surge',
  // Many small casts; overload_strike — charge then ignite, the arc jumps — is a wasp
  // sting as a card.
  enemyDeck: [
    'stoke',
    'cinder_gale',
    'ashen_wake',
    'static_arc',
    'arc_lash',
    'overload_strike',
    'cinder_mark',
    'arc_mark',
    'aegis_ward',
  ],
  enemyOpeningBoard: [
    ['ember_moth', 1, 1],
    ['ember_moth', 6, 1],
    ['cinder_adder', 2, 0],
    ['soot_sprite', 5, 0],
  ],
  enemyCompanion: { unitCardId: 'wasp_bound' },
  // The comb: burnable, so the wildfire reaction is live and burning it is burning the
  // prize's home.
  terrain: [
    { at: { x: 2, y: 2 }, kind: 'cover', hp: 40 },
    { at: { x: 5, y: 2 }, kind: 'cover', hp: 40 },
    { at: { x: 1, y: 4 }, kind: 'cover', hp: 40 },
    { at: { x: 6, y: 4 }, kind: 'cover', hp: 40 },
    { at: { x: 3, y: 5 }, kind: 'cover', hp: 40 },
  ],
  // The nest-robber callback: even here somebody runs off with comb.
  scavenger: true,
  subjugationPrize: 'wasp',
  script: nestScript,
});

/* ================================================================================== *
 * Black Ice — where the grave-gargoyles grow old
 * ================================================================================== */

export const RIMEFIELD_GARGOYLE: EncounterDef = registerEncounter({
  id: 'rimefield_gargoyle',
  name: 'Black Ice',
  blurb:
    'The thing in the cistern was a juvenile, hiding. The sheet ice south of the road ' +
    'is where its kind grow old, and the shepherds have stopped cutting across it in ' +
    'daylight — the dark shapes in the sheet are not stones.',
  width: 8,
  height: 8,
  playerHp: 400,
  enemyHp: 500,
  playerName: 'Hero',
  companionName: 'Companion',
  companionSchool: 'frost',
  enemyName: 'Black Ice',
  enemySchool: 'dusk',
  // The frost+dusk pair, with the hybrid literally named black_ice as its signature.
  enemyDeck: [
    'glacial_spike',
    'frost_nova',
    'brittle_touch',
    'flash_freeze',
    'black_ice',
    'rime_mark',
    'shadow_siphon',
    'wither',
    'dark_tithe',
    'aegis_ward',
  ],
  enemyOpeningBoard: [
    ['glacial_stalker', 1, 1],
    ['hollow_wraith', 6, 1],
    ['rime_fox', 2, 0],
  ],
  enemyCompanion: { unitCardId: 'gargoyle_bound' },
  // Pressure ridges, sheet-ice cover, and the crystals the Break fought among.
  terrain: [
    { at: { x: 1, y: 4 }, kind: 'wall' },
    { at: { x: 6, y: 4 }, kind: 'wall' },
    { at: { x: 3, y: 3 }, kind: 'cover', hp: 50 },
    { at: { x: 4, y: 5 }, kind: 'cover', hp: 50 },
  ],
  props: [
    { at: { x: 2, y: 2 }, defId: 'cryo_crystal' },
    { at: { x: 5, y: 5 }, defId: 'cryo_crystal' },
  ],
  // Declared, not inherited: black ice hunts blind, on snowing days and clear ones.
  weather: { kind: 'fog' },
  // The Rimefields' own wolves, loyal to nobody.
  turfwar: { count: 2, unitCardId: 'ridge_wolf' },
  // "Then take what is left in Marrow."
  marrowGeodes: { min: 2, max: 4 },
  subjugationPrize: 'gargoyle',
  script: SEAL_ONLY_SCRIPT,
});
registerEncounterScript('rimefield_gargoyle', SEAL_ONLY_SCRIPT);
