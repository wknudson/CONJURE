import { describe, expect, it } from 'vitest';
import { findUnit, run, scenario } from './scenario.js';
import { legalMoves } from '../core/engine/movement.js';
import { hasLoS } from '../core/engine/los.js';
import { legalAttacks } from '../core/engine/targeting.js';
import { unitAt, entityAt, coverAt } from '../core/engine/board.js';
import { CombatSession } from '../core/session.js';
import { ENCOUNTERS, NOVICE_DUELIST, IGNIS_TRIAL } from '../core/data/encounters/index.js';
import { territoryDepthFor } from '../core/types/state.js';

/** Builds a board with one cover tile at (2,2). */
function withCover() {
  const state = scenario({
    width: 6,
    height: 6,
    units: [{ def: 'scout_imp', side: 'player', at: { x: 2, y: 4 } }],
    obstacles: [{ at: { x: 2, y: 2 } }],
  });
  const id = Object.keys(state.obstacles)[0]!;
  state.obstacles[id]!.cover = true;
  return { state, coverId: id };
}

describe('cover terrain', () => {
  it('lets units move onto and through it', () => {
    const { state } = withCover();
    const imp = findUnit(state, 'scout_imp', 'player');

    const moves = legalMoves(state, imp);
    expect(moves.some((m) => m.to.x === 2 && m.to.y === 2)).toBe(true);

    const res = run(state, { type: 'moveUnit', unit: imp.id, to: { x: 2, y: 2 } });
    expect(res.state.units[imp.id]!.anchor).toEqual({ x: 2, y: 2 });
  });

  it('still blocks line of sight', () => {
    const { state } = withCover();
    // Shooting from behind the screen to the far side passes through (2,2).
    expect(hasLoS(state, { x: 2, y: 4 }, { x: 2, y: 0 })).toBe(false);
    // A lane beside it is clear.
    expect(hasLoS(state, { x: 0, y: 4 }, { x: 0, y: 0 })).toBe(true);
  });

  it('does not hide a unit standing on it', () => {
    const { state } = withCover();
    const imp = findUnit(state, 'scout_imp', 'player');
    const moved = run(state, { type: 'moveUnit', unit: imp.id, to: { x: 2, y: 2 } }).state;

    // Sight to the occupied tile itself is unobstructed — the screen is not a cloak.
    expect(hasLoS(moved, { x: 2, y: 5 }, { x: 2, y: 2 })).toBe(true);
  });

  it('resolves the unit, not the terrain, when both share a tile', () => {
    const { state, coverId } = withCover();
    const imp = findUnit(state, 'scout_imp', 'player');
    const moved = run(state, { type: 'moveUnit', unit: imp.id, to: { x: 2, y: 2 } }).state;
    const tile = { x: 2, y: 2 };

    expect(unitAt(moved, tile)?.id).toBe(imp.id);
    expect(entityAt(moved, tile)?.id).toBe(imp.id);
    // The screen is still there underneath.
    expect(coverAt(moved, tile)?.id).toBe(coverId);
  });

  it('is a legal attack target so a lane can be cleared', () => {
    const { coverId } = withCover();
    const shooter = scenario({
      width: 6,
      height: 6,
      units: [{ def: 'scout_imp', side: 'player', at: { x: 2, y: 3 } }],
      obstacles: [{ at: { x: 2, y: 2 } }],
    });
    const id = Object.keys(shooter.obstacles)[0]!;
    shooter.obstacles[id]!.cover = true;
    const imp = findUnit(shooter, 'scout_imp', 'player');

    expect(legalAttacks(shooter, imp).some((r) => 'id' in r && r.id === id)).toBe(true);
    expect(coverId).toBeTruthy();
  });
});

describe('per-encounter arenas', () => {
  it('gives each encounter its own shape', () => {
    expect(NOVICE_DUELIST.width).toBe(6);
    expect(NOVICE_DUELIST.height).toBe(8);
    expect(IGNIS_TRIAL.width).toBe(8);
    expect(IGNIS_TRIAL.height).toBe(8);

    const shapes = new Set(ENCOUNTERS.map((e) => `${e.width}x${e.height}`));
    expect(shapes.size).toBeGreaterThan(1);
  });

  it('places each encounter terrain on the board without blocking deployment', () => {
    for (const enc of ENCOUNTERS) {
      const session = new CombatSession(enc, 3);
      const board = session.getBoard();

      expect(board.width).toBe(enc.width);
      expect(board.height).toBe(enc.height);
      // Everything an encounter lays down is an obstacle: generic walls and cover from
      // `terrain`, named scenery from `props`, and geodes scattered at random. Count the
      // two authored lists and let the random ones be.
      const placed = board.obstacles.filter((o) => o.defId !== 'marrow_geode');
      expect(placed.length).toBe((enc.terrain?.length ?? 0) + (enc.props?.length ?? 0));

      // Terrain must never strand a side with nowhere to summon on turn one.
      expect(session.getPlayableCards().length).toBeGreaterThan(0);
      // The enemy's opening body must have made it onto the field. The player has none:
      // their line comes from the Vanguard Roster, and this session brought no roster.
      expect(board.units.filter((u) => u.defId === 'vanguard_footman')).toHaveLength(1);
    }
  });

  it('keeps terrain inside the arena bounds', () => {
    for (const enc of ENCOUNTERS) {
      for (const t of enc.terrain ?? []) {
        expect(t.at.x).toBeGreaterThanOrEqual(0);
        expect(t.at.y).toBeGreaterThanOrEqual(0);
        expect(t.at.x).toBeLessThan(enc.width);
        expect(t.at.y).toBeLessThan(enc.height);
      }
    }
  });

  it('leaves terrain out of both sides territory rows', () => {
    // Furniture in a summon zone would silently shrink the deployable area.
    for (const enc of ENCOUNTERS) {
      // Derived, not assumed: a short arena owns one row per side, and hardcoding two
      // here made the assertion unsatisfiable — every row would be somebody's territory.
      const depth = territoryDepthFor(enc.height);
      const homeRows: number[] = [];
      for (let i = 0; i < depth; i++) homeRows.push(i, enc.height - 1 - i);
      for (const t of enc.terrain ?? []) {
        expect(homeRows, `${enc.id} terrain at row ${t.at.y}`).not.toContain(t.at.y);
      }
    }
  });
});
