import { describe, expect, it } from 'vitest';
import { applyCommand } from '../core/engine/engine.js';
import { createCombat } from '../core/engine/setup.js';
import { ENCOUNTERS } from '../core/data/encounters/index.js';
import { planTurn } from '../core/ai/controller.js';
import type { GameState } from '../core/types/state.js';

interface Outcome {
  result: string;
  turns: number;
  playerHp: number;
  enemyHp: number;
}

function playOut(encounterId: string, seed: number): Outcome {
  const encounter = ENCOUNTERS.find((e) => e.id === encounterId)!;
  let state: GameState = createCombat(encounter, seed).state;
  let guard = 0;

  while (!state.result && guard++ < 120) {
    const plan = planTurn(state, state.activeSide);
    for (const command of plan) {
      if (state.result) break;
      try {
        state = applyCommand(state, command).state;
      } catch {
        break;
      }
    }
  }

  return {
    result: state.result ?? 'stalled',
    turns: state.turn,
    playerHp: state.players.player.hp,
    enemyHp: state.players.enemy.hp,
  };
}

/**
 * These are feel checks, not strict balance assertions. They exist to catch structural
 * failures: games that never end, or a side that literally cannot deal damage.
 */
describe('encounter balance sanity', () => {
  for (const encounter of ENCOUNTERS) {
    it(`${encounter.name}: every game reaches a decision`, () => {
      const outcomes = Array.from({ length: 12 }, (_, i) => playOut(encounter.id, i + 1));

      for (const o of outcomes) {
        expect(o.result, `stalled after ${o.turns} turns`).not.toBe('stalled');
      }

      // Both sides must be able to threaten: across a dozen games the enemy commander
      // has to lose HP somewhere, or the player side is structurally unable to win.
      const enemyEverDamaged = outcomes.some((o) => o.enemyHp < encounter.enemyHp);
      expect(enemyEverDamaged, 'player never dealt any commander damage').toBe(true);

      const playerEverDamaged = outcomes.some((o) => o.playerHp < encounter.playerHp);
      expect(playerEverDamaged, 'enemy never dealt any commander damage').toBe(true);
      // A dozen full playouts on the larger arenas exceeds the default 5s budget; the
      // AI itself runs well inside Module 5's 1.2s-per-turn cap.
    }, 30_000);
  }

  it('resolves in a reasonable number of turns', () => {
    const outcomes = Array.from({ length: 12 }, (_, i) => playOut('novice_duelist', i + 1));
    const avg = outcomes.reduce((s, o) => s + o.turns, 0) / outcomes.length;
    // A demo duel should not drag on for dozens of rounds. The deeper lane arena adds
    // an approach phase, so this sits higher than it did on the old compact board.
    expect(avg).toBeLessThan(30);
  }, 30_000);
});
