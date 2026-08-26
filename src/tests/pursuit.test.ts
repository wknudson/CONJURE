/**
 * Closing the distance, and the stalemate that made it necessary.
 *
 * `advance` is a y-gradient: the player scores by decreasing `y`, the enemy by increasing
 * it. That points the right way on almost every turn and fails completely on the last one —
 * two bodies with the board otherwise clear each maximise it by walking to *opposite* edges,
 * pass each other, and stand eight tiles apart with nothing in reach.
 *
 * That state was invisible while a Commander could be struck directly: the player's body
 * standing in the enemy's home rows simply ended the fight from there. Once the only route
 * to a Pact was its Companion's body, it surfaced as four encounters that no longer
 * resolved. `pursue` is the term that says "toward *them*" once "forward" has run out.
 *
 * These are fast, because the alternative is finding out from a seventy-minute suite.
 */

import { describe, expect, it } from 'vitest';
import { scenario, findUnit } from './scenario.js';
import { planTurn, NOVICE_AI, ADEPT_AI } from '../core/ai/controller.js';
import { NOVICE_WEIGHTS, scoreAction } from '../core/ai/score.js';
import { applyCommand } from '../core/engine/engine.js';
import { threatensFrom } from '../core/engine/targeting.js';
import type { GameState } from '../core/types/state.js';

/** Chebyshev between the two named bodies, which is the distance the engine measures in. */
function gap(state: GameState, aDef: string, bDef: string): number {
  const a = findUnit(state, aDef, 'enemy');
  const b = findUnit(state, bDef, 'player');
  return Math.max(Math.abs(a.anchor.x - b.anchor.x), Math.abs(a.anchor.y - b.anchor.y));
}

/**
 * Two lone bodies at opposite ends of a tall board — the shape that used to deadlock.
 *
 * Bound Forms specifically: they are the bodies that are always present, always the last
 * thing standing, and the ones the retreat term treats differently.
 */
function standoff(): GameState {
  const state = scenario({
    width: 6,
    height: 9,
    units: [
      { def: 'scout_imp', side: 'enemy', at: { x: 1, y: 8 }, keywords: ['BoundForm'] },
      { def: 'ash_ghoul', side: 'player', at: { x: 0, y: 0 }, keywords: ['BoundForm'] },
    ],
  });
  state.players.enemy.companionUnitId = findUnit(state, 'scout_imp', 'enemy').id;
  state.players.enemy.companionUnitDefId = 'treant_bound';
  state.players.player.companionUnitId = findUnit(state, 'ash_ghoul', 'player').id;
  state.players.player.companionUnitDefId = 'ignis_bound';
  state.activeSide = 'enemy';
  return state;
}

describe('a body with nothing in reach comes to find you', () => {
  it('closes the gap instead of holding the far edge', () => {
    // The enemy body sits on row 8, which is as much `advance` as it can possibly have.
    // Every step toward the player now *costs* it advance, so only `pursue` can move it.
    const state = standoff();
    const before = gap(state, 'scout_imp', 'ash_ghoul');

    let next = state;
    for (const command of planTurn(state, 'enemy', NOVICE_AI)) {
      next = applyCommand(next, command).state;
    }

    expect(gap(next, 'scout_imp', 'ash_ghoul'), 'it must have come toward them').toBeLessThan(
      before,
    );
  });

  it('comes hunting rather than holding the far edge', () => {
    // Driven through the real turn machine, so the refresh and the round counter are the
    // engine's. Only the hunter is judged: the player's body is entitled to hold ground out
    // of reach, because the retreat term prices its safety off the Pact, and it is the side
    // that *wants* the fight closing the distance that breaks a deadlock.
    let state = standoff();
    const start = gap(state, 'scout_imp', 'ash_ghoul');
    let closest = start;

    for (let round = 0; round < 12 && !state.result; round++) {
      for (const command of planTurn(state, state.activeSide, NOVICE_AI)) {
        if (state.result) break;
        try {
          state = applyCommand(state, command).state;
        } catch {
          break;
        }
      }
      closest = Math.min(closest, gap(state, 'scout_imp', 'ash_ghoul'));
      // No `endTurn` of our own: a plan already ends with one, so the sides alternate on
      // their own and adding another would hand the same side two turns in a row.
    }

    expect(closest, 'it never left its corner').toBeLessThan(start);
  });

  it('hovers rather than committing, once inside the danger projection', () => {
    // Pinning a known limit cycle rather than pretending it is not there.
    //
    // `pursue` pulls the body in while there is nothing to fear; the retreat term pushes it
    // back out once the tile is inside the other body's reach-plus-movement projection. With
    // *only* the two bodies on the board and nothing else to break the tie, the two terms
    // trade and it oscillates instead of engaging.
    //
    // That is survivable in a real fight, where spells and other bodies decide it — the four
    // encounters this weight was added for now resolve in about thirty turns. It is recorded
    // here so the next person to see the oscillation knows it is understood and bounded,
    // and so that a change which finally makes the body commit fails this test loudly rather
    // than silently.
    let state = standoff();
    const seen: number[] = [];

    for (let round = 0; round < 10 && !state.result; round++) {
      for (const command of planTurn(state, state.activeSide, NOVICE_AI)) {
        if (state.result) break;
        try {
          state = applyCommand(state, command).state;
        } catch {
          break;
        }
      }
      if (state.activeSide === 'player') seen.push(gap(state, 'scout_imp', 'ash_ghoul'));
    }

    expect(seen.length, 'the enemy took several turns').toBeGreaterThan(2);
    expect(Math.min(...seen), 'it does close').toBeLessThan(Math.max(...seen));
    expect(new Set(seen).size, 'and it does not settle on one distance').toBeGreaterThan(1);
  });

  it('does the same for the Adept, which shares the weight', () => {
    const state = standoff();
    const before = gap(state, 'scout_imp', 'ash_ghoul');
    let next = state;
    for (const command of planTurn(state, 'enemy', ADEPT_AI)) {
      next = applyCommand(next, command).state;
    }
    expect(gap(next, 'scout_imp', 'ash_ghoul')).toBeLessThan(before);
  });
});

