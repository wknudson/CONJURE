/**
 * The Vanguard drill: every body in the third muster, fielded by the AI and made to fight.
 *
 * A body the AI never swings is a body the balance ledger cannot see and the player will
 * meet as dead weight — a Behemoth that cannot find a way into the lane, a turret that never
 * finds a target, a rider the planner does not know how to value. The ledger only plays the
 * encounters that exist, and none of these bodies are in one yet, so this puts each on the
 * Novice Duelist's ground on the enemy side and asks the one question that matters: does it
 * fight? The player's side is held passive (deploy, then end every turn), so the answer is
 * about the planner and not about who won the opening exchange.
 */

import { describe, expect, it } from 'vitest';
import { applyCommand } from '../core/engine/engine.js';
import { createCombat } from '../core/engine/setup.js';
import { planTurn } from '../core/ai/controller.js';
import { NOVICE_DUELIST } from '../core/data/encounters/index.js';
import type { EncounterDef } from '../core/data/encounters/registry.js';
import { VANGUARD_CARDS } from '../core/data/cards/vanguard.js';
import { isRosterEligible } from '../core/data/roster.js';
import type { GameState } from '../core/types/state.js';

/** Half-turns to give a body to reach something and swing at it. */
const DRILL_HALF_TURNS = 24;

function drill(defId: string, seed: number): { swung: boolean; moved: boolean; died: number } {
  const def = VANGUARD_CARDS[defId]!;
  // Behemoths anchor on the corner; everything else beside the free Footman at (3,1).
  const at: [number, number] = def.unit!.footprint === 2 ? [0, 0] : [2, 1];
  const encounter: EncounterDef = {
    ...NOVICE_DUELIST,
    id: `drill_${defId}`,
    enemyOpeningBoard: [[defId, at[0], at[1]]],
    enemyDeck: [],
  };
  let state: GameState = createCombat(encounter, seed).state;
  const body = Object.values(state.units).find((u) => u.defId === defId && u.side === 'enemy');
  expect(body, `${defId} was never placed`).toBeDefined();

  let swung = false;
  let moved = false;
  let died = -1;
  for (let half = 0; half < DRILL_HALF_TURNS && !state.result && !swung && died < 0; half++) {
    // The player's side holds still: it deploys and ends its turns and does nothing else.
    // A lone thin body against a whole army and a hand of spells dies on the approach, which
    // says nothing about whether the planner knows how to use it. With the other side
    // passive, the only question left is the one this file asks.
    const plan = planTurn(state, state.activeSide);
    const commands =
      state.activeSide === 'player'
        ? plan.filter((c) => c.type === 'finishDeployment' || c.type === 'endTurn')
        : plan;
    for (const command of commands) {
      if (state.result) break;
      try {
        const step = applyCommand(state, command);
        state = step.state;
        for (const ev of step.events) {
          if (ev.t === 'attackDeclared' && ev.attackerId === body!.id) swung = true;
          if (ev.t === 'unitMoved' && ev.unitId === body!.id) moved = true;
          if (ev.t === 'unitDied' && ev.unitId === body!.id) died = half;
        }
      } catch {
        break;
      }
    }
  }
  return { swung, moved, died };
}

describe('the third muster, drilled', () => {
  const ids = Object.keys(VANGUARD_CARDS);

  it('musters thirty-six bodies, every one of them fieldable', () => {
    expect(ids).toHaveLength(36);
    for (const id of ids) expect(isRosterEligible(VANGUARD_CARDS[id]!), id).toBe(true);
  });

  it.each(ids)('%s fights when the AI fields it', (id) => {
    // Two seeds, so one unlucky opening draw does not decide it -- but the second is only
    // played when the first did not swing. Each drill is a real AI game, and the file shares
    // the machine with the rest of the suite; playing a seed whose answer is already known
    // was the heaviest thing it did.
    const first = drill(id, 1);
    const results = first.swung ? [first] : [first, drill(id, 2)];
    expect(
      results.some((r) => r.swung),
      `${id} never swung in ${DRILL_HALF_TURNS} half-turns (moved: ${results.map((r) => r.moved)}, died at: ${results.map((r) => r.died)})`,
    ).toBe(true);
  });
});
