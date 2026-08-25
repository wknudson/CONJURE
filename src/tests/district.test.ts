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
  isSafeAt,
  isWalkable,
  extractRects,
  splitRun,
  tileAt,
} from '../district/map.js';
import { AREAS, ASHFALL, areaById } from '../district/areas/index.js';
import { ColliderSet } from '../district/collision.js';

const SPAWN = ASHFALL.spawn;
const DOORS = ASHFALL.props.doors ?? [];
const BOARD_POS = ASHFALL.props.board!;
const VEX_POS = ASHFALL.props.npcs![0]!;
const WARDEN_WAYPOINTS = ASHFALL.props.patrols![0]!;

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

describe('closing the lap', () => {
  // `finishCombat` completes the tutorial whenever `tutorialActive` still reports true.
  // These pin the cases that rule has to get right, since the alternative — keying off
  // which contract was taken — is what left the panel nagging forever in the last one.

  it('closes on a resolved contract however far round the player got', () => {
    expect(tutorialActive(['bounty_taken'])).toBe(true);
    expect(tutorialActive(['intro', 'artificer', 'journal', 'bounty_taken'])).toBe(true);
  });

  it('closes for someone who ignored the Dispatcher and just went to work', () => {
    // Skipping the guided doors and taking a contract still demonstrates the loop. The
    // panel has nothing left to teach them.
    expect(tutorialActive([])).toBe(true);
  });

  it('does not fire twice', () => {
    expect(tutorialActive(ALL)).toBe(false);
    expect(tutorialActive(['bounty_taken', 'complete'])).toBe(false);
  });

  it('leaves a character from before the ward alone', () => {
    // A pre-v20 save migrates in with the whole ledger, so their next fight must not try
    // to complete a lap they were never shown.
    expect(tutorialActive(ALL)).toBe(false);
  });
});

