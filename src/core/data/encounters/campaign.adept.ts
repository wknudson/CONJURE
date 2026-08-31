/**
 * The King's Contracts — the Adept fights of the Middle Ring (campaign, Wave 2).
 *
 * Seven countersigned jobs on the roads and farm towns, per
 * `docs/11_world_of_azo_and_the_kings_contracts.md` §4. The two Adept duels (the Poacher
 * and the Waystone) live in `campaign.duels.ts`.
 */

import type { EncounterDef, EncounterScript } from './registry.js';
import { registerEncounter, registerEncounterScript } from './registry.js';
import { SEAL_ONLY_SCRIPT } from './seal.js';

// These fights carry a `subjugationPrize` now, and a prize is inert without something to
// offer it: `beginSubjugation` is what deals the Rite, and an encounter opts in by calling
// it. The shared seal-only script fires at a quarter strength, so the treant, the tortoise and the heron can be
// bound instead of killed — which in each case is the reading the contract's own evidence
// supports, and the game never says so out loud.
registerEncounterScript('tallow_blight', SEAL_ONLY_SCRIPT);
registerEncounterScript('drowned_granary', SEAL_ONLY_SCRIPT);
registerEncounterScript('hollow_census', SEAL_ONLY_SCRIPT);
import type { Ctx } from '../../engine/context.js';
import { newCause } from '../../engine/context.js';
import { dealDamage } from '../../engine/damage.js';
import { unitsOf } from '../../engine/board.js';

/** Adept #2 — a treant tearing one dead-straight line above a buried pipe. */
export const TALLOW_BLIGHT: EncounterDef = registerEncounter({
  id: 'tallow_blight',
  name: 'Blight on the Tallow Levels',
  blurb:
    'A treant is tearing up the Hollis rendering farm’s north field, fence to fence in a ' +
    'dead straight line. The season will not wait for it to finish.',
  width: 7,
  height: 9,
  rosterBudget: 8,
  playerHp: 400,
  enemyHp: 400,
  playerName: 'Hero',
  companionName: 'Ignis',
  companionSchool: 'pyre',
  enemyName: 'The Ashwood Stray',
  enemySchool: 'bloom',
  enemyDeck: [
    'strangling_vines',
    'thornlash',
    'spore_burst',
    'sap_draught',
    'root_snare',
    'briar_rampart',
    'rot_root_snare',
  ],
  enemyOpeningBoard: [
    ['creeping_briar', 1, 1],
    ['creeping_briar', 5, 1],
    ['bramble_sentinel', 2, 0],
  ],
  // The treant itself: the Crimson Treant's bound body.
  enemyCompanion: { unitCardId: 'treant_bound' },
  // The torn field: a straight line of shatterable cover down the middle — the crack made
  // terrain. The line the treant tore sits directly over the Conduit Works' pipe.
  terrain: [
    { at: { x: 3, y: 2 }, kind: 'cover', hp: 60 },
    { at: { x: 3, y: 3 }, kind: 'cover', hp: 60 },
    { at: { x: 3, y: 4 }, kind: 'cover', hp: 60 },
    { at: { x: 3, y: 5 }, kind: 'cover', hp: 60 },
    { at: { x: 3, y: 6 }, kind: 'cover', hp: 60 },
    { at: { x: 1, y: 4 }, kind: 'wall' },
    { at: { x: 5, y: 4 }, kind: 'wall' },
  ],
  marrowGeodes: { min: 1, max: 2 },
  // The treant is tearing one straight line, directly above the buried pipe. Bind it and the
// line stops without the grove having to.
  subjugationPrize: 'treant',
});

