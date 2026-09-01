/**
 * The twelve Wild Hunts.
 *
 * Registered from one builder rather than authored twelve times, and that is a decision
 * worth defending in a codebase whose every other encounter is written out longhand. A
 * story contract is *about* something — the sawn beams, the sixty-one souls, the manifest
 * with no return trips — and each one earns its own arena because the arena is part of what
 * it says. A hunt is about an animal. Twelve hand-built fields would be twelve chances to
 * make one hunt accidentally unwinnable and no chance to say anything a species' own cards
 * are not already saying.
 *
 * So each hunt states the six things that differ — the beast, its den, the weather over it,
 * the handlers or the wildlife between you and it, and the tier it pays at — and the builder
 * supplies the rest. See `data/hunts.ts` for what a hunt *is* and why it repeats.
 *
 * ## Two traps this file is built around
 *
 * **An all-Feral enemy stalls the fight.** Wild beasts spawned through `turfwar` belong to
 * nobody and fight everybody, so an "enemy army" made of wolves is not an army: neither side
 * can lose, the balance harness runs its 120-turn guard out, and the encounter fails the
 * suite. `campaign.adept.ts` records the same lesson from the Hollow Census. Every hunt here
 * therefore fields real handlers — trappers, wardens, Conduit Works crews — and puts the
 * wildlife in `turfwar` where it belongs.
 *
 * **A prize without a seal is a prize nobody can claim.** `subjugationPrize` names the beast;
 * it does not *offer* it. What offers it is a script calling `beginSubjugation`, and every
 * hunt uses the shared `SEAL_ONLY_SCRIPT` for exactly that. A hunt with one and not the other
 * would be a fight that can only be won by killing the animal the hunt exists to catch.
 */

import type { EncounterDef } from './registry.js';
import { registerEncounter, registerEncounterScript } from './registry.js';
import { SEAL_ONLY_SCRIPT } from './seal.js';
import { HUNTS } from '../hunts.js';
import { companionById } from '../companions.js';
import { rosterPointsOf } from '../roster.js';
import { CARDS } from '../cards/index.js';
import type { Weather } from '../../types/state.js';

/** What one hunt has to say for itself. Everything else the builder decides. */
interface HuntSpec {
  encounterId: string;
  name: string;
  blurb: string;
  /** The beast's own body, and the school its spells come from. */
  boundForm: string;
  /** Cards the beast's handlers fight with — real soldiers, never only wildlife. */
  enemyDeck: string[];
  /** Handlers already on the field, as [defId, x, y]. */
  opening: [string, number, number][];
  weather?: Weather;
  terrain?: EncounterDef['terrain'];
  /** Wildlife that turns up and mauls whoever is nearest. Feral: it fights both sides. */
  turfwar?: { count: number; unitCardId: string };
  geodes?: { min: number; max: number };
}

/**
 * Health per tier, for both sides.
 *
 * A hunt is a fight with an animal rather than a duel with a person, so the enemy pool is
 * the beast's stamina and it rises with the tier while the player's stays at the standard
 * Pact. The numbers are the same ones the campaign's fights of each tier use.
 */
const TIER_HP: Record<string, number> = { novice: 380, adept: 430, master: 500 };

/**
 * Builds and registers one hunt.
 *
 * The prize and the tier are read off `HUNTS` rather than restated here, so the registry in
 * `data/hunts.ts` is the single answer to "what does this hunt give you" — a second copy in
 * the encounter would be a fact stored twice, and the one that drifted would be the one the
 * panel showed.
 */
