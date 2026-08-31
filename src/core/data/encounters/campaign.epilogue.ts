/**
 * The epilogue — "The Quiet Below" (four contracts, after the Summons).
 *
 * The Colossus fell; the floor is still warm. The arc's premise, assembled from clues
 * the campaign already planted (the veteran who heard the floor eating, Coldwater's
 * "ask the floor what it eats", Pylon Nine's grid running to the undercroft, the 61
 * souls, the manifest with no return trips): **the machine never needed Vane. It only
 * needed his silence — and above him, the King's.** The King stays unseen, per the
 * standing rule; what the arc establishes is that he never signed, never came down,
 * never countermanded.
 *
 * Register shift: E1's poster still speaks in the regime's voice, because the regime's
 * voice turns out to be a machine no one alive is speaking through — the last lie.
 * From E2 the posters are Vex's plain hand, and the cracks stop being discoveries about
 * the world and start being discoveries about how deep it goes.
 *
 * These gate on the finale by position alone: appended after `the_summons` in
 * `STORY_CONTRACTS`, they are simply the next uncompleted master contracts, one at a
 * time, in order. Master pay throughout — the story changes what the work is, not what
 * work is worth.
 */

import type { EncounterDef, EncounterScript } from './registry.js';
import { registerEncounter, registerEncounterScript } from './registry.js';
import { newCause } from '../../engine/context.js';
import { summonUnit } from '../../engine/spawn.js';
import { canPlace } from '../../engine/board.js';
import { SEAL_ONLY_SCRIPT, sealAt25 } from './seal.js';
import { growAtHalfScript } from './bossPhases.js';

/* ================================================================================== *
 * E1 — Dead Letters: the dispatch line, kept by nobody
 * ================================================================================== */

registerEncounterScript('dead_letters', SEAL_ONLY_SCRIPT);

export const DEAD_LETTERS: EncounterDef = registerEncounter({
  id: 'dead_letters',
  name: 'Dead Letters',
  blurb:
    'Interference on the Dispatch line, Highcourt service quarter. Clear it; normal ' +
    'service will resume. Sealed in the standard wax, posted in the standard hand.',
  width: 7,
  height: 8,
  rosterBudget: 12,
  playerHp: 400,
  enemyHp: 440,
  playerName: 'Hero',
  companionName: 'Ignis',
  companionSchool: 'pyre',
  enemyName: 'The Standing Orders',
  enemySchool: 'bulwark',
  // written_path — an aura literally about paper — is the signature.
  enemyDeck: [
    'shield_bash',
    'shield_bash',
    'bastion_stance',
    'phalanx_step',
    'iron_gate',
    'stone_barricade',
    'written_path',
    'tremor_mark',
    'concussive_blow',
    'aegis_ward',
  ],
  enemyOpeningBoard: [
    ['anvil_lord', 3, 1],
    ['shieldbearer', 1, 1],
    ['shieldbearer', 5, 1],
    ['vanguard_footman', 2, 0],
  ],
  // The Registry's own bird, still carrying orders nobody sends. A second Ink Owl,
  // deliberately — the office had more than one, and the fiction ledger knows it.
  enemyCompanion: { unitCardId: 'lexis_bound' },
  // The service colonnade.
  terrain: [
    { at: { x: 1, y: 3 }, kind: 'wall' },
    { at: { x: 5, y: 3 }, kind: 'wall' },
    { at: { x: 3, y: 4 }, kind: 'cover' },
    { at: { x: 2, y: 2 }, kind: 'cover' },
  ],
  // No prize: the seal stays so the mercy ending — bind, don't kill — remains available,
  // and pays as a win.
  script: SEAL_ONLY_SCRIPT,
});

/* ================================================================================== *
 * E2 — The Undercroft Census: the count keeps rising
 * ================================================================================== */

const CENSUS_ARRIVALS: [number, number][] = [
  [1, 1],
  [5, 1],
  [2, 0],
];

