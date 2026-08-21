import { describe, expect, it } from 'vitest';
import {
  alongLine,
  atUnit,
  eventsOf,
  findUnit,
  handCard,
  play,
  run,
  scenario,
} from './scenario.js';

/**
 * Rune rules (Draft 7 §7):
 *  - Damage-based triggers need at least 1 point of ACTUAL HP loss. Damage fully
 *    absorbed by armor does not detonate — this is what makes armor a cascade brake.
 *  - A detonation that penetrates an adjacent rune-holder's armor chains in the same step.
 *  - An entity killed by an unaligned damage type fizzles its rune without detonating.
 */
describe('runes and cascades', () => {
  it('detonates a Cinder Rune when fire damage causes real HP loss', () => {
    const state = scenario({
      units: [
        { def: 'grave_sentinel', side: 'enemy', at: { x: 2, y: 2 }, hp: 100, rune: 'cinder_rune' },
        { def: 'scout_imp', side: 'enemy', at: { x: 3, y: 2 }, hp: 80 },
      ],
      hand: ['flame_surge'],
    });
    const host = findUnit(state, 'grave_sentinel', 'enemy');
    const bystander = findUnit(state, 'scout_imp', 'enemy');

    // Flame Surge hits a 2-tile line starting on the host.
    const res = run(
      state,
      play(handCard(state, 'player', 'flame_surge'), alongLine({ x: 2, y: 2 }, { x: 0, y: -1 })),
    );

    const dets = eventsOf(res.events, 'runeDetonated');
    expect(dets).toHaveLength(1);
    expect(dets[0]!.rune).toBe('cinder_rune');

    // Host: 3 from Flame Surge. Adjacent bystander: 4 from the detonation.
    expect(res.state.units[host.id]!.hp).toBe(100 - 30);
    expect(res.state.units[bystander.id]!.hp).toBe(80 - 40);
  });

  it('does NOT detonate when armor absorbs the entire hit', () => {
    const state = scenario({
      units: [
        {
          def: 'grave_sentinel',
          side: 'enemy',
          at: { x: 2, y: 2 },
          hp: 100,
          armor: 50,
          rune: 'cinder_rune',
        },
      ],
      hand: ['flame_surge'],
    });
    const host = findUnit(state, 'grave_sentinel', 'enemy');

    const res = run(
      state,
      play(handCard(state, 'player', 'flame_surge'), alongLine({ x: 2, y: 2 }, { x: 0, y: -1 })),
    );

    expect(eventsOf(res.events, 'runeDetonated')).toHaveLength(0);
    // 3 damage fully absorbed: armor 5 -> 2, HP untouched, rune still attached.
    expect(res.state.units[host.id]!.armor).toBe(20);
    expect(res.state.units[host.id]!.hp).toBe(100);
    expect(res.state.units[host.id]!.rune).toBeDefined();
  });

  it('chains to an adjacent rune only when the blast penetrates its armor', () => {
    const state = scenario({
      units: [
        { def: 'grave_sentinel', side: 'enemy', at: { x: 2, y: 2 }, hp: 100, rune: 'cinder_rune' },
        // Armor 40 exactly absorbs the 40-damage blast, so this rune must NOT chain.
        {
          def: 'grave_sentinel',
          side: 'enemy',
          at: { x: 3, y: 2 },
          hp: 100,
          armor: 40,
          rune: 'cinder_rune',
        },
      ],
      hand: ['flame_surge'],
    });
    const shielded = Object.values(state.units).find((u) => u.armor === 40)!;

    const res = run(
      state,
      play(handCard(state, 'player', 'flame_surge'), alongLine({ x: 2, y: 2 }, { x: 0, y: -1 })),
    );

    expect(eventsOf(res.events, 'runeDetonated')).toHaveLength(1);
    expect(res.state.units[shielded.id]!.armor).toBe(0);
    expect(res.state.units[shielded.id]!.hp).toBe(100);
    expect(res.state.units[shielded.id]!.rune).toBeDefined();
  });

  it('chains through an unarmored neighbour in the same resolution step', () => {
    const state = scenario({
      units: [
        { def: 'grave_sentinel', side: 'enemy', at: { x: 2, y: 2 }, hp: 100, rune: 'cinder_rune' },
        { def: 'grave_sentinel', side: 'enemy', at: { x: 3, y: 2 }, hp: 100, rune: 'cinder_rune' },
      ],
      hand: ['flame_surge'],
    });

    const res = run(
      state,
      play(handCard(state, 'player', 'flame_surge'), alongLine({ x: 2, y: 2 }, { x: 0, y: -1 })),
    );

    const dets = eventsOf(res.events, 'runeDetonated');
    expect(dets).toHaveLength(2);
    // The chained detonation is tagged at a deeper chain depth.
    expect(dets[1]!.chainDepth).toBeGreaterThan(dets[0]!.chainDepth);
  });

  it('fizzles a Cinder Rune when the host is killed by unaligned physical damage', () => {
    const state = scenario({
      units: [
        { def: 'scout_imp', side: 'player', at: { x: 2, y: 3 }, atk: 90 },
        { def: 'scout_imp', side: 'enemy', at: { x: 2, y: 2 }, hp: 20, rune: 'cinder_rune' },
        { def: 'scout_imp', side: 'enemy', at: { x: 3, y: 2 }, hp: 80 },
      ],
    });
    const attacker = findUnit(state, 'scout_imp', 'player');
    const host = Object.values(state.units).find((u) => u.rune)!;
    const bystander = Object.values(state.units).find(
      (u) => u.side === 'enemy' && !u.rune,
    )!;

    const res = run(state, {
      type: 'attack',
      attacker: attacker.id,
      target: { kind: 'unit', id: host.id },
    });

    expect(eventsOf(res.events, 'runeDetonated')).toHaveLength(0);
    const fizzles = eventsOf(res.events, 'runeFizzled');
    expect(fizzles).toHaveLength(1);
    expect(fizzles[0]!.reason).toBe('unaligned');
    // The bystander is untouched: the rune never went off.
    expect(res.state.units[bystander.id]!.hp).toBe(80);
  });

  it('fires a death-triggered Soul Splinter Rune when its host is sacrificed', () => {
    const state = scenario({
      units: [
        {
          def: 'marrow_wisp',
          side: 'player',
          at: { x: 2, y: 3 },
          rune: 'soul_splinter_rune',
        },
        { def: 'grave_sentinel', side: 'enemy', at: { x: 0, y: 0 }, hp: 100 },
        { def: 'scout_imp', side: 'enemy', at: { x: 4, y: 0 }, hp: 30 },
      ],
      hand: ['dark_tithe'],
    });
    const wisp = findUnit(state, 'marrow_wisp', 'player');
    const weakest = findUnit(state, 'scout_imp', 'enemy');

    const res = run(state, play(handCard(state, 'player', 'dark_tithe'), atUnit(wisp.id)));

    const dets = eventsOf(res.events, 'runeDetonated');
    expect(dets).toHaveLength(1);
    expect(dets[0]!.rune).toBe('soul_splinter_rune');
    // 5 damage to the lowest-HP enemy kills the 3 HP Scout Imp.
    expect(res.state.units[weakest.id]).toBeUndefined();
  });

  it('detonates every rune on the board with +2 bonus damage via Cataclysmic Core', () => {
    const state = scenario({
      pips: 8,
      marrow: 2,
      units: [
        { def: 'grave_sentinel', side: 'enemy', at: { x: 0, y: 0 }, hp: 200, rune: 'cinder_rune' },
        { def: 'grave_sentinel', side: 'enemy', at: { x: 4, y: 0 }, hp: 200, rune: 'cinder_rune' },
        { def: 'scout_imp', side: 'enemy', at: { x: 1, y: 0 }, hp: 200 },
        { def: 'scout_imp', side: 'enemy', at: { x: 3, y: 0 }, hp: 200 },
      ],
      hand: ['cataclysmic_core'],
    });
    const nearFirst = Object.values(state.units).find(
      (u) => u.anchor.x === 1 && u.anchor.y === 0,
    )!;

    const res = run(state, play(handCard(state, 'player', 'cataclysmic_core'), { kind: 'global' }));

    expect(eventsOf(res.events, 'runeDetonated')).toHaveLength(2);
    // Base 4 + 2 bonus = 6 to each adjacent unit.
    expect(res.state.units[nearFirst.id]!.hp).toBe(200 - 60);
  });
});
