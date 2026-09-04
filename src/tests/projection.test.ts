import { describe, expect, it } from 'vitest';
import { calculateProjectedDamage, describeProjected } from '../hud/projection.js';
import type { BoardView } from '../contract/query.js';
import { CARDS } from '../core/data/cards/index.js';
import { createCombat } from '../core/engine/setup.js';
import { toBoardView } from '../core/engine/views.js';
import { NOVICE_DUELIST } from '../core/data/encounters/index.js';
import { GROWTH_CAP, GROWTH_CAP_BEHEMOTH } from '../core/engine/growth.js';
import { STAT_SCALE } from '../core/scale.js';

/**
 * The projected-damage readout.
 *
 * This exists to close a trust gap: the declared figure alone under-reports, because an
 * attacker that will grow before it swings hits for more than it promised. Being told
 * 30 and taking 40 is the failure that makes a telegraph worth ignoring.
 *
 * It closed that gap by exactly one point, against an engine that grows bodies by ten —
 * and the test that guarded it asserted the one. The forecast now reads each grower's real
 * step off the snapshot, and these tests hold it to the engine's numbers rather than to
 * a constant of their own.
 */

/** What a growing body gains per stack, as the engine actually pays it. */
const STEP = STAT_SCALE;

function board(over: Partial<BoardView> = {}): BoardView {
  return {
    width: 6,
    height: 8,
    turn: 2,
    activeSide: 'player',
    phase: 'action',
    units: [],
    obstacles: [],
    hazards: [],
    intents: [],
    marks: [],
    statuses: [],
    escalation: [],
    player: {} as BoardView['player'],
    enemy: {} as BoardView['enemy'],
    encounterName: 'test',
    ...over,
  } as BoardView;
}

function attacker(over: Record<string, unknown> = {}) {
  return {
    id: 'u1',
    defId: 'scout_imp',
    name: 'Scout Imp',
    side: 'enemy',
    anchor: { x: 1, y: 1 },
    footprint: 1,
    hp: 20,
    maxHp: 20,
    armor: 0,
    atk: 30,
    mov: 3,
    rangeMin: 1,
    rangeMax: 1,
    school: 'arcane',
    keywords: ['Growth'],
    archetype: 'skirmisher',
    escalation: 0,
    growth: { step: STEP, cap: GROWTH_CAP },
    exhausted: false,
    ...over,
  } as BoardView['units'][number];
}

