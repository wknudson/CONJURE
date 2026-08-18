/**
 * The Ignis Subjugation Trial.
 *
 * Two scripted thresholds:
 *  - 50%: a Damage Gate clamps HP to exactly half, nullifies the remainder of the current
 *    resolution chain, purges debuffs, and spawns the phase-2 add with Forced Eviction.
 *  - 25%: a free Rite of Binding card is injected. Playing it binds Ignis and wins the
 *    trial. If the hand is full it attaches as an Ephemeral overlay that sits outside the
 *    hand limit and cannot be discarded.
 */

import type { EncounterDef, EncounterScript } from './registry.js';
import { registerEncounter, registerEncounterScript } from './registry.js';
import type { Ctx } from '../../engine/context.js';
import { emit, newCause } from '../../engine/context.js';
import { dockIntoForm, summonUnit } from '../../engine/spawn.js';
import { beginSubjugation } from '../../engine/subjugation.js';
import { clearIntents } from '../../engine/intents.js';
import { canPlace, entityAt, unitsOf } from '../../engine/board.js';
import { toCardSnapshot } from '../../engine/views.js';
import { cellsAt } from '../../util/grid.js';

const ENCOUNTER_ID = 'ignis_trial';
const PHASE_TWO_GATE = 'phase2';
/** Tracked apart from the phase itself, so a blocked transformation can retry. */
const GROWN_GATE = 'grown';

/** Where the phase-2 Ember Guard tries to appear. */
const ADD_SPAWNS: [number, number][] = [
  [1, 1],
  [3, 1],
  [2, 0],
];

const script: EncounterScript = {
  onDamageToCommander(ctx, side, amount) {
    if (side !== 'enemy') return amount;
    if (ctx.state.encounter.firedGates.includes(PHASE_TWO_GATE)) return amount;

    const cmd = ctx.state.players.enemy;
    const halfway = Math.floor(cmd.maxHp / 2);

    // Only clamp if this hit would actually cross the threshold.
    if (cmd.hp - amount > halfway) return amount;

    const clamped = Math.max(0, cmd.hp - halfway);
    ctx.state.encounter.firedGates.push(PHASE_TWO_GATE);

    // Cancel the rest of this chain so further cascade damage cannot undo the clamp,
    // then transform. The engine is synchronous, so this runs before the damage write
    // completes — enterPhaseTwo only touches units and the board, never boss HP.
    ctx.state.encounter.chainCancelled = true;
    enterPhaseTwo(ctx);

    return clamped;
  },

  onCommanderHpChanged(ctx, side) {
    if (side !== 'enemy') return;
    maybeSeal(ctx);
  },

  onTurnStart(ctx, side) {
    // A damage-over-time tick can cross the 50% gate outside a damage chain.
    if (side !== 'enemy') return;
    const cmd = ctx.state.players.enemy;
    const halfway = Math.floor(cmd.maxHp / 2);
    if (cmd.hp <= halfway && !ctx.state.encounter.firedGates.includes(PHASE_TWO_GATE)) {
      ctx.state.encounter.firedGates.push(PHASE_TWO_GATE);
      enterPhaseTwo(ctx);
    } else if (ctx.state.encounter.bossPhase === 2) {
      // It was boxed in when it tried to grow. Try again now that the board has moved.
      growIntoBehemoth(ctx);
    }
    maybeSeal(ctx);
  },
};

function enterPhaseTwo(ctx: Ctx): void {
  const state = ctx.state;
  state.encounter.bossPhase = 2;

  newCause(ctx);
  emit(ctx, {
    t: 'bossPhaseShift',
    side: 'enemy',
    phase: 2,
    name: 'Ignis Enraged',
  });

  // Purge debuffs from the boss's own units, its own body included. A phase change
  // shrugging off crowd control is standard for a boss, and it is the reason spending a
  // Flash Freeze just before the halfway mark is a mistake rather than a plan.
  for (const unit of unitsOf(state, 'enemy')) {
    unit.statuses = {};
  }

  // The drake grows into its full shape. The enraged form is the enrage: it hits harder,
  // it is slower, and at 2x2 it blocks sight through itself, so the arena's lanes are
  // redrawn by the transformation alone.
  if (growIntoBehemoth(ctx)) return;

  // Boxed in, or fighting from off the board entirely. It calls for help instead; the
  // growth is retried at the start of each of its turns until there is room.
  for (const [x, y] of ADD_SPAWNS) {
    if (evictAndSpawn(ctx, { x, y })) return;
  }
}

