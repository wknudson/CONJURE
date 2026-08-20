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
      // Eight, down from twelve. The Fused Grimoire made every deck permanently larger —
      // a 15-card Hero half plus eight innate spells — and the AI's cost is per *option*
      // per turn, so the same twelve playouts now take half again as long. Games are still
      // 7 to 19 turns; nothing got longer, the search got wider. Eight still catches the
      // two structural failures this guards: a game that never ends, and a side that
      // cannot threaten at all.
      const outcomes = Array.from({ length: 8 }, (_, i) => playOut(encounter.id, i + 1));

      for (const o of outcomes) {
        expect(o.result, `stalled after ${o.turns} turns`).not.toBe('stalled');
      }

      // Both sides must be able to threaten: across a dozen games the enemy commander
      // has to lose HP somewhere, or the player side is structurally unable to win.
      const enemyEverDamaged = outcomes.some((o) => o.enemyHp < encounter.enemyHp);
      expect(enemyEverDamaged, 'player never dealt any commander damage').toBe(true);

      const playerEverDamaged = outcomes.some((o) => o.playerHp < encounter.playerHp);
      expect(playerEverDamaged, 'enemy never dealt any commander damage').toBe(true);
      // A dozen full playouts per encounter, run alongside every other AI-heavy suite in
      // a parallel worker. The budget is for "did this hang", not "was this fast": every
      // action the AI gains -- channelling, another obstacle worth striking -- adds real
      // work to every turn of every game, and the assertions above are what matter.
      //
      // Which is why there is no number here. This carried a 120s override while the
      // global deadline was 180s, so the file was held to a *stricter* budget than the
      // config that exists to keep exactly this kind of test from failing on load -- and
      // it duly failed at 142s in a full run and passed alone. Inheriting the global is
      // the policy the comment above was already describing.
    });
  }

  it('resolves in a reasonable number of turns', () => {
    const outcomes = Array.from({ length: 12 }, (_, i) => playOut('novice_duelist', i + 1));
    const avg = outcomes.reduce((s, o) => s + o.turns, 0) / outcomes.length;
    // A demo duel should not drag on for dozens of rounds. The deeper lane arena adds
    // an approach phase, so this sits higher than it did on the old compact board.
    expect(avg).toBeLessThan(30);
    // Same reasoning as above: the budget guards against a hang, not against slowness,
    // and the global deadline is where that guard lives.
  });
});
