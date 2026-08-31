/**
 * Line of sight answers exactly what it used to.
 *
 * `hasLoS` was inverted for speed. It used to build `occluderCells` — a `Set` of every
 * sight-blocking cell on the board, with a `cellsOf` array per entity, a `coordKey` string
 * per occupied cell, a `Set` insertion each, and an `Object.entries` over the hazards — and
 * then test the two or three cells actually on the line. A CPU profile put that at 6.7% of
 * all engine time, and the worst of it was that a call between *adjacent* tiles, where the
 * line between them is empty, still built the whole set before discovering it had nothing to
 * test. Now the line is walked and each cell asked directly.
 *
 * That is the kind of rewrite that can be subtly wrong in ways a normal suite never reaches,
 * because sight has four separate rules layered on it: **2×2 bodies** block for everyone,
 * **Guardians** block unless the viewer pierces them, **every obstacle** blocks including
 * cover, and **steam fog** blocks unless the viewer ignores it. The old code decided all
 * four while building a set; the new code decides them per cell. So this file keeps the old
 * implementation verbatim and asserts the two agree — over every ordered pair of cells on a
 * few hundred crowded, fogged, Guardian-infested boards, for every combination of viewer and
 * ignore-list that matters.
 *
 * Cheap: no engine, no playouts, just the two functions.
 */

import { describe, expect, it } from 'vitest';
import type { Coord, Side, UnitId } from '../contract/ids.js';
import { coordKey } from '../contract/ids.js';
import { cellsOf } from '../core/util/grid.js';
import { hasLoS, supercoverLine } from '../core/engine/los.js';
import { isUnit } from '../core/types/units.js';
import type { Entity, Obstacle, Unit } from '../core/types/units.js';
import type { GameState } from '../core/types/state.js';
import { makeRng, nextInt } from '../core/util/rng.js';
import type { RngState } from '../core/util/rng.js';

// ---------------------------------------------------------------- the previous implementation

function oldOccluderCells(
  state: GameState,
  ignoreIds: UnitId[] = [],
  viewer?: Side,
): Set<string> {
  const set = new Set<string>();
  const all: Entity[] = [...Object.values(state.units), ...Object.values(state.obstacles)];
  for (const e of all) {
    if (ignoreIds.includes(e.id)) continue;
    const screens = isUnit(e) && e.keywords.includes('Guardian') && e.footprint !== 2;
    const pierced = screens && viewer !== undefined && state.players[viewer].ignoresGuardians;
    const blocks = !isUnit(e) || e.footprint === 2 || (screens && !pierced);
    if (!blocks) continue;
    for (const c of cellsOf(e)) set.add(coordKey(c));
  }

  const seesThroughSmoke = viewer !== undefined && state.players[viewer].ignoresFog;
  if (!seesThroughSmoke) {
    for (const [key, hazard] of Object.entries(state.hazards)) {
      if (hazard.kind === 'steam_fog') set.add(key);
    }
  }

  return set;
}

function oldHasLoS(
  state: GameState,
  from: Coord,
  to: Coord,
  ignoreIds: UnitId[] = [],
  viewer?: Side,
): boolean {
  if (state.players.player.fogConceals || state.players.enemy.fogConceals) {
    if (viewer === undefined || !state.players[viewer].ignoresFog) {
      if (state.hazards[coordKey(to)]?.kind === 'steam_fog') {
        const all: Entity[] = [...Object.values(state.units), ...Object.values(state.obstacles)];
        const hidden = all.find(
          (e) => isUnit(e) && cellsOf(e).some((c) => c.x === to.x && c.y === to.y),
        );
        if (hidden && state.players[(hidden as { side: Side }).side].fogConceals) return false;
      }
    }
  }

  const blockers = oldOccluderCells(state, ignoreIds, viewer);
  return supercoverLine(from, to).every((c) => !blockers.has(coordKey(c)));
}

// ---------------------------------------------------------------- fixtures

const W = 8;
const H = 8;

