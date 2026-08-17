import { describe, expect, it } from 'vitest';
import { scenario } from './scenario.js';
import { threatMap } from '../core/engine/threat.js';
import { coordKey } from '../contract/ids.js';

const has = (tiles: { x: number; y: number }[], x: number, y: number): boolean =>
  tiles.some((t) => t.x === x && t.y === y);

describe('threat projection', () => {
  it('marks tiles an enemy can reach by moving then attacking', () => {
    // Grave Sentinel: MOV 2, melee range 1, sitting at (2,0).
    const state = scenario({
      width: 6,
      height: 6,
      units: [{ def: 'grave_sentinel', side: 'enemy', at: { x: 2, y: 0 } }],
    });

    const map = threatMap(state, 'player');

    // Two tiles of movement plus one of reach covers rows 1 through 3.
    expect(has(map.tiles, 2, 1)).toBe(true);
    expect(has(map.tiles, 2, 3)).toBe(true);
    // Row 4 needs three tiles of movement, which it does not have.
    expect(has(map.tiles, 2, 4)).toBe(false);
  });

  it('projects further for a faster unit', () => {
    // Scout Imp has MOV 3, so the same start line reaches a row deeper.
    const state = scenario({
      width: 6,
      height: 6,
      units: [{ def: 'scout_imp', side: 'enemy', at: { x: 2, y: 0 } }],
    });

    expect(has(threatMap(state, 'player').tiles, 2, 4)).toBe(true);
  });

  it('is empty when the enemy cannot act', () => {
    const state = scenario({
      units: [{ def: 'scout_imp', side: 'enemy', at: { x: 2, y: 1 } }],
    });
    const unitId = Object.keys(state.units)[0]!;
    state.units[unitId]!.statuses.freeze = 1;

    expect(threatMap(state, 'player').tiles).toHaveLength(0);
  });

  it('accumulates damage where several attackers converge', () => {
    const state = scenario({
      width: 6,
      height: 6,
      units: [
        { def: 'scout_imp', side: 'enemy', at: { x: 1, y: 1 }, atk: 2 },
        { def: 'scout_imp', side: 'enemy', at: { x: 3, y: 1 }, atk: 3 },
      ],
    });

    const map = threatMap(state, 'player');
    // A tile between them is reachable by both, so the shown damage is the sum.
    expect(map.damageByTile.get(coordKey({ x: 2, y: 2 }))).toBe(5);
  });

  it('flags melee that can already reach the player Commander', () => {
    // Standing in the player's home rows is the whole melee requirement.
    const near = scenario({
      width: 6,
      height: 6,
      units: [{ def: 'scout_imp', side: 'enemy', at: { x: 2, y: 4 } }],
    });
    expect(threatMap(near, 'player').commanderThreats).toHaveLength(1);

    const far = scenario({
      width: 6,
      height: 6,
      units: [{ def: 'grave_sentinel', side: 'enemy', at: { x: 2, y: 0 } }],
    });
    // MOV 2 from row 0 cannot reach row 4 this turn.
    expect(threatMap(far, 'player').commanderThreats).toHaveLength(0);
  });

  it('does not project threat through a wall of obstacles for ranged units', () => {
    const blocked = scenario({
      width: 6,
      height: 6,
      units: [{ def: 'spark_wisp', side: 'enemy', at: { x: 0, y: 0 } }],
      obstacles: [{ at: { x: 0, y: 1 } }, { at: { x: 1, y: 1 } }, { at: { x: 1, y: 0 } }],
    });

    // The wisp is walled into its corner: nothing it can move to reaches far.
    const map = threatMap(blocked, 'player');
    expect(has(map.tiles, 0, 5)).toBe(false);
  });
});