function hunt(spec: HuntSpec): EncounterDef {
  const entry = HUNTS.find((h) => h.encounterId === spec.encounterId);
  if (!entry) throw new Error(`hunt encounter ${spec.encounterId} is not in HUNTS`);
  const species = companionById(entry.species);
  if (!species) throw new Error(`hunt ${spec.encounterId} names unknown species ${entry.species}`);

  registerEncounterScript(spec.encounterId, SEAL_ONLY_SCRIPT);

  return registerEncounter({
    id: spec.encounterId,
    name: spec.name,
    blurb: spec.blurb,
    width: 8,
    height: 8,
    // A hunt is one apex beast and whatever runs with it -- the shape is the point, not a
    // shortfall against the arena. The number is the adds plus the free vanguard, computed
    // off the spec so the ledger test and the den can never disagree about what fields.
    rosterBudget:
      spec.opening.reduce((n, [defId]) => n + rosterPointsOf(CARDS[defId]!), 0) +
      rosterPointsOf(CARDS.vanguard_footman!),
    playerHp: 400,
    enemyHp: TIER_HP[entry.tier] ?? 400,
    playerName: 'Hero',
    companionName: 'Companion',
    // The beast casts from its own school, which is the whole reason two species of one
    // school fight differently: a Saltglass Seal throws the harbour half of Frost and a
    // Boreas throws the lockdown half, out of the pools `omit` split.
    companionSchool: species.grimoire.schools[0]!,
    enemyName: species.name,
    enemySchool: species.school,
    enemyDeck: spec.enemyDeck,
    enemyOpeningBoard: spec.opening,
    enemyCompanion: { unitCardId: spec.boundForm },
    ...(spec.weather ? { weather: spec.weather } : {}),
    ...(spec.terrain ? { terrain: spec.terrain } : {}),
    ...(spec.turfwar ? { turfwar: spec.turfwar } : {}),
    ...(spec.geodes ? { marrowGeodes: spec.geodes } : {}),
    subjugationPrize: entry.species,
  });
}

// ============================================================== the founding bloodlines

export const HUNT_CALDERA_DRAKE = hunt({
  encounterId: 'hunt_caldera_drake',
  name: 'Caldera Scrub: Ember Drake',
  blurb:
    'A young drake has taken a vent on the caldera scrub, and the tap-field crew that found ' +
    'it would rather it were somebody else’s problem. Bind it or burn it.',
  boundForm: 'ignis_bound',
  enemyDeck: [
    'flame_surge',
    'flame_surge',
    'ashen_wake',
    'stoke',
    'ember_coat',
    'ember_hound',
    'shield_bash',
    'aegis_ward',
    'grave_sentinel',
    'scout_imp',
  ],
  opening: [
    ['scout_imp', 2, 1],
    ['ember_hound', 5, 1],
  ],
  terrain: [
    { at: { x: 3, y: 3 }, kind: 'cover' },
    { at: { x: 4, y: 4 }, kind: 'cover' },
    { at: { x: 1, y: 4 }, kind: 'wall' },
    { at: { x: 6, y: 3 }, kind: 'wall' },
  ],
  geodes: { min: 2, max: 3 },
});

export const HUNT_RIMEFIELD_BEAR = hunt({
  encounterId: 'hunt_rimefield_bear',
  name: 'Rimefields: Frost Bear',
  blurb:
    'The pass crews have been feeding it to keep it off the road, which has worked exactly ' +
    'as well as feeding a bear ever does.',
  boundForm: 'boreas_bound',
  enemyDeck: [
    'glacial_spike',
    'glacial_spike',
    'frost_nova',
    'flash_freeze',
    'brittle_touch',
    'rimeguard',
    'rimeguard',
    'ice_barricade',
    'shield_bash',
    'aegis_ward',
    'grave_sentinel',
  ],
  opening: [
    ['rimeguard', 2, 1],
    ['rimeguard', 5, 1],
    ['scout_imp', 3, 0],
  ],
  weather: { kind: 'fog' },
  terrain: [
    { at: { x: 2, y: 4 }, kind: 'wall' },
    { at: { x: 5, y: 4 }, kind: 'wall' },
    { at: { x: 3, y: 2 }, kind: 'cover' },
    { at: { x: 4, y: 5 }, kind: 'cover' },
  ],
  turfwar: { count: 2, unitCardId: 'ridge_wolf' },
});

