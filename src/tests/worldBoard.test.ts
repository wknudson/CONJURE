/**
 * Where a fight fits, and the promise that it fits *there*.
 *
 * The combat board is snapped onto real district tiles, which means the placement rule is
 * the one piece of this feature that can fail in a way no amount of polish hides: a grid laid
 * across a warehouse, or half of it in the canal. It is also pure, and the grids are small,
 * so the nearest-clear-window claim can be checked exhaustively rather than sampled.
 *
 * Every area is crossed with every encounter footprint the game actually ships, so a new area
 * with a tight layout — or an encounter that grows a row — fails here rather than on the road.
 * What is *promised* is scoped to what is reachable: an area must cleanly seat the fights that
 * can start in it, and everywhere else the fallback must stay small enough to read as the ward
 * dimming rather than as a grid drawn through a wall.
 */

import { describe, expect, it } from 'vitest';
import { AREAS } from '../district/areas/index.js';
import { boardAt, overlappedRects, placeBoard } from '../district/combat/WorldBoard.js';
import { ENCOUNTERS } from '../core/data/encounters/index.js';
import { PACKS } from '../core/data/packs.js';
import { TILE, colOf, extractRects, rowOf, type AreaDef } from '../district/map.js';

/** Every distinct footprint an encounter asks for, largest first. */
const SIZES = [...new Set(ENCOUNTERS.map((e) => `${e.width}x${e.height}`))]
  .map((s) => {
    const [w, h] = s.split('x').map(Number);
    return { w: w!, h: h! };
  })
  .sort((a, b) => b.w * b.h - a.w * a.h);

/** Whether a district tile would ruin a board standing on it. */
function bad(area: AreaDef, col: number, row: number): boolean {
  if (col < 0 || row < 0 || col >= area.cols || row >= area.rows) return true;
  const def = area.legend[area.grid[row]![col]!];
  return !def || !!def.solid || def.tex === 'water';
}

/** Brute force: every clear window of this size. */
function cleanWindows(area: AreaDef, w: number, h: number): { col: number; row: number }[] {
  const out: { col: number; row: number }[] = [];
  for (let row = 0; row + h <= area.rows; row++) {
    for (let col = 0; col + w <= area.cols; col++) {
      let ok = true;
      for (let r = 0; r < h && ok; r++) {
        for (let c = 0; c < w && ok; c++) if (bad(area, col + c, row + r)) ok = false;
      }
      if (ok) out.push({ col, row });
    }
  }
  return out;
}

/** The arena every roaming pack fights in. One size for all of them; see encounters/packs.ts. */
const PACK_ARENA = (() => {
  const enc = ENCOUNTERS.find((e) => e.id === PACKS[0]!.encounterId)!;
  return { w: enc.width, h: enc.height };
})();

describe('the fight a road can actually start, fits on that road', () => {
  it('seats the pack arena cleanly in every area that roams packs', () => {
    // The load-bearing claim of the whole feature, and deliberately scoped to what is
    // *reachable*. Every pack shares one arena size, and an area with packs in it must be
    // able to seat that arena with nothing standing in the middle of it.
    //
    // Not asserted of every area against every encounter, because that is a promise the
    // world does not make: Ashfall is the dense hub, it roams no packs, and the only fight
    // that starts there is the Warden's — covered separately below. Demanding a clean 8x8
    // somewhere in a ward that is four terraces and a cross-street would be a test dictating
    // level design to satisfy a case that never occurs.
    for (const area of AREAS) {
      if (!area.props.packs?.length) continue;
      for (const spec of area.props.packs) {
        const board = placeBoard(area, { x: spec.x, z: spec.z }, PACK_ARENA.w, PACK_ARENA.h);
        expect(
          board.clean,
          `${area.id}: ${spec.encounterId} cannot seat a clean ${PACK_ARENA.w}x${PACK_ARENA.h} board`,
        ).toBe(true);
        expect(board.blockers).toHaveLength(0);
      }
    }
  });

  it('never puts a board on a building or in the water', () => {
    for (const area of AREAS) {
      for (const { w, h } of SIZES) {
        const board = placeBoard(area, { x: area.spawn.x, z: area.spawn.z }, w, h);
        if (!board.clean) continue; // the fallback is allowed to overlap; see below
        for (let r = 0; r < h; r++) {
          for (let c = 0; c < w; c++) {
            expect(
              bad(area, board.col + c, board.row + r),
              `${area.id} ${w}x${h}: tile (${board.col + c},${board.row + r}) is not arena`,
            ).toBe(false);
          }
        }
      }
    }
  });

  it('keeps the fallback to a corner, even in the densest ward', () => {
    // Where a clean window genuinely does not exist, what matters is *how much* has to be
    // faded. Ashfall's worst case for the pack arena is three tiles of forty-two — the corner
    // of one terrace — which reads as the ward dimming around the fight. A future area that
    // could only ever seat a board across half a warehouse fails here, loudly, rather than
    // shipping as a grid drawn through a wall.
    const WORST = 0.15;
    for (const area of AREAS) {
      for (const { w, h } of SIZES) {
        const board = placeBoard(area, { x: area.spawn.x, z: area.spawn.z }, w, h);
        const share = board.blockers.length / (w * h);
        expect(
          share,
          `${area.id} ${w}x${h}: ${board.blockers.length}/${w * h} tiles blocked`,
        ).toBeLessThanOrEqual(WORST);
      }
    }
  });
});

