import { describe, expect, it } from 'vitest';
import { addUnit, eventsOf, run, scenario } from './scenario.js';
import { applyCommand } from '../core/engine/engine.js';
import { legalAttacks, sacrificeCandidates } from '../core/engine/targeting.js';
import { enumerateActions } from '../core/ai/enumerate.js';
import { threatMap } from '../core/engine/threat.js';
import { CombatSession } from '../core/session.js';
import { NOVICE_DUELIST } from '../core/data/encounters/index.js';
import { CARDS } from '../core/data/cards/index.js';
import type { GameState } from '../core/types/state.js';

/**
 * Wildlife: things on the board that belong to neither army.
 *
 * The rule underneath all of it is that a beast has no allies and no owner. Everything
 * else — that either side may kill it, that the AI cannot command it, that shoving an
 * enemy into its path works — falls out of that.
 */

/** A wolf between the two lines, with a unit from each side nearby. */
function standoff(): { state: GameState; wolf: string; mine: string; theirs: string } {
  const state = scenario({ width: 6, height: 8 });
  const wolf = addUnit(state, { def: 'ridge_wolf', side: 'enemy', at: { x: 2, y: 4 } });
  const mine = addUnit(state, { def: 'scout_imp', side: 'player', at: { x: 2, y: 5 } });
  const theirs = addUnit(state, { def: 'scout_imp', side: 'enemy', at: { x: 2, y: 3 } });
  return { state, wolf: wolf.id, mine: mine.id, theirs: theirs.id };
}

describe('a beast has no allies', () => {
  it('can be attacked by the side it is filed under', () => {
    const { state, wolf, theirs } = standoff();
    const targets = legalAttacks(state, state.units[theirs]!);
    expect(targets.some((t) => t.kind === 'unit' && t.id === wolf)).toBe(true);
  });

  it('can be attacked by the other side too', () => {
    const { state, wolf, mine } = standoff();
    const targets = legalAttacks(state, state.units[mine]!);
    expect(targets.some((t) => t.kind === 'unit' && t.id === wolf)).toBe(true);
  });

  it('will bite the side it is filed under', () => {
    // "Hostile to both" has to hold in the direction that is easy to get wrong.
    const { state, wolf, theirs } = standoff();
    const targets = legalAttacks(state, state.units[wolf]!);
    expect(targets.some((t) => t.kind === 'unit' && t.id === theirs)).toBe(true);
  });

  it('will not bite another beast', () => {
    const state = scenario({ width: 6, height: 8 });
    const a = addUnit(state, { def: 'ridge_wolf', side: 'enemy', at: { x: 2, y: 4 } });
    const b = addUnit(state, { def: 'ridge_wolf', side: 'enemy', at: { x: 2, y: 3 } });

    const targets = legalAttacks(state, state.units[a.id]!);
    expect(targets.some((t) => t.kind === 'unit' && t.id === b.id)).toBe(false);
  });
});

describe('nobody commands it', () => {
  it('is never offered to the AI as one of its own units', () => {
    const { state, wolf } = standoff();
    state.activeSide = 'enemy';

    const actions = enumerateActions(state, 'enemy');
    const usingWolf = actions.filter(
      (a) =>
        (a.type === 'moveUnit' && a.unit === wolf) ||
        (a.type === 'attack' && a.attacker === wolf) ||
        (a.type === 'channel' && a.unit === wolf),
    );

    expect(usingWolf).toHaveLength(0);
  });

  it('is still offered to the AI as something to kill', () => {
    const { state, wolf } = standoff();
    state.activeSide = 'enemy';

    const actions = enumerateActions(state, 'enemy');
    expect(
      actions.some((a) => a.type === 'attack' && a.target.kind === 'unit' && a.target.id === wolf),
    ).toBe(true);
  });

  it('cannot be sacrificed by the side it sits with', () => {
    const { state } = standoff();
    expect(sacrificeCandidates(state, 'enemy').some((u) => u.defId === 'ridge_wolf')).toBe(false);
  });

  it('counts as a danger to both sides on the threat map', () => {
    const { state, wolf } = standoff();
    // The player sees it coming...
    expect(threatMap(state, 'player').tiles.length).toBeGreaterThan(0);
    // ...and so does the side it is nominally filed under.
    const theirThreat = threatMap(state, 'enemy');
    expect(theirThreat.tiles.length, 'a wolf endangers its own side too').toBeGreaterThan(0);
    expect(state.units[wolf]!.keywords).toContain('Feral');
  });
});

