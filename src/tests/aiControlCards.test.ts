/**
 * The AI and its control cards.
 *
 * A card whose whole effect is a status or an Aura used to score exactly zero, and zero
 * sits at the pass threshold — so every enemy deck that shipped one carried dead weight
 * it re-enumerated and re-declined every turn. Six Auras and four control spells were in
 * the game and unplayable by the side they were written for; the whole Aura system was
 * player-only in practice.
 *
 * These tests hold the two terms that closed that: `statusValue` (a debuff on a foe is
 * worth something, and one on our own bodies costs the same) and `auraValue` (building a
 * carrier up is worth a turn's attention).
 */

import { describe, expect, it } from 'vitest';
import { findUnit, giveCard, scenario } from './scenario.js';
import { NOVICE_AI, planTurn } from '../core/ai/controller.js';
import { NOVICE_WEIGHTS, scoreAction } from '../core/ai/score.js';
import { applyCommand } from '../core/engine/engine.js';
import type { GameEvent } from '../contract/events.js';
import type { GameState } from '../core/types/state.js';

/** Runs a whole planned turn and returns everything it emitted. */
function playOut(state: GameState): { state: GameState; events: GameEvent[] } {
  let cur = state;
  const events: GameEvent[] = [];
  for (const command of planTurn(state, 'enemy', NOVICE_AI)) {
    const res = applyCommand(cur, command);
    cur = res.state;
    events.push(...res.events);
  }
  return { state: cur, events };
}

describe('the AI plays its Auras', () => {
  it('attaches an Aura to its own body instead of holding it forever', () => {
    const state = scenario({
      units: [
        { def: 'scout_imp', side: 'enemy', at: { x: 2, y: 6 } },
        { def: 'scout_imp', side: 'player', at: { x: 2, y: 0 } },
      ],
      width: 6,
      height: 8,
    });
    state.activeSide = 'enemy';
    state.players.enemy.bones = 8;
    giveCard(state, 'enemy', 'ember_coat');

    const { events } = playOut(state);
    expect(
      events.some((e) => e.t === 'auraAttached'),
      'the Aura must leave its hand',
    ).toBe(true);
  });

  it('scores the attach itself, not only the stat delta it happens to carry', () => {
    // Static Charge moves MOV, a stat none of the damage terms can see — the flat
    // `auraValue` is what keeps it playable.
    const state = scenario({
      units: [
        { def: 'scout_imp', side: 'enemy', at: { x: 2, y: 6 } },
        { def: 'scout_imp', side: 'player', at: { x: 2, y: 0 } },
      ],
      width: 6,
      height: 8,
    });
    state.activeSide = 'enemy';
    state.players.enemy.bones = 8;
    const card = giveCard(state, 'enemy', 'static_charge');
    const carrier = findUnit(state, 'scout_imp', 'enemy');

    const scored = scoreAction(
      state,
      'enemy',
      { type: 'playCard', card, target: { kind: 'entity', ref: { kind: 'unit', id: carrier.id } } },
      NOVICE_WEIGHTS,
    );
    expect(scored, 'the cast must be legal').toBeDefined();
    expect(scored!.utility, 'above the pass threshold').toBeGreaterThan(0);
  });
});

describe('the AI plays its control spells', () => {
  /** A Spore Cloud aimed at a tile whose orthogonal neighbours belong to `side`. */
  function sporeCast(side: 'player' | 'enemy') {
    const state = scenario({
      units: [
        { def: 'scout_imp', side, at: { x: 2, y: 2 } },
        { def: 'scout_imp', side, at: { x: 1, y: 3 } },
      ],
      width: 6,
      height: 8,
    });
    state.activeSide = 'enemy';
    state.players.enemy.bones = 8;
    const card = giveCard(state, 'enemy', 'spore_cloud');
    return scoreAction(
      state,
      'enemy',
      { type: 'playCard', card, target: { kind: 'tile', at: { x: 2, y: 3 } } },
      NOVICE_WEIGHTS,
    );
  }

  it('values a pure status landed on the enemy', () => {
    const scored = sporeCast('player');
    expect(scored, 'the cast must be legal').toBeDefined();
    expect(scored!.utility, 'above the pass threshold').toBeGreaterThan(0);
  });

  it('and pays the mirror price for gassing its own', () => {
    const scored = sporeCast('enemy');
    expect(scored, 'the cast must be legal').toBeDefined();
    expect(scored!.utility, 'a self-poisoning line must be declined').toBeLessThan(0);
  });
});
