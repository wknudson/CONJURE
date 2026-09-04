import { describe, expect, it } from 'vitest';
import { addUnit, eventsOf, run, scenario } from './scenario.js';
import { makeCtx } from '../core/engine/context.js';
import { legalMoves } from '../core/engine/movement.js';
import { startOfTurnStatuses } from '../core/engine/status.js';
import { dealDamage } from '../core/engine/damage.js';
import { killEntity } from '../core/engine/death.js';
import { AURAS } from '../core/data/auras.js';
import { COMPANION_TRAITS } from '../core/data/companionTraits.js';
import type { GameState } from '../core/types/state.js';

/**
 * The nine knacks that were declared and not built, one test each at the chokepoint the
 * boon is read — the same seam the wired knacks are tested at in `hybridCompanions.test`.
 * Each is set directly on the side's state, which is where `createCombat` puts it.
 */
const enemyTurn = (state: GameState): void => {
  state.activeSide = 'enemy';
  state.players.enemy.bones = 5;
};

describe('Static Burn (wasp) — Burning enemies move one tile less', () => {
  const stride = (burn: number, boon: number): number => {
    const state = scenario({ width: 6, height: 8 });
    const foe = addUnit(state, { def: 'vanguard_footman', side: 'enemy', at: { x: 2, y: 2 } });
    if (burn) foe.statuses.burn = burn;
    state.players.player.burnSlows = boon;
    return Math.max(0, ...legalMoves(state, state.units[foe.id]!).map((m) => m.cost));
  };
  it('costs a burning enemy a tile, and only a burning one, and only with the knack', () => {
    expect(stride(0, 0)).toBe(2);
    expect(stride(1, 0), 'no knack').toBe(2);
    expect(stride(0, 1), 'not burning').toBe(2);
    expect(stride(1, 1), 'burning, knack').toBe(1);
  });
});

describe('Ember Spores (treant) — a Toxin tick lights Burn', () => {
  const tick = (boon: number) => {
    const state = scenario({ width: 6, height: 8 });
    const foe = addUnit(state, { def: 'vanguard_footman', side: 'enemy', at: { x: 2, y: 2 } });
    foe.statuses.toxin = 2;
    state.players.player.toxinKindles = boon;
    const ctx = makeCtx(state);
    startOfTurnStatuses(ctx, 'enemy');
    return { unit: state.units[foe.id]!, ticks: eventsOf(ctx.events, 'statusTicked').map((e) => e.status) };
  };
  it('lands one Burn per tick, after the Burn pass so it is carried into the next turn', () => {
    const { unit: lit, ticks } = tick(1);
    expect(lit.statuses.burn).toBe(1);
    expect(lit.statuses.toxin, 'the toxin ticked and came off a stack').toBe(1);
    // Only the Toxin ticked. A Burn landed mid-pass would have ticked too, and been gone.
    expect(ticks).toEqual(['toxin']);
    expect(tick(0).unit.statuses.burn).toBeUndefined();
  });
});

describe('Lightning Rod (mantis) — a Guardian shot from range charges the shooter', () => {
  const shoot = (boon: boolean, from: { x: number; y: number }, def: string) => {
    const state = scenario({ width: 6, height: 8 });
    const wall = addUnit(state, { def: 'grave_sentinel', side: 'player', at: { x: 2, y: 4 }, hp: 200 });
    const shooter = addUnit(state, { def, side: 'enemy', at: from });
    state.players.player.guardiansCharge = boon;
    enemyTurn(state);
    const after = run(state, { type: 'attack', attacker: shooter.id, target: { kind: 'unit', id: wall.id } }).state;
    return after.units[shooter.id]!.statuses.charged;
  };
  it('charges a ranged attacker, not a melee one, and only with the knack', () => {
    expect(shoot(true, { x: 2, y: 2 }, 'cinder_adder'), 'from range').toBe(1);
    expect(shoot(false, { x: 2, y: 2 }, 'cinder_adder'), 'no knack').toBeUndefined();
    expect(shoot(true, { x: 2, y: 3 }, 'vanguard_footman'), 'adjacent').toBeUndefined();
  });
});

describe('Frost-Reaper (gargoyle) — Dusk damage on a Chilled body leaves Brittle', () => {
  const wound = (boon: boolean, dtype: 'decay' | 'fire', chill: number) => {
    const state = scenario({ width: 6, height: 8 });
    const foe = addUnit(state, { def: 'vanguard_footman', side: 'enemy', at: { x: 2, y: 2 }, hp: 60 });
    if (chill) foe.statuses.chill = chill;
    state.players.player.duskBrittlesChilled = boon;
    dealDamage(makeCtx(state), { target: { kind: 'unit', id: foe.id }, amount: 10, dtype, cause: 'spell' });
    return state.units[foe.id]!.statuses.brittle;
  };
  it('brittles only a Chilled body, only from Dusk, only with the knack', () => {
    expect(wound(true, 'decay', 1)).toBe(1);
    expect(wound(false, 'decay', 1), 'no knack').toBeUndefined();
    expect(wound(true, 'fire', 1), 'not Dusk').toBeUndefined();
    expect(wound(true, 'decay', 0), 'not Chilled').toBeUndefined();
  });
});