/** Adept #3 — a riot that is fishermen trying to reach their own boats. */
export const SALTGLASS_RIOT: EncounterDef = registerEncounter({
  id: 'saltglass_riot',
  name: 'The Saltglass Riot',
  blurb:
    'The harbor crowd at Saltglass has stopped dispersing when told. The customs chain ' +
    'stays; the crowd does not. See to it.',
  width: 8,
  height: 8,
  rosterBudget: 10,
  playerHp: 400,
  enemyHp: 380,
  playerName: 'Hero',
  companionName: 'Ignis',
  companionSchool: 'pyre',
  enemyName: 'The Harbor Crowd',
  enemySchool: 'bulwark',
  // TODO(worldbuild): fishermen with driftwood pikes are stock bulwark bodies for now.
  enemyDeck: [
    'bastion_stance',
    'phalanx_step',
    'concussive_blow',
    'shield_bash',
    'shield_bash',
    'stone_barricade',
    'aegis_ward',
    'tremor_mark',
  ],
  enemyOpeningBoard: [
    ['shieldbearer', 1, 1],
    ['shieldbearer', 6, 1],
    ['scout_imp', 2, 0],
    ['siege_ox', 5, 0],
  ],
  // What came up the harbor steps with the crowd. Off the default lane: the siege ox
  // already stands in it.
  enemyCompanion: { unitCardId: 'crab_bound', at: { x: 4, y: 0 } },
  // The gale off the sea, blowing up the board into the crowd's faces.
  weather: { kind: 'gale', wind: { x: 0, y: 1 } },
  // Crates, bollards, and the customs house corner.
  terrain: [
    { at: { x: 2, y: 3 }, kind: 'cover' },
    { at: { x: 5, y: 3 }, kind: 'cover' },
    { at: { x: 3, y: 4 }, kind: 'wall' },
    { at: { x: 4, y: 4 }, kind: 'wall' },
    { at: { x: 6, y: 5 }, kind: 'cover' },
    { at: { x: 1, y: 5 }, kind: 'cover' },
  ],
  scavenger: true,
});

/**
 * The Warrant's stone-throwers: the family, off-board, behind the fences.
 *
 * Every enemy turn, the player's most advanced unit takes a small physical hit. It cannot
 * kill — the stones stop at 1 HP — because the family are not killers; they are furious,
 * and the pressure they add is the point: standing in the yard costs, so the player is
 * always paying rent on the ground the warrant told them to take.
 */
const STONES_FROM_THE_FENCES = 10;
const warrantScript: EncounterScript = {
  onTurnStart(ctx: Ctx, side): void {
    if (side !== 'enemy') return;
    const units = unitsOf(ctx.state, 'player');
    if (units.length === 0) return;
    // The most advanced body — smallest anchor y is deepest into the yard.
    const target = units.reduce((a, b) => (b.anchor.y < a.anchor.y ? b : a));
    if (target.hp <= STONES_FROM_THE_FENCES) return; // stones bruise, they do not finish
    newCause(ctx);
    dealDamage(ctx, {
      target: { kind: 'unit', id: target.id },
      amount: STONES_FROM_THE_FENCES,
      dtype: 'physical',
      cause: 'impact',
    });
  },
};
registerEncounterScript('warrant_of_distraint', warrantScript);

/** Adept #4 — a family's tamed boar, and license fees priced to be unkeepable. */
export const WARRANT_OF_DISTRAINT: EncounterDef = registerEncounter({
  id: 'warrant_of_distraint',
  name: 'Warrant of Distraint: Bray’s Hollow',
  blurb:
    'Unlicensed livestock at the Marsh farmstead, Bray’s Hollow. Seize per the schedule ' +
    'attached. The fees are in the warrant; the arithmetic is not your concern.',
  width: 7,
  height: 8,
  rosterBudget: 6,
  playerHp: 400,
  enemyHp: 360,
  playerName: 'Hero',
  companionName: 'Ignis',
  companionSchool: 'pyre',
  enemyName: 'The Marsh Farmstead',
  enemySchool: 'bulwark',
  enemyDeck: [
    'shield_bash',
    'concussive_blow',
    'stone_barricade',
    'stone_barricade',
    'aegis_ward',
    'tremor_mark',
    'bastion_stance',
  ],
  // The farm's working beasts, holding the yard with the boar.
  enemyOpeningBoard: [
    ['sporeback_boar', 1, 1],
    ['scout_imp', 5, 1],
  ],
  // The boar the warrant names: a tamed vault boar, fighting for its family.
  enemyCompanion: { unitCardId: 'ferrum_bound' },
  // The yard: fence lines with two gates, and the well.
  terrain: [
    { at: { x: 0, y: 3 }, kind: 'wall' },
    { at: { x: 1, y: 3 }, kind: 'wall' },
    { at: { x: 3, y: 3 }, kind: 'wall' },
    { at: { x: 5, y: 3 }, kind: 'wall' },
    { at: { x: 6, y: 3 }, kind: 'wall' },
    { at: { x: 3, y: 5 }, kind: 'cover' },
  ],
  script: warrantScript,
});

