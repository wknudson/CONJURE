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
import { registerEncounterScript } from './registry.js';
import type { Ctx } from '../../engine/context.js';
import { emit, newCause } from '../../engine/context.js';
import { summonUnit } from '../../engine/spawn.js';
import { canPlace, entityAt, unitsOf } from '../../engine/board.js';
import { toCardSnapshot } from '../../engine/views.js';
import { cellsAt } from '../../util/grid.js';

const ENCOUNTER_ID = 'ignis_trial';
const PHASE_TWO_GATE = 'phase2';
const RITE_GATE = 'rite';
const RITE_CARD_DEF = 'rite_of_binding';

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
    maybeOfferRite(ctx);
  },

  onTurnStart(ctx, side) {
    // A damage-over-time tick can cross the 50% gate outside a damage chain.
    if (side !== 'enemy') return;
    const cmd = ctx.state.players.enemy;
    const halfway = Math.floor(cmd.maxHp / 2);
    if (cmd.hp <= halfway && !ctx.state.encounter.firedGates.includes(PHASE_TWO_GATE)) {
      ctx.state.encounter.firedGates.push(PHASE_TWO_GATE);
      enterPhaseTwo(ctx);
    }
    maybeOfferRite(ctx);
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

  // Purge debuffs from the boss's own units.
  for (const unit of unitsOf(state, 'enemy')) {
    unit.statuses = {};
  }

  // Forced Eviction: clear a spawn site by returning any player minion on it to hand,
  // refunding its pip cost as Sparks (Module 5 §5.4).
  for (const [x, y] of ADD_SPAWNS) {
    const anchor = { x, y };
    if (evictAndSpawn(ctx, anchor)) return;
  }
}

function evictAndSpawn(ctx: Ctx, anchor: { x: number; y: number }): boolean {
  const state = ctx.state;

  for (const cell of cellsAt(anchor, 1)) {
    const occupant = entityAt(state, cell);
    if (!occupant) continue;
    if (occupant.side !== 'player') return false; // enemy unit already there; try next site

    // Return the player's unit to hand with a spark refund.
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
    cmd.sparks += 1;
    emit(ctx, {
      t: 'cardReturnedToHand',
      side: 'player',
      card: toCardSnapshot(state, 'player', instanceId),
      refundedSparks: 1,
    });
  }

  if (!canPlace(state, anchor, 1)) return false;
  summonUnit(ctx, 'grave_sentinel', 'enemy', anchor);
  return true;
}

function maybeOfferRite(ctx: Ctx): void {
  const state = ctx.state;
  if (state.encounter.firedGates.includes(RITE_GATE)) return;

  const cmd = state.players.enemy;
  if (cmd.hp > Math.floor(cmd.maxHp * 0.25)) return;
  if (cmd.hp <= 0) return;

  state.encounter.firedGates.push(RITE_GATE);

  const player = state.players.player;
  const instanceId = `rite${state.nextId++}`;
  const nonEphemeral = player.hand.filter((h) => !player.cards[h]?.ephemeral).length;

  player.cards[instanceId] = {
    instanceId,
    defId: RITE_CARD_DEF,
    // A full hand means the Rite arrives as an overlay outside the limit.
    ...(nonEphemeral >= player.handLimit ? { ephemeral: true } : {}),
  };
  player.hand.push(instanceId);

  newCause(ctx);
  emit(ctx, {
    t: 'cardInjected',
    side: 'player',
    card: toCardSnapshot(state, 'player', instanceId),
  });
}

registerEncounterScript(ENCOUNTER_ID, script);

export const IGNIS_TRIAL: EncounterDef = {
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
    'spark_wisp',
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
    ['spark_wisp', 5, 1],
  ],
  // Four pillars in the middle of the arena: cover on the diagonals to break the drake's
  // sightlines, solid rubble at the centre to fight around rather than through.
  terrain: [
    { at: { x: 2, y: 3 }, kind: 'cover' },
    { at: { x: 5, y: 4 }, kind: 'cover' },
    { at: { x: 3, y: 4 }, kind: 'wall' },
    { at: { x: 4, y: 3 }, kind: 'wall' },
  ],
  script,
};
