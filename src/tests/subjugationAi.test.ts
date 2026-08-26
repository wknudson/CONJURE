/**
 * The binder's side of the Harpoon Protocol.
 *
 * Everything about a subjugation was written from the beast's point of view. It knew to hunt
 * the anchor; nothing knew to *place* one. Three faults compounded, and each one hid the next:
 *
 *  1. no score for casting the Rite, so the AI held a free card with a legal target for a
 *     dozen turns while the beast sat sealed and unkillable;
 *  2. `anchorPressure` applied to whichever side was planning, so the side that *owned* the
 *     tether was offered twenty thousand points for destroying it — latent only because of
 *     fault 1, and primed to fire the moment it was fixed;
 *  3. the Pacifist Lockout suspended on `active` and meant `sealed`, so every round spent
 *     looking for the Rite was charged to the player alone, against a beast immune to it.
 *
 * Together they made every sealed fight an automatic loss for the planner. `fouled_cistern`
 * lost all eight balance seeds; it now binds five of them.
 */

import { describe, expect, it } from 'vitest';
import { addUnit, findUnit, scenario } from './scenario.js';
import { applyCommand } from '../core/engine/engine.js';
import { makeCtx } from '../core/engine/context.js';
import { beginSubjugation, setAnchor } from '../core/engine/subjugation.js';
import { planTurn, NOVICE_AI } from '../core/ai/controller.js';
import { scoreAction, NOVICE_WEIGHTS, TETHER_SCORE } from '../core/ai/score.js';
import { summonUnit } from '../core/engine/spawn.js';
import type { GameState } from '../core/types/state.js';

/** A sealed beast, a body to tether, and the Rite in hand — the position the AI froze in. */
function sealed(): { state: GameState; riteId: string; anchorId: string } {
  const state = scenario({
    width: 6,
    height: 7,
    enemyHp: 60,
    units: [{ def: 'grave_sentinel', side: 'player', at: { x: 2, y: 5 } }],
  });
  state.players.enemy.maxHp = 240;

  const ctx = makeCtx(state);
  const boss = summonUnit(ctx, 'ignis_drake_bound', 'enemy', { x: 2, y: 1 })!;
  state.players.enemy.companionUnitId = boss;
  state.players.enemy.companionUnitDefId = 'ignis_drake_bound';
  beginSubjugation(ctx);

  // The Rite is dealt to the top of the deck; a hand is where it can be cast from.
  const riteId = state.players.player.deck.shift()!;
  state.players.player.hand.push(riteId);

  return { state, riteId, anchorId: findUnit(state, 'grave_sentinel', 'player').id };
}

describe('casting the Rite', () => {
  it('is what the planner actually does with it', () => {
    // The whole bug, in one assertion. Before: `moveUnit, endTurn`, every turn, forever.
    const { state } = sealed();
    const plan = planTurn(state, 'player', NOVICE_AI);
    expect(plan.some((c) => c.type === 'playCard'), 'it casts the Rite').toBe(true);
  });

  it('outranks everything else on the board', () => {
    // A sealed beast cannot be damaged and cannot be killed, so the tether is not the best
    // line available — it is the only one. Nothing may be allowed to outbid it.
    const { state, riteId, anchorId } = sealed();
    const command = {
      type: 'playCard' as const,
      card: riteId,
      target: { kind: 'entity' as const, ref: { kind: 'unit' as const, id: anchorId } },
    };

    const scored = scoreAction(state, 'player', command, NOVICE_WEIGHTS);
    expect(scored).toBeTruthy();
    expect(scored!.utility).toBeGreaterThanOrEqual(TETHER_SCORE);
  });

  it('gets the tether down on the board', () => {
    // The behavioural end of it: not merely scored, actually placed. Whether the phase is
    // then *won* depends on holding the anchor for three rounds against a beast hunting it,
    // which is a fight rather than a mechanism — `fouled_cistern` binds five of eight
    // balance seeds, where before the planner lost all eight without ever casting this.
    let state = sealed().state;
    let placed = false;

    for (let round = 0; round < 4 && !state.result && !placed; round++) {
      for (const command of planTurn(state, state.activeSide, NOVICE_AI)) {
        if (state.result) break;
        try {
          state = applyCommand(state, command).state;
        } catch {
          break;
        }
      }
      placed = state.encounter.subjugation.active;
    }

    expect(placed, 'the Rite was cast and the anchor set').toBe(true);
    expect(state.encounter.subjugation.anchorUnitId, 'on one of its own bodies').toBeTruthy();
  });
});

