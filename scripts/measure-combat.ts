/**
 * What a turn of combat is actually made of.
 *
 * The complaint this exists to test is "combat is dry — you can just attack every turn and
 * never play a card." That is a claim about numbers, and the numbers were never counted. This
 * plays every shipped encounter out and reports what the turns contained, so a change to the
 * economy can be judged against a before rather than argued about.
 *
 * **It measures the AI playing both sides.** `balance.test.ts` drives the player with
 * `planTurn` too, and so does this. That is a real limitation — a human hoards and combos
 * where the AI does not — but it is the right instrument for the question being asked, which
 * is whether the *economy* permits card play at all. If the AI cannot afford cards, neither
 * can a person.
 *
 * A script rather than an assertion in `balance.test.ts`, deliberately: that suite is already
 * the slowest in the repo, and this wants to print a table for comparison rather than pass or
 * fail.
 *
 *     npx tsx scripts/measure-combat.ts
 *     npx tsx scripts/measure-combat.ts --seeds 12
 */

import { applyCommand } from '../src/core/engine/engine.js';
import { createCombat } from '../src/core/engine/setup.js';
import { ENCOUNTERS } from '../src/core/data/encounters/index.js';
import { planTurn } from '../src/core/ai/controller.js';
import type { GameState } from '../src/core/types/state.js';
import type { Side } from '../src/contract/ids.js';

interface Tally {
  turns: number;
  cards: number;
  attacks: number;
  channels: number;
  moves: number;
  tithes: number;
  /** Pips still banked when a turn ended — the economy's slack. */
  pipsLeft: number[];
  /** Longest run of rounds in which neither commander was hurt. See the Pacifist Lockout. */
  worstStall: number;
  result: string;
}

const EMPTY = (): Tally => ({
  turns: 0,
  cards: 0,
  attacks: 0,
  channels: 0,
  moves: 0,
  tithes: 0,
  pipsLeft: [],
  worstStall: 0,
  result: 'stalled',
});

function playOut(encounterId: string, seed: number): Tally {
  const encounter = ENCOUNTERS.find((e) => e.id === encounterId)!;
  let state: GameState = createCombat(encounter, seed).state;
  const t = EMPTY();
  let guard = 0;

  // Tracked here rather than read off the state because `stalledRounds` is reset by the
  // lockout itself, so by the time it matters the evidence is gone.
  let stall = 0;
  let lastHp = state.players.player.hp + state.players.enemy.hp;

  while (!state.result && guard++ < 120) {
    const side: Side = state.activeSide;
    const before = state.players[side].pips;
    const plan = planTurn(state, side);

    for (const command of plan) {
      if (state.result) break;
      try {
        state = applyCommand(state, command).state;
      } catch {
        // The same swallow `balance.test.ts` uses: a plan may contain a command the board has
        // since invalidated, and that is the AI's business, not this script's.
        break;
      }
      if (command.type === 'playCard') t.cards++;
      else if (command.type === 'attack' || command.type === 'attackTile') t.attacks++;
      else if (command.type === 'channel') t.channels++;
      else if (command.type === 'moveUnit') t.moves++;
      else if (command.type === 'bloodTithe') t.tithes++;
      else if (command.type === 'endTurn') {
        t.turns++;
        // Sampled before cleanup clamps it, which is the number that says "you had spending
        // power and no way to use it".
        t.pipsLeft.push(before);
      }
    }

    const hp = state.players.player.hp + state.players.enemy.hp;
    if (hp < lastHp) stall = 0;
    else stall++;
    lastHp = hp;
    t.worstStall = Math.max(t.worstStall, Math.floor(stall / 2));
  }

  t.result = state.result ?? 'stalled';
  return t;
}

const seeds = Number(process.argv[process.argv.indexOf('--seeds') + 1]) || 6;
const per = (n: number, turns: number): string => (turns ? (n / turns).toFixed(2) : '—');
const mean = (xs: number[]): number => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

console.log(
  `${'encounter'.padEnd(26)} ${'turns'.padStart(6)} ${'cards/t'.padStart(8)} ` +
    `${'atk/t'.padStart(7)} ${'chan/t'.padStart(7)} ${'pips left'.padStart(10)} ${'stall'.padStart(6)}`,
);
console.log('-'.repeat(78));

const totals = EMPTY();
for (const encounter of ENCOUNTERS) {
  const runs = Array.from({ length: seeds }, (_u, i) => playOut(encounter.id, 1000 + i * 37));
  const turns = mean(runs.map((r) => r.turns));
  const row = {
    cards: mean(runs.map((r) => r.cards)),
    attacks: mean(runs.map((r) => r.attacks)),
    channels: mean(runs.map((r) => r.channels)),
    pips: mean(runs.flatMap((r) => r.pipsLeft)),
    stall: Math.max(...runs.map((r) => r.worstStall)),
  };
  totals.turns += turns;
  totals.cards += row.cards;
  totals.attacks += row.attacks;
  totals.channels += row.channels;
  totals.pipsLeft.push(row.pips);
  totals.worstStall = Math.max(totals.worstStall, row.stall);

  console.log(
    `${encounter.id.padEnd(26)} ${turns.toFixed(1).padStart(6)} ${per(row.cards, turns).padStart(8)} ` +
      `${per(row.attacks, turns).padStart(7)} ${per(row.channels, turns).padStart(7)} ` +
      `${row.pips.toFixed(1).padStart(10)} ${String(row.stall).padStart(6)}`,
  );
}

console.log('-'.repeat(78));
console.log(
  `${'ALL'.padEnd(26)} ${totals.turns.toFixed(1).padStart(6)} ` +
    `${per(totals.cards, totals.turns).padStart(8)} ${per(totals.attacks, totals.turns).padStart(7)} ` +
    `${per(totals.channels, totals.turns).padStart(7)} ${mean(totals.pipsLeft).toFixed(1).padStart(10)} ` +
    `${String(totals.worstStall).padStart(6)}`,
);
console.log(
  `\n${ENCOUNTERS.length} encounters x ${seeds} seeds. ` +
    `'stall' is the longest run of rounds with no commander damage; the Pacifist Lockout fires at 6.`,
);