describe('it picks the nearest clear window, not merely a clear one', () => {
  it('beats or matches every other clean window on distance', () => {
    // Checked against brute force rather than against a remembered answer, so this stays a
    // statement about the rule instead of a snapshot of one grid.
    for (const area of AREAS) {
      for (const { w, h } of SIZES) {
        const windows = cleanWindows(area, w, h);
        if (windows.length === 0) continue;

        // Several probes per area, including corners, so the search is exercised rather than
        // only the middle of the map.
        const probes = [
          { x: area.spawn.x, z: area.spawn.z },
          { x: -area.halfX + TILE, z: -area.halfZ + TILE },
          { x: area.halfX - TILE, z: area.halfZ - TILE },
          { x: 0, z: 0 },
        ];

        for (const at of probes) {
          const board = placeBoard(area, at, w, h);
          expect(board.clean, `${area.id} ${w}x${h} near (${at.x},${at.z})`).toBe(true);

          const distanceOf = (col: number, row: number): number => {
            const c = boardAt(area, col, row, w, h).centre();
            return Math.hypot(c.x - at.x, c.z - at.z);
          };
          const chosen = distanceOf(board.col, board.row);
          const nearest = Math.min(...windows.map((v) => distanceOf(v.col, v.row)));
          expect(chosen, `${area.id} ${w}x${h} chose a further window`).toBeCloseTo(nearest, 6);
        }
      }
    }
  });
});

describe('the fallback is honest about what it could not avoid', () => {
  it('names its blockers rather than overlapping in silence', () => {
    // Forced: a board far larger than any area, so no clean window can exist.
    const area = AREAS[0]!;
    const board = placeBoard(area, { x: 0, z: 0 }, area.cols + 4, area.rows + 4);

    expect(board.clean).toBe(false);
    expect(board.blockers.length, 'it says what is in the way').toBeGreaterThan(0);
    // And it is specific about why, so the caller knows whether a mesh exists to fade.
    expect(board.blockers.some((b) => b.reason === 'out-of-bounds')).toBe(true);
  });

  it('hands back the whole buildings a footprint crosses, not just the tiles', () => {
    // The tile list says *that* something is there; the caller needs *which* mesh to fade,
    // in the same rectangles `world.ts` built the geometry from.
    const area = AREAS[0]!;
    // A building character, taken from the legend rather than assumed.
    const solidChar = Object.keys(area.legend).find((ch) => area.legend[ch]!.solid)!;
    const rects = extractRects(area, solidChar);
    expect(rects.length, 'the fixture area has buildings to cross').toBeGreaterThan(0);

    // A board covering the whole area must cross every one of them.
    const whole = boardAt(area, 0, 0, area.cols, area.rows);
    expect(overlappedRects(whole, rects)).toHaveLength(rects.length);

    // And one placed cleanly must cross none. Asked of an area that can genuinely seat the
    // arena — in the hub ward every 7x6 window clips a terrace corner, which is the case the
    // fallback exists for and the wrong place to assert its absence.
    const open = AREAS.find((a) => a.props.packs?.length)!;
    const openRects = extractRects(open, Object.keys(open.legend).find((ch) => open.legend[ch]!.solid)!);
    const clean = placeBoard(open, { x: open.spawn.x, z: open.spawn.z }, PACK_ARENA.w, PACK_ARENA.h);
    expect(clean.clean).toBe(true);
    expect(overlappedRects(clean, openRects)).toHaveLength(0);
  });
});

describe('the transform agrees with the district grid it is laid on', () => {
  it('maps combat tile (0,0) onto the district tile it claims', () => {
    for (const area of AREAS) {
      const board = placeBoard(area, { x: area.spawn.x, z: area.spawn.z }, 6, 8);
      const origin = board.centreOf({ x: 0, y: 0 });
      expect(colOf(area, origin.x)).toBe(board.col);
      expect(rowOf(area, origin.z)).toBe(board.row);

      const far = board.centreOf({ x: 5, y: 7 });
      expect(colOf(area, far.x)).toBe(board.col + 5);
      expect(rowOf(area, far.z)).toBe(board.row + 7);
    }
  });

  it('steps exactly one tile per tile, and centres between the ends', () => {
    const area = AREAS[0]!;
    const board = boardAt(area, 2, 2, 6, 8);
    const a = board.centreOf({ x: 0, y: 0 });
    const b = board.centreOf({ x: 1, y: 1 });
    expect(b.x - a.x).toBeCloseTo(TILE);
    expect(b.z - a.z).toBeCloseTo(TILE);

    const mid = board.centre();
    const end = board.centreOf({ x: 5, y: 7 });
    expect(mid.x).toBeCloseTo((a.x + end.x) / 2);
    expect(mid.z).toBeCloseTo((a.z + end.z) / 2);
  });

  it('carries a fractional position, for a body mid-step', () => {
    // The animation handlers tween `pos` between tiles; a transform that only accepted whole
    // indices would snap every move.
    const board = boardAt(AREAS[0]!, 0, 0, 6, 8);
    const half = board.centreOf({ x: 0.5, y: 0 });
    const zero = board.centreOf({ x: 0, y: 0 });
    expect(half.x - zero.x).toBeCloseTo(TILE / 2);
  });
});
