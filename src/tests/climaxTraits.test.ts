import { describe, expect, it } from 'vitest';
import { addUnit, eventsOf, run, scenario } from './scenario.js';
import { applyCommand } from '../core/engine/engine.js';
import { legalMoves } from '../core/engine/movement.js';
import { killEntity, OVERGROWTH_BURST_TOXIN } from '../core/engine/death.js';
import { makeCtx } from '../core/engine/context.js';
import { AURAS } from '../core/data/auras.js';
import { coordKey } from '../contract/ids.js';
import type { GameState } from '../core/types/state.js';
import type { Unit } from '../core/types/units.js';

/**
 * The five Climax traits that are not about movement.
 *
 * For a long while only Overload and Heavy Footprint were built, while every Aura's card
 * text sold its Climax as a promise: "it burns what it strikes", "it drinks what it
 * wounds", "it steps to anywhere it sees". Five of seven third stacks did nothing but
 * unlock a Detonation target. These hold each promise to the board, at the seam it hangs
 * off — the attack rider, the corpse, the start-of-turn tick, the move list.
 */

/** A unit wearing a fully-grown Aura, without waiting three rounds for it. */
function climaxed(state: GameState, unitId: string, aura: string): Unit {
  const unit = state.units[unitId]!;
  unit.aura = { defId: aura, stacks: 3 };
  return unit;
}

/** A board where nothing else can end the fight. Plenty of Bones, so every swing is funded. */
const board = () => scenario({ width: 7, height: 8, playerHp: 5000, enemyHp: 5000, bones: 8 });

const swing = (state: GameState, attacker: string, target: string) =>
  applyCommand(state, { type: 'attack', attacker, target: { kind: 'unit', id: target } });

describe('Conflagration: it burns what it strikes, and the ground it leaves', () => {
  it('ignites the body it wounds', () => {
    const state = board();
    const host = addUnit(state, { def: 'scout_imp', side: 'player', at: { x: 3, y: 4 }, fresh: false });
    const foe = addUnit(state, { def: 'anvil_lord', side: 'enemy', at: { x: 3, y: 3 }, hp: 500 });
    climaxed(state, host.id, 'aura_conflagration');

    const res = swing(state, host.id, foe.id);
    expect(res.state.units[foe.id]!.statuses.burn).toBe(2);
  });

  it('does not ignite through a blow that armour soaked entirely', () => {
    // The rider's wound rule, inherited rather than restated.
    const state = board();
    const host = addUnit(state, { def: 'scout_imp', side: 'player', at: { x: 3, y: 4 }, fresh: false });
    const foe = addUnit(state, { def: 'anvil_lord', side: 'enemy', at: { x: 3, y: 3 }, hp: 500, armor: 900 });
    climaxed(state, host.id, 'aura_conflagration');

    const res = swing(state, host.id, foe.id);
    expect(res.state.units[foe.id]!.statuses.burn).toBeUndefined();
  });

  it('leaves fire on the tile it walked off', () => {
    const state = board();
    const host = addUnit(state, { def: 'scout_imp', side: 'player', at: { x: 3, y: 4 }, fresh: false });
    climaxed(state, host.id, 'aura_conflagration');

    const res = applyCommand(state, { type: 'moveUnit', unit: host.id, to: { x: 3, y: 3 } });
    expect(res.state.hazards[coordKey({ x: 3, y: 4 })]?.kind, 'where it stood').toBe('burning');
    expect(res.state.hazards[coordKey({ x: 3, y: 3 })], 'not where it stands').toBeUndefined();
  });

  it('leaves nothing before Climax', () => {
    const state = board();
    const host = addUnit(state, { def: 'scout_imp', side: 'player', at: { x: 3, y: 4 }, fresh: false });
    state.units[host.id]!.aura = { defId: 'aura_conflagration', stacks: 2 };

    const res = applyCommand(state, { type: 'moveUnit', unit: host.id, to: { x: 3, y: 3 } });
    expect(Object.keys(res.state.hazards)).toHaveLength(0);
  });
});

