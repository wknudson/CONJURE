/**
 * The board lookups answer exactly what they used to.
 *
 * `entityAt`, `unitAt` and `coverAt` were rewritten for speed — a CPU profile put
 * `entityAt` at 14.4% of all engine runtime, almost none of it in the scan and nearly all
 * of it in the garbage: `allEntities` built three arrays per call and `cellsOf` built one
 * more per entity, to answer a question about four integers. The scan stayed; the
 * allocation went. See the header of `board.ts`.
 *
 * A rewrite for speed is exactly the kind that can be subtly wrong and still pass a suite,
 * because the ways it goes wrong are narrow: the **2×2 footprint**, where the old code
 * enumerated four cells and the new one does interval arithmetic, and the **cover rule**,
 * where a unit sharing a tile with a bush has to win the lookup no matter which order the
 * entities happen to sit in. Neither shows up in a typical position.
 *
 * So this file keeps the old implementations, verbatim, and asserts the two agree over
 * every cell of a few thousand randomly built boards — dense ones, where 2×2 bodies
 * overlap cover and each other, which is where the disagreement would be. Cheap: no
 * playouts, no engine, just the lookups.
 */

import { describe, expect, it } from 'vitest';
import { coordEq } from '../contract/ids.js';
import type { Coord } from '../contract/ids.js';
import { cellsOf } from '../core/util/grid.js';
import { coverAt, entityAt, isCover, unitAt } from '../core/engine/board.js';
import type { Entity, Obstacle, Unit } from '../core/types/units.js';
import type { GameState } from '../core/types/state.js';
import { makeRng, nextInt } from '../core/util/rng.js';
import type { RngState } from '../core/util/rng.js';

// ---------------------------------------------------------------- the previous implementations

function oldAllEntities(state: GameState): Entity[] {
  return [...Object.values(state.units), ...Object.values(state.obstacles)];
}

function oldEntityAt(state: GameState, c: Coord): Entity | undefined {
  let cover: Entity | undefined;
  for (const e of oldAllEntities(state)) {
    if (!cellsOf(e).some((cell) => coordEq(cell, c))) continue;
    if (isCover(e)) {
      cover ??= e;
      continue;
    }
    return e;
  }
  return cover;
}

function oldUnitAt(state: GameState, c: Coord): Unit | undefined {
  for (const u of Object.values(state.units)) {
    if (cellsOf(u).some((cell) => coordEq(cell, c))) return u;
  }
  return undefined;
}

function oldCoverAt(state: GameState, c: Coord): Entity | undefined {
  for (const o of Object.values(state.obstacles)) {
    if (isCover(o) && cellsOf(o).some((cell) => coordEq(cell, c))) return o;
  }
  return undefined;
}

// ---------------------------------------------------------------- fixtures

const W = 8;
const H = 8;

