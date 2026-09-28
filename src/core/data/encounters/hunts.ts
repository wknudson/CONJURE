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
    // The Drake's own three: a hunt is where a species teaches its signatures.
    'drakes_brand',
    'ember_cascade',
    'drakes_roar',
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
    // Frost's ranged body, so the Bear can teach it: a hunt in the cold is where a Boreas
    // earns the archer for their own line.
    'rime_archer',
    'ice_barricade',
    'shield_bash',
    'aegis_ward',
    'grave_sentinel',
    // The Bear's own three: a hunt is where a species teaches its signatures.
    'glacial_maul',
    'numbing_roar',
    'den_of_ice',
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
    // The Lynx's own three: a hunt is where a species teaches its signatures.
    'storm_pounce',
    'static_bristle',
    'crackle_chase',
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
    // The Stag's own three: a hunt is where a species teaches its signatures.
    'carrion_feast',
    'soul_toll',
    'offering',
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
    // Bloom's mortar, taught by the grove that shells surveyors from behind its cover.
    'thorn_lobber',
    'shield_bash',
    'aegis_ward',
    'scout_imp',
    // The Warden's own three: a hunt is where a species teaches its signatures.
    'rootbind',
    'warden_tree',
    'bramble_lash',
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
    // Bulwark's Behemoth, taught by the one Bulwark hunt: the Boar's wardens field a wall
    // of their own, and beating it is how a Ferrum earns one.
    'bastion_golem',
    'shield_bash',
    'aegis_ward',
    'stone_barricade',
    // The Boar's own three: a hunt is where a species teaches its signatures.
    'vault_door',
    'boar_charge',
    'tusk_toss',
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
    // The Salamander's own three: a hunt is where a species teaches its signatures.
    'smoulder',
    'ductwork_drag',
    'backburn',
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
    // The Ram's own three: a hunt is where a species teaches its signatures.
    'ground_breaker',
    'headbutt',
    'rockslide_run',
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
    // The Seal's own three: a hunt is where a species teaches its signatures.
    'sea_fog',
    'tidal_floe',
    'icebreaker_dive',
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
    // The Aurochs' own three: a hunt is where a species teaches its signatures.
    'fallow_cloud',
    'moss_stampede',
    'ruminate',
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

