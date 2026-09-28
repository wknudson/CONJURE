/**
 * Finding a way round: the nav grid, its paths, and its sense of what is connected to what.
 *
 * A small yard drawn for the purpose first -- a wall to go round and a pocket that cannot be
 * reached -- and then every real area, built from the same footprints the world builds its
 * colliders from, so a route the grid offers is a route the collider layer will let a body walk.
 */

import { describe, expect, it } from 'vitest';
import { defineArea, xOfCol, zOfRow, type TileDef } from '../district/map.js';
import { ColliderSet } from '../district/collision.js';
import { NavAgent, NavGrid } from '../district/nav.js';
import { AREAS } from '../district/areas/index.js';
import { staticFootprints } from '../district/footprints.js';

const LEGEND: Record<string, TileDef> = {
  '.': { tex: 'chalk', safe: false, walk: true },
  R: { tex: 'cobble', safe: false, walk: false, solid: { minHeight: 3, maxHeight: 3, inset: 0, depthInset: 0, chimneyChance: 0, split: false } },
};

/**
 * Twelve by seven. A wall down column 5 with one gap at the bottom row, and a sealed box in the
 * top-right corner with a single open tile inside it.
 */
const YARD = defineArea({
  id: 'nav_yard',
  name: 'Nav yard',
  grid: [
    '.....R...RRR', //  0
    '.....R...R.R', //  1
    '.....R...RRR', //  2
    '.....R......', //  3
    '.....R......', //  4
    '.....R......', //  5
    '............', //  6
  ],
  legend: LEGEND,
  spawn: { x: 0, z: 0 },
  exits: [],
  safety: 'none',
  props: {},
});

const at = (col: number, row: number): { x: number; z: number } => ({ x: xOfCol(YARD, col), z: zOfRow(YARD, row) });

function colliders(area = YARD): ColliderSet {
  const set = new ColliderSet(area);
  for (const f of staticFootprints(area)) set.add(f.x, f.z, f.w, f.d, f.tag);
  return set;
}

describe('the nav grid', () => {
  const set = colliders();
  const nav = new NavGrid(set);

  it('goes round the wall, through the gap, on ground a body can walk', () => {
    const a = at(2, 0);
    const b = at(8, 0);
    expect(nav.lineClear(a.x, a.z, b.x, b.z), 'the wall is in the way').toBe(false);
    const route = nav.path(a.x, a.z, b.x, b.z);
    expect(route).not.toBeNull();
    // Every leg is straight and clear, and the whole of it can be walked by the colliders.
    let from = a;
    let length = 0;
    for (const p of route!) {
      expect(nav.lineClear(from.x, from.z, p.x, p.z), `leg to ${p.x},${p.z}`).toBe(true);
      for (let t = 0; t <= 1; t += 0.05) {
        expect(set.blocked(from.x + (p.x - from.x) * t, from.z + (p.z - from.z) * t, 0.4)).toBe(false);
      }
      length += Math.hypot(p.x - from.x, p.z - from.z);
      from = p;
    }
    expect(from).toEqual(b);
    // Down to the gap and back up: much longer than the crow flies.
    expect(length).toBeGreaterThan(Math.hypot(b.x - a.x, b.z - a.z) * 2);
    // Pulled tight: a handful of corners, not a staircase of cells.
    expect(route!.length).toBeLessThanOrEqual(4);
  });

  it('refuses a place nothing can reach, and says so without searching', () => {
    const inside = at(10, 1);
    const outside = at(10, 5);
    expect(nav.walkable(inside.x, inside.z), 'the pocket is floor').toBe(true);
    expect(nav.connected(inside.x, inside.z, outside.x, outside.z)).toBe(false);
    expect(nav.path(outside.x, outside.z, inside.x, inside.z)).toBeNull();
  });

  it('moves a goal on a wall to the floor beside it', () => {
    const a = at(2, 3);
    const wall = at(5, 3);
    const route = nav.path(a.x, a.z, wall.x, wall.z);
    expect(route).not.toBeNull();
    const end = route![route!.length - 1]!;
    expect(nav.walkable(end.x, end.z)).toBe(true);
    expect(Math.hypot(end.x - wall.x, end.z - wall.z)).toBeLessThan(3);
  });

  it('lays its waypoints on the main ground only', () => {
    const wps = nav.waypoints(8);
    expect(wps.length).toBeGreaterThan(4);
    for (const p of wps) expect(nav.componentAt(p.x, p.z)).toBe(nav.mainComponent);
  });

  it('walks an agent round the wall, a step at a time', () => {
    const agent = new NavAgent();
    const pos = at(2, 0);
    const goal = at(8, 0);
    let steps = 0;
    while (Math.hypot(goal.x - pos.x, goal.z - pos.z) > 0.5 && steps < 2000) {
      const p = agent.next(nav, pos.x, pos.z, goal.x, goal.z, 0.05);
      const dx = p.x - pos.x;
      const dz = p.z - pos.z;
      const d = Math.hypot(dx, dz);
      if (d > 0.001) set.move(pos, (dx / d) * 0.2, (dz / d) * 0.2, 0.4);
      steps++;
    }
    expect(Math.hypot(goal.x - pos.x, goal.z - pos.z), `stuck at ${pos.x},${pos.z}`).toBeLessThanOrEqual(0.5);
  });
});

describe('every area has ground to hunt across', () => {
  for (const area of AREAS) {
    it(`${area.id}: every pack's home, every Warden post and the spawn are on one piece of ground`, () => {
      const nav = new NavGrid(colliders(area));
      const spots = [
        area.spawn,
        ...(area.props.packs ?? []).map((p) => ({ x: p.x, z: p.z })),
        ...(area.props.patrols ?? []).flat(),
      ];
      for (const s of spots) {
        // A spot on the edge of a cell may round onto the wall; a stride is close enough.
        const p = nav.walkable(s.x, s.z) ? s : nav.nearestOpen(s.x, s.z, 2);
        expect(p, `${area.id}: nothing open near ${s.x},${s.z}`).not.toBeNull();
        expect(nav.connected(p!.x, p!.z, area.spawn.x, area.spawn.z), `${area.id}: ${s.x},${s.z} is cut off`).toBe(true);
      }
    });
  }

  it('paints the grid that asking every cell would have given', () => {
    // The grid is painted -- tiles, then boxes -- rather than asked of `blocked` cell by cell,
    // which is what made it quick. Held to the old answer everywhere it is quick to hold it:
    // the three biggest maps, where the boxes are thickest, and a room, where they are closest.
    const sized = [...AREAS].sort((a, b) => b.cols * b.rows - a.cols * a.rows);
    const room = AREAS.find((a) => a.indoor && (a.props.npcs?.length ?? 0) > 0)!;
    for (const area of [...sized.slice(0, 3), room]) {
      const set = colliders(area);
      const nav = new NavGrid(set);
      for (let z = -area.halfZ + 0.5; z < area.halfZ; z += 1) {
        for (let x = -area.halfX + 0.5; x < area.halfX; x += 1) {
          if (nav.walkable(x, z) === !set.blocked(x, z, 0.45)) continue;
          expect.fail(`${area.id}: the painted grid and the asked one disagree at ${x},${z}`);
        }
      }
    }
  });

  it('builds the grid for the largest area quickly enough to do at every crossing', () => {
    const biggest = [...AREAS].sort((a, b) => b.cols * b.rows - a.cols * a.rows)[0]!;
    const set = colliders(biggest);
    const t0 = performance.now();
    new NavGrid(set);
    expect(performance.now() - t0, biggest.id).toBeLessThan(250);
  });
});
