/**
 * The King's Contracts — the Master tier (campaign, Wave 3).
 *
 * Eight wildland fights, per `docs/11_world_of_azo_and_the_kings_contracts.md` §5: four
 * Apex subjugations (the chimera, the mantis, the dynamo, the Sovereign), two kill writs
 * whose kills are the crime (the juggernaut, the grove), the haunting at Pylon Nine, and
 * the relocation convoy. Coldwater — the King's Duelist — lives in `campaign.duels.ts`
 * with the other wagers; The Summons is Wave 4.
 *
 * Every script here is a reduction of the `ignis_trial` shape: the 25% seal is that
 * file's `maybeSeal` verbatim (the threshold belongs to the encounter, everything after
 * it to `beginSubjugation`, which is idempotent), and the 50% gates reuse its
 * fired-gates convention without the behemoth growth — no other species has a grown
 * form yet.
 */

import type { EncounterDef, EncounterScript } from './registry.js';
import { registerEncounter, registerEncounterScript } from './registry.js';
import type { Ctx } from '../../engine/context.js';
import { emit, newCause } from '../../engine/context.js';
import { dealDamage } from '../../engine/damage.js';
import { beginSubjugation } from '../../engine/subjugation.js';
import { summonUnit } from '../../engine/spawn.js';
import { canPlace, unitsOf } from '../../engine/board.js';

/** The enrage at a quarter strength, exactly as the Ignis trial runs it. */
function sealAt25(ctx: Ctx): void {
  const cmd = ctx.state.players.enemy;
  if (cmd.hp <= 0) return;
  if (cmd.hp > Math.floor(cmd.maxHp * 0.25)) return;
  beginSubjugation(ctx);
}

/**
 * A 50% phase turn: the gate fires once, the boss shrugs off its statuses, and the
 * arena answers with adds where there is room. The growth step of the trial's version
 * is deliberately absent — these species have no second form to grow into yet.
 */
function phaseAtHalf(
  ctx: Ctx,
  gate: string,
  name: string,
  adds: { defId: string; at: [number, number][] },
): void {
  const state = ctx.state;
  const cmd = state.players.enemy;
  if (cmd.hp > Math.floor(cmd.maxHp / 2)) return;
  if (state.encounter.firedGates.includes(gate)) return;
  state.encounter.firedGates.push(gate);

  newCause(ctx);
  emit(ctx, { t: 'bossPhaseShift', side: 'enemy', phase: 2, name });
  for (const unit of unitsOf(state, 'enemy')) unit.statuses = {};
  for (const [x, y] of adds.at) {
    if (canPlace(state, { x, y }, 1)) summonUnit(ctx, adds.defId, 'enemy', { x, y });
  }
}

/* ================================================================================== *
 * Master #1 — Apex Subjugation: The Caldera Chimera
 * ================================================================================== */

const chimeraScript: EncounterScript = {
  onTurnStart(ctx, side) {
    if (side !== 'enemy') return;
    // The caldera answers: at half strength the swarm rises off the tap-fields.
    phaseAtHalf(ctx, 'caldera_answers', 'The Caldera Answers', {
      defId: 'ember_moth',
      at: [
        [1, 1],
        [6, 1],
        [3, 0],
      ],
    });
    sealAt25(ctx);
  },
  onCommanderHpChanged(ctx, side) {
    if (side === 'enemy') sealAt25(ctx);
  },
};
registerEncounterScript('caldera_chimera', chimeraScript);

export const CALDERA_CHIMERA: EncounterDef = registerEncounter({
  id: 'caldera_chimera',
  name: 'Apex Subjugation: The Caldera Chimera',
  blurb:
    'The chimera has raided three tap-field crews this season. Subjugate or destroy it; ' +
    'the drilling schedule holds either way.',
  width: 8,
  height: 8,
  playerHp: 400,
  enemyHp: 440,
  playerName: 'Hero',
  companionName: 'Ignis',
  companionSchool: 'pyre',
  enemyName: 'The Caldera Chimera',
  enemySchool: 'pyre',
  enemyDeck: [
    'stoke',
    'cinder_gale',
    'ashen_wake',
    'cinder_mark',
    'aegis_ward',
    'shield_bash',
    'flame_surge',
  ],
  enemyOpeningBoard: [
    ['ember_hound', 1, 1],
    ['ember_hound', 6, 1],
    ['ember_moth', 2, 0],
  ],
  // The apex itself, on the board from the first bell.
  enemyCompanion: { unitCardId: 'chimera_bound' },
  // The map is the motive: its denning ground is a geode field, and the fight is had on
  // exactly the wealth the drills came for.
  marrowGeodes: { min: 4, max: 6 },
  terrain: [
    { at: { x: 2, y: 3 }, kind: 'wall' },
    { at: { x: 5, y: 4 }, kind: 'wall' },
    { at: { x: 3, y: 5 }, kind: 'cover' },
    { at: { x: 4, y: 2 }, kind: 'cover' },
  ],
  subjugationPrize: 'chimera',
  script: chimeraScript,
});

