/**
 * Why a fight does not end.
 *
 * `balance.test.ts` asserts only that a decision is reached; when that fails it cannot say
 * whether the side ran out of damage, out of reach, or merely out of turns. This plays the
 * named encounters and reports the shape of the deadlock: what is still standing, what the
 * commanders have left, and whether anything was still landing when the guard ran out.
 *
 *     npx tsx scripts/diagnose-stall.ts fouled_cistern tallow_blight
 */

import { applyCommand } from '../src/core/engine/engine.js';
import { createCombat } from '../src/core/engine/setup.js';
import { ENCOUNTERS } from '../src/core/data/encounters/index.js';
import { planTurn } from '../src/core/ai/controller.js';
import type { GameState } from '../src/core/types/state.js';

const GUARD = 120;

function probe(id: string, seed: number): string {
  const encounter = ENCOUNTERS.find((e) => e.id === id);
  if (!encounter) return `${id}: no such encounter`;
  let state: GameState = createCombat(encounter, seed).state;

  let guard = 0;
  let lastDamageAt = 0;
  let hpBefore = state.players.player.hp + state.players.enemy.hp;
  let attacks = 0;
  let cards = 0;
  let channels = 0;

  while (!state.result && guard++ < GUARD) {
    for (const command of planTurn(state, state.activeSide)) {
      if (state.result) break;
      try {
        state = applyCommand(state, command).state;
      } catch {
        break;
      }
      if (command.type === 'attack') attacks++;
      else if (command.type === 'playCard') cards++;
      else if (command.type === 'channel') channels++;
    }
    const hp = state.players.player.hp + state.players.enemy.hp;
    if (hp < hpBefore) lastDamageAt = guard;
    hpBefore = hp;
  }

  const alive = (side: 'player' | 'enemy'): number =>
    Object.values(state.units).filter((u) => u.side === side && u.hp > 0).length;

  return (
    `${id.padEnd(20)} ${(state.result ?? 'STALLED').padEnd(8)} turn ${String(state.turn).padStart(3)}  ` +
    `pact ${String(state.players.player.hp).padStart(4)}/${String(state.players.enemy.hp).padStart(4)}  ` +
    `bodies ${alive('player')}v${alive('enemy')}  ` +
    `atk ${String(attacks).padStart(3)} card ${String(cards).padStart(3)} chan ${String(channels).padStart(3)}  ` +
    `last wound at side-turn ${lastDamageAt}/${guard}`
  );
}

const ids = process.argv.slice(2);
for (const id of ids.length ? ids : ['fouled_cistern']) {
  for (const seed of [1, 2, 3]) console.log(probe(id, seed));
  console.log('');
}
