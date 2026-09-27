/**
 * What a pack does when it is not hunting you, and how it comes to be.
 *
 * The four ways of passing the time -- roam, beat, sentry, prowl -- and the ladder from not
 * having seen you to running at you: suspicion at the edge of sight, alarm up close, the chase,
 * and the search that follows losing you. Real `Pack`s driven by real frames, on yards drawn for
 * the purpose so every expectation can be read off the grid.
 */

import { describe, expect, it } from 'vitest';
import { Pack } from '../district/entities.js';
import { ColliderSet } from '../district/collision.js';
import { NavGrid } from '../district/nav.js';
import { defineArea, xOfCol, zOfRow, type AreaDef, type TileDef } from '../district/map.js';
import { LOOK } from '../district/look.js';
import { buildActorArt, type ActorArt } from '../district/sprites3d.js';

const LEGEND: Record<string, TileDef> = {
  '.': { tex: 'chalk', safe: false, walk: true },
  R: { tex: 'cobble', safe: false, walk: false, solid: { minHeight: 3, maxHeight: 3, inset: 0, depthInset: 0, chimneyChance: 0, split: false } },
};

const area = (grid: string[]): AreaDef =>
  defineArea({ id: 'yard', name: 'Yard', grid, legend: LEGEND, spawn: { x: 0, z: 0 }, exits: [], safety: 'none', props: {} });

/** Sixteen by ten, open. */
const OPEN = area(Array.from({ length: 10 }, () => '.'.repeat(16)));
/** Twelve by seven: a wall down column 5 with the only gap in the bottom row. */
const WALLED = area([
  '.....R......',
  '.....R......',
  '.....R......',
  '.....R......',
  '.....R......',
  '.....R......',
  '............',
]);

const img = (tag: string): HTMLImageElement => ({ tag, width: 136, height: 361 }) as unknown as HTMLImageElement;
const art = (): ActorArt =>
  buildActorArt({ front: img('f'), back: img('b'), side: img('s'), sideWalk: [img('w0'), img('w1'), img('w2'), img('w3')] }, 1);