/* ================================================================================== *
 * Master #2 — The Rimefield Break
 * ================================================================================== */

/** Rows under the cracked face. Anything standing there when the snow moves is hit. */
const AVALANCHE_ROWS = 3;
const AVALANCHE_HIT = 12;

const rimefieldScript: EncounterScript = {
  onTurnStart(ctx, side) {
    if (side !== 'enemy') return;
    // Every other enemy turn the face sheds. Both armies are under it equally — the
    // point of the fight is that the mountain was never on anyone's side.
    if (ctx.state.turn % 2 !== 0) return;
    newCause(ctx);
    for (const unit of Object.values(ctx.state.units)) {
      if (unit.anchor.y > AVALANCHE_ROWS) continue;
      if (unit.hp <= AVALANCHE_HIT) continue; // the snow bruises; the fight kills
      dealDamage(ctx, {
        target: { kind: 'unit', id: unit.id },
        amount: AVALANCHE_HIT,
        dtype: 'impact',
        cause: 'impact',
      });
    }
  },
};
registerEncounterScript('rimefield_break', rimefieldScript);

export const RIMEFIELD_BREAK: EncounterDef = registerEncounter({
  id: 'rimefield_break',
  name: 'The Rimefield Break',
  blurb:
    'A glacial juggernaut is menacing the north pass and the winter freight cannot ' +
    'reroute. The pass opens this month. See that it does.',
  width: 7,
  height: 9,
  playerHp: 400,
  enemyHp: 450,
  playerName: 'Hero',
  companionName: 'Ignis',
  companionSchool: 'pyre',
  enemyName: 'The Pass-Holder',
  enemySchool: 'frost',
  enemyDeck: [
    'glacial_spike',
    'flash_freeze',
    'brittle_touch',
    'frost_nova',
    'rime_mark',
    'aegis_ward',
    'creeping_rime',
  ],
  enemyOpeningBoard: [
    ['glacial_stalker', 1, 1],
    ['rimeguard', 5, 1],
    ['rime_fox', 2, 0],
  ],
  enemyCompanion: { unitCardId: 'juggernaut_bound' },
  // Ice sheets and shear walls: a shatter/superconduct playground, exactly per the doc.
  terrain: [
    { at: { x: 1, y: 3 }, kind: 'wall' },
    { at: { x: 5, y: 3 }, kind: 'wall' },
    { at: { x: 3, y: 4 }, kind: 'cover', hp: 50 },
    { at: { x: 2, y: 5 }, kind: 'cover', hp: 50 },
    { at: { x: 4, y: 6 }, kind: 'cover', hp: 50 },
  ],
  props: [
    { at: { x: 3, y: 2 }, defId: 'cryo_crystal' },
    { at: { x: 5, y: 5 }, defId: 'cryo_crystal' },
  ],
  script: rimefieldScript,
});

/* ================================================================================== *
 * Master #3 — Binding Order: Sealed — the Storm Shelf
 * ================================================================================== */

const mantisScript: EncounterScript = {
  onTurnStart(ctx, side) {
    if (side !== 'enemy') return;
    sealAt25(ctx);
  },
  onCommanderHpChanged(ctx, side) {
    if (side === 'enemy') sealAt25(ctx);
  },
};
registerEncounterScript('storm_shelf_binding', mantisScript);