function makeUnit(id: string, anchor: Coord, footprint: 1 | 2, side: Side, guardian: boolean): Unit {
  return {
    id,
    defId: 'x',
    name: id,
    side,
    anchor,
    footprint,
    hp: 10,
    maxHp: 10,
    armor: 0,
    atk: 1,
    mov: 1,
    rangeMin: 1,
    rangeMax: 1,
    school: 'frost',
    keywords: guardian ? ['Guardian'] : [],
  } as unknown as Unit;
}

function makeObstacle(id: string, anchor: Coord, cover: boolean): Obstacle {
  return {
    id,
    defId: 'x',
    name: id,
    side: 'neutral',
    anchor,
    footprint: 1,
    hp: 5,
    maxHp: 5,
    destructible: true,
    cover,
  } as unknown as Obstacle;
}

/**
 * A board built to exercise all four sight rules at once: 2×2 bodies, Guardians on both
 * sides, cover and walls, and steam laid over some of it. The knacks that pierce Guardians
 * and see through fog are toggled per side, because the viewer argument is exactly what the
 * rewrite threads differently.
 */
function randomState(rng: RngState): GameState {
  const units: Record<string, Unit> = {};
  const obstacles: Record<string, Obstacle> = {};
  const hazards: Record<string, { kind: string }> = {};

  const unitCount = 1 + nextInt(rng, 7);
  for (let i = 0; i < unitCount; i++) {
    units[`u${i}`] = makeUnit(
      `u${i}`,
      { x: nextInt(rng, W), y: nextInt(rng, H) },
      nextInt(rng, 4) === 0 ? 2 : 1,
      nextInt(rng, 2) === 0 ? 'player' : 'enemy',
      nextInt(rng, 2) === 0,
    );
  }
  const obstacleCount = nextInt(rng, 6);
  for (let i = 0; i < obstacleCount; i++) {
    obstacles[`o${i}`] = makeObstacle(
      `o${i}`,
      { x: nextInt(rng, W), y: nextInt(rng, H) },
      nextInt(rng, 2) === 0,
    );
  }
  const fogCount = nextInt(rng, 5);
  for (let i = 0; i < fogCount; i++) {
    hazards[coordKey({ x: nextInt(rng, W), y: nextInt(rng, H) })] = { kind: 'steam_fog' };
  }

  const side = (): Record<string, boolean> => ({
    ignoresGuardians: nextInt(rng, 2) === 0,
    ignoresFog: nextInt(rng, 2) === 0,
    fogConceals: nextInt(rng, 2) === 0,
  });

  return {
    width: W,
    height: H,
    units,
    obstacles,
    hazards,
    players: { player: side(), enemy: side() },
  } as unknown as GameState;
}

