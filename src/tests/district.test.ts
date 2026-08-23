/**
 * The ward's pure logic: the guided lap, and the grid it is walked on.
 *
 * Deliberately no three.js and no DOM here — `map.ts`, `quest.ts` and `collision.ts` were
 * split out of the screen precisely so the rules could be asked questions without a canvas.
 */

import { describe, expect, it } from 'vitest';
import type { TutorialFlag } from '../app/save.js';
import {
  LOCKED_REASON,
  bountyAvailable,
  currentObjective,
  pipStates,
  tutorialActive,
} from '../district/quest.js';
import {
  BOARD_POS,
  DOORS,
  SPAWN,
  VEX_POS,
  WARDEN_WAYPOINTS,
  GRID,
  MAP,
  isSafeAt,
  isWalkable,
  extractRects,
  splitRun,
  tileAt,
} from '../district/map.js';
import { ColliderSet } from '../district/collision.js';

const ALL: TutorialFlag[] = ['intro', 'artificer', 'journal', 'bounty_taken', 'complete'];

describe('the guided lap', () => {
  it('opens by pointing at the Dispatcher', () => {
    expect(currentObjective([])).toMatch(/Vex/);
    expect(tutorialActive([])).toBe(true);
  });

  it('walks the doors in the order that teaches, then the board', () => {
    expect(currentObjective(['intro'])).toMatch(/Artificer/);
    expect(currentObjective(['intro', 'artificer'])).toMatch(/Journal/);
    expect(currentObjective(['intro', 'artificer', 'journal'])).toMatch(/Bounty Board/);
  });

  it('cannot be stranded by doing things out of order', () => {
    // A Commander who finds the Journal first has still done the Journal. Every step is
    // checked by presence, so no ordering can leave the panel asking for something twice
    // or for nothing at all.
    const outOfOrder: TutorialFlag[] = ['journal', 'intro'];
    expect(currentObjective(outOfOrder)).toMatch(/Artificer/);
    expect(currentObjective(['journal', 'intro', 'artificer'])).toMatch(/Bounty Board/);
  });

  it('goes away once the lap is walked', () => {
    expect(tutorialActive(ALL)).toBe(false);
    expect(currentObjective(ALL)).toBeNull();
    expect(pipStates(ALL).every((p) => p.lit)).toBe(true);
  });

  it('lights a pip per step taken', () => {
    const pips = pipStates(['intro', 'artificer']);
    expect(pips.find((p) => p.key === 'artificer')!.lit).toBe(true);
    expect(pips.find((p) => p.key === 'journal')!.lit).toBe(false);
  });
});

describe('the board during the lap', () => {
  const affordable = true;

  it('offers the Novice contract and refuses the rest', () => {
    expect(bountyAvailable([], 'novice', false, affordable)).toBe(true);
    expect(bountyAvailable([], 'adept', false, affordable)).toBe(false);
    expect(bountyAvailable([], 'master', false, affordable)).toBe(false);
    expect(bountyAvailable([], 'novice', true, affordable)).toBe(false);
  });

  it('opens everything once the lap is done', () => {
    for (const tier of ['novice', 'adept', 'master']) {
      expect(bountyAvailable(ALL, tier, false, affordable)).toBe(true);
    }
    expect(bountyAvailable(ALL, 'novice', true, affordable)).toBe(true);
  });

  it('lifts the gate rather than trapping a player who cannot cover the stake', () => {
    // The Novice contract is the only posting with a buy-in. Someone who has lost theirs
    // would otherwise be gated to the one fight they can no longer pay for, with no way
    // to earn — so the gate opens instead of closing the last door.
    expect(bountyAvailable([], 'adept', false, false)).toBe(true);
    expect(bountyAvailable([], 'master', false, false)).toBe(true);
  });

  it('says why a contract is greyed out', () => {
    expect(LOCKED_REASON).toMatch(/Novice/);
  });
});