export const HUNT_PYLON_KUDU = hunt({
  encounterId: 'hunt_pylon_kudu',
  name: 'Pylon Twelve: Conduit Kudu',
  blurb:
    'It grazes in the shadow of the live crossarm, and the Works have written off three crews ' +
    'trying to move it. Something in its horns is drawing charge off the grid, and the grid is noticing.',
  boundForm: 'kudu_bound',
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
    // The Kudu's own three: a hunt is where a species teaches its signatures.
    'lightning_draw',
    'static_field',
    'storm_spire',
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
    // The Jackal's own three: a hunt is where a species teaches its signatures.
    'shallow_grave',
    'rot_bite',
    'barrow_howl',
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

// ============================================================== the third bloodlines
//
// Each hunt fields its handlers out of the school's newest bodies where it can, so the third
// muster meets the balance harness the day it has a fight to be in, and each deck carries the
// species' three signatures, which is how a player first owns one.

export const HUNT_CALDERA_PHOENIX = hunt({
  encounterId: 'hunt_caldera_phoenix',
  name: 'Caldera Rim: Ashwing Phoenix',
  blurb:
    'It nests on the lip of the caldera and burns its own nest down every spring. The tap ' +
    'crews have learned to stop counting how many times they have killed it.',
  boundForm: 'phoenix_bound',
  enemyDeck: [
    'flame_surge',
    'flame_surge',
    'immolate',
    'kindling',
    'wildfire',
    'flame_archer',
    'shield_bash',
    'aegis_ward',
    // The Phoenix's own three.
    'ash_rebirth',
    'phoenix_dive',
    'wingbeat_embers',
  ],
  opening: [
    ['flame_archer', 2, 1],
    ['kiln_guard', 5, 1],
    ['cinder_lobber', 6, 0],
  ],
  terrain: [
    { at: { x: 2, y: 3 }, kind: 'wall' },
    { at: { x: 5, y: 4 }, kind: 'wall' },
    { at: { x: 3, y: 5 }, kind: 'cover' },
    { at: { x: 4, y: 2 }, kind: 'cover' },
  ],
  geodes: { min: 2, max: 3 },
});

export const HUNT_CINDERWORKS_BADGER = hunt({
  encounterId: 'hunt_cinderworks_badger',
  name: 'Slag Heaps: Cinderback Badger',
  blurb:
    'Something has dug a sett into the slag and is keeping the heap warm. The stokers want it ' +
    'gone before it undermines the tip.',
  boundForm: 'badger_bound',
  enemyDeck: [
    'fire_breath',
    'fire_breath',
    'scorch',
    'stoke',
    'brazier',
    'kiln_guard',
    'shield_bash',
    'aegis_ward',
    // The Badger's own three.
    'burrow_strike',
    'smoke_sett',
    'cinderback_bristle',
  ],
  opening: [
    ['salamander_whelp', 1, 1],
    ['kiln_guard', 5, 1],
    ['cinder_adder', 3, 0],
  ],
  terrain: [
    { at: { x: 1, y: 3 }, kind: 'wall' },
    { at: { x: 6, y: 3 }, kind: 'wall' },
    { at: { x: 3, y: 4 }, kind: 'cover' },
    { at: { x: 4, y: 4 }, kind: 'cover' },
  ],
});

export const HUNT_RIMEFIELD_MAMMOTH = hunt({
  encounterId: 'hunt_rimefield_mammoth',
  name: 'Glacier Foot: Hoarfrost Mammoth',
  blurb:
    'It came down off the ice and is walking the pass road one step a day. The road will not ' +
    'survive the walk, and neither will the toll-house at the bottom.',
  boundForm: 'mammoth_bound',
  enemyDeck: [
    'glacial_spike',
    'glacial_spike',
    'frost_nova',
    'icicle_rain',
    'ice_barricade',
    'permafrost_troll',
    'shield_bash',
    'aegis_ward',
    // The Mammoth's own three.
    'mammoth_trample',
    'permafrost_stomp',
    'woolly_hide',
  ],
  opening: [
    ['permafrost_troll', 3, 1],
    ['rimeguard', 1, 1],
    ['frost_ballista', 5, 0],
  ],
  weather: { kind: 'fog' },
  terrain: [
    { at: { x: 2, y: 4 }, kind: 'wall' },
    { at: { x: 5, y: 4 }, kind: 'wall' },
    { at: { x: 3, y: 3 }, kind: 'cover' },
  ],
  turfwar: { count: 1, unitCardId: 'ridge_wolf' },
});

export const HUNT_RIMEFIELD_ERMINE = hunt({
  encounterId: 'hunt_rimefield_ermine',
  name: 'Snowline: Rime Ermine',
  blurb:
    'The trappers keep finding their snares sprung and nothing in them. It is white, it is ' +
    'small, and it has been laughing at them all winter.',
  boundForm: 'ermine_bound',
  enemyDeck: [
    'cold_snap',
    'cold_snap',
    'frostbite',
    'creeping_rime',
    'sleet',
    'rime_fox',
    'shield_bash',
    'aegis_ward',
    // The Ermine's own three.
    'ermine_bite',
    'white_dash',
    'frozen_ambush',
  ],
  opening: [
    ['frost_wisp', 2, 1],
    ['rime_fox', 5, 1],
    ['rime_archer', 3, 0],
  ],
  weather: { kind: 'fog' },
  terrain: [
    { at: { x: 1, y: 4 }, kind: 'cover' },
    { at: { x: 6, y: 3 }, kind: 'cover' },
    { at: { x: 3, y: 4 }, kind: 'wall' },
  ],
});

export const HUNT_SALTGLASS_EEL = hunt({
  encounterId: 'hunt_saltglass_eel',
  name: 'Saltglass Canals: Galvanic Eel',
  blurb:
    'The lock-keepers stopped putting their hands in the water the week the grid first leaked ' +
    'into it. Something down there has been eating well ever since.',
  boundForm: 'eel_bound',
  enemyDeck: [
    'static_arc',
    'static_arc',
    'discharge',
    'spark',
    'chain_bolt',
    'spark_imp',
    'shield_bash',
    'aegis_ward',
    // The Eel's own three.
    'eel_coil',
    'canal_current',
    'eel_jolt',
  ],
  opening: [
    ['static_hare', 2, 1],
    ['voltaic_coil', 5, 1],
    ['coil_lancer', 3, 0],
  ],
  // No rain. Rain adds ten to every shock hit, and an eel in the rain ended playouts in four
  // turns at an Adept tier whose other hunts run to twenty.
  weather: { kind: 'fog' },
  terrain: [
    { at: { x: 2, y: 3 }, kind: 'cover' },
    { at: { x: 5, y: 4 }, kind: 'cover' },
    { at: { x: 3, y: 5 }, kind: 'wall' },
  ],
});

export const HUNT_SHELF_PANGOLIN = hunt({
  encounterId: 'hunt_shelf_pangolin',
  name: 'Storm Shelf: Sparkback Pangolin',
  blurb:
    'It rolls down the conduit gullies in a ball of sparks and uncurls wherever it stops. The ' +
    'shepherds have started calling it the Works inspector.',
  boundForm: 'pangolin_bound',
  enemyDeck: [
    'thunderclap',
    'spark',
    'spark',
    'induction',
    'static_insight',
    'voltaic_hound',
    'shield_bash',
    'aegis_ward',
    // The Pangolin's own three.
    'ball_roll',
    'scale_shed',
    'static_curl',
  ],
  opening: [
    ['voltaic_hound', 2, 1],
    ['static_hare', 5, 1],
    ['clockwork_bombardier', 3, 0],
  ],
  weather: { kind: 'gale', wind: { x: 1, y: 0 } },
  terrain: [
    { at: { x: 2, y: 4 }, kind: 'wall' },
    { at: { x: 5, y: 3 }, kind: 'wall' },
    { at: { x: 4, y: 5 }, kind: 'cover' },
  ],
});
