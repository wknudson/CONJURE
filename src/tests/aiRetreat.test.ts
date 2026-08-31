import { describe, expect, it } from 'vitest';
import { findUnit, scenario } from './scenario.js';
import { planTurn, NOVICE_AI } from '../core/ai/controller.js';
import { enumerateActions } from '../core/ai/enumerate.js';
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
        { def: 'scout_imp', side: 'enemy', at: { x: 1, y: 6 }, hp: 20 },
        { def: 'grave_sentinel', side: 'player', at: { x: 0, y: 6 }, atk: 60, keywords: [] },
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
      enemyHp: 400,
      playerHp: 20,
      units: [
        { def: 'scout_imp', side: 'enemy', at: { x: 2, y: 5 }, hp: 10 },
        { def: 'grave_sentinel', side: 'player', at: { x: 2, y: 4 }, atk: 60, keywords: [] },
        { def: 'sap_wisp', side: 'player', at: { x: 2, y: 6 }, keywords: ['BoundForm'] },
      ],
    });
    const body = findUnit(state, 'sap_wisp', 'player');
    state.players.player.companionUnitId = body.id;
    state.players.player.companionUnitDefId = 'ignis_bound';
    state.activeSide = 'enemy';

    const commands = planTurn(state, 'enemy', NOVICE_AI);
    const hitPact = commands.some(
      (c) => c.type === 'attack' && c.target.kind === 'unit' && c.target.id === body.id,
    );
    expect(hitPact, 'a 1 HP imp should still take the winning swing').toBe(true);
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
        { def: 'scout_imp', side: 'enemy', at: { x: 2, y: 3 }, hp: 20 },
        { def: 'grave_sentinel', side: 'player', at: { x: 2, y: 5 }, atk: 60 },
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

describe('ranged kiting', () => {
  /**
   * A ranged body with a blade at its throat. Backward moves used to be pruned from
   * enumeration for everything but a Bound Form, so ranged bodies stood in melee and
   * traded — the roadmap carried the note for a week. A ranged body backing up is not
   * retreating, it is kiting: with move and attack independent, the step out of reach
   * costs it nothing it cannot still do from the new tile.
   *
   * A free-aim shooter rather than a §3 archetype, deliberately: a constrained shooter
   * standing off its line takes the `firingPosition` bonus for re-lining first, which is
   * correct behaviour and a different test. The keywords are stripped so the bound body
   * reads as a plain ranged minion. A narrow board and a slow blade, so there is no
   * lateral escape to muddy the reading and a MOV-1 attacker leaves genuinely safe
   * ground two steps back.
   */
  it("steps backward out of a blade's reach after shooting", () => {
    const state = scenario({
      width: 3,
      height: 5,
      units: [
        { def: 'gargoyle_bound', side: 'enemy', at: { x: 1, y: 3 }, keywords: [] },
        { def: 'rimeguard', side: 'player', at: { x: 1, y: 4 }, atk: 60, keywords: [] },
      ],
    });
    state.activeSide = 'enemy';
    const stalker = findUnit(state, 'gargoyle_bound', 'enemy');

    // The gate itself: backward moves for a ranged unit are candidates at all now.
    const backward = enumerateActions(state, 'enemy').filter(
      (c) => c.type === 'moveUnit' && c.unit === stalker.id && c.to.y < stalker.anchor.y,
    );
    expect(backward.length, 'backward moves should be enumerated for ranged').toBeGreaterThan(0);

    const danger = threatMap(state, 'enemy').damageByTile;
    expect(danger.get(coordKey(stalker.anchor)) ?? 0, 'the stalker starts in lethal danger')
      .toBeGreaterThanOrEqual(stalker.hp);

    const commands = planTurn(state, 'enemy', NOVICE_AI);
    const attacked = commands.some((c) => c.type === 'attack' && c.attacker === stalker.id);
    const moved = commands.find((c) => c.type === 'moveUnit' && c.unit === stalker.id);

    expect(attacked, 'the stalker should still take its shot').toBe(true);
    expect(moved, 'the stalker should not stand at the blade').toBeDefined();
    if (moved?.type === 'moveUnit') {
      expect(moved.to.y, 'the withdrawal should be backward — the move that used to be illegal to consider')
        .toBeLessThan(stalker.anchor.y);
      expect(danger.get(coordKey(moved.to)) ?? 0, 'and it should reach safe ground').toBe(0);
    }
  });

  it('still prunes backward moves for melee bodies', () => {
    // The pruning exists to keep the candidate list focused, and a bruiser walking
    // backwards is still almost never the best thing to do. Only reach buys the exception.
    const state = scenario({
      width: 3,
      height: 5,
      units: [
        { def: 'scout_imp', side: 'enemy', at: { x: 1, y: 3 } },
        { def: 'rimeguard', side: 'player', at: { x: 1, y: 4 }, atk: 60, keywords: [] },
      ],
    });
    state.activeSide = 'enemy';
    const imp = findUnit(state, 'scout_imp', 'enemy');

    const backward = enumerateActions(state, 'enemy').filter(
      (c) => c.type === 'moveUnit' && c.unit === imp.id && c.to.y < imp.anchor.y,
    );
    expect(backward.length, 'melee backward moves stay pruned').toBe(0);
  });
});