describe('Overgrowth: it drinks what it wounds, and bursts when it dies', () => {
  it('heals the host by the health its blow actually took', () => {
    const state = board();
    const host = addUnit(state, { def: 'scout_imp', side: 'player', at: { x: 3, y: 4 }, fresh: false, hp: 5 });
    const foe = addUnit(state, { def: 'anvil_lord', side: 'enemy', at: { x: 3, y: 3 }, hp: 500 });
    climaxed(state, host.id, 'aura_overgrowth');
    // Give it a ceiling to heal toward — the fixture summoned it at 5 of its printed max.
    const before = state.units[host.id]!.hp;
    const atk = state.units[host.id]!.atk;

    const res = swing(state, host.id, foe.id);
    const after = res.state.units[host.id]!;
    expect(after.hp).toBe(Math.min(after.maxHp, before + atk));
    expect(eventsOf(res.events, 'healed').some((e) => e.target.kind === 'unit' && e.target.id === host.id)).toBe(true);
  });

  it('drinks nothing from a blow that armour soaked', () => {
    const state = board();
    const host = addUnit(state, { def: 'scout_imp', side: 'player', at: { x: 3, y: 4 }, fresh: false, hp: 5 });
    const foe = addUnit(state, { def: 'anvil_lord', side: 'enemy', at: { x: 3, y: 3 }, hp: 500, armor: 900 });
    climaxed(state, host.id, 'aura_overgrowth');

    const res = swing(state, host.id, foe.id);
    expect(res.state.units[host.id]!.hp).toBe(5);
  });

  it('poisons the enemies beside its corpse, and nobody else', () => {
    const state = board();
    const host = addUnit(state, { def: 'scout_imp', side: 'player', at: { x: 3, y: 4 }, fresh: false });
    const foe = addUnit(state, { def: 'scout_imp', side: 'enemy', at: { x: 3, y: 3 } });
    const friend = addUnit(state, { def: 'scout_imp', side: 'player', at: { x: 2, y: 4 } });
    const far = addUnit(state, { def: 'scout_imp', side: 'enemy', at: { x: 5, y: 1 } });
    climaxed(state, host.id, 'aura_overgrowth');

    killEntity(makeCtx(state), state.units[host.id]!, 'spell');

    expect(state.units[foe.id]!.statuses.toxin).toBe(OVERGROWTH_BURST_TOXIN);
    expect(state.units[friend.id]!.statuses.toxin, 'its own side').toBeUndefined();
    expect(state.units[far.id]!.statuses.toxin, 'out of reach').toBeUndefined();
  });
});

describe('Hollow: its wounds fester', () => {
  it('leaves what it wounds Brittle', () => {
    const state = board();
    const host = addUnit(state, { def: 'scout_imp', side: 'player', at: { x: 3, y: 4 }, fresh: false });
    const foe = addUnit(state, { def: 'anvil_lord', side: 'enemy', at: { x: 3, y: 3 }, hp: 500 });
    climaxed(state, host.id, 'aura_marrow_siphon');

    const res = swing(state, host.id, foe.id);
    expect(res.state.units[foe.id]!.statuses.brittle).toBe(1);
  });

  it('so the next blow that turn lands harder', () => {
    const state = board();
    const host = addUnit(state, { def: 'scout_imp', side: 'player', at: { x: 3, y: 4 }, fresh: false });
    const second = addUnit(state, { def: 'scout_imp', side: 'player', at: { x: 4, y: 4 }, fresh: false });
    const foe = addUnit(state, { def: 'anvil_lord', side: 'enemy', at: { x: 3, y: 3 }, hp: 500 });
    climaxed(state, host.id, 'aura_marrow_siphon');

    const first = swing(state, host.id, foe.id);
    const hpAfterFirst = first.state.units[foe.id]!.hp;
    const followUp = swing(first.state, second.id, foe.id);
    const taken = hpAfterFirst - followUp.state.units[foe.id]!.hp;
    expect(taken, 'the follow-up bites deeper than its printed swing').toBeGreaterThan(second.atk);
  });
});