function makeUnit(id: string, anchor: Coord, footprint: 1 | 2): Unit {
  return {
    id,
    defId: 'x',
    name: id,
    side: 'player',
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
    keywords: [],
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
 * A deliberately crowded board. Sparse ones agree trivially — the interesting cases are a
 * 2×2 body straddling a bush and two bodies claiming the same tile, which only turn up
 * when the board is packed far denser than real play.
 */
function randomState(rng: RngState): GameState {
  const units: Record<string, Unit> = {};
  const obstacles: Record<string, Obstacle> = {};
  const unitCount = 1 + nextInt(rng, 8);
  for (let i = 0; i < unitCount; i++) {
    const footprint: 1 | 2 = nextInt(rng, 3) === 0 ? 2 : 1;
    units[`u${i}`] = makeUnit(
      `u${i}`,
      { x: nextInt(rng, W), y: nextInt(rng, H) },
      footprint,
    );
  }
  const obstacleCount = nextInt(rng, 8);
  for (let i = 0; i < obstacleCount; i++) {
    obstacles[`o${i}`] = makeObstacle(
      `o${i}`,
      { x: nextInt(rng, W), y: nextInt(rng, H) },
      nextInt(rng, 2) === 0,
    );
  }
  return { width: W, height: H, units, obstacles } as unknown as GameState;
}

describe('the rewritten board lookups', () => {
  it('agree with the old ones on every cell of a thousand crowded boards', () => {
    const rng = makeRng(20260830);
    let cellsChecked = 0;
    let hits = 0;
    let twoByTwos = 0;

    for (let board = 0; board < 1000; board++) {
      const state = randomState(rng);
      twoByTwos += Object.values(state.units).filter((u) => u.footprint === 2).length;

      // Every cell, plus a ring outside the board: a lookup off the edge has to come back
      // empty rather than matching a 2x2 whose interval arithmetic ran past the bounds.
      for (let y = -1; y <= H; y++) {
        for (let x = -1; x <= W; x++) {
          const c = { x, y };
          cellsChecked++;
          const now = entityAt(state, c);
          const before = oldEntityAt(state, c);
          expect(now?.id, `entityAt(${x},${y}) on board ${board}`).toBe(before?.id);
          expect(unitAt(state, c)?.id, `unitAt(${x},${y}) on board ${board}`).toBe(
            oldUnitAt(state, c)?.id,
          );
          expect(coverAt(state, c)?.id, `coverAt(${x},${y}) on board ${board}`).toBe(
            oldCoverAt(state, c)?.id,
          );
          if (now) hits++;
        }
      }
    }

    // The comparison is worthless if the boards were empty. These bounds only assert the
    // fixture actually built the situation the test claims to cover.
    expect(cellsChecked).toBeGreaterThan(90_000);
    expect(hits, 'the boards were too empty to be comparing anything').toBeGreaterThan(
      cellsChecked / 10,
    );
    expect(twoByTwos, 'no 2x2 bodies were generated, which is the case that matters').
      toBeGreaterThan(500);
  });

  it('still lets a body win the tile it shares with cover', () => {
    // The one rule `entityAt` exists to enforce, asserted directly rather than left to the
    // random boards: attacks and displacement must find the body, not the bush. The
    // rewrite scans units before obstacles precisely to keep this true.
    const unit = makeUnit('body', { x: 3, y: 3 }, 1);
    const bush = makeObstacle('bush', { x: 3, y: 3 }, true);
    const state = {
      width: W,
      height: H,
      units: { body: unit },
      obstacles: { bush },
    } as unknown as GameState;

    expect(entityAt(state, { x: 3, y: 3 })?.id).toBe('body');
    expect(coverAt(state, { x: 3, y: 3 })?.id, 'the bush is still there').toBe('bush');
  });

  it('finds a wall on a tile with no body on it', () => {
    const wall = makeObstacle('wall', { x: 1, y: 1 }, false);
    const state = { width: W, height: H, units: {}, obstacles: { wall } } as unknown as GameState;
    expect(entityAt(state, { x: 1, y: 1 })?.id).toBe('wall');
    expect(coverAt(state, { x: 1, y: 1 }), 'a wall is not cover').toBeUndefined();
  });

  it('covers all four cells of a 2x2 and none of the fifth', () => {
    // The interval arithmetic, stated as a case. `occupies` replaced an enumeration of
    // four coords with two range checks, and getting the corner wrong is the whole risk.
    const big = makeUnit('big', { x: 2, y: 2 }, 2);
    const state = { width: W, height: H, units: { big }, obstacles: {} } as unknown as GameState;
    for (const [x, y] of [
      [2, 2],
      [3, 2],
      [2, 3],
      [3, 3],
    ]) {
      expect(entityAt(state, { x, y })?.id, `(${x},${y}) should be inside the body`).toBe('big');
    }
    for (const [x, y] of [
      [1, 2],
      [4, 2],
      [2, 1],
      [2, 4],
      [4, 4],
      [1, 1],
    ]) {
      expect(entityAt(state, { x, y }), `(${x},${y}) should be outside the body`).toBeUndefined();
    }
  });
});