/** Adept #5 — a sealed wagon marked MEDICAL that ticks. */
export const NIGHT_FREIGHT: EncounterDef = registerEncounter({
  id: 'night_freight',
  name: 'The Night Freight',
  blurb:
    'A sealed wagon runs Fenwick’s Crossing to Jolrek tonight and wants a blade beside ' +
    'it. Do not open the crates. Do not answer questions about the crates.',
  width: 6,
  height: 9,
  rosterBudget: 8,
  playerHp: 400,
  enemyHp: 380,
  playerName: 'Hero',
  companionName: 'Ignis',
  companionSchool: 'pyre',
  enemyName: 'Masked Whisperers',
  enemySchool: 'dusk',
  // TODO(worldbuild): the doc's win condition — they win by destroying the wagon — needs
  // an engine-level objective. Rough pass: a straight fight around the wagon, which is
  // the barricade prop below and merely scenery.
  enemyDeck: [
    'smoke_bomb',
    'shadow_siphon',
    'wither',
    'grapple_line',
    'dark_tithe',
    'soul_splinter_mark',
    'aether_beam',
  ],
  enemyOpeningBoard: [
    ['hollow_wraith', 1, 1],
    ['ash_ghoul', 4, 1],
    ['hollowed_husk', 2, 0],
  ],
  enemyCompanion: { unitCardId: 'umbra_bound' },
  // The wagon, mid-road, with the verge either side.
  props: [{ at: { x: 3, y: 5 }, defId: 'alchemists_barricade' }],
  terrain: [
    { at: { x: 0, y: 4 }, kind: 'cover' },
    { at: { x: 5, y: 4 }, kind: 'cover' },
    { at: { x: 2, y: 3 }, kind: 'cover' },
  ],
});

/** Adept #7 — branded hounds under the coach inn, and one licensed pit. */
export const CELLAR_CLEARANCE: EncounterDef = registerEncounter({
  id: 'cellar_clearance',
  name: 'Cellar Clearance, Fenwick’s Crossing',
  blurb:
    'Feral hounds under the coach inn, and the cellar full of last season’s spirit. ' +
    'Clear it without burning the Crossing down, if convenient.',
  width: 6,
  height: 6,
  rosterBudget: 8,
  playerHp: 400,
  enemyHp: 320,
  playerName: 'Hero',
  companionName: 'Ignis',
  companionSchool: 'pyre',
  enemyName: 'The Pit Stock',
  enemySchool: 'pyre',
  enemyDeck: ['stoke', 'cinder_gale', 'cinder_mark', 'shield_bash', 'aegis_ward'],
  enemyOpeningBoard: [
    ['ember_hound', 1, 1],
    ['ember_hound', 4, 1],
    ['ember_moth', 2, 0],
  ],
  // What lives in the inn's flue, and what the pit stock answer to.
  enemyCompanion: { unitCardId: 'salamander_bound' },
  // The fire hazards the blurb is nervous about: two casks of spirit, mid-cellar. A
  // volatile cask is an obstacle whose behaviour lives on its card, per `props`.
  props: [
    { at: { x: 2, y: 2 }, defId: 'volatile_cask' },
    { at: { x: 4, y: 3 }, defId: 'volatile_cask' },
  ],
  terrain: [
    { at: { x: 1, y: 2 }, kind: 'wall' },
    { at: { x: 3, y: 3 }, kind: 'wall' },
  ],
});