export const HUNT_SHELF_LYNX = hunt({
  encounterId: 'hunt_shelf_lynx',
  name: 'Storm Shelf: Storm Lynx',
  blurb:
    'It hunts along the sky-conduits, where the air is already angry. The Works want it ' +
    'gone; the shepherds want it left alone.',
  boundForm: 'voltara_bound',
  enemyDeck: [
    'static_arc',
    'static_arc',
    'arc_lash',
    'arcing_step',
    'static_charge',
    'voltaic_hound',
    'storm_rod',
    'shield_bash',
    'aegis_ward',
    'scout_imp',
    'grave_sentinel',
  ],
  opening: [
    ['voltaic_hound', 2, 1],
    ['storm_rod', 5, 1],
  ],
  weather: { kind: 'gale', wind: { x: 1, y: 0 } },
  terrain: [
    { at: { x: 3, y: 2 }, kind: 'wall' },
    { at: { x: 4, y: 5 }, kind: 'wall' },
    { at: { x: 1, y: 3 }, kind: 'cover' },
    { at: { x: 6, y: 4 }, kind: 'cover' },
  ],
});

export const HUNT_ASHWOOD_STAG = hunt({
  encounterId: 'hunt_ashwood_stag',
  name: 'Ashwood Dark: Carrion Stag',
  blurb:
    'The timber camps stopped cutting the eastern stand because of what walks it after dusk. ' +
    'The Magistracy would like the cutting to resume.',
  boundForm: 'mortis_bound',
  enemyDeck: [
    'shadow_siphon',
    'shadow_siphon',
    'marrow_siphon',
    'wither',
    'creeping_decay',
    'grave_call',
    'grave_sentinel',
    'hollowed_husk',
    'ash_ghoul',
    'shield_bash',
    'aegis_ward',
    'dark_tithe',
  ],
  opening: [
    ['grave_sentinel', 2, 1],
    ['hollowed_husk', 5, 1],
    ['ash_ghoul', 3, 0],
  ],
  weather: { kind: 'fog' },
  terrain: [
    { at: { x: 2, y: 3 }, kind: 'wall' },
    { at: { x: 5, y: 3 }, kind: 'wall' },
    { at: { x: 3, y: 5 }, kind: 'cover' },
    { at: { x: 4, y: 2 }, kind: 'cover' },
  ],
  geodes: { min: 2, max: 4 },
});

export const HUNT_ASHWOOD_WARDEN = hunt({
  encounterId: 'hunt_ashwood_warden',
  name: 'Ashwood Grove: Thorn Warden',
  blurb:
    'Something in the old grove has been turning the surveyors around in circles for a week. ' +
    'They have started leaving their stakes where they fall.',
  boundForm: 'sylva_bound',
  enemyDeck: [
    'spore_cloud',
    'root_snare',
    'root_snare',
    'thornlash',
    'verdant_swell',
    'creeping_briar',
    'briar_wolf',
    'shield_bash',
    'aegis_ward',
    'scout_imp',
  ],
  opening: [
    ['creeping_briar', 2, 1],
    ['briar_wolf', 5, 1],
  ],
  terrain: [
    { at: { x: 3, y: 3 }, kind: 'cover' },
    { at: { x: 4, y: 3 }, kind: 'cover' },
    { at: { x: 2, y: 5 }, kind: 'wall' },
    { at: { x: 5, y: 5 }, kind: 'wall' },
  ],
});

export const HUNT_CHALK_BOAR = hunt({
  encounterId: 'hunt_chalk_boar',
  name: 'Chalk Road: Vault Boar',
  blurb:
    'It has rooted out three toll posts and eaten the ledgers in two of them. The road ' +
    'wardens are past reasoning with it.',
  boundForm: 'ferrum_bound',
  enemyDeck: [
    'seismic_slam',
    'seismic_slam',
    'tectonic_plate',
    'petrifying_mantle',
    'bastion_stance',
    'shieldbearer',
    'shieldbearer',
    'siege_ox',
    'shield_bash',
    'aegis_ward',
    'stone_barricade',
  ],
  opening: [
    ['shieldbearer', 2, 1],
    ['shieldbearer', 5, 1],
    ['siege_ox', 3, 0],
  ],
  terrain: [
    { at: { x: 3, y: 4 }, kind: 'wall' },
    { at: { x: 4, y: 4 }, kind: 'wall' },
    { at: { x: 1, y: 2 }, kind: 'cover' },
    { at: { x: 6, y: 5 }, kind: 'cover' },
  ],
});