describe('the tether points the right way for each side', () => {
  /** A live tether: the beast wants it dead, the binder wants it standing. */
  function tethered(): { state: GameState; anchorId: string } {
    const { state, anchorId } = sealed();
    const ctx = makeCtx(state);
    setAnchor(ctx, state.units[anchorId]!);
    return { state, anchorId };
  }

  it('does not offer the binder a fortune for destroying its own anchor', () => {
    // `anchorPressure` was applied to whoever was planning, so this used to score +20000.
    const { state, anchorId } = tethered();
    const attacker = addUnit(state, {
      def: 'ash_ghoul',
      side: 'player',
      at: { x: 2, y: 4 },
      atk: 90,
    });

    const command = {
      type: 'attack' as const,
      attacker: attacker.id,
      target: { kind: 'unit' as const, id: anchorId },
    };
    const scored = scoreAction(state, 'player', command, NOVICE_WEIGHTS);

    // Either refused outright or valued as the disaster it is — never as progress.
    if (scored) expect(scored.utility).toBeLessThan(0);
  });

  it('still offers the beast one for breaking it', () => {
    // The original term, unchanged, on the side it was written for.
    const { state, anchorId } = tethered();
    const hunter = addUnit(state, {
      def: 'ash_ghoul',
      side: 'enemy',
      at: { x: 2, y: 4 },
      atk: 90,
    });
    state.activeSide = 'enemy';

    const command = {
      type: 'attack' as const,
      attacker: hunter.id,
      target: { kind: 'unit' as const, id: anchorId },
    };
    const scored = scoreAction(state, 'enemy', command, NOVICE_WEIGHTS);
    expect(scored).toBeTruthy();
    expect(scored!.utility).toBeGreaterThan(0);
  });
});

describe('the Pacifist Lockout and the seal', () => {
  it('stops charging the player the moment the beast becomes immune', () => {
    // The window between the seal and the Rite: the beast is already unkillable, the tether
    // is not yet down, and the lockout's unblockable damage lands on one side only. This
    // guarded `active`, so that window was uncovered — and the fight it decided was one the
    // player was still trying to win.
    const { state } = sealed();
    state.encounter.subjugation.active = false;
    expect(state.encounter.subjugation.sealed, 'sealed but not yet tethered').toBe(true);

    const before = state.players.player.hp;
    let cur = state;
    // Well past the six-round stall limit.
    for (let i = 0; i < 20 && !cur.result; i++) {
      cur = applyCommand(cur, { type: 'endTurn' }).state;
      // Held in the pre-tether window on purpose: this is the state the bug lived in.
      cur.encounter.subjugation.active = false;
    }

    expect(cur.stalledRounds, 'the clock never starts while sealed').toBe(0);
    expect(cur.players.player.hp, 'and the player is never charged for it').toBe(before);
  });

  it('still breaks an ordinary stalemate', () => {
    // The guard is scoped to the seal, not bolted onto the lockout: an unsealed fight where
    // nobody commits must still be collected on.
    let state = scenario({ playerHp: 400, enemyHp: 400 });
    for (let i = 0; i < 16 && !state.result; i++) {
      state = applyCommand(state, { type: 'endTurn' }).state;
    }
    expect(state.players.player.hp, 'the arena collects').toBeLessThan(400);
  });
});