describe('Rime Shell: the plate re-forms', () => {
  const STEP = AURAS.aura_rime_shell!.passiveStat.armor!;
  const CEILING = STEP * AURAS.aura_rime_shell!.maxStacks;

  it('refunds one step of armour at the start of each of its turns', () => {
    const state = board();
    const host = addUnit(state, { def: 'scout_imp', side: 'player', at: { x: 3, y: 6 }, fresh: false });
    climaxed(state, host.id, 'aura_rime_shell');
    state.units[host.id]!.armor = 0;

    const round = run(state, { type: 'endTurn' }, { type: 'endTurn' });
    expect(round.state.units[host.id]!.armor).toBe(STEP);
    expect(eventsOf(round.events, 'armorGained').some((e) => e.target.kind === 'unit' && e.target.id === host.id)).toBe(true);
  });

  it('stops at three stacks worth, so a wall left alone gets hard rather than unkillable', () => {
    const state = board();
    const host = addUnit(state, { def: 'scout_imp', side: 'player', at: { x: 3, y: 6 }, fresh: false });
    climaxed(state, host.id, 'aura_rime_shell');
    state.units[host.id]!.armor = CEILING;

    const round = run(state, { type: 'endTurn' }, { type: 'endTurn' });
    expect(round.state.units[host.id]!.armor).toBe(CEILING);
  });

  it('does nothing before Climax', () => {
    const state = board();
    const host = addUnit(state, { def: 'scout_imp', side: 'player', at: { x: 3, y: 6 }, fresh: false });
    state.units[host.id]!.aura = { defId: 'aura_rime_shell', stacks: 1 };
    state.units[host.id]!.armor = 0;

    const round = run(state, { type: 'endTurn' }, { type: 'endTurn' });
    // Stack 2 pays its printed step; that is growth, not the Climax refund. Nothing beyond it.
    expect(round.state.units[host.id]!.armor).toBe(STEP);
  });
});

describe('Blink: it steps to anywhere it sees', () => {
  const canReach = (state: GameState, unitId: string, to: { x: number; y: number }) =>
    legalMoves(state, state.units[unitId]!).some((m) => m.to.x === to.x && m.to.y === to.y);

  it('reaches an empty tile far beyond its stride', () => {
    const state = board();
    const host = addUnit(state, { def: 'scout_imp', side: 'player', at: { x: 3, y: 7 }, fresh: false });
    const far = { x: 3, y: 0 };
    expect(canReach(state, host.id, far), 'out of stride before Climax').toBe(false);

    climaxed(state, host.id, 'aura_written_path');
    expect(canReach(state, host.id, far), 'a step through nothing after').toBe(true);
  });

  it('may not land on a body, and may not step to what it cannot see', () => {
    // A wall rather than a body for the sightline: ordinary bodies do not block sight in
    // this engine — only a Guardian does — so "behind a body" is in plain view, and the
    // test would be asserting a rule the game does not have.
    const state = scenario({
      width: 7,
      height: 8,
      playerHp: 5000,
      enemyHp: 5000,
      bones: 8,
      obstacles: [{ at: { x: 3, y: 3 } }],
    });
    const host = addUnit(state, { def: 'scout_imp', side: 'player', at: { x: 3, y: 7 }, fresh: false });
    const blocker = addUnit(state, { def: 'scout_imp', side: 'enemy', at: { x: 4, y: 5 } });
    climaxed(state, host.id, 'aura_written_path');

    expect(canReach(state, host.id, blocker.anchor), 'occupied by a body').toBe(false);
    expect(canReach(state, host.id, { x: 3, y: 3 }), 'occupied by a wall').toBe(false);
    // Straight behind the wall on the same file: the stone is in the way of the line.
    expect(canReach(state, host.id, { x: 3, y: 1 }), 'behind a wall').toBe(false);
    // Off to the side, the line is clear.
    expect(canReach(state, host.id, { x: 0, y: 1 }), 'in plain view').toBe(true);
  });

  it('is clamped by fog like everything else that sees', () => {
    const state = board();
    state.encounter.weather = { kind: 'fog' } as GameState['encounter']['weather'];
    const host = addUnit(state, { def: 'scout_imp', side: 'player', at: { x: 3, y: 7 }, fresh: false });
    climaxed(state, host.id, 'aura_written_path');

    expect(canReach(state, host.id, { x: 3, y: 4 }), 'three tiles: visible').toBe(true);
    expect(canReach(state, host.id, { x: 3, y: 3 }), 'four tiles: lost in the fog').toBe(false);
  });

  it('is still one move: a body that has stepped may not step again', () => {
    const state = board();
    const host = addUnit(state, { def: 'scout_imp', side: 'player', at: { x: 3, y: 7 }, fresh: false });
    climaxed(state, host.id, 'aura_written_path');

    const res = applyCommand(state, { type: 'moveUnit', unit: host.id, to: { x: 3, y: 0 } });
    expect(res.state.units[host.id]!.anchor).toEqual({ x: 3, y: 0 });
    expect(legalMoves(res.state, res.state.units[host.id]!)).toHaveLength(0);
  });
});