describe('Hollow Ice (gargoyle) — a Climaxed Hollow host leaves an Ice Barricade', () => {
  const [hollowId, hollow] = Object.entries(AURAS).find(([, a]) => a.climaxTrait === 'hollow')!;
  const fall = (boon: boolean) => {
    const state = scenario({ width: 6, height: 8 });
    const host = addUnit(state, { def: 'vanguard_footman', side: 'player', at: { x: 3, y: 3 } });
    host.aura = { defId: hollowId, stacks: hollow.maxStacks };
    state.players.player.hollowLeavesIce = boon;
    killEntity(makeCtx(state), state.units[host.id]!, 'spell');
    return Object.values(state.obstacles).find((o) => o.anchor.x === 3 && o.anchor.y === 3);
  };
  it('raises the wall where the host stood, and only with the knack', () => {
    expect(hollow, 'a Hollow aura exists').toBeDefined();
    expect(fall(true)?.defId).toBe('ice_barricade');
    expect(fall(false)).toBeUndefined();
  });
});

describe('Echo Chamber (geist) — Deathbursts carry one ring further', () => {
  const burst = (boon: number) => {
    const state = scenario({ width: 8, height: 8 });
    const boar = addUnit(state, { def: 'sporeback_boar', side: 'player', at: { x: 3, y: 3 } });
    const near = addUnit(state, { def: 'vanguard_footman', side: 'enemy', at: { x: 4, y: 3 } });
    const far = addUnit(state, { def: 'vanguard_footman', side: 'enemy', at: { x: 5, y: 3 } });
    state.players.player.deathburstReach = boon;
    killEntity(makeCtx(state), state.units[boar.id]!, 'spell');
    return { near: state.units[near.id]!.statuses.toxin, far: state.units[far.id]!.statuses.toxin };
  };
  it('reaches two tiles out with the knack, one without', () => {
    expect(burst(0)).toEqual({ near: 2, far: undefined });
    expect(burst(1)).toEqual({ near: 2, far: 2 });
  });
});

describe('Death Rattle (geist) — a body killed by a blow leaves its killer Brittle', () => {
  const kill = (boon: boolean) => {
    const state = scenario({ width: 6, height: 8 });
    const victim = addUnit(state, { def: 'vanguard_footman', side: 'player', at: { x: 2, y: 3 }, hp: 10 });
    const killer = addUnit(state, { def: 'vanguard_footman', side: 'enemy', at: { x: 2, y: 2 } });
    state.players.player.deathRattle = boon;
    enemyTurn(state);
    const after = run(state, { type: 'attack', attacker: killer.id, target: { kind: 'unit', id: victim.id } }).state;
    return { dead: after.units[victim.id] === undefined, brittle: after.units[killer.id]!.statuses.brittle };
  };
  it('brittles the killer, and only with the knack', () => {
    expect(kill(true)).toEqual({ dead: true, brittle: 1 });
    expect(kill(false)).toEqual({ dead: true, brittle: undefined });
  });
});

describe('Ossify (sovereign) — Shatter cannot strip the plate', () => {
  const shatter = (boon: boolean) => {
    const state = scenario({ width: 6, height: 8 });
    const frozen = addUnit(state, { def: 'grave_sentinel', side: 'player', at: { x: 3, y: 3 }, armor: 30, hp: 200 });
    frozen.statuses.freeze = 1;
    const striker = addUnit(state, { def: 'vanguard_footman', side: 'enemy', at: { x: 3, y: 2 } });
    state.players.player.armorUnstrippable = boon;
    enemyTurn(state);
    const res = run(state, { type: 'attack', attacker: striker.id, target: { kind: 'unit', id: frozen.id } });
    return { armor: res.state.units[frozen.id]!.armor, stripped: eventsOf(res.events, 'armorStripped').length };
  };
  it('keeps the Armor through the strip, and only with the knack', () => {
    expect(shatter(false).stripped, 'the strip fires without it').toBe(1);
    expect(shatter(false).armor).toBe(0);
    expect(shatter(true).stripped).toBe(0);
    // Whatever the blow itself took, the strip took nothing.
    expect(shatter(true).armor).toBeGreaterThan(0);
  });
});

describe('Grave-Robber (sovereign) — every fallen body refunds a Bone', () => {
  const lose = (boon: number) => {
    const state = scenario({ width: 6, height: 8 });
    const body = addUnit(state, { def: 'vanguard_footman', side: 'player', at: { x: 2, y: 3 } });
    state.players.player.bonesOnDeath = boon;
    const before = state.players.player.bones;
    const ctx = makeCtx(state);
    killEntity(ctx, state.units[body.id]!, 'spell');
    return { gained: state.players.player.bones - before, refunds: eventsOf(ctx.events, 'boneRefunded').length };
  };
  it('pays one Bone on the death, and only with the knack', () => {
    expect(lose(1)).toEqual({ gained: 1, refunds: 1 });
    expect(lose(0)).toEqual({ gained: 0, refunds: 0 });
  });
});

describe('the nine are wired', () => {
  it('none is pending and each names a boon the engine reads', () => {
    for (const id of [
      'static_burn', 'ember_spores', 'lightning_rod', 'frost_reaper', 'hollow_ice',
      'echo_chamber', 'death_rattle', 'ossify', 'grave_robber',
    ]) {
      const t = COMPANION_TRAITS[id]!;
      expect(t.pending, id).toBeUndefined();
      expect(Object.keys(t.boons), id).toHaveLength(1);
    }
  });
});