describe('every area', () => {
  // The invariants that must hold wherever the player can walk. Written as a loop rather
  // than against Ashfall because a second area is exactly how the assumptions in here get
  // tested -- the ward was hand-checked, and hand-checking does not survive a third map.
  for (const area of AREAS) {
    describe(area.name, () => {
      it('is rectangular, and every character means something', () => {
        // `defineArea` throws on both, so reaching this test at all is most of the proof.
        // Asserted anyway: the throw happens at import, and an import error reads as "the
        // whole suite is broken" rather than as "this grid is malformed".
        expect(area.grid).toHaveLength(area.rows);
        for (const row of area.grid) expect(row).toHaveLength(area.cols);
        for (const row of area.grid) {
          for (const ch of row) expect(area.legend[ch], ch + ' in ' + area.id).toBeDefined();
        }
      });

      it('puts the player down somewhere they can stand', () => {
        expect(isWalkable(area, area.spawn.x, area.spawn.z), 'spawn').toBe(true);
      });

      it('bounds itself, so nothing walks off the edge', () => {
        expect(isWalkable(area, 0, 9999)).toBe(false);
        expect(isWalkable(area, -9999, 0)).toBe(false);
        expect(tileAt(area, 9999, 9999).walk).toBe(false);
      });

      it('lands every exit somewhere real, and clear of the way back', () => {
        for (const exit of area.exits) {
          const target = areaById(exit.to);
          expect(target, area.id + ' -> ' + exit.to).toBeDefined();
          expect(isWalkable(area, exit.x, exit.z), exit.to + ' hotspot').toBe(true);
          expect(
            isWalkable(target!, exit.arrive.x, exit.arrive.z),
            'arrival in ' + exit.to,
          ).toBe(true);

          // The rule `DoorSpec.returnZ` states in prose: arriving on top of a hotspot
          // re-raises its prompt the instant the screen mounts, so you step out of a gate
          // and are immediately invited back through it.
          const back = target!.exits.find((e) => e.to === area.id);
          if (back) {
            const d = Math.hypot(back.x - exit.arrive.x, back.z - exit.arrive.z);
            expect(d, 'arrival from ' + area.id + ' sits on the way back').toBeGreaterThan(2.6);
          }
        }
      });

      it('can be left from where it puts you down', () => {
        // The trap this caught, and the reason it is phrased as reachability rather than as
        // "the gate is in the right place": the gate mesh used to be derived as a stride
        // north of the hotspot, which is true of the ward's yard wall and false of any
        // doorway facing the other way. In the second area the wall landed between the
        // arrival tile and the way out, so you could walk in and never leave -- with no
        // error, because every individual position was perfectly legal.
        //
        // Walked rather than reasoned about: a straight line from the spawn to each exit,
        // sampled against the same collision the player is subject to.
        const set = new ColliderSet(area);
        for (const c of area.props.crates ?? []) set.add(c.x, c.z, 1.1, 1.1, 'crate');
        for (const exit of area.exits) {
          if (exit.gate) set.add(exit.gate.x, exit.gate.z, 8, 1.2, 'gate');
        }

        for (const exit of area.exits) {
          // A coarse flood from the spawn: if the hotspot is reachable at all, some route
          // of one-unit steps finds it.
          const key = (x: number, z: number): string => `${Math.round(x)},${Math.round(z)}`;
          const seen = new Set<string>([key(area.spawn.x, area.spawn.z)]);
          const queue = [{ x: area.spawn.x, z: area.spawn.z }];
          let found = false;
          while (queue.length > 0 && !found) {
            const at = queue.shift()!;
            if (Math.hypot(at.x - exit.x, at.z - exit.z) < 2.6) {
              found = true;
              break;
            }
            for (const [dx, dz] of [
              [1, 0],
              [-1, 0],
              [0, 1],
              [0, -1],
            ] as const) {
              const nx = at.x + dx;
              const nz = at.z + dz;
              const k = key(nx, nz);
              if (seen.has(k)) continue;
              seen.add(k);
              if (set.blocked(nx, nz, 0.4)) continue;
              queue.push({ x: nx, z: nz });
            }
          }
          expect(found, `${area.id}: cannot walk from the spawn to the ${exit.to} exit`).toBe(true);
        }
      });

      it('stands every prop on ground that exists', () => {
        for (const pk of area.props.packs ?? []) {
          expect(isWalkable(area, pk.x, pk.z), 'pack ' + pk.encounterId).toBe(true);
        }
        for (const l of area.props.lamps ?? []) {
          expect(isWalkable(area, l.x, l.z), 'lamp').toBe(true);
        }
        if (area.props.huntSignpost) {
          const at = area.props.huntSignpost;
          expect(isWalkable(area, at.x, at.z), 'signpost').toBe(true);
        }
      });

      it('agrees with itself about how big it is', () => {
        // The ground span was import-time constants off one global grid. If those ever
        // drift again, the paving, the collision and the baked texture stop describing the
        // same place -- silently, which is the whole reason this is here.
        expect(area.halfX).toBe((area.cols * 4) / 2);
        expect(area.halfZ).toBe((area.rows * 4) / 2);
      });
    });
  }

  it('has unique ids, because a save stores one', () => {
    const ids = AREAS.map((a) => a.id);
    expect(new Set(ids).size, ids.join(', ')).toBe(ids.length);
  });
});