const censusScript: EncounterScript = {
  onTurnStart(ctx, side) {
    if (side !== 'enemy') return;
    // Every third turn the count rises: another husk stands up from the rolls.
    if (ctx.state.turn % 3 === 0) {
      newCause(ctx);
      for (const [x, y] of CENSUS_ARRIVALS) {
        if (canPlace(ctx.state, { x, y }, 1)) {
          summonUnit(ctx, 'hollowed_husk', 'enemy', { x, y });
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
registerEncounterScript('undercroft_census', censusScript);

export const UNDERCROFT_CENSUS: EncounterDef = registerEncounter({
  id: 'undercroft_census',
  name: 'The Undercroft Census',
  blurb:
    'Not the Crown’s paper. Vex’s own hand: the undercroft is still warm, and the ' +
    'Census owes Weeping Stile a count. Take the clerk down the stair and let her ' +
    'write what is true, for once, room by room.',
  // A descent: long and narrow.
  width: 7,
  height: 9,
  rosterBudget: 10,
  playerHp: 400,
  enemyHp: 460,
  playerName: 'Hero',
  companionName: 'Ignis',
  companionSchool: 'pyre',
  enemyName: 'What the Floor Kept',
  enemySchool: 'dusk',
  // The grave-work half: exhume and last rites is the Census's job description down here.
  enemyDeck: [
    'wither',
    'creeping_decay',
    'pall',
    'exhume',
    'last_rites',
    'charnel_pillar',
    'shadow_siphon',
    'dark_tithe',
    'soul_splinter_mark',
    'aegis_ward',
  ],
  enemyOpeningBoard: [
    ['hollow_wraith', 1, 1],
    ['hollowed_husk', 5, 1],
    ['ash_ghoul', 2, 0],
    ['marrow_wisp', 4, 0],
  ],
  // A Cinder Shade: what is left of a lamplighter who kept going back — which is what
  // the undercroft makes of people.
  enemyCompanion: { unitCardId: 'shade_bound' },
  // Pipe galleries.
  terrain: [
    { at: { x: 3, y: 3 }, kind: 'wall' },
    { at: { x: 3, y: 4 }, kind: 'wall' },
    { at: { x: 1, y: 5 }, kind: 'wall' },
    { at: { x: 5, y: 5 }, kind: 'wall' },
    { at: { x: 2, y: 2 }, kind: 'cover' },
    { at: { x: 4, y: 6 }, kind: 'cover' },
  ],
  // The floor's hoard — and the crack says what the geodes are.
  marrowGeodes: { min: 4, max: 6 },
  // No prize: what the floor kept is released, not pocketed.
  script: censusScript,
});

/* ================================================================================== *
 * E3 — The King's Duelist: Underhill — the last post, held on a dead order
 * ================================================================================== */

registerEncounterScript('underhill_duel', SEAL_ONLY_SCRIPT);

export const UNDERHILL_DUEL: EncounterDef = registerEncounter({
  id: 'underhill_duel',
  name: 'The King’s Duelist: Underhill',
  blurb:
    'The last of the King’s Duelists holds the Spire doors, because his standing orders ' +
    'say the doors are held and nobody who could countermand them is left above ground. ' +
    'He has asked for you by name. It is not an honor this time. It is a question.',
  width: 8,
  height: 8,
  playerHp: 400,
  // Above Coldwater's 460: the ladder's true last rung.
  enemyHp: 470,
  playerName: 'Hero',
  companionName: 'Ignis',
  companionSchool: 'pyre',
  enemyName: 'Underhill',
  enemySchool: 'bulwark',
  // A duelist's Hero-legal kit, per the campaign.duels convention.
  enemyDeck: [
    'shield_bash',
    'shield_bash',
    'aegis_ward',
    'aegis_ward',
    'grapple_line',
    'aether_beam',
    'arc_lash',
    'concussive_blow',
    'stone_barricade',
    'tremor_mark',
    'arc_mark',
  ],
  enemyOpeningBoard: [
    ['grave_sentinel', 2, 1],
    ['grave_sentinel', 4, 1],
    ['storm_rod', 3, 0],
    // The arena pass: an 8x8 seats sixteen points, and the last post is manned like a
    // post -- a guard line, and the emplacements a King's coat still rates.
    ['shieldbearer', 0, 1],
    ['shieldbearer', 6, 1],
    ['voltaic_coil', 1, 0],
    ['storm_rod', 7, 0],
  ],
  // The stock duelist shadow, deliberately: the undercroft took his beast years ago,
  // and what casts beside him now is what it gave back.
  enemyCompanion: { unitCardId: 'umbra_bound' },
  // The last two bollards before the doors.
  terrain: [
    { at: { x: 3, y: 3 }, kind: 'wall' },
    { at: { x: 4, y: 4 }, kind: 'wall' },
  ],
  // No prize — he stakes the purse and the way down; the crest is paper now. The seal
  // stays so mercy can end the duel without killing the man.
  script: SEAL_ONLY_SCRIPT,
});

/* ================================================================================== *
 * E4 — The Quiet Below: the working engine, one floor down
 * ================================================================================== */

/** Where the eaten keep arriving. Deliberately the relocation train's wave unit. */
const BELOW_ARRIVALS: [number, number][] = [
  [1, 1],
  [6, 1],
  [3, 0],
];

// The finale's machinery, one floor down: phase 1 is the engine's own curdled residue,
// and at half strength the floor opens onto the working twin of the throne room's show
// model. The wisp-arrivals ride on top of the shared builder's turn hook.
const belowBase = growAtHalfScript({
  phaseName: 'The Working Engine',
  grownDefId: 'colossus_bound',
  addDefId: 'grave_sentinel',
  addSpawns: [
    [2, 1],
    [5, 1],
    [3, 0],
  ],
  forcedEviction: false,
});

const belowScript: EncounterScript = {
  onDamageToCommander: belowBase.onDamageToCommander?.bind(belowBase),
  onCommanderHpChanged: belowBase.onCommanderHpChanged?.bind(belowBase),
  onTurnStart(ctx, side) {
    if (side === 'enemy' && ctx.state.turn % 2 === 0) {
      newCause(ctx);
      for (const [x, y] of BELOW_ARRIVALS) {
        if (canPlace(ctx.state, { x, y }, 1)) {
          summonUnit(ctx, 'marrow_wisp', 'enemy', { x, y });
          break;
        }
      }
    }
    belowBase.onTurnStart?.(ctx, side);
  },
};
registerEncounterScript('the_quiet_below', belowScript);

export const THE_QUIET_BELOW: EncounterDef = registerEncounter({
  id: 'the_quiet_below',
  name: 'The Quiet Below',
  blurb:
    'Below the throne room is the working engine — the one the Colossus was only ever ' +
    'the mouth of — still drawing on every pact in Azo, yours included, one quiet ' +
    'degree at a time. Go down and put it out. There is no fee.',
  width: 8,
  height: 8,
  rosterBudget: 10,
  playerHp: 400,
  // The finale's cap. The epilogue meets it, never exceeds it.
  enemyHp: 500,
  playerName: 'Hero',
  companionName: 'Ignis',
  companionSchool: 'pyre',
  enemyName: 'What the Floor Ate',
  enemySchool: 'dusk',
  // Surge/dusk, cascade-heavy — Vane learned it from the floor, not the other way round.
  enemyDeck: [
    'discharge',
    'chain_bolt',
    'paralytic_arc',
    'wither',
    'shadow_siphon',
    'dark_tithe',
    'cull_the_weak',
    'harvest_the_weak',
    'soul_splinter_mark',
    'arc_mark',
    'aegis_ward',
    'aegis_ward',
  ],
  enemyOpeningBoard: [
    ['galvanic_revenant', 2, 1],
    ['hollow_wraith', 5, 1],
    ['storm_wisp', 3, 0],
    ['grave_sentinel', 5, 0],
  ],
  // Phase 1: the engine's front is its own curdled waste — the Pylon Nine image,
  // brought home.
  enemyCompanion: { unitCardId: 'geist_bound' },
  // The throne room's colonnade, mirrored: the same room, upside down.
  terrain: [
    { at: { x: 1, y: 2 }, kind: 'wall' },
    { at: { x: 6, y: 2 }, kind: 'wall' },
    { at: { x: 1, y: 5 }, kind: 'wall' },
    { at: { x: 6, y: 5 }, kind: 'wall' },
    { at: { x: 3, y: 4 }, kind: 'cover' },
    { at: { x: 4, y: 3 }, kind: 'cover' },
  ],
  // The finale's throne was clean; the undercroft is the hoard, and the arena is the
  // motive one last time — bookending the Chimera.
  marrowGeodes: { min: 5, max: 7 },
  // Prizeless by design: you don't pocket the ending, and neither of the endings is
  // pocketable. (Recorded alternative if a prize is ever wanted: 'geist', as a second
  // route — the undercroft is canonically where geists curdle — but a pinnacle paying a
  // duplicate of Pylon Nine reads as a lesser echo.)
  script: belowScript,
});
