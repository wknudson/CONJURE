import { describe, expect, it } from 'vitest';
import { addUnit, scenario } from './scenario.js';
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
        { def: 'scout_imp', side: 'enemy', at: { x: 1, y: 1 }, atk: 20 },
        { def: 'scout_imp', side: 'enemy', at: { x: 3, y: 1 }, atk: 30 },
      ],
    });

    const map = threatMap(state, 'player');
    // A tile between them is reachable by both, so the shown damage is the sum.
    expect(map.damageByTile.get(coordKey({ x: 2, y: 2 }))).toBe(50);
  });

  it('flags whatever can already reach the player Bound Form', () => {
    // The body is the only route to a Pact — no attack may name a portrait — so "threatens
    // your Commander" is exactly "can reach the thing standing in for them".
    const withBody = (foe: { def: string; at: { x: number; y: number } }) => {
      const state = scenario({
        width: 6,
        height: 6,
        units: [{ def: foe.def, side: 'enemy', at: foe.at }],
      });
      const body = addUnit(state, {
        def: 'scout_imp',
        side: 'player',
        at: { x: 2, y: 5 },
        keywords: ['BoundForm'],
      });
      state.players.player.companionUnitId = body.id;
      state.players.player.companionUnitDefId = 'ignis_bound';
      return state;
    };

    const near = withBody({ def: 'scout_imp', at: { x: 2, y: 4 } });
    expect(threatMap(near, 'player').commanderThreats).toHaveLength(1);

    // MOV 2 from row 0 cannot reach the back row this turn.
    const far = withBody({ def: 'grave_sentinel', at: { x: 2, y: 0 } });
    expect(threatMap(far, 'player').commanderThreats).toHaveLength(0);
  });

  it('does not project threat through a wall of obstacles for ranged units', () => {
    const blocked = scenario({
      width: 6,
      height: 6,
      units: [{ def: 'marrow_wisp', side: 'enemy', at: { x: 0, y: 0 } }],
      obstacles: [{ at: { x: 0, y: 1 } }, { at: { x: 1, y: 1 } }, { at: { x: 1, y: 0 } }],
    });

    // The wisp is walled into its corner: nothing it can move to reaches far.
    const map = threatMap(blocked, 'player');
    expect(has(map.tiles, 0, 5)).toBe(false);
  });
});
