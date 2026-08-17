import { describe, expect, it } from 'vitest';
import { findUnit, scenario } from './scenario.js';
import { planTurn, NOVICE_AI } from '../core/ai/controller.js';
import { applyCommand } from '../core/engine/engine.js';
import { NOVICE_WEIGHTS } from '../core/ai/score.js';
import { threatMap } from '../core/engine/threat.js';
import { coordKey } from '../contract/ids.js';

/**
 * Independent actions gave both sides the ability to strike and withdraw. These check
 * the AI actually uses it, and — just as importantly — that it does not turtle or
 * oscillate as a result.
 */
describe('AI retreat', () => {
  it('pulls a wounded attacker out of reach after it swings', () => {
    // A fragile enemy skirmisher already deep in the player's home rows, so its best
    // opening is a swing at the Commander rather than more advancing. A slow, hard
    // hitting player unit covers the left of the board; the right is safe.
    //
    // The board is deliberately wide: on a narrow one a MOV 2 melee unit threatens every
    // column, leaving nowhere to withdraw to and nothing to measure.
    //
    // The player unit's keywords are stripped — a Grave Sentinel's Counter would make
    // attacking it correctly suicidal, which would test the wrong thing.
    const state = scenario({
      width: 10,
      height: 8,
      units: [
        { def: 'scout_imp', side: 'enemy', at: { x: 1, y: 6 }, hp: 2 },
        { def: 'grave_sentinel', side: 'player', at: { x: 0, y: 6 }, atk: 6, keywords: [] },
      ],
    });
    state.activeSide = 'enemy';

    const imp = findUnit(state, 'scout_imp', 'enemy');
    const danger = threatMap(state, 'enemy').damageByTile;
    const before = danger.get(coordKey(imp.anchor)) ?? 0;
    expect(before, 'the imp should start in lethal danger').toBeGreaterThanOrEqual(imp.hp);

    const commands = planTurn(state, 'enemy', NOVICE_AI);
    const attacked = commands.some((c) => c.type === 'attack' && c.attacker === imp.id);
    const moved = commands.find((c) => c.type === 'moveUnit' && c.unit === imp.id);

    expect(attacked, 'the imp should take its free swing').toBe(true);
    expect(moved, 'the imp should not stand in melee range afterwards').toBeDefined();

    const after = moved?.type === 'moveUnit' ? (danger.get(coordKey(moved.to)) ?? 0) : 0;
    expect(after, 'the withdrawal should reach a safer tile').toBeLessThan(before);
  });

  it('prefers a lethal dive over retreating, when one is available', () => {
    // The counterweight to the test above: retreat must never make the AI passive when
    // it can actually close out the game.
    const state = scenario({
      width: 6,
      height: 8,
      enemyHp: 40,
      playerHp: 2,
      units: [
        { def: 'scout_imp', side: 'enemy', at: { x: 2, y: 5 }, hp: 1 },
        { def: 'grave_sentinel', side: 'player', at: { x: 2, y: 4 }, atk: 6, keywords: [] },
      ],
    });
    state.activeSide = 'enemy';

    const commands = planTurn(state, 'enemy', NOVICE_AI);
    const hitFace = commands.some(
      (c) => c.type === 'attack' && c.target.kind === 'portrait' && c.target.side === 'player',
    );
    expect(hitFace, 'a 1 HP imp should still take the winning swing').toBe(true);
  });

  it('still presses forward when nothing threatens it', () => {
    // With no player units on the board, retreat scoring must not make the AI shuffle
    // backwards — advancing on the commander has to remain the plan.
    const state = scenario({
      width: 6,
      height: 8,
      units: [{ def: 'scout_imp', side: 'enemy', at: { x: 2, y: 1 } }],
    });
    state.activeSide = 'enemy';
    const imp = findUnit(state, 'scout_imp', 'enemy');

    const commands = planTurn(state, 'enemy', NOVICE_AI);
    const move = commands.find((c) => c.type === 'moveUnit' && c.unit === imp.id);

    expect(move, 'an unthreatened unit should still advance').toBeDefined();
    if (move?.type === 'moveUnit') {
      // The player's side is at high y, so advancing means increasing y.
      expect(move.to.y).toBeGreaterThan(imp.anchor.y);
    }
  });

  it('does not oscillate between the same two tiles across turns', () => {
    const state = scenario({
      width: 6,
      height: 8,
      units: [
        { def: 'scout_imp', side: 'enemy', at: { x: 2, y: 3 }, hp: 2 },
        { def: 'grave_sentinel', side: 'player', at: { x: 2, y: 5 }, atk: 6 },
      ],
    });
    state.activeSide = 'enemy';

    const imp = findUnit(state, 'scout_imp', 'enemy');
    const visited: string[] = [coordKey(imp.anchor)];
    let cur = state;

    for (let round = 0; round < 6 && cur.units[imp.id]; round++) {
      for (const command of planTurn(cur, 'enemy', NOVICE_AI)) {
        try {
          cur = applyCommand(cur, command).state;
        } catch {
          break;
        }
        if (cur.result) break;
      }
      if (cur.result) break;
      const now = cur.units[imp.id];
      if (!now) break;
      visited.push(coordKey(now.anchor));
      // Hand the turn back so the next plan starts from a fresh turn.
      cur = applyCommand(cur, { type: 'endTurn' }).state;
      if (cur.activeSide !== 'enemy') cur = applyCommand(cur, { type: 'endTurn' }).state;
    }

    // A true oscillation is A,B,A,B,A. Allow revisiting a tile, but not a repeating
    // two-cycle across the whole run.
    let alternations = 0;
    for (let i = 2; i < visited.length; i++) {
      if (visited[i] === visited[i - 2] && visited[i] !== visited[i - 1]) alternations++;
    }
    expect(alternations, `path was ${visited.join(' -> ')}`).toBeLessThan(3);
  });

  it('keeps retreat weighted below pressing an advantage', () => {
    // The guard that stops the AI turtling: one point of face damage must always be
    // worth more than one point of dodged damage.
    expect(NOVICE_WEIGHTS.retreat).toBeLessThan(NOVICE_WEIGHTS.face);
    expect(NOVICE_WEIGHTS.retreat).toBeLessThan(NOVICE_WEIGHTS.kill);
  });
});