/** A seeded roll, so a wander goes the same way every run. */
function rolls(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function run(p: Pack, seconds: number, each?: () => void): void {
  for (let t = 0; t < seconds; t += 0.05) {
    p.update(0.05, t, 0);
    each?.();
  }
}

/** The player nowhere near, so a pack goes about its business. */
function away(p: Pack): Pack {
  p.playerAt.set(500, 0, 500);
  p.playerSafe = false;
  return p;
}

describe('a beat', () => {
  it('walks its posts in order and comes round again', () => {
    const a = OPEN;
    const route = [
      { x: xOfCol(a, 2), z: zOfRow(a, 2) },
      { x: xOfCol(a, 13), z: zOfRow(a, 2) },
      { x: xOfCol(a, 13), z: zOfRow(a, 7) },
    ];
    const p = away(new Pack('pack_chalk_scavengers', art(), 1.9, route[0]!.x, route[0]!.z, 4, new ColliderSet(a), rolls(1), { behaviour: 'beat', route }));
    const nearest = route.map(() => Infinity);
    const order: number[] = [];
    run(p, 60, () => {
      route.forEach((r, i) => {
        const d = Math.hypot(p.position.x - r.x, p.position.z - r.z);
        nearest[i] = Math.min(nearest[i]!, d);
        if (d < 0.8 && order[order.length - 1] !== i) order.push(i);
      });
    });
    for (const d of nearest) expect(d).toBeLessThan(0.8);
    // In order, and more than once round.
    expect(order.slice(0, 4)).toEqual([0, 1, 2, 0]);
  });
});

describe('a sentry', () => {
  it('holds its post and sweeps between its two headings', () => {
    const a = OPEN;
    const at = { x: xOfCol(a, 8), z: zOfRow(a, 5) };
    const p = away(new Pack('pack_chalk_scavengers', art(), 1.9, at.x, at.z, 4, new ColliderSet(a), rolls(2), { behaviour: 'sentry', sweep: [-1, 1] }));
    // Asked for sight by walking a player round it at a fixed distance: what it can see is a
    // record of which way it was facing.
    let lookedLeft = false;
    let lookedRight = false;
    run(p, 14, () => {
      expect(Math.hypot(p.position.x - at.x, p.position.z - at.z), 'it left its post').toBeLessThan(0.8);
      for (const [angle, flag] of [
        [-1, 'l'],
        [1, 'r'],
      ] as const) {
        // A spot straight along each end of the sweep, inside its range.
        p.playerAt.set(at.x + Math.sin(angle) * 3, 0, at.z + Math.cos(angle) * 3);
        if (p.sees()) {
          if (flag === 'l') lookedLeft = true;
          else lookedRight = true;
        }
      }
      p.playerAt.set(500, 0, 500);
    });
    expect(lookedLeft, 'it never looked one way').toBe(true);
    expect(lookedRight, 'it never looked the other').toBe(true);
  });
});

describe('a prowler', () => {
  it('ranges over the whole area, not a patch of it', () => {
    const a = OPEN;
    const set = new ColliderSet(a);
    const nav = new NavGrid(set);
    const start = { x: xOfCol(a, 1), z: zOfRow(a, 1) };
    const p = away(new Pack('pack_chalk_scavengers', art(), 1.9, start.x, start.z, 4, set, rolls(3), { behaviour: 'prowl', nav }));
    let furthest = 0;
    run(p, 90, () => {
      furthest = Math.max(furthest, Math.hypot(p.position.x - start.x, p.position.z - start.z));
    });
    // A roaming pack with a radius of four never gets further than four from home.
    expect(furthest).toBeGreaterThan(30);
  });
});

describe('noticing you', () => {
  const rangeAt = (k: number): number => LOOK.packVisionRange * k;

  it('is only suspicious at the edge of its sight, and makes up its mind if you stay', () => {
    const p = new Pack('pack_chalk_scavengers', art(), 1.9, 0, 0, 0.01, new ColliderSet(OPEN), rolls(4));
    p.playerAt.set(0, 0, rangeAt(0.92));
    p.playerSafe = false;
    run(p, 0.1);
    expect(p.state).toBe('SUSPICIOUS');
    expect(p.mark).toBe('?');
    run(p, 1.5);
    expect(['ALERT', 'CHASE']).toContain(p.state);
  });

  it('knows at once when you are close', () => {
    const p = new Pack('pack_chalk_scavengers', art(), 1.9, 0, 0, 0.01, new ColliderSet(OPEN), rolls(5));
    p.playerAt.set(0, 0, rangeAt(0.4));
    p.playerSafe = false;
    run(p, 0.1);
    expect(p.state).toBe('ALERT');
    expect(p.mark).toBe('!');
  });

  it('forgets you if you get out of sight before it decides', () => {
    const p = new Pack('pack_chalk_scavengers', art(), 1.9, 0, 0, 0.01, new ColliderSet(OPEN), rolls(6));
    p.playerAt.set(0, 0, rangeAt(0.95));
    p.playerSafe = false;
    run(p, 0.15);
    expect(p.state).toBe('SUSPICIOUS');
    p.playerAt.set(0, 0, rangeAt(3));
    run(p, 3);
    expect(p.state).toBe('ROAM');
    expect(p.mark).toBeNull();
  });
});

describe('losing you', () => {
  it('goes to where it last saw you, looks round, and gives up', () => {
    const a = OPEN;
    const p = new Pack('pack_chalk_scavengers', art(), 1.9, xOfCol(a, 8), zOfRow(a, 2), 0.01, new ColliderSet(a), rolls(7));
    const seenAt = { x: xOfCol(a, 8), z: zOfRow(a, 2) + 3 };
    p.playerAt.set(seenAt.x, 0, seenAt.z);
    p.playerSafe = false;
    run(p, 0.5);
    expect(p.state).toBe('CHASE');
    // Gone: far away, and out of its sight for good.
    p.playerAt.set(500, 0, 500);
    let searched = false;
    let reached = Infinity;
    run(p, 12, () => {
      if (p.state === 'SEARCH') {
        searched = true;
        reached = Math.min(reached, Math.hypot(p.position.x - seenAt.x, p.position.z - seenAt.z));
      }
    });
    expect(searched, 'it never looked for you').toBe(true);
    expect(reached, 'it never went to the spot').toBeLessThan(2.5);
    expect(p.state, 'and then went back to its business').toBe('ROAM');
  });
});

describe('a chase round a wall', () => {
  const a = WALLED;
  const from = { x: xOfCol(a, 3), z: zOfRow(a, 1) };
  const to = { x: xOfCol(a, 7), z: zOfRow(a, 1) };

  function chase(withNav: boolean): boolean {
    const set = new ColliderSet(a);
    const p = new Pack('pack_chalk_scavengers', art(), 1.9, from.x, from.z, 0.01, set, rolls(8), withNav ? { nav: new NavGrid(set) } : {});
    let caught = false;
    p.onContact = () => void (caught = true);
    p.playerAt.set(to.x, 0, to.z);
    p.playerSafe = false;
    p.answerTheCall(to.x, to.z);
    run(p, 15, () => {
      if (caught) return;
    });
    return caught;
  }

  it('goes down to the gap and round, with the ground to go by', () => {
    expect(chase(true)).toBe(true);
  });

  it('grinds against the wall without it, which is what it used to do', () => {
    expect(chase(false)).toBe(false);
  });
});