describe('the beast takes its turn', () => {
  it('mauls whatever is nearest when the round comes round', () => {
    const state = scenario({ width: 6, height: 8 });
    state.encounter.id = 'novice_duelist';
    addUnit(state, { def: 'ridge_wolf', side: 'enemy', at: { x: 2, y: 4 } });
    const victim = addUnit(state, {
      def: 'grave_sentinel',
      side: 'player',
      at: { x: 2, y: 5 },
      hp: 20,
      keywords: [],
    });

    const res = run(state, { type: 'endTurn' });

    expect(res.state.units[victim.id]!.hp).toBeLessThan(20);
  });

  it('goes for its own side when they are the closer meal', () => {
    const state = scenario({ width: 6, height: 8 });
    state.encounter.id = 'novice_duelist';
    addUnit(state, { def: 'ridge_wolf', side: 'enemy', at: { x: 2, y: 4 } });
    const ally = addUnit(state, {
      def: 'grave_sentinel',
      side: 'enemy',
      at: { x: 2, y: 3 },
      hp: 20,
      keywords: [],
    });
    // The player's unit is further away.
    addUnit(state, { def: 'grave_sentinel', side: 'player', at: { x: 5, y: 7 }, hp: 20, keywords: [] });

    const res = run(state, { type: 'endTurn' });

    expect(res.state.units[ally.id]!.hp, 'the wolf ate what was closest').toBeLessThan(20);
  });
});

describe('the scavenger', () => {
  it('turns up on the duelist road and runs', () => {
    const session = new CombatSession(NOVICE_DUELIST, 5);
    let seen = false;

    for (let i = 0; i < 4 && !session.isOver(); i++) {
      session.dispatch({ type: 'endTurn' });
      session.runAiTurn();
      if (session.getBoard().units.some((u) => u.defId === 'gilded_scavenger')) seen = true;
    }

    expect(seen, 'a scavenger should have wandered through by now').toBe(true);
  });

  it('never attacks anything', () => {
    const state = scenario({ width: 6, height: 8 });
    const scav = addUnit(state, { def: 'gilded_scavenger', side: 'enemy', at: { x: 2, y: 4 } });
    addUnit(state, { def: 'scout_imp', side: 'player', at: { x: 2, y: 5 } });

    // 0 ATK is the design; the flee step never issues an attack either.
    expect(state.units[scav.id]!.atk).toBe(0);
    expect(CARDS.gilded_scavenger!.unit!.atk).toBe(0);
  });

  it('pays a purse to whoever brings it down', () => {
    const state = scenario({ width: 6, height: 8, marrow: 0 });
    const scav = addUnit(state, {
      def: 'gilded_scavenger',
      side: 'enemy',
      at: { x: 2, y: 4 },
      hp: 1,
    });
    const hunter = addUnit(state, { def: 'magma_brute', side: 'player', at: { x: 2, y: 5 } });

    const res = applyCommand(state, {
      type: 'attack',
      attacker: hunter.id,
      target: { kind: 'unit', id: scav.id },
    });

    expect(res.state.units[scav.id]).toBeUndefined();
    expect(res.state.players.player.marrow).toBe(CARDS.gilded_scavenger!.bounty!.marrow);
  });

  it('leaves without dying when it reaches the edge in time', () => {
    // Escaping is not a death: nothing killed it, and nobody is owed the kill.
    const state = scenario({ width: 6, height: 8 });
    state.encounter.id = 'novice_duelist';
    state.turn = 20; // well past its patience
    const scav = addUnit(state, { def: 'gilded_scavenger', side: 'enemy', at: { x: 0, y: 4 } });

    const res = run(state, { type: 'endTurn' });

    expect(res.state.units[scav.id]).toBeUndefined();
    expect(eventsOf(res.events, 'unitEscaped').length).toBeGreaterThan(0);
    expect(eventsOf(res.events, 'unitDied').some((e) => e.unitId === scav.id)).toBe(false);
  });
});
