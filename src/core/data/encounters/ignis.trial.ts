/**
 * The Ignis Subjugation Trial.
 *
 * Two scripted thresholds:
 *  - 50%: a Damage Gate clamps HP to exactly half, nullifies the remainder of the current
 *    resolution chain, purges debuffs, and grows the drake into its enraged form with
 *    Forced Eviction. The machinery lives in `bossPhases.ts`; this file names the knobs.
 *  - 25%: a free Rite of Binding card is injected. Playing it binds Ignis and wins the
 *    trial. If the hand is full it attaches as an Ephemeral overlay that sits outside the
 *    hand limit and cannot be discarded.
 */

import type { EncounterDef } from './registry.js';
import { registerEncounter, registerEncounterScript } from './registry.js';
import { growAtHalfScript } from './bossPhases.js';

const ENCOUNTER_ID = 'ignis_trial';

const script = growAtHalfScript({
  phaseName: 'Ignis Enraged',
  // The drake grows into its full shape. The enraged form is the enrage: it hits harder,
  // it is slower, and at 2x2 it blocks sight through itself, so the arena's lanes are
  // redrawn by the transformation alone.
  grownDefId: 'ignis_behemoth_bound',
  addDefId: 'grave_sentinel',
  // Where the phase-2 Ember Guard tries to appear.
  addSpawns: [
    [1, 1],
    [3, 1],
    [2, 0],
  ],
  // A wild thing growing does not ask: player bodies in the way return to hand.
  forcedEviction: true,
});

registerEncounterScript(ENCOUNTER_ID, script);

export const IGNIS_TRIAL: EncounterDef = registerEncounter({
  id: ENCOUNTER_ID,
  name: 'Subjugation Trial: Ignis',
  blurb:
    'A wild Pyre salamander. Break it to half strength to enrage it, then wear it down — below a quarter it can be bound rather than killed.',
  // An open 8x8 arena: room to circle a Behemoth and to use the drake's full board.
  width: 8,
  height: 8,
  playerHp: 400,
  enemyHp: 440,
  playerName: 'Hero',
  companionName: 'Ignis',
  companionSchool: 'pyre',
  enemyName: 'Ignis, Ember Drake',
  enemySchool: 'pyre',
  enemyDeck: [
    'cinder_mark',
    'cinder_mark',
    'flame_surge',
    'flame_surge',
    'magma_brute',
    'scout_imp',
    'scout_imp',
    'marrow_wisp',
    'grave_sentinel',
    'shield_bash',
    'aegis_ward',
    'stone_barricade',
    'dark_tithe',
    'soul_splinter_mark',
    'cataclysmic_core',
  ],
  enemyOpeningBoard: [
    ['scout_imp', 1, 1],
    ['marrow_wisp', 5, 1],
    // The arena pass: an 8x8 seats sixteen points. A trial should cost what the ground
    // says it costs, and the drake was carrying the fight alone.
    ['cinder_lobber', 6, 1],
    ['cinder_adder', 2, 1],
    ['ember_hound', 0, 0],
    ['soot_sprite', 7, 0],
  ],
  // The drake fights on the board. Its 44 HP is the pool its body draws on.
  enemyCompanion: { unitCardId: 'ignis_drake_bound' },
  // Bind it and it is yours. The same species the player may already be fielding: what a
  // taming produces is a *roll* -- its own constitution and its own knack -- so a second
  // Ignis is a different animal rather than a duplicate.
  subjugationPrize: 'ignis',
  // Four pillars in the middle of the arena: cover on the diagonals to break the drake's
  // sightlines, solid rubble at the centre to fight around rather than through.
  terrain: [
    { at: { x: 2, y: 3 }, kind: 'cover' },
    { at: { x: 5, y: 4 }, kind: 'cover' },
    { at: { x: 3, y: 4 }, kind: 'wall' },
    { at: { x: 4, y: 3 }, kind: 'wall' },
  ],
  script,
});