describe('the rewritten line of sight', () => {
  it('agrees with the old one on every sightline of two hundred crowded boards', () => {
    const rng = makeRng(20260831);
    let pairs = 0;
    let blocked = 0;
    let emptyLines = 0;

    for (let board = 0; board < 200; board++) {
      const state = randomState(rng);
      const unitIds = Object.keys(state.units);
      // The viewers that matter: nobody in particular (the strictest reading), and each
      // side, whose knacks decide Guardians and fog.
      const viewers: (Side | undefined)[] = [undefined, 'player', 'enemy'];
      // An empty ignore list, and one holding a real body — `ignoreIds` is how the shooter
      // and its target are excused, and the rewrite checks it at a different moment.
      const ignoreSets: UnitId[][] = [[], [unitIds[0] as UnitId]];

      for (let ay = 0; ay < H; ay++) {
        for (let ax = 0; ax < W; ax++) {
          for (let by = 0; by < H; by++) {
            for (let bx = 0; bx < W; bx++) {
              const from = { x: ax, y: ay };
              const to = { x: bx, y: by };
              // One viewer/ignore combination per pair, rotated, rather than the full
              // cross product: six times the pairs would be six times the runtime for the
              // same coverage spread differently.
              const viewer = viewers[(ax + by) % viewers.length];
              const ignore = ignoreSets[(ay + bx) % ignoreSets.length]!;
              pairs++;
              if (supercoverLine(from, to).length === 0) emptyLines++;
              const now = hasLoS(state, from, to, ignore, viewer);
              const before = oldHasLoS(state, from, to, ignore, viewer);
              if (!before) blocked++;
              if (now !== before) {
                throw new Error(
                  `board ${board}: (${ax},${ay})->(${bx},${by}) viewer=${viewer ?? 'none'} ` +
                    `ignore=[${ignore.join(',')}] — was ${before}, now ${now}`,
                );
              }
            }
          }
        }
      }
    }

    // The comparison is worthless if the boards let everything see everything, or if the
    // adjacent-tile fast path was never taken. These only assert the fixture built the
    // situations the test claims to cover.
    expect(pairs).toBeGreaterThan(500_000);
    expect(blocked, 'nothing was ever blocked, so nothing was compared').toBeGreaterThan(
      pairs / 20,
    );
    expect(emptyLines, 'the adjacent-tile fast path was never exercised').toBeGreaterThan(
      pairs / 100,
    );
  });

  it('lets adjacent tiles see each other through anything', () => {
    // The fast path, stated as a rule rather than left implicit in a benchmark. There is no
    // cell *between* neighbours, so nothing can stand in the way — which is why melee reach
    // never consults an occluder at all. This was already true; it is now also cheap.
    const wall = makeObstacle('wall', { x: 4, y: 4 }, false);
    const state = {
      width: W,
      height: H,
      units: {},
      obstacles: { wall },
      hazards: { [coordKey({ x: 4, y: 4 })]: { kind: 'steam_fog' } },
      players: { player: {}, enemy: {} },
    } as unknown as GameState;

    // Onto the blocked tile itself, and across it diagonally to its neighbour.
    expect(hasLoS(state, { x: 3, y: 4 }, { x: 4, y: 4 })).toBe(true);
    expect(hasLoS(state, { x: 3, y: 3 }, { x: 4, y: 4 })).toBe(true);
    // ...but not past it.
    expect(hasLoS(state, { x: 3, y: 4 }, { x: 5, y: 4 })).toBe(false);
  });

  it('still stops sight at cover, a 2x2 and steam, and lets the knacks through', () => {
    // The four rules, each asserted once and directly, so a failure names which one broke.
    const base = { width: W, height: H, players: { player: {}, enemy: {} } };

    const cover = {
      ...base,
      units: {},
      obstacles: { c: makeObstacle('c', { x: 4, y: 4 }, true) },
      hazards: {},
    } as unknown as GameState;
    expect(hasLoS(cover, { x: 4, y: 3 }, { x: 4, y: 5 }), 'cover should block').toBe(false);

    const behemoth = {
      ...base,
      units: { b: makeUnit('b', { x: 4, y: 4 }, 2, 'enemy', false) },
      obstacles: {},
      hazards: {},
    } as unknown as GameState;
    expect(hasLoS(behemoth, { x: 4, y: 3 }, { x: 4, y: 6 }), 'a 2x2 should block').toBe(false);

    const guard = {
      ...base,
      units: { g: makeUnit('g', { x: 4, y: 4 }, 1, 'enemy', true) },
      obstacles: {},
      hazards: {},
      players: { player: { ignoresGuardians: true }, enemy: {} },
    } as unknown as GameState;
    expect(hasLoS(guard, { x: 4, y: 3 }, { x: 4, y: 5 }), 'a Guardian should block').toBe(false);
    expect(
      hasLoS(guard, { x: 4, y: 3 }, { x: 4, y: 5 }, [], 'player'),
      'trench plate should read around a Guardian',
    ).toBe(true);

    const steam = {
      ...base,
      units: {},
      obstacles: {},
      hazards: { [coordKey({ x: 4, y: 4 })]: { kind: 'steam_fog' } },
      players: { player: { ignoresFog: true }, enemy: {} },
    } as unknown as GameState;
    expect(hasLoS(steam, { x: 4, y: 3 }, { x: 4, y: 5 }), 'steam should block').toBe(false);
    expect(
      hasLoS(steam, { x: 4, y: 3 }, { x: 4, y: 5 }, [], 'player'),
      'goggles should see through steam',
    ).toBe(true);
  });
});