export const STORM_SHELF_BINDING: EncounterDef = registerEncounter({
  id: 'storm_shelf_binding',
  name: 'Binding Order: Sealed — the Storm Shelf',
  blurb:
    'The Rime Conductor interferes with the sky-conduits and the grid loses a pylon a ' +
    'month to it. Bind it. The order is sealed; do not read past the fee.',
  width: 8,
  height: 8,
  playerHp: 400,
  enemyHp: 440,
  playerName: 'Hero',
  companionName: 'Ignis',
  companionSchool: 'pyre',
  enemyName: 'The Rime Conductor',
  enemySchool: 'surge',
  enemyDeck: [
    'chain_bolt',
    'static_arc',
    'arc_lash',
    'discharge',
    'arc_mark',
    'aegis_ward',
    'paralytic_arc',
  ],
  enemyOpeningBoard: [
    ['storm_wisp', 1, 1],
    ['voltaic_hound', 6, 1],
    ['storm_rod', 2, 0],
  ],
  enemyCompanion: { unitCardId: 'mantis_bound' },
  // The shelf's permanent storm: the conduits' own exhaust, blowing into your approach.
  weather: { kind: 'gale', wind: { x: 0, y: 1 } },
  // The pylon row: what the contract calls the infrastructure and the mantis calls the
  // lightning it grounds.
  terrain: [
    { at: { x: 1, y: 3 }, kind: 'wall' },
    { at: { x: 4, y: 3 }, kind: 'wall' },
    { at: { x: 6, y: 4 }, kind: 'wall' },
    { at: { x: 2, y: 5 }, kind: 'cover' },
    { at: { x: 5, y: 5 }, kind: 'cover' },
  ],
  subjugationPrize: 'mantis',
  script: mantisScript,
});

/* ================================================================================== *
 * Master #4 — The Geist of Pylon Nine
 * ================================================================================== */

// TODO(worldbuild): the doc gives the geist "heals from shock damage — starve it, not
// blast it". EncounterScript has no unit-damage hook, so that rule needs either a unit
// keyword or a new hook; the rough pass ships the fight without it.
export const PYLON_NINE: EncounterDef = registerEncounter({
  id: 'pylon_nine',
  name: 'The Geist of Pylon Nine',
  blurb:
    'Something haunts the newest pylon and drinks its charge. The Conduit Works ledger ' +
    'carries it as product loss. Make the ledger balance.',
  width: 7,
  height: 8,
  playerHp: 400,
  enemyHp: 420,
  playerName: 'Hero',
  companionName: 'Ignis',
  companionSchool: 'pyre',
  enemyName: 'Product Loss',
  enemySchool: 'surge',
  enemyDeck: [
    'discharge',
    'static_arc',
    'chain_bolt',
    'arc_mark',
    'shadow_siphon',
    'aegis_ward',
  ],
  enemyOpeningBoard: [
    ['storm_wisp', 1, 1],
    ['storm_wisp', 5, 1],
    ['voltaic_coil', 2, 0],
  ],
  enemyCompanion: { unitCardId: 'geist_bound' },
  // Pylon Nine itself, mid-field, and the exclusion fencing around its base.
  terrain: [
    { at: { x: 3, y: 3 }, kind: 'wall' },
    { at: { x: 3, y: 4 }, kind: 'wall' },
    { at: { x: 1, y: 4 }, kind: 'cover' },
    { at: { x: 5, y: 4 }, kind: 'cover' },
    { at: { x: 2, y: 2 }, kind: 'cover' },
  ],
});

/* ================================================================================== *
 * Master #5 — Wildfire Writ: the Ashwood
 * ================================================================================== */

export const WILDFIRE_WRIT: EncounterDef = registerEncounter({
  id: 'wildfire_writ',
  name: 'Wildfire Writ: the Ashwood',
  blurb:
    'The blight in the treant grove threatens the timber camps, per the survey attached. ' +
    'Burn it out before the wind turns. The burn line is drawn on the map.',
  width: 8,
  height: 8,
  playerHp: 400,
  enemyHp: 430,
  playerName: 'Hero',
  companionName: 'Ignis',
  companionSchool: 'pyre',
  enemyName: 'The Grove',
  enemySchool: 'bloom',
  enemyDeck: [
    'strangling_vines',
    'spore_burst',
    'thornlash',
    'sap_draught',
    'briar_rampart',
    'root_snare',
    'rot_root_snare',
  ],
  enemyOpeningBoard: [
    ['bramble_sentinel', 1, 1],
    ['creeping_briar', 6, 1],
    ['sporeback_boar', 2, 0],
    ['sap_wisp', 5, 0],
  ],
  // The elder, rooted at the grove's heart.
  enemyCompanion: { unitCardId: 'treant_bound' },
  // The grove is the arena: burnable brush everywhere, which is what makes the wildfire
  // reaction the fight's grammar — every Burn a player lands has somewhere to spread.
  terrain: [
    { at: { x: 2, y: 2 }, kind: 'cover', hp: 40 },
    { at: { x: 5, y: 2 }, kind: 'cover', hp: 40 },
    { at: { x: 1, y: 4 }, kind: 'cover', hp: 40 },
    { at: { x: 3, y: 4 }, kind: 'cover', hp: 40 },
    { at: { x: 6, y: 4 }, kind: 'cover', hp: 40 },
    { at: { x: 2, y: 5 }, kind: 'cover', hp: 40 },
    { at: { x: 4, y: 5 }, kind: 'cover', hp: 40 },
  ],
});

