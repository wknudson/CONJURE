import { describe, expect, it } from 'vitest';
import { calculateProjectedDamage, describeProjected } from '../hud/projection.js';
import type { BoardView } from '../contract/query.js';

/**
 * The projected-damage readout.
 *
 * This exists to close a trust gap: the declared figure alone under-reports, because an
 * attacker that will grow before it swings hits for more than it promised. Being told
 * 3 and taking 4 is the failure that makes a telegraph worth ignoring.
 */

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
    runes: [],
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
    hp: 2,
    maxHp: 2,
    armor: 0,
    atk: 3,
    mov: 3,
    rangeMin: 1,
    rangeMax: 1,
    school: 'arcane',
    keywords: ['Growth'],
    archetype: 'skirmisher',
    escalation: 0,
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
        units: [attacker({ keywords: [] })],
        intents: [{ unitId: 'u1', kind: 'commander', damage: 3 }],
      }),
    );
    expect(p.fromAttacks).toBe(3);
    expect(p.total).toBe(3);
  });

  it('ignores blows aimed at a tile rather than the Pact', () => {
    const p = calculateProjectedDamage(
      board({
        units: [attacker()],
        intents: [{ unitId: 'u1', kind: 'attack', at: { x: 2, y: 2 }, damage: 3 }],
      }),
    );
    expect(p.total).toBe(0);
  });

  it('adds the growth a Growth attacker gains before it swings', () => {
    // The exact bug this was written for: declared 3, actual 4.
    const p = calculateProjectedDamage(
      board({
        units: [attacker({ escalation: 0 })],
        intents: [{ unitId: 'u1', kind: 'commander', damage: 3 }],
      }),
    );
    expect(p.fromAttacks).toBe(3);
    expect(p.fromEscalation).toBe(1);
    expect(p.total).toBe(4);
  });

  it('does not add growth for a unit already at its cap', () => {
    const p = calculateProjectedDamage(
      board({
        units: [attacker({ escalation: 3 })],
        intents: [{ unitId: 'u1', kind: 'commander', damage: 6 }],
      }),
    );
    expect(p.fromEscalation).toBe(0);
    expect(p.total).toBe(6);
  });

  it('keeps growing a Behemoth, which has no cap', () => {
    const p = calculateProjectedDamage(
      board({
        units: [attacker({ footprint: 2, escalation: 9 })],
        intents: [{ unitId: 'u1', kind: 'commander', damage: 12 }],
      }),
    );
    expect(p.fromEscalation).toBe(1);
  });

  it('does not add growth for a unit that cannot grow', () => {
    const p = calculateProjectedDamage(
      board({
        units: [attacker({ keywords: [] })],
        intents: [{ unitId: 'u1', kind: 'commander', damage: 3 }],
      }),
    );
    expect(p.fromEscalation).toBe(0);
  });

  it('itemises only when there is more than one source', () => {
    const single = calculateProjectedDamage(
      board({
        units: [attacker({ keywords: [] })],
        intents: [{ unitId: 'u1', kind: 'commander', damage: 3 }],
      }),
    );
    expect(describeProjected(single)).toBe('Incoming: 3 damage');

    const mixed = calculateProjectedDamage(
      board({
        units: [attacker()],
        intents: [{ unitId: 'u1', kind: 'commander', damage: 3 }],
      }),
    );
    expect(describeProjected(mixed)).toBe('Incoming: 4 damage (3 attack, 1 escalation)');
  });

  it('counts a blow aimed at the Bound Form, which lands on the Pact', () => {
    // The on-grid route to the Pact. Without this the readout would call a lethal swing
    // at the Companion "0 incoming" and the telegraph would be worse than useless.
    const bound = attacker({
      id: 'b1',
      side: 'player',
      anchor: { x: 3, y: 6 },
      keywords: ['BoundForm'],
    });
    const p = calculateProjectedDamage(
      board({
        units: [attacker({ keywords: [] }), bound],
        intents: [{ unitId: 'u1', kind: 'attack', at: { x: 3, y: 6 }, damage: 3 }],
      }),
    );
    expect(p.total).toBe(3);
    expect(p.fromAttacks).toBe(3);
  });

  it('ignores a blow aimed at an ordinary minion', () => {
    const pawn = attacker({ id: 'p1', side: 'player', anchor: { x: 3, y: 6 }, keywords: [] });
    const p = calculateProjectedDamage(
      board({
        units: [attacker({ keywords: [] }), pawn],
        intents: [{ unitId: 'u1', kind: 'attack', at: { x: 3, y: 6 }, damage: 3 }],
      }),
    );
    expect(p.total).toBe(0);
  });

  it('survives an intent whose unit is already gone', () => {
    const p = calculateProjectedDamage(
      board({ intents: [{ unitId: 'ghost', kind: 'commander', damage: 3 }] }),
    );
    expect(p.total).toBe(3);
  });
});