describe('the ward grid', () => {
  it('is square and complete', () => {
    expect(MAP).toHaveLength(GRID);
    for (const row of MAP) expect(row).toHaveLength(GRID);
  });

  it('starts the player, the Dispatcher and every door on warded pavement', () => {
    // The whole guided lap has to be walkable without once stepping off the walkway.
    // Leaving it is a choice the player makes, and that is the only way the rule teaches.
    expect(isSafeAt(SPAWN.x, SPAWN.z), 'spawn').toBe(true);
    expect(isSafeAt(VEX_POS.x, VEX_POS.z), 'Vex').toBe(true);
    for (const door of DOORS) {
      expect(isSafeAt(door.x, door.z), door.key).toBe(true);
      expect(isSafeAt(door.x, door.returnZ), `${door.key} return`).toBe(true);
    }
  });

  it('puts the bounty board within reach of the pavement', () => {
    // The board itself is a prop you cannot stand on, so what matters is that the tile in
    // front of it is walkable and safe.
    expect(isSafeAt(BOARD_POS.x, BOARD_POS.z + 2.4)).toBe(true);
  });

  it('keeps the Warden on unpaved ground, where it is allowed to look', () => {
    for (const wp of WARDEN_WAYPOINTS) {
      expect(isWalkable(wp.x, wp.z), `${wp.x},${wp.z} walkable`).toBe(true);
      expect(isSafeAt(wp.x, wp.z), `${wp.x},${wp.z} must not be pavement`).toBe(false);
    }
  });

  it('bounds itself: the canal and everything off the edge are impassable', () => {
    expect(isWalkable(0, -38)).toBe(false); // the canal
    expect(isWalkable(0, 999)).toBe(false); // off the south edge
    expect(isWalkable(-999, 0)).toBe(false); // off the west edge
    expect(tileAt(999, 999).walk).toBe(false);
  });

  it('reads buildings out of the map rather than beside it', () => {
    const blocks = extractRects('B');
    expect(blocks.length).toBeGreaterThan(0);
    // Every extracted footprint must actually be impassable, or the geometry and the
    // collision would disagree about where a wall is.
    for (const r of blocks) {
      expect(MAP[r.row]![r.col]).toBe('B');
    }
  });

  it('splits long terraces so the skyline is not one slab', () => {
    expect(splitRun(6)).toEqual([
      [0, 3],
      [3, 3],
    ]);
    expect(splitRun(4)).toEqual([
      [0, 2],
      [2, 2],
    ]);
    expect(splitRun(2)).toEqual([[0, 2]]);
    // Whatever the length, the pieces tile it exactly.
    for (let len = 1; len <= 12; len++) {
      const parts = splitRun(len);
      expect(parts.reduce((a, [, w]) => a + w, 0)).toBe(len);
    }
  });
});

describe('collision', () => {
  it('slides along a wall instead of sticking to it', () => {
    const set = new ColliderSet();
    // A wall running north–south just east of the spawn: thin across the direction of
    // travel, long along it, so pushing into it blocks X and leaves Z free.
    set.add(SPAWN.x + 1, SPAWN.z, 0.5, 6, 'wall');
    const pos = { x: SPAWN.x, z: SPAWN.z };
    // Pushing diagonally into it: the blocked axis is dropped, the free one still moves.
    set.move(pos, 1, 0.5);
    expect(pos.x, 'stopped by the wall').toBe(SPAWN.x);
    expect(pos.z, 'still slid along it').toBeGreaterThan(SPAWN.z);
  });

  it('will not let a body stand in the canal', () => {
    const set = new ColliderSet();
    expect(set.blocked(0, -38)).toBe(true);
  });

  it('respects a disabled collider', () => {
    const set = new ColliderSet();
    const box = set.add(SPAWN.x, SPAWN.z, 2, 2, 'gate');
    expect(set.blocked(SPAWN.x, SPAWN.z)).toBe(true);
    box.enabled = false;
    expect(set.blocked(SPAWN.x, SPAWN.z)).toBe(false);
  });
});