// ============================================================ the second bloodlines

export const HUNT_CINDERWORKS_SALAMANDER = hunt({
  encounterId: 'hunt_cinderworks_salamander',
  name: 'Cinderworks Roofs: Flue Salamander',
  blurb:
    'Something in the flues is putting the foundry’s draught out, one chimney at a time. ' +
    'The stokers have stopped going up alone.',
  boundForm: 'salamander_bound',
  enemyDeck: [
    'emberfall',
    'chimney_draw',
    'backdraft',
    'stoke',
    'flame_surge',
    'soot_sprite',
    'soot_sprite',
    'cinder_adder',
    'shield_bash',
    'aegis_ward',
    'scout_imp',
  ],
  opening: [
    ['soot_sprite', 2, 1],
    ['soot_sprite', 5, 1],
    ['cinder_adder', 3, 0],
  ],
  terrain: [
    { at: { x: 2, y: 2 }, kind: 'wall' },
    { at: { x: 5, y: 2 }, kind: 'wall' },
    { at: { x: 2, y: 5 }, kind: 'wall' },
    { at: { x: 5, y: 5 }, kind: 'wall' },
    { at: { x: 3, y: 3 }, kind: 'cover' },
  ],
});

export const HUNT_CHALK_CUT_RAM = hunt({
  encounterId: 'hunt_chalk_cut_ram',
  name: 'The Chalk Cut: Quarry Ram',
  blurb:
    'It comes down the cut at the same hour every morning and takes the shoring with it. ' +
    'The quarry has given up rebuilding before noon.',
  boundForm: 'ram_bound',
  enemyDeck: [
    'sinkhole',
    'counterweight',
    'crag_slam',
    'deadweight',
    'seismic_slam',
    // The Ram's own signature shove, out of its legacy Grimoire. It was the one splice base
    // no fight taught: Kinetic Arc is pressed from it, the bench gates on the *collection*,
    // and nothing put it there — so the pressing could be tested and never reached. A ram
    // that takes the shoring with it is exactly the thing that should be slamming bodies
    // into these walls.
    'avalanche_slam',
    'quarry_hand',
    'quarry_hand',
    'shieldbearer',
    'shield_bash',
    'aegis_ward',
  ],
  opening: [
    ['quarry_hand', 2, 1],
    ['quarry_hand', 5, 1],
  ],
  terrain: [
    { at: { x: 3, y: 2 }, kind: 'wall' },
    { at: { x: 4, y: 2 }, kind: 'wall' },
    { at: { x: 3, y: 5 }, kind: 'wall' },
    { at: { x: 4, y: 5 }, kind: 'wall' },
  ],
  geodes: { min: 3, max: 4 },
});

export const HUNT_SALTGLASS_SEAL = hunt({
  encounterId: 'hunt_saltglass_seal',
  name: 'Saltglass Harbor: Harbor Ghost',
  blurb:
    'The harbour has been closed by writ for two seasons and something has moved into it. ' +
    'The fishermen call it the ghost and will not say more.',
  boundForm: 'seal_bound',
  enemyDeck: [
    'cold_snap',
    'whiteout',
    'calving',
    'hoarfrost_veil',
    'flash_freeze',
    'hoarhound',
    'hoarhound',
    'rimeguard',
    'shield_bash',
    'aegis_ward',
    'grave_sentinel',
  ],
  opening: [
    ['hoarhound', 2, 1],
    ['hoarhound', 5, 1],
    ['rimeguard', 3, 0],
  ],
  weather: { kind: 'fog' },
  terrain: [
    { at: { x: 1, y: 3 }, kind: 'wall' },
    { at: { x: 6, y: 3 }, kind: 'wall' },
    { at: { x: 3, y: 4 }, kind: 'cover' },
    { at: { x: 4, y: 4 }, kind: 'cover' },
  ],
});