describe('the ward grid', () => {
  it('is square and complete', () => {
    expect(ASHFALL.grid).toHaveLength(20);
    for (const row of ASHFALL.grid) expect(row).toHaveLength(20);
  });

  it('starts the player, the Dispatcher and every door on warded pavement', () => {
    // The whole guided lap has to be walkable without once stepping off the walkway.
    // Leaving it is a choice the player makes, and that is the only way the rule teaches.
    expect(isSafeAt(ASHFALL, SPAWN.x, SPAWN.z), 'spawn').toBe(true);
    expect(isSafeAt(ASHFALL, VEX_POS.x, VEX_POS.z), 'Vex').toBe(true);
    for (const door of DOORS) {
      expect(isSafeAt(ASHFALL, door.x, door.z), door.key).toBe(true);
      expect(isSafeAt(ASHFALL, door.x, door.returnZ), door.key + ' return').toBe(true);
    }
  });

  it('puts the bounty board within reach of the pavement', () => {
    expect(isSafeAt(ASHFALL, BOARD_POS.x, BOARD_POS.z + 2.4)).toBe(true);
  });

  it('keeps the Warden on unpaved ground, where it is allowed to look', () => {
    for (const wp of WARDEN_WAYPOINTS) {
      expect(isWalkable(ASHFALL, wp.x, wp.z), 'waypoint walkable').toBe(true);
      expect(isSafeAt(ASHFALL, wp.x, wp.z), 'waypoint must not be pavement').toBe(false);
    }
  });

  it('has somewhere legal to stand that is not pavement', () => {
    // The restore path asks "can you stand here", not "is this safe", because logging out
    // in an alley is legal and being quietly moved back to the plaza for it is not. This
    // guards the distinction the two questions rest on.
    const alley = { x: 22, z: -2 };
    expect(isWalkable(ASHFALL, alley.x, alley.z)).toBe(true);
    expect(isSafeAt(ASHFALL, alley.x, alley.z)).toBe(false);
  });

  it('keeps a guaranteed-safe fallback for the Warden to return you to', () => {
    // `lastSafePos` is seeded from the spawn whenever the restored spot is not pavement.
    // If the spawn itself were ever unsafe, a catch would drop the player straight back
    // into the cone that caught them.
    expect(isSafeAt(ASHFALL, SPAWN.x, SPAWN.z)).toBe(true);
  });

  it('bounds itself: the canal and everything off the edge are impassable', () => {
    expect(isWalkable(ASHFALL, 0, -38)).toBe(false); // the canal
    expect(isWalkable(ASHFALL, 0, 999)).toBe(false); // off the south edge
    expect(isWalkable(ASHFALL, -999, 0)).toBe(false); // off the west edge
    expect(tileAt(ASHFALL, 999, 999).walk).toBe(false);
  });

  it('reads buildings out of the map rather than beside it', () => {
    const blocks = extractRects(ASHFALL, 'B');
    expect(blocks.length).toBeGreaterThan(0);
    // Every extracted footprint must actually be impassable, or the geometry and the
    // collision would disagree about where a wall is.
    for (const r of blocks) {
      expect(ASHFALL.grid[r.row]![r.col]).toBe('B');
    }
  });

  it('extracts an oblong grid without dropping or repeating anything', () => {
    // `extractRects` allocated a square seen-map off one global GRID, which was correct
    // only for as long as every area was square. An oblong area is what proves it walks
    // rows and columns separately -- and the failure it would have had is silent.
    const verge = areaById('chalk_verge')!;
    expect(verge.cols).not.toBe(verge.rows);
    for (const char of Object.keys(verge.legend)) {
      if (!verge.legend[char]!.solid) continue;
      const rects = extractRects(verge, char);
      let tiles = 0;
      for (const r of rects) {
        tiles += r.w * r.d;
        for (let row = r.row; row < r.row + r.d; row++) {
          for (let col = r.col; col < r.col + r.w; col++) {
            expect(verge.grid[row]![col], 'covered tile is ' + char).toBe(char);
          }
        }
      }
      const inGrid = verge.grid.join('').split(char).length - 1;
      expect(tiles, char + ': covered exactly once').toBe(inGrid);
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
    const set = new ColliderSet(ASHFALL);
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
    const set = new ColliderSet(ASHFALL);
    expect(set.blocked(0, -38)).toBe(true);
  });

  it('respects a disabled collider', () => {
    const set = new ColliderSet(ASHFALL);
    const box = set.add(SPAWN.x, SPAWN.z, 2, 2, 'gate');
    expect(set.blocked(SPAWN.x, SPAWN.z)).toBe(true);
    box.enabled = false;
    expect(set.blocked(SPAWN.x, SPAWN.z)).toBe(false);
  });
});