/** Adept #8 — a village that stopped answering, and a page marked RELOCATED. */
export const HOLLOW_CENSUS: EncounterDef = registerEncounter({
  id: 'hollow_census',
  name: 'The Hollow Census',
  blurb:
    'Weeping Stile has missed two counts. Escort the Census through, room by room, and ' +
    'let the clerk write what the clerk writes.',
  width: 7,
  height: 8,
  rosterBudget: 8,
  playerHp: 400,
  enemyHp: 340,
  playerName: 'Hero',
  companionName: 'Ignis',
  companionSchool: 'pyre',
  enemyName: 'What Was Left Behind',
  enemySchool: 'dusk',
  // What holds the village now. Not the watch-beasts — those are the turfwar hounds
  // below, loose in the lanes and loyal to nobody, which is what Feral means and why
  // they cannot also be the enemy's army: a first cut fielded ridge wolves on this line
  // and the balance harness caught the result, a side with no soldiers stalling every
  // playout at the turn cap. The bodies that fight back are what the fog kept.
  enemyDeck: ['wither', 'creeping_decay', 'shadow_siphon', 'dark_tithe', 'shield_bash', 'aegis_ward'],
  enemyOpeningBoard: [
    ['hollow_wraith', 1, 1],
    ['ash_ghoul', 5, 1],
    ['hollowed_husk', 2, 0],
  ],
  weather: { kind: 'fog' },
  // More of them, loose in the lanes, mauling whoever comes near — either side.
  turfwar: { count: 2, unitCardId: 'marrow_hound' },
  // The Fen Reaper, standing in the flooded lane the village used for a street. It was
  // here before the Census was, and it is the only thing in Weeping Stile that stayed.
  enemyCompanion: { unitCardId: 'heron_bound' },
  subjugationPrize: 'heron',
  // Empty houses: walls with gaps, a village fought door to door.
  terrain: [
    { at: { x: 1, y: 3 }, kind: 'wall' },
    { at: { x: 2, y: 3 }, kind: 'wall' },
    { at: { x: 4, y: 3 }, kind: 'wall' },
    { at: { x: 5, y: 4 }, kind: 'wall' },
    { at: { x: 2, y: 5 }, kind: 'cover' },
    { at: { x: 4, y: 5 }, kind: 'cover' },
  ],
});

/** Adept #9 — currents, a tortoise holding the channel, and gates chained open. */
export const DROWNED_GRANARY: EncounterDef = registerEncounter({
  id: 'drowned_granary',
  name: 'The Drowned Granary',
  blurb:
    'Something enormous has dammed Millharrow’s sluice and the mill pond is climbing the ' +
    'granary steps. Kill it before the commons’ grain goes under.',
  width: 6,
  height: 9,
  rosterBudget: 6,
  playerHp: 400,
  enemyHp: 420,
  playerName: 'Hero',
  companionName: 'Ignis',
  companionSchool: 'pyre',
  enemyName: 'The Dam',
  enemySchool: 'bulwark',
  enemyDeck: [
    'bastion_stance',
    'crag_slam',
    'concussive_blow',
    'stone_barricade',
    'aegis_ward',
    'tremor_mark',
  ],
  enemyOpeningBoard: [
    ['rime_fox', 1, 1],
    ['sap_wisp', 4, 1],
  ],
  // The tortoise, mid-channel, exactly where the doc puts it: the only thing between the
  // water and the grain.
  enemyCompanion: { unitCardId: 'tortoise_bound', at: { x: 3, y: 4 } },
  // The channel: two lanes of water that carry whatever stands in them downstream, one
  // step a round, toward the player's end. The tortoise blocks the east lane.
  currents: [
    { at: { x: 2, y: 2 }, dir: { x: 0, y: 1 } },
    { at: { x: 2, y: 3 }, dir: { x: 0, y: 1 } },
    { at: { x: 2, y: 4 }, dir: { x: 0, y: 1 } },
    { at: { x: 2, y: 5 }, dir: { x: 0, y: 1 } },
    { at: { x: 2, y: 6 }, dir: { x: 0, y: 1 } },
    { at: { x: 3, y: 2 }, dir: { x: 0, y: 1 } },
    { at: { x: 3, y: 3 }, dir: { x: 0, y: 1 } },
    { at: { x: 3, y: 5 }, dir: { x: 0, y: 1 } },
    { at: { x: 3, y: 6 }, dir: { x: 0, y: 1 } },
  ],
  // The banks.
  terrain: [
    { at: { x: 0, y: 3 }, kind: 'cover' },
    { at: { x: 5, y: 3 }, kind: 'cover' },
    { at: { x: 0, y: 5 }, kind: 'wall' },
    { at: { x: 5, y: 5 }, kind: 'wall' },
  ],
  // The tortoise is the only thing keeping the commons' grain dry. Bound, it stops being in
// the sluice and starts being yours — the one ending where the flood does not come.
  subjugationPrize: 'tortoise',
});