export const HUNT_TALLOW_AUROCHS = hunt({
  encounterId: 'hunt_tallow_aurochs',
  name: 'Tallow Levels: Fallow Warden',
  blurb:
    'It grazes the strips the tithe left fallow, which the rendering farms insist is theft. ' +
    'The strips have not been sown in three years.',
  boundForm: 'aurochs_bound',
  enemyDeck: [
    'pollen_drift',
    'blight_harvest',
    'blight_bloom',
    'noxious_cloud',
    'taproot',
    'sporeback_boar',
    'mire_toad',
    'creeping_briar',
    'shield_bash',
    'aegis_ward',
    'grave_sentinel',
  ],
  opening: [
    ['sporeback_boar', 2, 1],
    ['mire_toad', 5, 1],
    ['creeping_briar', 3, 0],
  ],
  weather: { kind: 'rain' },
  terrain: [
    { at: { x: 2, y: 3 }, kind: 'cover' },
    { at: { x: 5, y: 3 }, kind: 'cover' },
    { at: { x: 3, y: 5 }, kind: 'wall' },
    { at: { x: 4, y: 2 }, kind: 'wall' },
  ],
});

export const HUNT_PYLON_KITE = hunt({
  encounterId: 'hunt_pylon_kite',
  name: 'Pylon Twelve: Conduit Kudu',
  blurb:
    'It grazes in the shadow of the live crossarm, and the Works have written off three crews ' +
    'trying to move it. Something in its horns is drawing charge off the grid, and the grid is noticing.',
  boundForm: 'kite_bound',
  enemyDeck: [
    'induction',
    'capacitor_dump',
    'thunderhead',
    'elmos_fire',
    'tesla_pylon',
    'static_arc',
    'voltaic_hound',
    'voltaic_coil',
    'clockwork_bombardier',
    'shield_bash',
    'aegis_ward',
    'grave_sentinel',
  ],
  opening: [
    ['voltaic_hound', 2, 1],
    ['voltaic_coil', 5, 1],
    ['clockwork_bombardier', 3, 0],
  ],
  weather: { kind: 'gale', wind: { x: 0, y: 1 } },
  terrain: [
    { at: { x: 3, y: 3 }, kind: 'wall' },
    { at: { x: 4, y: 3 }, kind: 'wall' },
    { at: { x: 1, y: 5 }, kind: 'cover' },
    { at: { x: 6, y: 5 }, kind: 'cover' },
  ],
});

export const HUNT_BARROW_JACKAL = hunt({
  encounterId: 'hunt_barrow_jackal',
  name: 'Bastion Fringe: Barrow Jackal',
  blurb:
    'It digs on the unconsecrated side, where the ground is newest. The Census would ' +
    'prefer nobody watched it work.',
  boundForm: 'jackal_bound',
  enemyDeck: [
    'pall',
    'exhume',
    'last_rites',
    'creeping_decay',
    'charnel_pillar',
    'shadow_siphon',
    'carrion_crow',
    'carrion_crow',
    'hollow_wraith',
    'grave_sentinel',
    'shield_bash',
    'aegis_ward',
  ],
  opening: [
    ['grave_sentinel', 2, 1],
    ['hollow_wraith', 5, 1],
    ['carrion_crow', 3, 0],
  ],
  weather: { kind: 'fog' },
  terrain: [
    { at: { x: 2, y: 2 }, kind: 'cover' },
    { at: { x: 5, y: 5 }, kind: 'cover' },
    { at: { x: 2, y: 5 }, kind: 'wall' },
    { at: { x: 5, y: 2 }, kind: 'wall' },
  ],
  turfwar: { count: 2, unitCardId: 'marrow_hound' },
  geodes: { min: 2, max: 3 },
});