describe('projected damage', () => {
  it('is zero with nothing declared', () => {
    expect(calculateProjectedDamage(board()).total).toBe(0);
    expect(describeProjected(calculateProjectedDamage(board()))).toBe('');
  });

  it('counts declared blows aimed at the Commander', () => {
    const p = calculateProjectedDamage(
      board({
        units: [attacker({ keywords: [], growth: undefined })],
        intents: [{ unitId: 'u1', kind: 'commander', damage: 30 }],
      }),
    );
    expect(p.fromAttacks).toBe(30);
    expect(p.total).toBe(30);
  });

  it('ignores blows aimed at a tile rather than the Pact', () => {
    const p = calculateProjectedDamage(
      board({
        units: [attacker()],
        intents: [{ unitId: 'u1', kind: 'attack', at: { x: 2, y: 2 }, damage: 30 }],
      }),
    );
    expect(p.total).toBe(0);
  });

  it('adds the growth a Growth attacker gains before it swings, at the engine\'s step', () => {
    // The exact bug this was written for: declared 30, actual 40. The earlier version of
    // this test asserted a growth of 1 — the readout was ten short and the test agreed.
    const p = calculateProjectedDamage(
      board({
        units: [attacker({ escalation: 0 })],
        intents: [{ unitId: 'u1', kind: 'commander', damage: 30 }],
      }),
    );
    expect(p.fromAttacks).toBe(30);
    expect(p.fromEscalation).toBe(STEP);
    expect(p.total).toBe(30 + STEP);
  });

  it('adds nothing for a Growth body whose stat block grows by nothing', () => {
    // The other half of the same bug. Several Growth bodies grow in health alone, with an
    // Attack step of zero; the old constant added a point for them anyway.
    const p = calculateProjectedDamage(
      board({
        units: [attacker({ growth: { step: 0, cap: GROWTH_CAP } })],
        intents: [{ unitId: 'u1', kind: 'commander', damage: 30 }],
      }),
    );
    expect(p.fromEscalation).toBe(0);
    expect(p.total).toBe(30);
  });

  it('does not add growth for a unit already at its cap', () => {
    const p = calculateProjectedDamage(
      board({
        units: [attacker({ escalation: GROWTH_CAP })],
        intents: [{ unitId: 'u1', kind: 'commander', damage: 60 }],
      }),
    );
    expect(p.fromEscalation).toBe(0);
    expect(p.total).toBe(60);
  });

  it('keeps growing a Behemoth, whose cap is out of any fight\'s reach', () => {
    const p = calculateProjectedDamage(
      board({
        units: [attacker({ footprint: 2, escalation: 9, growth: { step: STEP, cap: GROWTH_CAP_BEHEMOTH } })],
        intents: [{ unitId: 'u1', kind: 'commander', damage: 120 }],
      }),
    );
    expect(p.fromEscalation).toBe(STEP);
  });

  it('reads the cap off the body rather than off a constant', () => {
    // A future card that grows further than the school default must be forecast at its own
    // ceiling. This is the `escalationCap` case the roadmap flagged as "wrong the day a
    // card changes a cap".
    const p = calculateProjectedDamage(
      board({
        units: [attacker({ escalation: GROWTH_CAP, growth: { step: STEP, cap: GROWTH_CAP + 2 } })],
        intents: [{ unitId: 'u1', kind: 'commander', damage: 30 }],
      }),
    );
    expect(p.fromEscalation).toBe(STEP);
  });

  it('does not add growth for a unit that cannot grow', () => {
    const p = calculateProjectedDamage(
      board({
        units: [attacker({ keywords: [], growth: undefined })],
        intents: [{ unitId: 'u1', kind: 'commander', damage: 30 }],
      }),
    );
    expect(p.fromEscalation).toBe(0);
  });

  it('guesses nothing for a grower the view did not describe', () => {
    // The keyword without the numbers. A snapshot that says "this grows" but not by how
    // much is not licence to invent a step — the readout says what it knows.
    const p = calculateProjectedDamage(
      board({
        units: [attacker({ growth: undefined })],
        intents: [{ unitId: 'u1', kind: 'commander', damage: 30 }],
      }),
    );
    expect(p.fromEscalation).toBe(0);
  });

  it('itemises only when there is more than one source', () => {
    const single = calculateProjectedDamage(
      board({
        units: [attacker({ keywords: [], growth: undefined })],
        intents: [{ unitId: 'u1', kind: 'commander', damage: 30 }],
      }),
    );
    expect(describeProjected(single)).toBe('Incoming: 30 damage');

    const mixed = calculateProjectedDamage(
      board({
        units: [attacker()],
        intents: [{ unitId: 'u1', kind: 'commander', damage: 30 }],
      }),
    );
    expect(describeProjected(mixed)).toBe(
      `Incoming: ${30 + STEP} damage (30 attack, ${STEP} Growth)`,
    );
  });

  it('counts a blow aimed at the Bound Form, which lands on the Pact', () => {
    // The on-grid route to the Pact. Without this the readout would call a lethal swing
    // at the Companion "0 incoming" and the telegraph would be worse than useless.
    const bound = attacker({
      id: 'b1',
      side: 'player',
      anchor: { x: 3, y: 6 },
      keywords: ['BoundForm'],
      growth: undefined,
    });
    const p = calculateProjectedDamage(
      board({
        units: [attacker({ keywords: [], growth: undefined }), bound],
        intents: [{ unitId: 'u1', kind: 'attack', at: { x: 3, y: 6 }, damage: 30 }],
      }),
    );
    expect(p.total).toBe(30);
    expect(p.fromAttacks).toBe(30);
  });

  it('ignores a blow aimed at an ordinary minion', () => {
    const pawn = attacker({ id: 'p1', side: 'player', anchor: { x: 3, y: 6 }, keywords: [], growth: undefined });
    const p = calculateProjectedDamage(
      board({
        units: [attacker({ keywords: [], growth: undefined }), pawn],
        intents: [{ unitId: 'u1', kind: 'attack', at: { x: 3, y: 6 }, damage: 30 }],
      }),
    );
    expect(p.total).toBe(0);
  });

  it('survives an intent whose unit is already gone', () => {
    const p = calculateProjectedDamage(
      board({ intents: [{ unitId: 'ghost', kind: 'commander', damage: 30 }] }),
    );
    expect(p.total).toBe(30);
  });
});

describe('the view tells the truth about growth', () => {
  it('carries every Growth body\'s real step and cap, read off its stat block', () => {
    // The seam the forecast now depends on. A live board, not a fixture: every grower the
    // encounter fields must describe itself in the engine's own numbers, and every body
    // that does not grow must say nothing rather than something.
    const { state } = createCombat(NOVICE_DUELIST, 11);
    const view = toBoardView(state);
    expect(view.units.length).toBeGreaterThan(0);

    for (const u of view.units) {
      const live = state.units[u.id]!;
      if (!u.keywords.includes('Growth')) {
        expect(u.growth, `${u.defId} does not grow`).toBeUndefined();
        continue;
      }
      expect(u.growth, `${u.defId} grows and must say how`).toBeDefined();
      expect(u.growth!.step).toBe(CARDS[u.defId]!.unit!.escalationBonus.atk);
      expect(u.growth!.cap).toBe(live.escalationCap);
    }
  });
});