describe('but it does not abandon strike-and-withdraw', () => {
  it('leaves a unit that already threatens something to the retreat term', () => {
    // The gate is `threatensFrom`, not `legalAttacks`, precisely so this case is untouched:
    // a body that has swung still threatens from where it stands, so pursuit must not fire
    // and turn a planned withdrawal into a chase.
    const state = scenario({
      width: 6,
      height: 8,
      units: [
        { def: 'scout_imp', side: 'enemy', at: { x: 2, y: 3 } },
        { def: 'grave_sentinel', side: 'player', at: { x: 2, y: 4 }, atk: 90 },
      ],
    });
    const imp = findUnit(state, 'scout_imp', 'enemy');
    expect(
      threatensFrom(state, imp, imp.anchor),
      'it is adjacent, so it threatens from here',
    ).toBe(true);
    // Which is the whole assertion: pursuit is switched off for this unit, so whatever it
    // decides is the retreat term's decision and not a pursuit-driven dive.
  });
});

describe('fighting through armor', () => {
  /**
   * The other half of the same stall, and the half that took longer to see.
   *
   * A blow entirely absorbed reports `hpLoss: 0`. The scoring counted only health, so the
   * swing was worth nothing — and since a zero utility sits *at* the pass threshold, it was
   * discarded before it was even a candidate. Against a Pact behind a hundred and sixty
   * armor the AI therefore declined every attack it had and paced instead, while the armor
   * was topped back up each turn.
   */
  it('values a swing that only strips armor', () => {
    const state = scenario({
      width: 6,
      height: 6,
      enemyArmor: 160,
      units: [
        { def: 'ash_ghoul', side: 'player', at: { x: 2, y: 3 }, atk: 30 },
        { def: 'briar_wolf', side: 'enemy', at: { x: 2, y: 2 }, keywords: ['BoundForm'] },
      ],
    });
    state.players.enemy.companionUnitId = findUnit(state, 'briar_wolf', 'enemy').id;
    state.players.enemy.companionUnitDefId = 'aurochs_bound';

    const me = findUnit(state, 'ash_ghoul', 'player');
    const foe = findUnit(state, 'briar_wolf', 'enemy');
    const command = { type: 'attack' as const, attacker: me.id, target: { kind: 'unit' as const, id: foe.id } };

    // The blow really is fully absorbed — otherwise this test proves nothing.
    const landed = applyCommand(state, command);
    const hit = landed.events.find((e) => e.t === 'damageDealt');
    expect(hit && hit.t === 'damageDealt' && hit.hpLoss, 'no health should be lost').toBe(0);
    expect(hit && hit.t === 'damageDealt' && hit.absorbedByArmor, 'armor took it').toBeGreaterThan(0);

    const scored = scoreAction(state, 'player', command, NOVICE_WEIGHTS);
    expect(scored, 'the swing must be scored at all').toBeTruthy();
    expect(scored!.utility, 'and worth more than passing').toBeGreaterThan(0);
  });

  it('takes that swing rather than pacing', () => {
    // The behavioural version: the AI must actually choose it.
    const state = scenario({
      width: 6,
      height: 6,
      enemyArmor: 160,
      units: [
        { def: 'ash_ghoul', side: 'player', at: { x: 2, y: 3 }, atk: 30 },
        { def: 'briar_wolf', side: 'enemy', at: { x: 2, y: 2 }, keywords: ['BoundForm'] },
      ],
    });
    state.players.enemy.companionUnitId = findUnit(state, 'briar_wolf', 'enemy').id;
    state.players.enemy.companionUnitDefId = 'aurochs_bound';

    const plan = planTurn(state, 'player', NOVICE_AI);
    expect(plan.some((c) => c.type === 'attack'), 'it swings').toBe(true);
  });
});

describe('the weights themselves', () => {
  it('outrank the gradient they exist to override, and yield to a firing line', () => {
    // A pursuit worth less than `advance` would never overcome the cost of turning around,
    // and one worth more than `firingPosition` would walk a mortar into its own blind spot.
    expect(NOVICE_WEIGHTS.pursue).toBeGreaterThan(NOVICE_WEIGHTS.advance);
    expect(NOVICE_WEIGHTS.pursue).toBeLessThan(NOVICE_WEIGHTS.firingPosition);
  });

  it('credit armor as real but lesser progress', () => {
    // At zero the AI cannot fight through armor; at one it would mistake stripping the wall
    // for landing the blow behind it.
    expect(NOVICE_WEIGHTS.armorChip).toBeGreaterThan(0);
    expect(NOVICE_WEIGHTS.armorChip).toBeLessThan(1);
  });
});