/**
 * Grows the drake into its enraged shape, if there is anywhere to put it.
 *
 * Kept separate from the phase change so that a failure retries without re-announcing.
 * The phase has genuinely happened — the clamp, the purge and the adds are all done —
 * and only the transformation is outstanding.
 */
function growIntoBehemoth(ctx: Ctx): boolean {
  const state = ctx.state;
  if (state.encounter.firedGates.includes(GROWN_GATE)) return false;

  const grew = dockIntoForm(ctx, 'enemy', 'ignis_behemoth_bound', (c, at) =>
    evictAndSpawn(c, at, false),
  );
  if (!grew) return false;

  state.encounter.firedGates.push(GROWN_GATE);
  // Every declared blow was aimed from a body that no longer stands there, and half the
  // sightlines it was aimed along have just been rewritten.
  clearIntents(ctx);
  return true;
}

function evictAndSpawn(
  ctx: Ctx,
  anchor: { x: number; y: number },
  summon = true,
): boolean {
  const state = ctx.state;

  for (const cell of cellsAt(anchor, 1)) {
    const occupant = entityAt(state, cell);
    if (!occupant) continue;
    if (occupant.side !== 'player') return false; // enemy unit already there; try next site

    // Return the player's unit to hand with a marrow refund.
    const cmd = state.players.player;
    delete state.units[occupant.id];
    emit(ctx, {
      t: 'unitDied',
      unitId: occupant.id,
      at: { ...occupant.anchor },
      footprint: occupant.footprint,
      cause: 'spell',
    });

    const instanceId = `evict${state.nextId++}`;
    cmd.cards[instanceId] = { instanceId, defId: occupant.defId };
    cmd.hand.push(instanceId);
    cmd.marrow += 1;
    emit(ctx, {
      t: 'cardReturnedToHand',
      side: 'player',
      card: toCardSnapshot(state, 'player', instanceId),
      refundedMarrow: 1,
    });
  }

  // Used both to make room for the drake's larger form and to call an add into the gap.
  if (!summon) return true;
  if (!canPlace(state, anchor, 1)) return false;
  summonUnit(ctx, 'grave_sentinel', 'enemy', anchor);
  return true;
}

/**
 * The enrage, at a quarter strength.
 *
 * The threshold and the decision to have one belong to the encounter; everything the
 * protocol then does -- sealing, purging, dealing the Rite -- belongs to the engine, and
 * `beginSubjugation` is idempotent, so this may be called as loosely as it likes.
 */
function maybeSeal(ctx: Ctx): void {
  const cmd = ctx.state.players.enemy;
  if (cmd.hp <= 0) return;
  if (cmd.hp > Math.floor(cmd.maxHp * 0.25)) return;
  beginSubjugation(ctx);
}

registerEncounterScript(ENCOUNTER_ID, script);

export const IGNIS_TRIAL: EncounterDef = registerEncounter({
  id: ENCOUNTER_ID,
  name: 'Subjugation Trial: Ignis',
  blurb:
    'A wild Pyre salamander. Break it to half strength to enrage it, then wear it down — below a quarter it can be bound rather than killed.',
  // An open 8x8 arena: room to circle a Behemoth and to use the drake's full board.
  width: 8,
  height: 8,
  playerHp: 40,
  enemyHp: 44,
  playerName: 'Hero',
  companionName: 'Ignis',
  companionSchool: 'pyre',
  enemyName: 'Ignis, Ember Drake',
  enemySchool: 'pyre',
  enemyDeck: [
    'cinder_rune',
    'cinder_rune',
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
    'soul_splinter_rune',
    'cataclysmic_core',
  ],
  enemyOpeningBoard: [
    ['scout_imp', 1, 1],
    ['marrow_wisp', 5, 1],
  ],
  // The drake fights on the board. Its 44 HP is the pool its body draws on.
  enemyCompanion: { unitCardId: 'ignis_drake_bound' },
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