/* ================================================================================== *
 * Master #7 — Apex Subjugation: The Kinetic Dynamo
 * ================================================================================== */

/** Where the freed stock comes up from the flats. */
const DYNAMO_REINFORCEMENTS: [number, number][] = [
  [1, 1],
  [6, 1],
  [3, 0],
];

const dynamoScript: EncounterScript = {
  onTurnStart(ctx, side) {
    if (side !== 'enemy') return;
    // Every third turn something it freed arrives to fight beside it. Branded pit
    // stock — the same series the Fenwick cellar wore.
    if (ctx.state.turn % 3 === 0) {
      newCause(ctx);
      for (const [x, y] of DYNAMO_REINFORCEMENTS) {
        if (canPlace(ctx.state, { x, y }, 1)) {
          summonUnit(ctx, 'ember_hound', 'enemy', { x, y });
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
registerEncounterScript('dynamo_flats', dynamoScript);

export const DYNAMO_FLATS: EncounterDef = registerEncounter({
  id: 'dynamo_flats',
  name: 'Apex Subjugation: The Kinetic Dynamo',
  blurb:
    'The engine-beast that walked out of the Cinderworks is loose on the flats, and ' +
    'foundry stock goes missing wherever it passes. Bring it back in harness.',
  width: 8,
  height: 8,
  playerHp: 400,
  enemyHp: 440,
  playerName: 'Hero',
  companionName: 'Ignis',
  companionSchool: 'pyre',
  enemyName: 'The Momentum Engine',
  enemySchool: 'surge',
  enemyDeck: [
    'arcing_step',
    'chain_bolt',
    'galvanic_rally',
    'arc_lash',
    'arc_mark',
    'aegis_ward',
    'tempest_break',
  ],
  enemyOpeningBoard: [
    ['voltaic_hound', 1, 1],
    ['clockwork_bombardier', 6, 1],
  ],
  enemyCompanion: { unitCardId: 'dynamo_bound' },
  // Open flats: momentum wants room, and gets it.
  terrain: [
    { at: { x: 3, y: 3 }, kind: 'cover' },
    { at: { x: 4, y: 4 }, kind: 'cover' },
  ],
  marrowGeodes: { min: 1, max: 3 },
  subjugationPrize: 'dynamo',
  script: dynamoScript,
});

/* ================================================================================== *
 * Master #8 — The Relocation Train
 * ================================================================================== */

/** Where the next wave comes out of the dark alongside the road. */
const TRAIN_WAVE_SPAWNS: [number, number][] = [
  [1, 1],
  [4, 1],
  [2, 0],
];
/** Alternating faces from earlier contracts: the roads' hungry and the harbor's angry. */
const TRAIN_WAVE_UNITS = ['scout_imp', 'marrow_wisp', 'shieldbearer'];

const trainScript: EncounterScript = {
  onTurnStart(ctx, side) {
    if (side !== 'enemy') return;
    // A new body every other turn until the convoy clears. Wave defense, as near as the
    // engine's two sides can spell it.
    if (ctx.state.turn % 2 !== 0) return;
    const wave = Math.floor(ctx.state.turn / 2);
    const defId = TRAIN_WAVE_UNITS[wave % TRAIN_WAVE_UNITS.length]!;
    newCause(ctx);
    for (const [x, y] of TRAIN_WAVE_SPAWNS) {
      if (canPlace(ctx.state, { x, y }, 1)) {
        summonUnit(ctx, defId, 'enemy', { x, y });
        return;
      }
    }
  },
};
registerEncounterScript('relocation_train', trainScript);

export const RELOCATION_TRAIN: EncounterDef = registerEncounter({
  id: 'relocation_train',
  name: 'The Relocation Train',
  blurb:
    'The season’s last relocation convoy runs Fenwick’s Crossing to the Spire undercroft ' +
    'tonight, and it will be interfered with. It must not be. That is the whole contract.',
  width: 6,
  height: 9,
  playerHp: 400,
  enemyHp: 400,
  playerName: 'Hero',
  companionName: 'Ignis',
  companionSchool: 'pyre',
  // TODO(worldbuild): the doc wants the attackers wearing the exact unit identities of
  // earlier contracts' people. The wave list reuses their unit defs; reused *names and
  // skins* want a reskin system.
  enemyName: 'The Interference',
  enemySchool: 'dusk',
  enemyDeck: [
    'smoke_bomb',
    'wither',
    'dark_tithe',
    'grapple_line',
    'shield_bash',
    'soul_splinter_mark',
  ],
  enemyOpeningBoard: [
    ['scout_imp', 1, 1],
    ['shieldbearer', 4, 1],
  ],
  // The convoy itself, strung down the road. Scenery in the rough pass; the doc's
  // protect-the-wagons objective needs the same engine work the Night Freight does.
  props: [
    { at: { x: 3, y: 4 }, defId: 'alchemists_barricade' },
    { at: { x: 3, y: 6 }, defId: 'alchemists_barricade' },
  ],
  terrain: [
    { at: { x: 0, y: 3 }, kind: 'cover' },
    { at: { x: 5, y: 3 }, kind: 'cover' },
    { at: { x: 0, y: 6 }, kind: 'cover' },
    { at: { x: 5, y: 6 }, kind: 'cover' },
  ],
  script: trainScript,
});

/* ================================================================================== *
 * Master #9 — Apex Subjugation: The Bone Bastion Sovereign
 * ================================================================================== */

const sovereignScript: EncounterScript = {
  onTurnStart(ctx, side) {
    if (side !== 'enemy') return;
    // At half strength the graves answer. Sentinels: the Bastion has always had wardens.
    phaseAtHalf(ctx, 'bastion_wakes', 'The Bastion Wakes', {
      defId: 'grave_sentinel',
      at: [
        [1, 1],
        [6, 1],
        [3, 0],
      ],
    });
    sealAt25(ctx);
  },
  onCommanderHpChanged(ctx, side) {
    if (side === 'enemy') sealAt25(ctx);
  },
};
registerEncounterScript('bone_bastion', sovereignScript);

// TODO(worldbuild): the doc bills the Sovereign as 2x2 behemoth-class. Only Ignis has a
// grown form today (`ignis_behemoth_bound`); the Sovereign fights at footprint 1 until a
// second 2x2 body is authored.
export const BONE_BASTION: EncounterDef = registerEncounter({
  id: 'bone_bastion',
  name: 'Apex Subjugation: The Bone Bastion Sovereign',
  blurb:
    'The necropolis apex walks at night now, and it walks toward the Levels. Put it down ' +
    'or put it in harness before it reaches the tithe barns.',
  width: 8,
  height: 8,
  playerHp: 400,
  enemyHp: 460,
  playerName: 'Hero',
  companionName: 'Ignis',
  companionSchool: 'pyre',
  enemyName: 'The Sovereign',
  enemySchool: 'dusk',
  enemyDeck: [
    'wither',
    'creeping_decay',
    'shadow_siphon',
    'grave_call',
    'dark_tithe',
    'soul_splinter_mark',
    'aegis_ward',
  ],
  enemyOpeningBoard: [
    ['grave_sentinel', 1, 1],
    ['ash_ghoul', 6, 1],
    ['hollow_wraith', 2, 0],
  ],
  enemyCompanion: { unitCardId: 'sovereign_bound' },
  // The graves. Fresh, mass, numbered — the fight is had on top of the crack.
  terrain: [
    { at: { x: 1, y: 3 }, kind: 'cover' },
    { at: { x: 3, y: 3 }, kind: 'cover' },
    { at: { x: 5, y: 3 }, kind: 'cover' },
    { at: { x: 2, y: 5 }, kind: 'cover' },
    { at: { x: 4, y: 5 }, kind: 'cover' },
    { at: { x: 6, y: 5 }, kind: 'cover' },
    { at: { x: 3, y: 4 }, kind: 'wall' },
  ],
  subjugationPrize: 'sovereign',
  script: sovereignScript,
});
